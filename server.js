const express = require('express');
let compression;
try {
  compression = require('compression');
} catch (e) {
  console.log('[Notice] "compression" module not found. Continuing without HTTP compression.');
}
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const UserDB = require('./server/user-db');
const RoomManager = require('./server/room-manager');
const GameEngine = require('./server/game-engine');
const AIEngine = require('./server/ai-engine');
const { callLLMProvider } = require('./server/llm-provider');
const { generateLLMPrompt } = require('./server/prompt-generator');

const app = express();

// 1. Enable Gzip/Brotli compression if installed
if (compression) {
  app.use(compression());
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'], // Prioritizes WebSocket immediately
  perMessageDeflate: {
    threshold: 1024 // Compresses WebSocket frames exceeding 1 KB
  }
});

// 2. Cache static assets (images, audio, css, js) for 1 day so browsers don't re-download them repeatedly
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  immutable: true
}));

// Serve the root favicon.ico (kept at the project root, outside public/) with
// caching so it is fetched once per visit.
app.get('/favicon.ico', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'favicon.ico'), (err) => {
    if (err && !res.headersSent) {
      res.status(404).end();
    }
  });
});

// Default route (Express 5 compatibility wildcard)
app.get('*any', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to broadcast room state updates
function broadcastState(roomCode) {
  const room = RoomManager.getRoom(roomCode);
  if (room && room.gameState) {
    io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
  }
}

// Finished-game rooms are fully reaped after this long (frees the full
// gameState + chat archive kept in memory for finished matches).
RoomManager.startRoomCleanup();

// Bootstrap AI watchdog behavior on first connection.
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  RoomManager.initAIWatchdog(io);

  // 1. Create Room
  socket.on('createRoom', ({ mapData, playerName, playerColor, accountId }, callback) => {
    try {
      if (!mapData || !mapData.territories || mapData.territories.length === 0) {
        return callback({ error: 'Invalid map data' });
      }
      const room = RoomManager.createRoom(socket.id, playerName, playerColor, mapData);
      room.io = io;
      if (accountId && room.players[0]) {
        room.players[0].accountId = accountId;
        const acc = UserDB.getSafeUser(UserDB.loadUsers()[accountId.toLowerCase()]);
        if (acc) {
          room.players[0].level = acc.level || 1;
          room.players[0].battleCard = acc.battleCard || { theme: 'default', option: 1, showcasedBadges: [] };
        }
      }
      socket.join(room.code);
      console.log(`Room created: ${room.code} by ${playerName} (Account: ${accountId || 'Guest'})`);
      callback({ success: true, roomCode: room.code, players: room.players });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to create room' });
    }
  });
  socket.on('watchAIBattle', ({ mapData, aiCount, gameMode, asNormalMap, disableNations, honorPremadeAlliances, disabledNationIds, cardTradeRule, generativeAIMode, llmProviderConfig, reqBlizzardCount, reqStartingNukes, reqStartingThermonukes, reqAllowCrafting }, callback) => {
    try {
      if (!mapData) return callback({ error: 'Invalid map data' });

      let embeddedGameState = null;
      let rawMap = mapData;

      if (mapData && mapData.mapData && mapData.gameState) {
        embeddedGameState = mapData.gameState;
        rawMap = mapData.mapData;
      } else if (mapData && mapData.gameState) {
        embeddedGameState = mapData.gameState;
      }

      if (!rawMap || !rawMap.territories || rawMap.territories.length === 0) {
        return callback({ error: 'Invalid map data' });
      }

      const count = Math.min(24, Math.max(2, parseInt(aiCount) || 4));
      const activeMapData = asNormalMap ? { ...rawMap, isScenario: false, nations: [] } : rawMap;

      // Create a ghost host room
      const personalities = ['normal', 'strategic', 'kind', 'goofball', 'cynical', 'aggressive'];
      const aiNames = [
        'Atlas', 'Nero', 'Zara', 'Odin', 'Kira', 'Rex', 'Lyra', 'Drake',
        'Vulkan', 'Athena', 'Titus', 'Freya', 'Kratos', 'Scylla', 'Ares', 'Valkyrie',
        'Titan', 'Xerxes', 'Ragnar', 'Hera', 'Loki', 'Leonidas', 'Boreas', 'Nyx',
        'Orion', 'Solon', 'Balthazar', 'Cassandra', 'Darius', 'Elysia', 'Gideon', 'Helios'
      ];
      const aiColors = [
        '#ff3366', '#33ff66', '#3366ff', '#ffcc00', '#ff00ff', '#00ffff', '#ff9900', '#ff6633',
        '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6',
        '#f97316', '#6366f1', '#84cc16', '#e11d48', '#0284c7', '#d97706', '#7c3aed', '#059669'
      ];

      const room = RoomManager.createRoom('__spectator__', 'Spectator', '#888888', activeMapData);
      room.players = [];
      room.hostId = socket.id;
      if (asNormalMap) room.asNormalMap = true;
      if (disableNations) room.disableNations = true;
      room.honorPremadeAlliances = honorPremadeAlliances !== false;
      room.disabledNationIds = Array.isArray(disabledNationIds) ? disabledNationIds : [];
      room.cardTradeRule = cardTradeRule === 'fixed' ? 'fixed' : 'progressive';
      room.generativeAIMode = !!generativeAIMode;

      // Bind Blizzard & Nuke options
      room.blizzardCount = parseInt(reqBlizzardCount) || 0;
      room.startingNukes = parseInt(reqStartingNukes) || 0;
      room.startingThermonukes = parseInt(reqStartingThermonukes) || 0;
      room.allowCrafting = reqAllowCrafting === true;
      if (llmProviderConfig) {
        room.llmProviderConfig = {
          provider: llmProviderConfig.provider || 'clipboard',
          apiKey: llmProviderConfig.apiKey || ''
        };
        if (llmProviderConfig.delay) {
          room.llmDelay = parseInt(llmProviderConfig.delay) || 3000;
        }
      }

      if (embeddedGameState && embeddedGameState.territories && embeddedGameState.turnIndex !== undefined) {
        room.gameState = JSON.parse(JSON.stringify(embeddedGameState));
        room.gameState.mapData = activeMapData;
        room.gameState.generativeAIMode = room.generativeAIMode;
        if (room.gameState.players && room.gameState.players.length > 0) {
          room.players = room.gameState.players.map(p => ({ ...p }));
        }
        room.status = 'PLAYING';
        socket.join(room.code);

        GameEngine.addLog(room.gameState, `💾 Scenario match in progress restored! Turn: ${room.gameState.turnIndex + 1}.`);

        const sanitizedState = RoomManager.getSanitizedGameState(room.gameState);
        sanitizedState.mapData = activeMapData;
        sanitizedState.generativeAIMode = room.generativeAIMode;

        io.to(room.code).emit('gameStarted', {
          roomCode: room.code,
          mapData: activeMapData,
          gameState: sanitizedState,
          spectatorMode: true
        });
        io.to(room.code).emit('gameStateUpdate', sanitizedState);

        if (callback) {
          callback({
            success: true,
            roomCode: room.code,
            mapData: activeMapData,
            gameState: sanitizedState,
            players: room.players,
            spectatorMode: true
          });
        }
        return;
      }

      const useScenarioNations = !asNormalMap && !disableNations && activeMapData.isScenario && activeMapData.nations && activeMapData.nations.length > 0;

      if (useScenarioNations) {
        const disabledSet = new Set(room.disabledNationIds);
        const activeNations = activeMapData.nations.filter(n => !disabledSet.has(n.id));
        room.players = activeNations.map((n, idx) => ({
          id: `ai_${Math.random().toString(36).substr(2, 9)}`,
          name: n.name,
          nationName: n.name,
          nationId: n.id,
          color: n.color,
          isHost: idx === 0,
          isAI: true,
          autoDefend: true,
          trustScores: {},
          personality: personalities[idx % personalities.length]
        }));
      } else {
        const shuffleArray = (arr) => {
          const copy = [...arr];
          for (let idx = copy.length - 1; idx > 0; idx--) {
            const jdx = Math.floor(Math.random() * (idx + 1));
            [copy[idx], copy[jdx]] = [copy[jdx], copy[idx]];
          }
          return copy;
        };

        const randomizedNames = shuffleArray(aiNames);
        const randomizedPersonalities = shuffleArray(personalities);

        // Assign colors using greedy max-min selection for maximum visual
        // distinctness between AI players. A plain random shuffle can place
        // similar-hue colors (e.g. two reds or two blues) on different players,
        // making commanders hard to tell apart on the battlefield. Instead we
        // greedily pick the color that is furthest (in HSV space) from every
        // color already selected, then shuffle the player-to-color mapping so
        // the assignment is still random — only the *set* of colors used is
        // guaranteed maximally spread.
        const hueSortedColors = [...aiColors].sort(
          (a, b) => GameEngine.hexToHsv(a).h - GameEngine.hexToHsv(b).h
        );
        const selectedColors = [hueSortedColors[0]];
        while (selectedColors.length < count && selectedColors.length < hueSortedColors.length) {
          let best = null, bestDist = -1;
          for (const c of hueSortedColors) {
            if (selectedColors.includes(c)) continue;
            let minDist = Infinity;
            for (const s of selectedColors) {
              const d = GameEngine.colorDistanceHSV(c, s);
              if (d < minDist) minDist = d;
            }
            if (minDist > bestDist) { bestDist = minDist; best = c; }
          }
          if (!best) break;
          selectedColors.push(best);
        }
        const randomizedColors = shuffleArray(selectedColors);

        for (let i = 0; i < count; i++) {
          const id = `ai_${Math.random().toString(36).substr(2, 9)}`;
          room.players.push({
            id,
            name: randomizedNames[i % randomizedNames.length],
            color: randomizedColors[i],
            isHost: i === 0,
            isAI: true,
            autoDefend: true,
            trustScores: {},
            personality: randomizedPersonalities[i % randomizedPersonalities.length]
          });
        }
      }

      if (gameMode && gameMode !== 'auto') {
        room.gameMode = gameMode;
      } else {
        const isCapRush = !asNormalMap && !!(activeMapData.scenarioSettings && activeMapData.scenarioSettings.capitalRush);
        room.gameMode = isCapRush ? 'capital_rush' : 'conquest';
      }
      socket.join(room.code);

      // Start game immediately
      const res = RoomManager.startGame(room.code);
      if (res.error) return callback({ error: res.error });

      console.log(`AI Battle room ${room.code} started with ${room.players.length} AIs for spectator`);
      callback({
        success: true,
        roomCode: room.code,
        mapData: activeMapData,
        gameState: res.room.gameState,
        players: res.room.players,
        spectatorMode: true
      });

      // Kick off AI turns immediately
      RoomManager.runAITurn(res.room, io);
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to create AI battle' });
    }
  });

  // Toggle Normal Map Rules for Scenario Lobbies
  socket.on('toggleNormalMapRules', ({ roomCode, asNormalMap }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can toggle map rules' });

      room.asNormalMap = !!asNormalMap;
      if (room.mapData) {
        if (room.asNormalMap) {
          room.activeMapData = { ...room.mapData, isScenario: false, nations: [] };
        } else {
          delete room.activeMapData;
        }
      }
      io.to(room.code).emit('roomStateUpdate', {
        asNormalMap: room.asNormalMap,
        mapData: room.activeMapData || room.mapData
      });
      if (callback) callback({ success: true, asNormalMap: room.asNormalMap });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update map rules' });
    }
  });

  // Toggle Disable Nations for Scenario Lobbies
  socket.on('toggleDisableNations', ({ roomCode, disableNations }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can toggle nations' });

      room.disableNations = !!disableNations;
      io.to(room.code).emit('roomStateUpdate', {
        disableNations: room.disableNations
      });
      if (callback) callback({ success: true, disableNations: room.disableNations });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to toggle nations' });
    }
  });

  // Toggle Premade Alliances for Scenario Lobbies
  socket.on('togglePremadeAlliances', ({ roomCode, honorPremadeAlliances }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can toggle premade alliances' });

      room.honorPremadeAlliances = honorPremadeAlliances !== false;
      io.to(room.code).emit('roomStateUpdate', {
        honorPremadeAlliances: room.honorPremadeAlliances
      });
      if (callback) callback({ success: true, honorPremadeAlliances: room.honorPremadeAlliances });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to toggle premade alliances' });
    }
  });

  // Update Blizzard & Nuke Lobby settings
  socket.on('updateNuclearSettings', ({ roomCode, blizzardCount, startingNukes, startingThermonukes, allowCrafting }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can change nuclear settings' });

      room.blizzardCount = parseInt(blizzardCount) || 0;
      room.startingNukes = parseInt(startingNukes) || 0;
      room.startingThermonukes = parseInt(startingThermonukes) || 0;
      room.allowCrafting = !!allowCrafting;

      io.to(room.code).emit('roomStateUpdate', {
        blizzardCount: room.blizzardCount,
        startingNukes: room.startingNukes,
        startingThermonukes: room.startingThermonukes,
        allowCrafting: room.allowCrafting
      });
      if (callback) callback({ success: true });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update nuclear settings' });
    }
  });

  // Craft Nuke Weapon
  socket.on('craftNuke', ({ roomCode, cardIndices, isThermo }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      const res = GameEngine.craftNuke(room, socket.id, cardIndices, isThermo);
      if (res.error) return callback && callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to craft weapon' });
    }
  });

  // Fire Nuke Weapon
  socket.on('fireNuke', ({ roomCode, sourceId, targetId, isThermo }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      const res = GameEngine.fireNuke(room, socket.id, sourceId, targetId, isThermo);
      if (res.error) return callback && callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));

      // Broadcast the missile flight to everyone except the launcher (they animate locally in their own ack)
      const nukeMap = room.mapData;
      const nukeSrc = nukeMap && nukeMap.territories ? nukeMap.territories.find(t => t.id === sourceId) : null;
      const nukeTgt = nukeMap && nukeMap.territories ? nukeMap.territories.find(t => t.id === targetId) : null;
      if (nukeSrc && nukeTgt && nukeSrc.center && nukeTgt.center) {
        socket.broadcast.to(roomCode).emit('fireNuclearMissileEvent', { srcCenter: nukeSrc.center, tgtCenter: nukeTgt.center, isThermo: isThermo, targetId: targetId });
      }

      callback({ success: true, result: res.result });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to detonate weapon' });
    }
  });

  // Toggle Fog of War in Lobby
  socket.on('toggleFogOfWar', ({ roomCode, fogOfWar }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can toggle Fog of War' });

      room.fogOfWar = !!fogOfWar;
      io.to(room.code).emit('roomStateUpdate', {
        fogOfWar: room.fogOfWar
      });
      if (callback) callback({ success: true, fogOfWar: room.fogOfWar });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update Fog of War' });
    }
  });

  // Change Card Trade Rule in Lobby
  socket.on('changeCardTradeRule', ({ roomCode, cardTradeRule }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can change card trade rule' });

      room.cardTradeRule = cardTradeRule === 'fixed' ? 'fixed' : 'progressive';
      io.to(room.code).emit('roomStateUpdate', {
        cardTradeRule: room.cardTradeRule
      });
      if (callback) callback({ success: true, cardTradeRule: room.cardTradeRule });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update card trade rule' });
    }
  });

  // Toggle Generative AI Hot-Seat Mode in Lobby
  socket.on('toggleGenerativeAIMode', ({ roomCode, generativeAIMode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can toggle Generative AI mode' });

      room.generativeAIMode = !!generativeAIMode;
      io.to(room.code).emit('roomStateUpdate', {
        generativeAIMode: room.generativeAIMode
      });
      if (callback) callback({ success: true, generativeAIMode: room.generativeAIMode });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to toggle Generative AI mode' });
    }
  });

  // Execute Generative AI LLM Turn Action
  socket.on('executeLLMAction', ({ roomCode, action }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      if (!action || typeof action !== 'object') {
        return callback && callback({ error: 'Invalid action object' });
      }

      const gameState = room.gameState;
      const activePlayer = gameState.players[gameState.turnIndex];

      // Safeguard: Ensure we are only executing LLM actions on an AI's turn to prevent hijacking human turns
      if (!activePlayer || !activePlayer.isAI) {
        return callback && callback({ error: 'Cannot execute LLM action: it is currently a human player\'s turn.' });
      }

      // Broadcast LLM commentary to global chat if present
      if (action.commentary && typeof action.commentary === 'string') {
        const chatMsg = {
          senderName: `${activePlayer ? activePlayer.name : 'AI'} [LLM]`,
          senderColor: activePlayer ? activePlayer.color : '#a855f7',
          text: `🤖 "${action.commentary}"`,
          timestamp: new Date().toLocaleTimeString()
        };
        gameState.chatArchive = gameState.chatArchive || [];
        gameState.chatArchive.push(chatMsg);
        io.to(room.code).emit('chatMessage', chatMsg);
      }

      // Handle multi-territory draft sequence if provided
          if (Array.isArray(action.draftSequence) && action.draftSequence.length > 0 && gameState.turnStage === 'DRAFT') {
            let placedCount = 0;
            action.draftSequence.forEach(item => {
              const tid = item.territoryId || item.targetId;
              const amt = parseInt(item.amount) || 1;
              if (tid && gameState.draftPool > 0) {
                const actualAmt = Math.min(amt, gameState.draftPool);
                const res = GameEngine.placeDraft(room, activePlayer.id, tid, actualAmt);
                if (res && res.success) placedCount += actualAmt;
              }
            });

            // Failsafe: if there are remaining draft armies after processing, auto-deploy them to the strongest territory
            if (gameState.draftPool > 0) {
              const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === activePlayer.id);
              if (owned.length > 0) {
                owned.sort((a, b) => gameState.territories[b].armies - gameState.territories[a].armies);
                const targetId = owned[0];
                const amount = gameState.draftPool;
                GameEngine.placeDraft(room, activePlayer.id, targetId, amount);
                GameEngine.addLog(gameState, `🛡️ Auto-Draft: ${amount} remaining armies auto-deployed on ${gameState.territories[targetId]?.name || targetId}.`);
              }
            }
            gameState.turnStage = 'ATTACK'; // Explicitly transition to Attack

            io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
            return callback && callback({ success: true, placedCount });
          }

      // Handle multi-attack sequence if provided
          if (Array.isArray(action.attackSequence) && action.attackSequence.length > 0) {
            let executedCount = 0;
            let skippedCount = 0;

            action.attackSequence.forEach(atk => {
              if (!atk.sourceId || !atk.targetId) return;

              // Auto-resolve any pending post-attack move from a prior conquest
              if (gameState.turnStage === 'POST_ATTACK_MOVE') {
                GameEngine.executePostAttackMove(room, activePlayer.id, 0);
              }

              const srcTerr = gameState.territories[atk.sourceId];
              const tgtTerr = gameState.territories[atk.targetId];

              if (srcTerr && tgtTerr && srcTerr.ownerId === activePlayer.id && srcTerr.armies >= 2 && tgtTerr.ownerId !== activePlayer.id) {
                const requestedMove = parseInt(atk.postAttackMove) || parseInt(atk.moveAmount) || 0;
                if (atk.blitz !== false) {
                  GameEngine.executeBlitzAttack(room, activePlayer.id, atk.sourceId, atk.targetId);
                  if (gameState.turnStage === 'POST_ATTACK_MOVE') {
                    GameEngine.executePostAttackMove(room, activePlayer.id, requestedMove);
                  }
                } else {
                  GameEngine.executeAttack(room, activePlayer.id, atk.sourceId, atk.targetId, Math.min(3, srcTerr.armies - 1));
                  if (gameState.turnStage === 'POST_ATTACK_MOVE') {
                    GameEngine.executePostAttackMove(room, activePlayer.id, requestedMove);
                  }
                }
                executedCount++;
              } else {
                skippedCount++;
              }
            });

            // AUTO-TRANSITION TO FORTIFY AFTER SEQUENCE COMPLETION
            if (gameState.turnStage === 'ATTACK') {
              gameState.turnStage = 'FORTIFY';
              GameEngine.addLog(gameState, `🏳️ Turn Consolidator: Completed attack sequence, transitioned safely to Fortify stage.`);
            }

            io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
            return callback && callback({ success: true, executedCount, skippedCount });
          }

      const actionStr = typeof action.action === 'string' ? action.action : '';
const typeStr = typeof action.type === 'string' ? action.type : '';
const actType = (actionStr || typeStr || '').toUpperCase();

          // ENFORCE DRAFT BEFORE PROCEEDING
          if (gameState.turnStage === 'DRAFT') {
            if (actType === 'DRAFT' || actType === 'PLACE_DRAFT') {
              const targetId = action.territoryId || action.targetId;
              const amount = parseInt(action.amount) || gameState.draftPool || 1;
              const actualAmt = Math.min(amount, gameState.draftPool);
              GameEngine.placeDraft(room, activePlayer.id, targetId, actualAmt);
            }
            
            // Failsafe: if armies still remain, auto-deploy them to the strongest territory
            if (gameState.draftPool > 0) {
              const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === activePlayer.id);
              if (owned.length > 0) {
                owned.sort((a, b) => gameState.territories[b].armies - gameState.territories[a].armies);
                const targetId = owned[0];
                const amount = gameState.draftPool;
                GameEngine.placeDraft(room, activePlayer.id, targetId, amount);
                GameEngine.addLog(gameState, `🛡️ Auto-Draft: ${amount} remaining armies auto-deployed on ${gameState.territories[targetId]?.name || targetId}.`);
              }
            }
            gameState.turnStage = 'ATTACK';
          } else if (actType === 'ATTACK') {
        if (action.blitz !== false) {
          const res = GameEngine.executeBlitzAttack(room, activePlayer.id, action.sourceId, action.targetId);
          if (res.error) return callback && callback({ error: res.error });
        } else {
          const res = GameEngine.executeAttack(room, activePlayer.id, action.sourceId, action.targetId, Math.min(3, gameState.territories[action.sourceId]?.armies - 1 || 1));
          if (res.error) return callback && callback({ error: res.error });
        }
      } else if (actType === 'END_ATTACK' || actType === 'END_DRAFT' || actType === 'PASS') {
        if (gameState.turnStage === 'DRAFT' && gameState.draftPool === 0) {
          gameState.turnStage = 'ATTACK';
        } else if (gameState.turnStage === 'ATTACK') {
          gameState.turnStage = 'FORTIFY';
        }
      } else if (actType === 'FORTIFY') {
        const res = GameEngine.executeFortify(room, activePlayer.id, action.sourceId, action.targetId, parseInt(action.amount) || 1);
        if (res.error) return callback && callback({ error: res.error });
      } else if (actType === 'END_TURN') {
        const res = GameEngine.endTurn(room, activePlayer.id);
        if (res.error) return callback && callback({ error: res.error });

        // Run AI logic if turn shifts to a Generative/LLM AI
        const nextPlayer = gameState.players[gameState.turnIndex];
        const isGenerative = room.generativeAIMode || (gameState && gameState.generativeAIMode);
        if (nextPlayer && nextPlayer.isAI && (nextPlayer.isLLM || isGenerative) && room.status === 'PLAYING') {
          RoomManager.runAITurn(room, io);
        }
      } else if (actType === 'TRADE_CARDS') { 
        const res = GameEngine.tradeAllCards(room, activePlayer.id);
        if (res.error) return callback && callback({ error: res.error });
      } else if (actType === 'PROPOSE_PACT' || actType === 'PROPOSE_ALLIANCE') {
        const targetId = action.targetPlayerId || action.targetId;
        const pType = (action.type || action.pactType || 'non_aggression').toLowerCase();
        const typeStr = pType.includes('all') ? 'alliance' : 'non_aggression';
        
        gameState.diplomacyProposals = gameState.diplomacyProposals || [];
        const existing = gameState.diplomacyProposals.find(p => 
          (p.proposerId === activePlayer.id || p.sender === activePlayer.id) && 
          (p.targetId === targetId || p.receiver === targetId)
        );
        if (!existing && targetId && targetId !== activePlayer.id) {
          gameState.diplomacyProposals.push({
            id: Math.random().toString(36).substr(2, 9),
            proposerId: activePlayer.id,
            targetId,
            sender: activePlayer.id,   // Unified key fallback
            receiver: targetId,         // Unified key fallback
            type: typeStr
          });
          const tgtPlayer = gameState.players.find(p => p.id === targetId);
          GameEngine.addLog(gameState, `📜 ${activePlayer.name} proposed a ${typeStr === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance'} to ${tgtPlayer ? tgtPlayer.name : targetId}.`);
        }
      } else if (actType === 'ACCEPT_PACT') {
        const proposerId = action.proposerId || action.targetPlayerId || action.targetId;
        gameState.diplomacyProposals = gameState.diplomacyProposals || [];
        const propIndex = gameState.diplomacyProposals.findIndex(p => 
          (p.targetId === activePlayer.id || p.receiver === activePlayer.id) && 
          (p.proposerId === proposerId || p.sender === proposerId)
        );
        if (propIndex !== -1) {
          const prop = gameState.diplomacyProposals.splice(propIndex, 1)[0];
          gameState.pacts = gameState.pacts || [];
          gameState.pacts.push({ playerA: prop.proposerId || prop.sender, playerB: activePlayer.id, type: prop.type });
          const propPlayer = gameState.players.find(p => p.id === proposerId);
          // Achievements for forming a pact
          GameEngine.grantPactFormationAchievements(room, prop.type, prop.proposerId || prop.sender, activePlayer.id);
          GameEngine.grantSilverTongue(room, prop.proposerId || prop.sender, activePlayer.id);
          GameEngine.addLog(gameState, `🤝 ${activePlayer.name} accepted the ${prop.type === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance'} proposal from ${propPlayer ? propPlayer.name : proposerId}!`);
        }
      } else if (actType === 'REJECT_PACT' || actType === 'DECLINE_PACT') {
        const proposerId = action.proposerId || action.targetPlayerId || action.targetId;
        gameState.diplomacyProposals = gameState.diplomacyProposals || [];
        const propIndex = gameState.diplomacyProposals.findIndex(p => 
          (p.targetId === activePlayer.id || p.receiver === activePlayer.id) && 
          (p.proposerId === proposerId || p.sender === proposerId)
        );
        if (propIndex !== -1) {
          gameState.diplomacyProposals.splice(propIndex, 1);
          const propPlayer = gameState.players.find(p => p.id === proposerId);
          GameEngine.addLog(gameState, `❌ Pact Declined: ${activePlayer.name} rejected the treaty proposal from ${propPlayer ? propPlayer.name : proposerId}.`);
        }
      } else if (actType === 'BREAK_PACT') {
        const targetId = action.targetPlayerId || action.targetId;
        gameState.pacts = gameState.pacts || [];
        const pactIndex = gameState.pacts.findIndex(p => (p.playerA === activePlayer.id && p.playerB === targetId) || (p.playerB === activePlayer.id && p.playerA === targetId));
        if (pactIndex !== -1) {
          gameState.pacts.splice(pactIndex, 1);
          const targetPlayer = gameState.players.find(p => p.id === targetId);
          GameEngine.addLog(gameState, `💔 ${activePlayer.name} HAS BETRAYED AND BROKEN THEIR TREATY WITH ${targetPlayer ? targetPlayer.name : targetId}!`);
        }
      }

      io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
      if (callback) callback({ success: true });
    } catch (err) {
      console.error('LLM Action Error:', err);
      if (callback) callback({ error: 'Failed to execute LLM action' });
    }
  });

  // Force Skip Turn (stuck AI watchdog / manual skip)
  socket.on('forceSkipTurn', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const skipName = activePlayer ? activePlayer.name : 'Current player';

      // Auto-resolve any pending post attack context if active
      if (room.gameState.turnStage === 'POST_ATTACK_MOVE') {
        GameEngine.executePostAttackMove(room, activePlayer.id, 0);
      }

      GameEngine.endTurn(room, activePlayer.id);
      GameEngine.addLog(room.gameState, `⏭️ Turn Force-Skipped: ${skipName}'s turn was skipped.`);

      io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));

      const nextPlayer = room.gameState.players[room.gameState.turnIndex];
      if (nextPlayer && nextPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }

      if (callback) callback({ success: true });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to force skip turn' });
    }
  });

  // Configure LLM API Provider for room
  socket.on('configureLLMProvider', ({ roomCode, provider, model, apiKey, baseURL }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });

      room.llmProviderConfig = {
        provider: provider || 'clipboard',
        model: model || '',
        apiKey: apiKey || '',
        baseURL: baseURL || ''
      };

      io.to(room.code).emit('roomStateUpdate', {
        llmProviderConfig: {
          provider: room.llmProviderConfig.provider,
          model: room.llmProviderConfig.model
        }
      });

      if (callback) callback({ success: true, config: room.llmProviderConfig });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to configure LLM provider' });
    }
  });

  // Toggle Pause/Resume AI Match
  socket.on('togglePauseGame', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });

      room.isPaused = !room.isPaused;
      const statusMsg = room.isPaused ? '⏸️ Match Paused' : '▶️ Match Resumed';
      
      if (room.gameState) {
        GameEngine.addLog(room.gameState, statusMsg);
      }

      io.to(room.code).emit('roomStateUpdate', { isPaused: room.isPaused });
      io.to(room.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));

      if (!room.isPaused && room.status === 'PLAYING') {
        const curPlayer = room.gameState ? room.gameState.players[room.gameState.turnIndex] : null;
        if (curPlayer && curPlayer.isAI) {
          RoomManager.runAITurn(room, io);
        }
      }

      if (callback) callback({ success: true, isPaused: room.isPaused });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to toggle pause' });
    }
  });

  // Ask AI Advisor (Co-pilot for human players)
  socket.on('askAIAdvisor', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      const player = room.gameState.players.find(p => p.id === socket.id);
      if (!player) return callback && callback({ error: 'Player not found' });

      const prompt = generateLLMPrompt(room, player.id);
      const advisorPrompt = prompt + `\n\n[ADVISOR INSTRUCTIONS]\nYou are a master Risk Grandmaster Strategy Advisor. Analyze the current situation for ${player.name}. Provide concise, actionable advice in JSON format: {"reasoning": "Strategic Overview", "advice": "Step-by-step strategy for this turn", "recommendedDraft": "Where to place troops", "recommendedAttacks": "Which territories to attack or pass"}`;

      const config = room.llmProviderConfig || { provider: 'groq' };
      callLLMProvider({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        prompt: advisorPrompt
      }).then(response => {
        if (callback) callback({ success: true, advice: response });
      }).catch(err => {
        console.error('AI Advisor error:', err.message);
        if (callback) callback({ error: `Advisor unavailable: ${err.message}` });
      });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to request AI Advisor' });
    }
  });

  // Load & Resume Saved Campaign State
  socket.on('loadSavedCampaign', ({ saveData }, callback) => {
    try {
      if (!saveData || !saveData.mapData || !saveData.gameState) {
        return callback({ error: 'Invalid or corrupted save file.' });
      }

      // Link mapData to gameState
      saveData.gameState.mapData = saveData.mapData;

      const room = RoomManager.createRoom(socket.id, 'Host Player', '#00e5ff', saveData.mapData);
      room.mapData = saveData.mapData;
      room.gameState = saveData.gameState;
      room.players = saveData.gameState.players ? saveData.gameState.players.map(p => ({ ...p })) : room.players;

      if (room.players && room.players.length > 0) {
        const humanPlayer = room.players.find(p => p.isHost || !p.isAI) || room.players[0];
        if (humanPlayer && !humanPlayer.isAI) {
          const oldId = humanPlayer.id;
          humanPlayer.id = socket.id;
          if (room.gameState && room.gameState.players) {
            const pInState = room.gameState.players.find(p => p.id === oldId);
            if (pInState) pInState.id = socket.id;
          }
          if (room.gameState && room.gameState.territories) {
            Object.values(room.gameState.territories).forEach(t => {
              if (t.ownerId === oldId) t.ownerId = socket.id;
            });
          }
        }
      }
      room.cardTradeRule = saveData.cardTradeRule || saveData.gameState.cardTradeRule || 'progressive';
      room.generativeAIMode = saveData.generativeAIMode !== undefined ? saveData.generativeAIMode : true;
      room.gameState.generativeAIMode = room.generativeAIMode;
      room.fogOfWar = saveData.fogOfWar !== undefined ? !!saveData.fogOfWar : !!saveData.gameState.fogOfWar;
      room.gameState.fogOfWar = room.fogOfWar;
      
      // Restore nuke, craft, and radiation metrics
      room.allowCrafting = saveData.allowCrafting !== undefined ? saveData.allowCrafting : (saveData.gameState.allowCrafting !== undefined ? saveData.gameState.allowCrafting : false);
      room.blizzardCount = saveData.blizzardCount !== undefined ? saveData.blizzardCount : (saveData.gameState.blizzards ? saveData.gameState.blizzards.length : 0);
      room.startingNukes = saveData.startingNukes !== undefined ? saveData.startingNukes : 0;
      room.startingThermonukes = saveData.startingThermonukes !== undefined ? saveData.startingThermonukes : 0;
      
      room.gameState.allowCrafting = room.allowCrafting;
      room.gameState.radiation = saveData.gameState.radiation || {};

      room.status = 'PLAYING';
      room.hostId = socket.id;

      socket.join(room.code);
      GameEngine.addLog(room.gameState, `💾 Campaign match restored from saved file! Turn: ${room.gameState.turnIndex + 1}.`);

      const sanitizedState = RoomManager.getSanitizedGameState(room.gameState);
      sanitizedState.mapData = room.mapData;
      sanitizedState.generativeAIMode = room.generativeAIMode;

      const isSpectator = !!saveData.spectatorMode || !!room.generativeAIMode;

      // Broadcast gameStarted and gameStateUpdate to sync all clients immediately
      io.to(room.code).emit('gameStarted', {
        roomCode: room.code,
        mapData: room.mapData,
        gameState: sanitizedState,
        spectatorMode: isSpectator
      });
      io.to(room.code).emit('gameStateUpdate', sanitizedState);

      if (callback) {
        callback({
          success: true,
          roomCode: room.code,
          mapData: room.mapData,
          gameState: sanitizedState,
          spectatorMode: isSpectator
        });
      }

      // Run AI logic if restored turn belongs to a Generative/LLM AI
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      const isGenerative = room.generativeAIMode || (room.gameState && room.gameState.generativeAIMode);
      if (curPlayer && curPlayer.isAI && (curPlayer.isLLM || isGenerative) && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }
    } catch (err) {
      console.error('Load Save Error:', err);
      if (callback) callback({ error: 'Failed to restore campaign from save file.' });
    }
  });
  // Change Heuristic AI Difficulty in Lobby
  socket.on('changeAIDifficulty', ({ roomCode, difficulty }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can change AI difficulty' });

      room.aiDifficulty = difficulty === 'easy' ? 'easy' : 'normal';
      if (room.gameState) {
        room.gameState.aiDifficulty = room.aiDifficulty;
      }

      io.to(room.code).emit('roomStateUpdate', {
        aiDifficulty: room.aiDifficulty
      });
      if (callback) callback({ success: true, aiDifficulty: room.aiDifficulty });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update AI difficulty' });
    }
  });
  socket.on('changeLLMDelay', ({ roomCode, delay }, callback) => {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      room.llmDelay = parseInt(delay) || 3000;
      callback && callback({ success: true });
    });

  // Toggle Specific Nation status (Disable/Enable individual nations in scenario)
  socket.on('toggleSpecificNation', ({ roomCode, nationId, disable }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback && callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback && callback({ error: 'Only host can modify nation settings' });

      room.disabledNationIds = room.disabledNationIds || [];
      if (disable) {
        if (!room.disabledNationIds.includes(nationId)) {
          room.disabledNationIds.push(nationId);
        }
        // If a player had selected this nation, reset their nation assignment
        room.players.forEach(p => {
          if (p.selectedNationId === nationId || p.nationId === nationId) {
            delete p.selectedNationId;
            delete p.nationId;
            delete p.nationName;
          }
        });
      } else {
        room.disabledNationIds = room.disabledNationIds.filter(id => id !== nationId);
      }

      io.to(room.code).emit('roomStateUpdate', {
        disabledNationIds: room.disabledNationIds,
        players: room.players
      });

      if (callback) callback({ success: true, disabledNationIds: room.disabledNationIds });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to update nation status' });
    }
  });

  // Sync Game State (e.g. after tab switch / focus restoration)
  socket.on('syncGameState', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback && callback({ error: 'Game not active' });

      // Kickstart AI if currently AI's turn
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      if (curPlayer && curPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }

      io.to(socket.id).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      if (callback) callback({ success: true, gameState: RoomManager.getSanitizedGameState(room.gameState) });
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to sync game state' });
    }
  });

  // 1c. Select Scenario Nation in Lobby
  socket.on('selectNation', ({ roomCode, nationId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.status !== 'LOBBY') return callback({ error: 'Game already started' });
      if (!room.mapData || !room.mapData.nations) return callback({ error: 'Not a scenario map' });

      const nation = room.mapData.nations.find(n => n.id === nationId);
      if (!nation) return callback({ error: 'Invalid nation ID' });

      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.selectedNationId = nationId;
        player.nationName = nation.name;
        player.color = nation.color; // Override player color with nation color!
        player.originalName = player.originalName || player.name;
        io.to(roomCode).emit('playersUpdate', room.players);
        callback({ success: true, nation });
      } else {
        callback({ error: 'Player not found in room' });
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to select nation' });
    }
  });

  // 2. Join Room
  socket.on('joinRoom', ({ roomCode, playerName, playerColor, accountId }, callback) => {
    try {
      const res = RoomManager.joinRoom(socket.id, roomCode, playerName, playerColor);
      if (res.error) {
        return callback({ error: res.error });
      }
      res.room.io = io;
      const playerObj = res.room.players.find(p => p.id === socket.id);
      if (playerObj && accountId) {
        playerObj.accountId = accountId;
        const acc = UserDB.getSafeUser(UserDB.loadUsers()[accountId.toLowerCase()]);
        if (acc) {
          playerObj.level = acc.level || 1;
          playerObj.battleCard = acc.battleCard || { theme: 'default', option: 1, showcasedBadges: [] };
        }
      }
      socket.join(roomCode);
      console.log(`Player ${playerName} (Account: ${accountId || 'Guest'}) joined room ${roomCode}`);
      
      io.to(roomCode).emit('playersUpdate', res.room.players);
      if (res.room.status === 'PLAYING') {
        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(res.room.gameState));
        if (res.rejoined) {
          io.to(roomCode).emit('chatMessage', {
            senderName: 'SYSTEM',
            senderColor: '#00ffcc',
            text: `🔌 ${playerName} has reconnected, reclaiming their forces from the AI bot.`,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }

      callback({
        success: true,
        roomCode: res.room.code,
        players: res.room.players,
        mapData: res.room.mapData,
        status: res.room.status,
        gameMode: res.room.gameMode,
        gameState: res.room.status === 'PLAYING' ? res.room.gameState : null
      });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to join room' });
    }
  });
  
  // Toggle specific AI player's type (Traditional vs LLM)
  socket.on('togglePlayerLLM', ({ roomCode, targetPlayerId, isLLM }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback({ error: 'Only host can toggle AI types' });

      // Update lobby-level player definition
      const player = room.players.find(p => p.id === targetPlayerId);
      if (player) {
        player.isLLM = !!isLLM;
      }

      // Update active game-state player definition if game is in progress
      if (room.gameState && room.gameState.players) {
        const gamePlayer = room.gameState.players.find(p => p.id === targetPlayerId);
        if (gamePlayer) {
          gamePlayer.isLLM = !!isLLM;
        }
      }

      io.to(roomCode).emit('playersUpdate', room.players);
      if (room.gameState) {
        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      }
      callback({ success: true, players: room.players });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to toggle AI type' });
    }
  });

  // Change AI Personality (Host can change AI settings in Lobby)
  socket.on('changeAIPersonality', ({ roomCode, targetPlayerId, newPersonality }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback({ error: 'Only host can change AI settings' });

      const res = RoomManager.changeAIPersonality(roomCode, targetPlayerId, newPersonality);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('playersUpdate', room.players);
      callback({ success: true, players: room.players });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to update AI personality' });
    }
  });
  // Change Player Color (Host can change AI colors, players can change own color)
  socket.on('changePlayerColor', ({ roomCode, targetPlayerId, newColor }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });

      const isHost = room.hostId === socket.id;
      const isSelf = targetPlayerId === socket.id;

      const player = room.players.find(p => p.id === targetPlayerId);
      if (!player) return callback({ error: 'Player not found' });

      if (!isHost && !isSelf) {
        return callback({ error: 'Only the host or player can change colors' });
      }
      if (player.isAI && !isHost) {
        return callback({ error: 'Only the host can change AI colors' });
      }

      // Ensure color is unique in room
      const cleanColor = (newColor || '').trim().toLowerCase();
      if (!cleanColor) return callback({ error: 'Invalid color' });

      const colorTaken = room.players.some(p => p.id !== targetPlayerId && p.color.toLowerCase() === cleanColor);
      if (colorTaken) {
        return callback({ error: 'This color is already taken by another commander' });
      }

      player.color = cleanColor;
      io.to(roomCode).emit('playersUpdate', room.players);
      callback({ success: true, players: room.players });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to update color' });
    }
  });
  // 3. Add AI Player
  socket.on('addAI', ({ roomCode, name, color }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback({ error: 'Only host can add AI players' });

      const res = RoomManager.addAIPlayer(roomCode, name, color);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('playersUpdate', res.room.players);
      callback({ success: true, players: res.room.players });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to add AI player' });
    }
  });

  // Update Game Mode settings in Lobby
  socket.on('updateGameMode', ({ roomCode, mode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback({ error: 'Only the host can change the game mode' });

      const res = RoomManager.updateGameMode(roomCode, mode);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('lobbySettingsUpdate', { gameMode: res.room.gameMode });
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to update game mode' });
    }
  });

  // Change AI Speed
  socket.on('changeAISpeed', ({ roomCode, speed }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      // Allow if player is host OR if the game is all AI (spectator session)
      const allAI = room.gameState && room.gameState.players.every(p => p.isAI);
      if (room.hostId !== socket.id && !allAI) {
        return callback({ error: 'Only the host or spectators of AI battles can change AI speed' });
      }

      const speedVal = parseInt(speed);
      room.aiSpeed = isNaN(speedVal) ? 1000 : Math.max(0, speedVal);
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to change AI speed' });
    }
  });

  // Toggle AI Blitz Mode (Host or Spectator of AI-only battle)
  socket.on('toggleAIBlitz', ({ roomCode, enabled }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      const allAI = room.players && room.players.every(p => p.isAI);
      if (room.hostId !== socket.id && !allAI) {
        return callback({ error: 'Only the host or spectators of AI battles can toggle AI Blitz attack' });
      }

      room.aiBlitz = !!enabled;
      io.to(roomCode).emit('roomUpdated', { roomCode, aiBlitz: room.aiBlitz });
      callback({ success: true, aiBlitz: room.aiBlitz });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to toggle AI blitz mode' });
    }
  });

  // Select Capital
  socket.on('selectCapital', ({ roomCode, territoryId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const res = GameEngine.selectCapital(room, socket.id, territoryId);
      if (res.error) return callback({ error: res.error });

      // Sanitized broadcast: raw gameState includes the full history array
      // (one full-board snapshot per turn), which grows unbounded in long
      // games. Stringifying + sending it stalls the server event loop and
      // freezes the client tab. Always broadcast the sanitized version.
      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true });

      // Run AI logic if turn shifts to AI
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      if (curPlayer && curPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to select capital' });
    }
  });

  // 4. Start Game
  socket.on('startGame', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room) return callback({ error: 'Room not found' });
      if (room.hostId !== socket.id) return callback({ error: 'Only the host can start the game' });

      const res = RoomManager.startGame(roomCode);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStarted', { roomCode, gameState: res.room.gameState });
      callback({ success: true });

      // Run AI logic if first player is AI
      const firstPlayer = res.room.gameState.players[0];
      if (firstPlayer.isAI) {
        RoomManager.runAITurn(res.room, io);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to start game' });
    }
  });

  // 5. Place Troops (Draft Phase or Setup Phase)
  socket.on('placeTroops', ({ roomCode, territoryId, amount }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const actingId = (room.generativeAIMode || room.gameState.generativeAIMode) ? activePlayer.id : socket.id;

      let res;
      if (room.gameState.turnStage === 'SETUP_CLAIM') {
        res = GameEngine.claimTerritory(room, actingId, territoryId);
      } else if (room.gameState.turnStage === 'SETUP_FORTIFY') {
        res = GameEngine.fortifySetup(room, actingId, territoryId, amount || 1);
      } else {
        res = GameEngine.placeDraft(room, actingId, territoryId, amount || 1);
      }

      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true });

      // Run AI logic if turn shifts to AI
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      if (curPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to place troops' });
    }
  });

  // 6. Execute Attack
  socket.on('attack', ({ roomCode, sourceId, targetId, diceCount }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const actingId = (room.generativeAIMode || room.gameState.generativeAIMode) ? activePlayer.id : socket.id;

      const res = GameEngine.executeAttack(room, actingId, sourceId, targetId, diceCount);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true, result: res.diceResult });

      if (res.diceResult) {
        RoomManager.handleCombatDialogue(room, io, res.diceResult);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to attack' });
    }
  });

  // 6b. Execute Blitz Attack (Fight to the Death)
  socket.on('blitzAttack', ({ roomCode, sourceId, targetId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const actingId = (room.generativeAIMode || room.gameState.generativeAIMode) ? activePlayer.id : socket.id;

      const res = GameEngine.executeBlitzAttack(room, actingId, sourceId, targetId);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true, blitzResult: res.blitzResult });

      if (res.blitzResult && res.blitzResult.lastDiceResult) {
        RoomManager.handleCombatDialogue(room, io, res.blitzResult.lastDiceResult);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to execute blitz attack' });
    }
  });

  // Post-Attack Move
  socket.on('postAttackMove', ({ roomCode, amount }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const actingId = (room.generativeAIMode || room.gameState.generativeAIMode) ? activePlayer.id : socket.id;

      const res = GameEngine.executePostAttackMove(room, actingId, amount);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true });

      // Run AI logic if turn shifted to AI
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      if (curPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to execute post-attack move' });
    }
  });

  // Toggle Auto Defend
  socket.on('toggleAutoDefend', ({ roomCode, enabled }, callback) => {
    try {
      const res = RoomManager.toggleAutoDefend(roomCode, socket.id, enabled);
      if (res.error) return callback({ error: res.error });
      
      const room = RoomManager.getRoom(roomCode);
      if (room && room.gameState) {
        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      }
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to toggle auto defend' });
    }
  });

  // Resolve Defense choice
  socket.on('resolveDefense', ({ roomCode, diceCount }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const res = GameEngine.resolveDefense(room, socket.id, diceCount);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true, result: res.diceResult });

      if (res.diceResult) {
        RoomManager.handleCombatDialogue(room, io, res.diceResult);
      }

      // Run AI logic if turn shifted to AI
      const curPlayer = room.gameState.players[room.gameState.turnIndex];
      if (curPlayer.isAI && room.status === 'PLAYING') {
        RoomManager.runAITurn(room, io);
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to resolve defense' });
    }
  });

  // 7. Execute Fortify
  socket.on('fortify', ({ roomCode, sourceId, targetId, amount }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const activePlayer = room.gameState.players[room.gameState.turnIndex];
      const actingId = (room.generativeAIMode || room.gameState.generativeAIMode) ? activePlayer.id : socket.id;

      const res = GameEngine.executeFortify(room, actingId, sourceId, targetId, amount);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to fortify' });
    }
  });

  // 8. End Turn / End Phase
  socket.on('endPhase', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const gameState = room.gameState;
      const activePlayer = gameState.players[gameState.turnIndex];
      const actingId = (room.generativeAIMode || gameState.generativeAIMode) ? activePlayer.id : socket.id;

      if (gameState.turnStage === 'ATTACK') {
        gameState.turnStage = 'FORTIFY';
        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
        if (callback) callback({ success: true });
      } else if (gameState.turnStage === 'FORTIFY') {
        const res = GameEngine.endTurn(room, actingId);
        if (res && res.error) {
          if (callback) callback({ error: res.error });
          return;
        }
        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
        if (callback) callback({ success: true });

        // Run AI logic if turn shifts to a Generative/LLM AI
        const nextPlayer = gameState.players[gameState.turnIndex];
        const isGenerative = room.generativeAIMode || (gameState && gameState.generativeAIMode);
        if (nextPlayer && nextPlayer.isAI && (nextPlayer.isLLM || isGenerative) && room.status === 'PLAYING') {
          RoomManager.runAITurn(room, io);
        }
      } else {
        if (callback) callback({ error: 'Cannot manually end this stage' });
      }
    } catch (err) {
      console.error(err);
      if (callback) callback({ error: 'Failed to end phase' });
    }
  });

  // 9. Card Trade In
  socket.on('tradeCards', ({ roomCode, cardIndices, targetTerritoryId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const res = GameEngine.tradeCards(room, socket.id, cardIndices, targetTerritoryId);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true, bonusArmies: res.bonusArmies, autoDeposited: res.autoDeposited });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to trade cards' });
    }
  });

  // 9a. Trade All Valid Card Sets Batch
  socket.on('tradeAllCards', ({ roomCode, targetTerritoryId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const res = GameEngine.tradeAllCards(room, socket.id, targetTerritoryId);
      if (res.error) return callback({ error: res.error });

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
      callback({ success: true, totalBonus: res.totalBonus, setsTraded: res.setsTraded });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to trade all cards' });
    }
  });

  // 9b. Request Timelapse History On-Demand
  socket.on('requestTimelapseHistory', ({ roomCode }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });
      callback({ success: true, history: room.gameState.history || [] });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to fetch timelapse history' });
    }
  });

  // 10. Propose Pact (Diplomacy)
  socket.on('proposePact', ({ roomCode, targetPlayerId, pactType }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const gameState = room.gameState;
      const sender = gameState.players.find(p => p.id === socket.id);
      const receiver = gameState.players.find(p => p.id === targetPlayerId);

      if (!sender || !receiver) return callback({ error: 'Player not found' });
      if (sender.eliminated || receiver.eliminated) return callback({ error: 'Eliminated players cannot participate in diplomacy' });
      
      // Check if pact already exists
      const pactExists = gameState.pacts.some(
        p => (p.playerA === socket.id && p.playerB === targetPlayerId) ||
             (p.playerB === socket.id && p.playerA === targetPlayerId)
      );
      if (pactExists) return callback({ error: 'A pact already exists between you' });

      // Anti-Spam Proposal Check
      if (receiver.isAI) {
        receiver.proposalSpam = receiver.proposalSpam || {};
        receiver.proposalSpam[socket.id] = (receiver.proposalSpam[socket.id] || 0) + 1;

        if (receiver.proposalSpam[socket.id] > 3) {
          AIEngine.adjustTrustScore(receiver, socket.id, -10);
          const responseText = `💬 "Stop spamming me with proposals, @${sender.name}! I will not negotiate with you."`;
          
          setTimeout(() => {
            io.to(roomCode).emit('chatMessage', {
              senderName: `${receiver.name} [AI]`,
              senderColor: receiver.color,
              text: responseText,
              timestamp: new Date().toLocaleTimeString()
            });
          }, 800);

          return callback({ success: true, accepted: false });
        }
      }

      const propId = `prop_${Math.random().toString(36).substr(2, 9)}`;
      const proposal = {
        id: propId,
        type: pactType, // 'non_aggression' or 'alliance'
        sender: socket.id,
        receiver: targetPlayerId,
        proposerId: socket.id,   // Unified key fallback
        targetId: targetPlayerId // Unified key fallback
      };

      const isGenerative = !!(room.generativeAIMode || gameState.generativeAIMode);

      // If receiver is a traditional AI, evaluate immediately.
      // If receiver is a Generative AI LLM, queue it for their turn.
      if (receiver.isAI && !isGenerative) {
        const accept = AIEngine.evaluateDiplomacyProposal(room, targetPlayerId, proposal);
        if (accept) {
          gameState.pacts.push({
            type: pactType,
            playerA: socket.id,
            playerB: targetPlayerId
          });
          // Achievements for forming a pact (proposer is a human socket / playerA)
          GameEngine.grantPactFormationAchievements(room, pactType, socket.id, targetPlayerId);
          GameEngine.grantSilverTongue(room, socket.id, targetPlayerId);
          
          gameState.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            message: `🤝 Pact Formed: ${sender.name} and ${receiver.name} formed a ${pactType.replace('_', ' ')}!`
          });

          // Recover trust since proposal was accepted
          AIEngine.getTrustScore(receiver, socket.id);
          receiver.trustScores[socket.id] = Math.min(100, receiver.trustScores[socket.id] + 20);

          io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
          callback({ success: true, accepted: true });
        } else {
          gameState.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            message: `❌ Pact Rejected: ${receiver.name} declined ${sender.name}'s proposal.`
          });
          // Rejecting lowers trust slightly
          AIEngine.getTrustScore(receiver, socket.id);
          receiver.trustScores[socket.id] = Math.max(0, receiver.trustScores[socket.id] - 5);

          io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
          callback({ success: true, accepted: false });
        }
      } else {
        // Human player or Generative AI: queue proposal to evaluate on their turn
        gameState.diplomacyProposals = gameState.diplomacyProposals || [];
        gameState.diplomacyProposals.push(proposal);

        if (!receiver.isAI) {
          io.to(targetPlayerId).emit('diplomacyReceived', {
            id: propId,
            type: pactType,
            senderName: sender.name
          });
        }

        io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
        callback({ success: true, pending: true });
      }
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to propose pact' });
    }
  });

  // 11. Respond to Pact Proposal (Accept/Decline)
  socket.on('respondDiplomacy', ({ roomCode, proposalId, accept }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const gameState = room.gameState;
      const propIdx = gameState.diplomacyProposals.findIndex(p => p.id === proposalId);
      if (propIdx === -1) return callback({ error: 'Proposal not found' });

      const prop = gameState.diplomacyProposals[propIdx];
      if (prop.receiver !== socket.id) return callback({ error: 'Not authorized to respond' });

      const sender = gameState.players.find(p => p.id === prop.sender);
      const receiver = gameState.players.find(p => p.id === socket.id);

      if (accept && sender && receiver) {
        gameState.pacts.push({
          type: prop.type,
          playerA: prop.sender,
          playerB: prop.receiver
        });
        // Achievements for forming a pact
        GameEngine.grantPactFormationAchievements(room, prop.type, prop.sender, prop.receiver);
        GameEngine.grantSilverTongue(room, prop.sender, prop.receiver);

        gameState.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `🤝 Pact Formed: ${sender.name} and ${receiver.name} formed a ${prop.type.replace('_', ' ')}!`
        });
      } else if (sender && receiver) {
        gameState.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `❌ Pact Rejected: ${receiver.name} declined ${sender.name}'s proposal.`
        });
      }

      // Remove proposal
      gameState.diplomacyProposals.splice(propIdx, 1);
      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to respond to proposal' });
    }
  });

  // 12. Break Pact
  socket.on('breakPact', ({ roomCode, opponentId }, callback) => {
    try {
      const room = RoomManager.getRoom(roomCode);
      if (!room || !room.gameState) return callback({ error: 'Game not active' });

      const gameState = room.gameState;
      const activePactIdx = gameState.pacts.findIndex(
        p => (p.playerA === socket.id && p.playerB === opponentId) ||
             (p.playerB === socket.id && p.playerA === opponentId)
      );

      if (activePactIdx === -1) return callback({ error: 'No active pact found' });

      const pact = gameState.pacts[activePactIdx];
      gameState.pacts.splice(activePactIdx, 1);

      const player = gameState.players.find(p => p.id === socket.id);
      const opponent = gameState.players.find(p => p.id === opponentId);

      gameState.logs.push({
        timestamp: new Date().toLocaleTimeString(),
        message: `💔 Pact Broken: ${player ? player.name : 'A player'} broke their pact with ${opponent ? opponent.name : 'another player'}.`
      });

      // Distrust penalty if opponent is AI
      if (opponent && opponent.isAI) {
        if (!opponent.trustScores) opponent.trustScores = {};
        opponent.trustScores[socket.id] = 0; // immediate maximum distrust
      }

      io.to(roomCode).emit('gameStateUpdate', RoomManager.getSanitizedGameState(gameState));
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: 'Failed to break pact' });
    }
  });

  // 13. Room Chat Message (With Fuzzy AI Dialog Parser)
  socket.on('sendMessage', ({ roomCode, text }) => {
    const room = RoomManager.getRoom(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    const senderName = player ? player.name : 'Unknown';
    const senderColor = player ? player.color : '#ffffff';

    const chatMsg = {
      senderName,
      senderColor,
      text,
      timestamp: new Date().toLocaleTimeString()
    };

    // Save chat to log history archive
    if (room.gameState) {
      room.gameState.chatArchive = room.gameState.chatArchive || [];
      room.gameState.chatArchive.push(chatMsg);
    }

    io.to(roomCode).emit('chatMessage', chatMsg);

    // LLM Generative AI Chat Response
          if (room.gameState && (room.generativeAIMode || room.gameState.generativeAIMode) && room.llmProviderConfig && room.llmProviderConfig.provider !== 'clipboard') {
            const activeAIs = room.players.filter(p => p.isAI && !p.eliminated);
            
            const hasAtSymbol = text.includes('@');
            const mentionedAI = activeAIs.find(ai => {
              const cleanName = ai.name.toLowerCase();
              const cleanNation = (ai.nationName || '').toLowerCase();
              
              if (hasAtSymbol) {
                return (
                  text.toLowerCase().includes(`@${cleanName}`) || 
                  (cleanNation && text.toLowerCase().includes(`@${cleanNation}`))
                );
              } else {
                return (
                  text.toLowerCase().includes(cleanName) || 
                  (cleanNation && text.toLowerCase().includes(cleanNation))
                );
              }
            });
            const targetAI = mentionedAI || (activeAIs.length > 0 && Math.random() < 0.35 ? activeAIs[Math.floor(Math.random() * activeAIs.length)] : null);

            if (targetAI) {
              // If the AI was not explicitly mentioned, check if the limit of 4 spontaneous messages has already been reached before making the API call
              const currentCount = (room.gameState.aiMessagesSentThisTurn && room.gameState.aiMessagesSentThisTurn[targetAI.id]) || 0;
              if (!mentionedAI && currentCount >= 4) {
                return;
              }

              setTimeout(async () => {
                try {
                  // Compile a complete map layout showing every territory, its owner, and armies
                  const boardSummary = Object.entries(room.gameState.territories)
                    .map(([id, t]) => {
                      const name = room.mapData.territories.find(m => m.id === id)?.name || id;
                      const owner = room.gameState.players.find(p => p.id === t.ownerId);
                      const ownerLabel = owner ? owner.name : (t.ownerId === 'dummy' ? 'Neutral' : 'Unknown');
                      return `"${name}" held by ${ownerLabel} (${t.armies} armies)`;
                    }).join(', ');

                  const chatPrompt = `You are ${targetAI.name}, an AI commander in a live game of Risk. 
The current complete board state is: [${boardSummary}].
A human player named "${senderName}" said in chat: "${text}". 
Reply in 1 short, punchy paragraph (1 to 3 sentences max). Maintain your character and make decisions keeping the actual owners of these territories in mind. Output valid JSON: {"commentary": "Your reply here"}`;
                  
                  const config = room.llmProviderConfig;
            const res = await callLLMProvider({
              provider: config.provider,
              model: config.model,
              apiKey: config.apiKey,
              baseURL: config.baseURL,
              prompt: chatPrompt
            });
            if (res && res.commentary) {
              // Use the unified sender helper; if explicitly addressed/mentioned, we bypass the limit and do not increment the counter
              RoomManager.sendAIChatMessage(room, io, targetAI, res.commentary, '🤖', !!mentionedAI, '[LLM]');
            }
          } catch (err) {
            console.error('LLM Chat Reply Error:', err.message);
          }
        }, 800);
      }
    }
    if (room.gameState && !room.generativeAIMode && !room.gameState.generativeAIMode) {
      const parsed = AIEngine.parseChatMessage(text, room.players, room.mapData);
      const senderNameClean = player ? player.name : 'Commander';
      let context = { sender: senderNameClean, gameMode: room.gameState.gameMode };

      let replyQueue = []; // Accumulate replies to stagger their timing

      if (parsed.intent === "BRAG") {
        const ownedCount = Object.values(room.gameState.territories).filter(t => t.ownerId === socket.id).length;
        const totalCount = Object.keys(room.gameState.territories).length || 1;
        const controlRatio = ownedCount / totalCount;

        const isFalseBrag = controlRatio <= 0.45;
        const dialogueCategory = isFalseBrag ? "FALSE_BRAG_ROAST" : "BRAG_RESPONSE";

        // EACH active AI player has an independent 50% chance of replying
        const activeAIs = room.gameState.players.filter(p => p.isAI && !p.eliminated && p.id !== socket.id);
        activeAIs.forEach(ai => {
          if (Math.random() < 0.50) {
            const responseText = AIEngine.getDialogue(dialogueCategory, ai.personality || 'normal', context);
            replyQueue.push({ ai, text: responseText });
          }
        });
        
      } else if (parsed.intent === "ALLIANCE_FORMED") {
        const alliedPlayer = room.gameState.players.find(p => p.id === parsed.recipientId);
        const targetEnemyPlayer = room.gameState.players.find(p => p.id === parsed.subjectId);

        const hasAlliance = room.gameState.pacts.some(p => 
          p.type === 'alliance' && 
          ((p.playerA === socket.id && p.playerB === parsed.recipientId) ||
           (p.playerB === socket.id && p.playerA === parsed.recipientId))
        );

        if (!hasAlliance) {
          // Fake Claim Callout: Nero is guaranteed to reject the fake claim
          if (alliedPlayer && alliedPlayer.isAI && !alliedPlayer.eliminated && alliedPlayer.id !== socket.id) {
            context.recipient = alliedPlayer.name;
            const responseText = AIEngine.getDialogue("ALLIANCE_FAKE_CLAIM", alliedPlayer.personality || 'normal', context);
            replyQueue.push({ ai: alliedPlayer, text: responseText });
          }
        } else {
          if (alliedPlayer) {
            context.recipient = alliedPlayer.name;

            // 1. Alliance Partner AI: 80% chance of replying supportively
            if (alliedPlayer.isAI && !alliedPlayer.eliminated && alliedPlayer.id !== socket.id) {
              if (Math.random() < 0.80) {
                const alliedContext = { ...context, subject: targetEnemyPlayer ? targetEnemyPlayer.name : 'the enemy' };
                const responseText = AIEngine.getDialogue("ALLIANCE_ACCEPT", alliedPlayer.personality || 'normal', alliedContext);
                replyQueue.push({ ai: alliedPlayer, text: responseText });
              }
            }
          }

          // 2. Alliance Target Enemy AI (The one being ganged up on): High 80% chance of replying in defiance
          if (targetEnemyPlayer && targetEnemyPlayer.isAI && !targetEnemyPlayer.eliminated && targetEnemyPlayer.id !== socket.id) {
            if (Math.random() < 0.80) {
              const enemyContext = { ...context, recipient: alliedPlayer ? alliedPlayer.name : 'your partner' };
              const responseText = AIEngine.getDialogue("ALLIANCE_TARGET_RESPONSE", targetEnemyPlayer.personality || 'normal', enemyContext);
              replyQueue.push({ ai: targetEnemyPlayer, text: responseText });
            }
          }

          // 3. Bystander AIs: Each has an independent 50% chance of commenting
          const bystanderAIs = room.gameState.players.filter(p => 
            p.isAI && 
            !p.eliminated && 
            p.id !== socket.id && 
            p.id !== parsed.recipientId && 
            p.id !== parsed.subjectId
          );
          bystanderAIs.forEach(ai => {
            if (Math.random() < 0.50) {
              const responseText = AIEngine.getDialogue("ALLIANCE_FORMED_RESPONSE", ai.personality || 'normal', context);
              replyQueue.push({ ai, text: responseText });
            }
          });
        }
        
      } else if (parsed.intent === "BETRAYAL_ANNOUNCE") {
        // The betrayed AI is guaranteed to reply in anger/shock (100% chance)
        const betrayedAI = room.gameState.players.find(p => p.id === parsed.recipientId);
        if (betrayedAI && betrayedAI.isAI && !betrayedAI.eliminated) {
          const responseText = AIEngine.getDialogue("BETRAYAL_DEFEND", betrayedAI.personality || 'normal', context);
          replyQueue.push({ ai: betrayedAI, text: responseText });
        }
      } else if (parsed.intent === "PROTEST") {
        // Protesting a border build-up: Guaranteed response from target
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          const borderTerritoryId = parsed.targetTerritoryId;
          const borderTerrName = borderTerritoryId ? (room.mapData.territories.find(t => t.id === borderTerritoryId)?.name || 'the border') : 'the border';
          
          let continentName = 'the region';
          const cont = room.mapData.continents.find(c => c.territoryIds.includes(borderTerritoryId));
          if (cont) continentName = cont.name;

          const borderContext = { ...context, border_territory: borderTerrName, requested_territory: borderTerrName, continent_name: continentName };
          const trust = AIEngine.getTrustScore(targetAI, socket.id);
          const accept = trust >= 50; // accepts if trust is favorable

          if (accept && borderTerritoryId) {
            targetAI.vacateTerritory = borderTerritoryId; // move troops away on next turn
            AIEngine.adjustTrustScore(targetAI, socket.id, 10);
            const responseText = AIEngine.getDialogue("PROTEST_ACCEPT", targetAI.personality || 'normal', borderContext);
            replyQueue.push({ ai: targetAI, text: responseText });
          } else {
            AIEngine.adjustTrustScore(targetAI, socket.id, -5);
            const responseText = AIEngine.getDialogue("PROTEST_DECLINE", targetAI.personality || 'normal', borderContext);
            replyQueue.push({ ai: targetAI, text: responseText });
          }
        }
        } else if (parsed.intent === "TRASH_TALK") {
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          const responseText = AIEngine.getDialogue("TRASH_TALK_RESPONSE", targetAI.personality || 'normal', context);
          replyQueue.push({ ai: targetAI, text: responseText });
        }
      } else if (parsed.intent === "BULLYING_COMPLAINT") {
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId) || room.gameState.players.find(p => p.isAI && !p.eliminated && p.id !== socket.id);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          const attacksOnPlayer = (targetAI.attackedPlayerHistory && targetAI.attackedPlayerHistory[socket.id]) || 0;
          const isBullying = attacksOnPlayer >= 2;
          const dialogueType = isBullying ? "COMPLAINT_OF_BULLYING" : "FALSE_BULLYING_RESPONSE";
          const responseText = AIEngine.getDialogue(dialogueType, targetAI.personality || 'normal', context);
          replyQueue.push({ ai: targetAI, text: responseText });
        }
      } else if (parsed.intent === "LOST_CAPITAL_DEFIANCE") {
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId) || room.gameState.players.find(p => p.isAI && !p.eliminated && p.id !== socket.id);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          const playerCapitalId = room.gameState.capitals ? room.gameState.capitals[socket.id] : null;
          const playerCapitalTerr = playerCapitalId ? room.gameState.territories[playerCapitalId] : null;
          const playerLostCapital = playerCapitalTerr && playerCapitalTerr.ownerId !== socket.id;
          const isCapitalRush = room.gameState.gameMode === 'capital_rush';
          
          const isValidDefiance = isCapitalRush && playerLostCapital;
          const dialogueType = isValidDefiance ? "LOST_CAPITAL_DEFIANCE" : "FALSE_CAPITAL_DEFIANCE_RESPONSE";
          const responseText = AIEngine.getDialogue(dialogueType, targetAI.personality || 'normal', context);
          replyQueue.push({ ai: targetAI, text: responseText });
        }
      } else if (parsed.intent === "FINAL_DUEL_DECLARATION") {
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId) || room.gameState.players.find(p => p.isAI && !p.eliminated && p.id !== socket.id);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          const activeCount = room.gameState.players.filter(p => !p.eliminated).length;
          const isValidDuel = activeCount === 2;
          const dialogueType = isValidDuel ? "FINAL_DUEL_DECLARATION" : "FALSE_FINAL_DUEL_RESPONSE";
          const responseText = AIEngine.getDialogue(dialogueType, targetAI.personality || 'normal', context);
          replyQueue.push({ ai: targetAI, text: responseText });
        }
      } else if (parsed.intent === "MERCY") {
        // Plea for mercy: Guaranteed response from target
        const targetAI = room.gameState.players.find(p => p.id === parsed.recipientId);
        if (targetAI && targetAI.isAI && !targetAI.eliminated) {
          targetAI.mercyPleaded = targetAI.mercyPleaded || {};

          // Anti-Abuse Cooldown Check
          if (targetAI.mercyPleaded[socket.id]) {
            AIEngine.adjustTrustScore(targetAI, socket.id, -15);
            const responseText = AIEngine.getDialogue("MERCY_ANNOYED", targetAI.personality || 'normal', context);
            replyQueue.push({ ai: targetAI, text: responseText });
          } else {
            targetAI.mercyPleaded[socket.id] = true; // flag as used once

            // Determine if the human is actually on the ropes
            const ownedCount = Object.values(room.gameState.territories).filter(t => t.ownerId === socket.id).length;
            if (ownedCount > 2) {
              // Too strong to ask for mercy! Immediate decline
              AIEngine.adjustTrustScore(targetAI, socket.id, -5);
              const mercyContext = { ...context, count: ownedCount };
              const responseText = AIEngine.getDialogue("MERCY_FAIL_TOO_STRONG", targetAI.personality || 'normal', mercyContext);
              replyQueue.push({ ai: targetAI, text: responseText });
            } else {
              // Genuinely on the ropes (ownedCount <= 2)
              const trust = AIEngine.getTrustScore(targetAI, socket.id);
              
              // Evaluate base chance of mercy by personality type
              const p = targetAI.personality || 'normal';
              let baseChance = 40; // normal / goofball
              if (p === 'kind') baseChance = 70;
              else if (p === 'strategic' || p === 'cynical') baseChance = 25;
              else if (p === 'aggressive') baseChance = 15;

              // Trust offsets base probability
              const finalChance = Math.max(5, Math.min(95, baseChance + (trust - 50) * 0.6));
              const accept = Math.random() * 100 < finalChance;

              if (accept) {
                targetAI.doNotAttack = targetAI.doNotAttack || {};
                targetAI.doNotAttack[socket.id] = 'all'; // ceasefire against all target's territories
                
                targetAI.mercyCeasefireTurns = targetAI.mercyCeasefireTurns || {};
                targetAI.mercyCeasefireTurns[socket.id] = 2; // stays active for 2 full turns
                
                AIEngine.adjustTrustScore(targetAI, socket.id, 10);
                const responseText = AIEngine.getDialogue("MERCY_ACCEPT", targetAI.personality || 'normal', context);
                replyQueue.push({ ai: targetAI, text: responseText });
              } else {
                const responseText = AIEngine.getDialogue("MERCY_DECLINE", targetAI.personality || 'normal', context);
                replyQueue.push({ ai: targetAI, text: responseText });
              }
            }
          }
        }
      }

      // Dispatch queued replies with staggered timeouts
      if (replyQueue.length > 0) {
        replyQueue.forEach((item, index) => {
          setTimeout(() => {
            // Re-verify room status before pushing delayed messages
            const currentRoom = RoomManager.getRoom(roomCode);
            if (!currentRoom || currentRoom.status !== 'PLAYING') return;

            const aiChat = {
              senderName: `${item.ai.name} [AI]`,
              senderColor: item.ai.color,
              text: `💬 "${item.text}"`,
              timestamp: new Date().toLocaleTimeString()
            };
            currentRoom.gameState.chatArchive.push(aiChat);
            io.to(roomCode).emit('chatMessage', aiChat);
          }, 1000 + index * 600); // 1.0s, 1.6s, 2.2s...
        });
      }

      // Traditional @recipient targeting logic (Ceasefires, Alliances, claims, etc.)
      const proposalIntents = ["CEASEFIRE", "ALLIANCE", "BETRAYAL_ACCUSATION", "BETRAYAL_ANNOUNCE", "MOVE_TROOPS", "CLAIM_TERRITORY"];
      if (parsed.recipientId && text.includes('@') && proposalIntents.includes(parsed.intent)) {
        const recipientAI = room.gameState.players.find(p => p.id === parsed.recipientId);
        
        if (recipientAI && recipientAI.isAI && !recipientAI.eliminated) {
          const personality = recipientAI.personality || 'normal';
          let responseText = "...";
          let dialogType = "";

          const trust = AIEngine.getTrustScore(recipientAI, socket.id);

          // Failsafe: Check if a pact already exists before allowing ceasefire/alliance proposals
          const alreadyHasPact = room.gameState.pacts.some(p => 
            (p.playerA === socket.id && p.playerB === parsed.recipientId) ||
            (p.playerB === socket.id && p.playerA === parsed.recipientId)
          );

          if (parsed.intent === "BETRAYAL_ANNOUNCE") {
            // Player is breaking an alliance/truce with target AI
            dialogType = "BETRAYAL_DEFEND";
            responseText = AIEngine.getDialogue(dialogType, personality, context);

            // Lower trust score, remove active promises and clear pacts
            AIEngine.adjustTrustScore(recipientAI, socket.id, -30);
            if (recipientAI.diplomaticPromises) {
              delete recipientAI.diplomaticPromises[socket.id];
            }
            if (recipientAI.betrayedByPlayers) {
              recipientAI.betrayedByPlayers[socket.id] = true;
            }
            room.gameState.pacts = room.gameState.pacts.filter(p =>
              !((p.playerA === socket.id && p.playerB === parsed.recipientId) ||
                (p.playerB === socket.id && p.playerA === parsed.recipientId))
            );

          } else if (parsed.intent === "CEASEFIRE") {
            if (alreadyHasPact) {
              dialogType = "PACT_FAIL_ALREADY_EXISTS";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else {
              const accept = trust >= 40;
              dialogType = accept ? "CEASEFIRE_ACCEPT" : "CEASEFIRE_DECLINE";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
              
              recipientAI.diplomaticPromises = recipientAI.diplomaticPromises || {};
              recipientAI.diplomaticPromises[socket.id] = accept ? 'non_aggression' : 'refused';
            }

          } else if (parsed.intent === "ALLIANCE") {
            const subject = room.gameState.players.find(p => p.id === parsed.subjectId || p.nationId === parsed.subjectId);
            const fallbackSubject = (room.gameState && room.gameState.isScenario) ? 'the enemy powers' : 'the enemy';
            context.subject = subject ? subject.name : fallbackSubject;

            if (parsed.subjectId === socket.id) {
              // Loophole check: Asking AI to ally against the player themselves
              dialogType = "ALLIANCE_FAIL_TARGET_SENDER";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else if (parsed.subjectId === parsed.recipientId) {
              // Loophole check: Asking AI to ally against itself
              dialogType = "ALLIANCE_FAIL_TARGET_RECIPIENT";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else if (alreadyHasPact) {
              dialogType = "PACT_FAIL_ALREADY_EXISTS";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else {
              const accept = trust >= 65;
              dialogType = accept ? "ALLIANCE_ACCEPT" : "ALLIANCE_DECLINE";
              responseText = AIEngine.getDialogue(dialogType, personality, context);

              recipientAI.diplomaticPromises = recipientAI.diplomaticPromises || {};
              recipientAI.diplomaticPromises[socket.id] = accept ? 'alliance' : 'refused';
            }

          } else if (parsed.intent === "BETRAYAL_ACCUSATION") {
            const hasActuallyBetrayed = recipientAI.betrayedPlayers && recipientAI.betrayedPlayers[socket.id] === true;
            const playerIsTheTraitor = recipientAI.betrayedByPlayers && recipientAI.betrayedByPlayers[socket.id] === true;

            if (playerIsTheTraitor) {
              // Loophole check: Human betrayed AI, but is falsely accusing them
              dialogType = "ACCUSATION_REVERSE";
            } else {
              dialogType = hasActuallyBetrayed ? "BETRAYAL_RESPONSE" : "ACCUSATION_DENIAL";
            }
            
            responseText = AIEngine.getDialogue(dialogType, personality, context);

          } else if (parsed.intent === "MOVE_TROOPS") {
            const terr = room.mapData.territories.find(t => t.id === parsed.targetTerritoryId) || { name: 'the border' };
            context.border_territory = terr.name;

            const terrState = room.gameState.territories[parsed.targetTerritoryId];
            const aiOwns = terrState && terrState.ownerId === parsed.recipientId;
            const hasSpareArmies = terrState && terrState.armies > 1;

            // Failsafe: If AI does not own the territory or has no extra troops to move, reject the premise
            if (!aiOwns || !hasSpareArmies) {
              dialogType = "MOVE_TROOPS_FAIL_NO_TROOPS";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else {
              const accept = trust >= 50;
              dialogType = accept ? "MOVE_TROOPS_ACCEPT" : "MOVE_TROOPS_DECLINE";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
              
              if (accept) {
                recipientAI.vacateTerritory = parsed.targetTerritoryId;
              }
            }

          } else if (parsed.intent === "CLAIM_TERRITORY") {
            const terr = room.mapData.territories.find(t => t.id === parsed.targetTerritoryId) || { name: 'the sector' };
            context.requested_territory = terr.name;

            // Calculate continent name to prevent [continent_name] string bugs
            let continentName = 'the region';
            const cont = room.mapData.continents.find(c => c.territoryIds.includes(parsed.targetTerritoryId));
            if (cont) continentName = cont.name;
            context.continent_name = continentName;

            // Calculate a random territory owned by the replying AI
            const aiOwned = Object.keys(room.gameState.territories).filter(tid => room.gameState.territories[tid].ownerId === parsed.recipientId);
            const aiTerrName = aiOwned.length > 0 
              ? (room.mapData.territories.find(t => t.id === aiOwned[Math.floor(Math.random() * aiOwned.length)])?.name || 'my borders')
              : 'my borders';
            context.ai_territory = aiTerrName;

            const terrState = room.gameState.territories[parsed.targetTerritoryId];
            const senderOwns = terrState && terrState.ownerId === socket.id;
            const aiOwns = terrState && terrState.ownerId === parsed.recipientId;

            // Failsafe: Evaluate ownership loops before agreeing/disagreeing
            if (senderOwns) {
              dialogType = "CLAIM_TERRITORY_FAIL_SENDER_OWNS";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else if (aiOwns) {
              dialogType = "CLAIM_TERRITORY_FAIL_AI_OWNS";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
            } else {
              const accept = trust >= 45;
              dialogType = accept ? "CLAIM_TERRITORY_ACCEPT" : "CLAIM_TERRITORY_DECLINE";
              responseText = AIEngine.getDialogue(dialogType, personality, context);
              
              if (accept && parsed.targetTerritoryId) {
                recipientAI.doNotAttack = recipientAI.doNotAttack || {};
                recipientAI.doNotAttack[socket.id] = parsed.targetTerritoryId;
              }
            }
          }
          

          // Broadcast AI's conversational reply
          setTimeout(() => {
            const aiChat = {
              senderName: `${recipientAI.name} [AI]`,
              senderColor: recipientAI.color,
              text: `💬 "${responseText}"`,
              timestamp: new Date().toLocaleTimeString()
            };
            if (room.gameState) {
              room.gameState.chatArchive.push(aiChat);
            }
            io.to(roomCode).emit('chatMessage', aiChat);
          }, 1200);
        }
      }
    }
  });
// Account System Events
  socket.on('accountRegister', ({ username, password }, callback) => {
    const res = UserDB.register(username, password);
    if (callback) callback(res);
  });

  socket.on('accountLogin', ({ username, password }, callback) => {
    const res = UserDB.login(username, password);
    if (callback) callback(res);
  });

  socket.on('accountAutoLogin', ({ username, token }, callback) => {
    const res = UserDB.autoLogin(username, token);
    if (callback) callback(res);
  });

  socket.on('getAccountStats', ({ username }, callback) => {
    const res = UserDB.getAccountStats(username);
    if (callback) callback(res);
  });

  socket.on('updateBattleCard', ({ username, battleCard }, callback) => {
    const res = UserDB.updateBattleCard(username, battleCard);
    if (callback) callback(res);
  });
  socket.on('triggerSecretAchievement', ({ username, achId, roomCode, proof }, callback) => {
    const room = RoomManager.getRoom(roomCode);
    const isEligible = room && room.gameState && room.gameState.matchStartedWithMinTwoHumans;
    // Allow-list: only these client-initiated secret actions may be granted, and
    // each requires a server-side proof value sent by the client so a raw socket
    // call can't self-grant arbitrary achievements.
    const SECRET_ACHIEVEMENT_ACTIONS = {
      secret_anime_scroll: (g, p) => !!p,
      secret_choose_already: (g, p) => Number(p) >= 6
    };
    const validator = SECRET_ACHIEVEMENT_ACTIONS[achId];
    if (!validator || !isEligible || !validator(room.gameState, proof)) {
      if (callback) callback({ error: 'Not eligible' });
      return;
    }
    const res = UserDB.grantAchievement(username, achId, isEligible);
    if (callback) callback(res || { success: false });
  });

  
  // 14. Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const res = RoomManager.removePlayer(socket.id);
    if (res && res.success) {
      const room = RoomManager.getRoom(res.code);
      if (room) {
        if (res.status === 'LOBBY') {
          io.to(res.code).emit('playersUpdate', room.players);
        } else if (res.status === 'PLAYING') {
          // Player became AI, notify room and push updated state
          io.to(res.code).emit('playersUpdate', room.players);
          // Sanitized broadcast: raw gameState includes the unbounded history
          // array which stalls the event loop and client in long games.
          io.to(res.code).emit('gameStateUpdate', RoomManager.getSanitizedGameState(room.gameState));
          
          // Broadcast system message about disconnect
          io.to(res.code).emit('chatMessage', {
            senderName: 'SYSTEM',
            senderColor: '#ff9900',
            text: `🔌 ${res.leftPlayer.originalName || res.leftPlayer.name} has disconnected. An AI bot has taken command of their forces.`,
            timestamp: new Date().toLocaleTimeString()
          });

          // If it was the disconnected player's turn, trigger AI moves
          const curPlayer = room.gameState.players[room.gameState.turnIndex];
          if (curPlayer.id === socket.id) {
            RoomManager.runAITurn(room, io);
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Factional Risk Server is running on port ${PORT}`);
});
