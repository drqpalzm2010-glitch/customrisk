const GameEngine = require('./game-engine');
const AIEngine = require('./ai-engine');
const { callLLMProvider } = require('./llm-provider');
const { generateLLMPrompt } = require('./prompt-generator');

const rooms = {};
// Helper to route and safely limit spontaneous AI chat messages to 4 per turn
function sendAIChatMessage(room, io, aiPlayer, text, prefixSymbol = '💬', ignoreLimit = false, suffix = '[AI]') {
  if (!room || !room.gameState || !aiPlayer) return;
  const gameState = room.gameState;
  gameState.aiMessagesSentThisTurn = gameState.aiMessagesSentThisTurn || {};

  if (!ignoreLimit) {
    const count = gameState.aiMessagesSentThisTurn[aiPlayer.id] || 0;
    if (count >= 4) {
      console.log(`[AI Chat Suppressed] Limit of 4 reached for ${aiPlayer.name} this turn.`);
      return; // Block message
    }
    gameState.aiMessagesSentThisTurn[aiPlayer.id] = count + 1;
  }

  const formattedText = text.startsWith('"') ? `${prefixSymbol} ${text}` : `${prefixSymbol} "${text}"`;

  const chatMsg = {
    senderName: `${aiPlayer.name} ${suffix}`,
    senderColor: aiPlayer.color,
    text: formattedText,
    timestamp: new Date().toLocaleTimeString()
  };

  gameState.chatArchive = gameState.chatArchive || [];
  gameState.chatArchive.push(chatMsg);
  io.to(room.code).emit('chatMessage', chatMsg);
}
// Key Minification Map for Network Compression
const KEY_MAP = {
  'territories': 't',
  'players': 'p',
  'blizzards': 'bl',
  'radiation': 'ra',
  'nukes': 'nu',
  'thermonukes': 'tn',
  'turnIndex': 'ti',
  'turnStage': 'ts',
  'turnIndex': 'ti',
  'turnStage': 'ts',
  'draftPool': 'dp',
  'pacts': 'pa',
  'capitals': 'ca',
  'conqueredThisTurn': 'ct',
  'tradeInCount': 'tc',
  'gameMode': 'gm',
  'cardTradeRule': 'cr',
  'isPaused': 'ip',
  'historyLength': 'hl',
  'ownerId': 'o',
  'armies': 'a',
  'id': 'i',
  'name': 'n',
  'color': 'c',
  'nationId': 'nid',
  'nationName': 'nn',
  'eliminated': 'e',
  'cards': 'ca_hand'
};

function compressState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state)) {
    return state.map(compressState);
  }
  const compressed = {};
  for (const [key, val] of Object.entries(state)) {
    const shortKey = KEY_MAP[key] || key;
    compressed[shortKey] = compressState(val);
  }
  return compressed;
}

// Helper to sanitize gameState for live socket broadcasts (omits heavy history array to prevent memory & network bloat in long games)
function getSanitizedGameState(gameState) {
  if (!gameState) return null;

  // Auto-heal orphaned POST_ATTACK_MOVE stage if context is missing or invalid
  if (gameState.turnStage === 'POST_ATTACK_MOVE') {
    const ctx = gameState.postAttackContext;
    if (!ctx || !ctx.sourceId || !ctx.targetId || !gameState.territories[ctx.sourceId] || !gameState.territories[ctx.targetId]) {
      gameState.postAttackContext = null;
      const curP = gameState.players ? gameState.players[gameState.turnIndex] : null;
      const cardCount = curP && curP.cards ? curP.cards.length : 0;
      gameState.turnStage = cardCount >= 6 ? 'DRAFT' : 'ATTACK';
    }
  }

  const { history, ...sanitized } = gameState;

  // Bandwidth Optimization: Slice logs to only send the last 5 entries
  let logs = sanitized.logs;
  if (logs && logs.length > 5) {
    logs = logs.slice(-5);
  }

  // Bandwidth Optimization: Slice chatArchive to only send the last 5 entries
  let chatArchive = sanitized.chatArchive;
  if (chatArchive && chatArchive.length > 5) {
    chatArchive = chatArchive.slice(-5);
  }

  const cleanState = {
    ...sanitized,
    logs,
    chatArchive,
    historyLength: history ? history.length : 0
  };

  // Minify the payload keys transparently before broadcasting over the wire
  return compressState(cleanState);
}

// Generate random room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms[code] ? generateRoomCode() : code;
}

function getRoom(code) {
  return rooms[code.toUpperCase()];
}

function handleCombatDialogue(room, io, rolls) {
  if (!rolls || !room.gameState) return;

  // 0. Check Betrayal Dialogue
  if (rolls.betrayed) {
    const attackerObj = room.gameState.players.find(p => p.id === rolls.attackerId);
    const defenderObj = room.gameState.players.find(p => p.id === rolls.defenderId);

    if (attackerObj || defenderObj) {
      setTimeout(() => {
        if (!room.gameState) return;
        const chatContext = { sender: attackerObj ? attackerObj.name : 'Attacker', recipient: defenderObj ? defenderObj.name : 'Defender', gameMode: room.gameState.gameMode };

        if (attackerObj && attackerObj.isAI) {
          const betrayerText = AIEngine.getDialogue("BETRAYAL_ATTACK", attackerObj.personality || 'normal', chatContext);
          const betrayerChat = {
            senderName: `${attackerObj.name} [AI]`,
            senderColor: attackerObj.color,
            text: `⚔️ "${betrayerText}"`,
            timestamp: new Date().toLocaleTimeString()
          };
          room.gameState.chatArchive = room.gameState.chatArchive || [];
          room.gameState.chatArchive.push(betrayerChat);
          io.to(room.code).emit('chatMessage', betrayerChat);
        }

        if (defenderObj && defenderObj.isAI) {
          setTimeout(() => {
            if (!room.gameState) return;
            const defenderText = AIEngine.getDialogue("BETRAYAL_DEFEND", defenderObj.personality || 'normal', chatContext);
            const defenderChat = {
              senderName: `${defenderObj.name} [AI]`,
              senderColor: defenderObj.color,
              text: `😡 "${defenderText}"`,
              timestamp: new Date().toLocaleTimeString()
            };
            room.gameState.chatArchive = room.gameState.chatArchive || [];
            room.gameState.chatArchive.push(defenderChat);
            io.to(room.code).emit('chatMessage', defenderChat);
          }, 600);
        }
      }, 400);
    }
  }

  // 1. Check Persistent Bullying Complaint (attacked consecutively across 3 turns)
  if (rolls.bullyingVictimId && rolls.bullyingAttackerId) {
    const victim = room.gameState.players.find(p => p.id === rolls.bullyingVictimId);
    const attackerObj = room.gameState.players.find(p => p.id === rolls.bullyingAttackerId);
    if (victim && victim.isAI && attackerObj) {
      setTimeout(() => {
        if (!room.gameState) return;
        const text = AIEngine.getDialogue("COMPLAINT_OF_BULLYING", victim.personality || 'normal', { sender: victim.name, recipient: attackerObj.name, gameMode: room.gameState.gameMode });
        const chatMsg = {
          senderName: `${victim.name} [AI]`,
          senderColor: victim.color,
          text: `💬 "${text}"`,
          timestamp: new Date().toLocaleTimeString()
        };
        room.gameState.chatArchive = room.gameState.chatArchive || [];
        room.gameState.chatArchive.push(chatMsg);
        io.to(room.code).emit('chatMessage', chatMsg);
      }, 1000);
    }
  }

  // 2. Check Defiance of Lost Capital (Capital Rush mode center capture)
  if (rolls.lostCapitalOwnerId && room.gameState.gameMode === 'capital_rush') {
    const capitalOwner = room.gameState.players.find(p => p.id === rolls.lostCapitalOwnerId);
    const conqueror = room.gameState.players.find(p => p.id === rolls.attackerId);
    if (capitalOwner && capitalOwner.isAI && !capitalOwner.eliminated && conqueror) {
      setTimeout(() => {
        if (!room.gameState) return;
        const text = AIEngine.getDialogue("LOST_CAPITAL_DEFIANCE", capitalOwner.personality || 'normal', { sender: capitalOwner.name, recipient: conqueror.name, gameMode: room.gameState.gameMode });
        const chatMsg = {
          senderName: `${capitalOwner.name} [AI]`,
          senderColor: capitalOwner.color,
          text: `🎖️ "${text}"`,
          timestamp: new Date().toLocaleTimeString()
        };
        room.gameState.chatArchive = room.gameState.chatArchive || [];
        room.gameState.chatArchive.push(chatMsg);
        io.to(room.code).emit('chatMessage', chatMsg);
      }, 1400);
    }
  }

  // 3. Check 1v1 Sudden Death State (exactly 2 active players remain)
  const activePlayers = room.gameState.players.filter(p => !p.eliminated);
  if (activePlayers.length === 2 && !room.gameState.finalDuelTriggered) {
    room.gameState.finalDuelTriggered = true;
    const challenger = activePlayers.find(p => p.isAI);
    const opponent = activePlayers.find(p => p.id !== challenger?.id);
    if (challenger && opponent) {
      setTimeout(() => {
        if (!room.gameState) return;
        // Verify 1v1 is still true after the timeout
        if (room.gameState.players.filter(p => !p.eliminated).length !== 2) return;
        
        const text = AIEngine.getDialogue("FINAL_DUEL_DECLARATION", challenger.personality || 'normal', { sender: challenger.name, recipient: opponent.name, gameMode: room.gameState.gameMode });
        const chatMsg = {
          senderName: `${challenger.name} [AI]`,
          senderColor: challenger.color,
          text: `⚔️ "${text}"`,
          timestamp: new Date().toLocaleTimeString()
        };
        room.gameState.chatArchive = room.gameState.chatArchive || [];
        room.gameState.chatArchive.push(chatMsg);
        io.to(room.code).emit('chatMessage', chatMsg);
      }, 2200);

      // If both remaining players are AIs, trigger a staggered response dialogue from the opponent!
      if (opponent.isAI) {
        setTimeout(() => {
          if (!room.gameState) return;
          // Verify 1v1 is still true after the timeout
          if (room.gameState.players.filter(p => !p.eliminated).length !== 2) return;

          const text = AIEngine.getDialogue("FINAL_DUEL_RESPONSE", opponent.personality || 'normal', { sender: opponent.name, recipient: challenger.name, gameMode: room.gameState.gameMode });
          const chatMsg = {
            senderName: `${opponent.name} [AI]`,
            senderColor: opponent.color,
            text: `⚔️ "${text}"`,
            timestamp: new Date().toLocaleTimeString()
          };
          room.gameState.chatArchive = room.gameState.chatArchive || [];
          room.gameState.chatArchive.push(chatMsg);
          io.to(room.code).emit('chatMessage', chatMsg);
        }, 3800); // Staggered by 1.6 seconds
      }
    }
  }

  // 4. Check Bad Dice Dialogue (lost 2+ units in two consecutive battles)
  if (rolls.badDicePlayerId) {
    const victim = room.gameState.players.find(p => p.id === rolls.badDicePlayerId);
    // Find an active bystander/opponent AI to comment on the terrible bad luck
    let commenterAI = room.gameState.players.find(p => p.isAI && !p.eliminated && p.id !== rolls.badDicePlayerId);
    if (!commenterAI && victim && victim.isAI && !victim.eliminated) {
      commenterAI = victim;
    }

    if (commenterAI && victim && Math.random() < 0.30) {
      const text = AIEngine.getDialogue("BAD_DICE_RESPONSE", commenterAI.personality || 'normal', { subject: victim.name, gameMode: room.gameState.gameMode });
      const chatMsg = {
        senderName: `${commenterAI.name} [AI]`,
        senderColor: commenterAI.color,
        text: `💬 "${text}"`,
        timestamp: new Date().toLocaleTimeString()
      };
      room.gameState.chatArchive = room.gameState.chatArchive || [];
      room.gameState.chatArchive.push(chatMsg);
      io.to(room.code).emit('chatMessage', chatMsg);
    }
  }

  // 2. Check Wipes and Elimination Speeches
  if (rolls.eliminatedPlayerId && rolls.killerPlayerId) {
    const eliminated = room.gameState.players.find(p => p.id === rolls.eliminatedPlayerId);
    const killer = room.gameState.players.find(p => p.id === rolls.killerPlayerId);

    if (eliminated && killer) {
      // Wiped out AI player says their goodbye
      if (eliminated.isAI) {
        setTimeout(() => {
          if (!room.gameState) return;
          const text = AIEngine.getDialogue("ELIMINATION_SPEECH", eliminated.personality || 'normal', { sender: eliminated.name, recipient: killer.name, gameMode: room.gameState.gameMode });
          const chatMsg = {
            senderName: `${eliminated.name} [AI]`,
            senderColor: eliminated.color,
            text: `💀 "${text}"`,
            timestamp: new Date().toLocaleTimeString()
          };
          room.gameState.chatArchive = room.gameState.chatArchive || [];
          room.gameState.chatArchive.push(chatMsg);
          io.to(room.code).emit('chatMessage', chatMsg);
        }, 800);
      }

      // Successful Killer AI player brags about the annihilation
      if (killer.isAI) {
        setTimeout(() => {
          if (!room.gameState) return;
          const text = AIEngine.getDialogue("CONQUER_SPEECH", killer.personality || 'normal', { sender: killer.name, recipient: eliminated.name, gameMode: room.gameState.gameMode });
          const chatMsg = {
            senderName: `${killer.name} [AI]`,
            senderColor: killer.color,
            text: `⚔️ "${text}"`,
            timestamp: new Date().toLocaleTimeString()
          };
          room.gameState.chatArchive = room.gameState.chatArchive || [];
          room.gameState.chatArchive.push(chatMsg);
          io.to(room.code).emit('chatMessage', chatMsg);
        }, 1600);
      }
    }
  }
}

// Generate a unique color not currently taken by any player in the room
function getUniqueColor(room) {
  const taken = new Set(room.players.map(p => p.color.toLowerCase()));
  const presetColors = ['#ff3366', '#33ff66', '#3366ff', '#ffcc00', '#ff00ff', '#00ffff', '#ffffff', '#ff9900'];
  for (const col of presetColors) {
    if (!taken.has(col.toLowerCase())) return col;
  }
  // dynamic fallback
  while (true) {
    const col = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    if (!taken.has(col.toLowerCase())) return col;
  }
}

function createRoom(hostSocketId, playerName, playerColor, mapData) {
  const code = generateRoomCode();
  const isScenarioCapRush = !!(mapData && mapData.isScenario && mapData.scenarioSettings && mapData.scenarioSettings.capitalRush);
  rooms[code] = {
    code,
    hostId: hostSocketId,
    status: 'LOBBY',
    gameMode: 'auto',
    allowCrafting: false, // Nuke crafting is opt-IN (matches unchecked lobby checkbox); enabled when host toggles "Allow Crafting of Nukes"
    mapData,
    players: [
      {
        id: hostSocketId,
        name: playerName || 'Host Player',
        color: (playerColor || '#00e5ff').trim().toLowerCase(),
        isHost: true,
        isAI: false,
        autoDefend: true
      }
    ],
    gameState: null
  };
  return rooms[code];
}

function joinRoom(socketId, code, playerName, playerColor) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };

  if (room.status !== 'LOBBY') {
    // Check if player is rejoining by name
    const normalizedName = (playerName || '').trim().toLowerCase();
    const existingPlayer = room.players.find(p => 
      p.disconnected && 
      p.originalName && 
      p.originalName.trim().toLowerCase() === normalizedName
    );

    if (existingPlayer) {
      const oldSocketId = existingPlayer.id;
      existingPlayer.id = socketId;
      existingPlayer.isAI = false;
      existingPlayer.name = existingPlayer.originalName;
      existingPlayer.disconnected = false;

      // Update in gameState
      if (room.gameState) {
        const statePlayer = room.gameState.players.find(p => p.id === oldSocketId);
        if (statePlayer) {
          statePlayer.id = socketId;
          statePlayer.isAI = false;
          statePlayer.name = statePlayer.originalName;
          statePlayer.disconnected = false;
        }

        // Update territory owners
        Object.keys(room.gameState.territories).forEach(tid => {
          if (room.gameState.territories[tid].ownerId === oldSocketId) {
            room.gameState.territories[tid].ownerId = socketId;
          }
        });

        // Update active capitals mapping
        if (room.gameState.capitals && room.gameState.capitals[oldSocketId] !== undefined) {
          room.gameState.capitals[socketId] = room.gameState.capitals[oldSocketId];
          delete room.gameState.capitals[oldSocketId];
        }

        // Update active pacts
        room.gameState.pacts.forEach(pact => {
          if (pact.playerA === oldSocketId) pact.playerA = socketId;
          if (pact.playerB === oldSocketId) pact.playerB = socketId;
        });

        // Update active proposals
        room.gameState.diplomacyProposals.forEach(prop => {
          if (prop.sender === oldSocketId) prop.sender = socketId;
          if (prop.receiver === oldSocketId) prop.receiver = socketId;
        });

        // Update active combatContext
        if (room.gameState.combatContext) {
          if (room.gameState.combatContext.defenderId === oldSocketId) {
            room.gameState.combatContext.defenderId = socketId;
          }
        }

        // Update lastDiceRolls
        if (room.gameState.lastDiceRolls) {
          if (room.gameState.lastDiceRolls.attackerId === oldSocketId) {
            room.gameState.lastDiceRolls.attackerId = socketId;
          }
          if (room.gameState.lastDiceRolls.defenderId === oldSocketId) {
            room.gameState.lastDiceRolls.defenderId = socketId;
          }
        }

        // Update history snapshots
        if (room.gameState.history) {
          room.gameState.history.forEach(h => {
            if (h.activePlayerId === oldSocketId) {
              h.activePlayerId = socketId;
            }
            if (h.players) {
              h.players.forEach(p => {
                if (p.id === oldSocketId) {
                  p.id = socketId;
                }
              });
            }
            if (h.territories) {
              Object.keys(h.territories).forEach(tid => {
                if (h.territories[tid].ownerId === oldSocketId) {
                  h.territories[tid].ownerId = socketId;
                }
              });
            }
          });
        }
      }

      // If rejoining host, update room hostId
      if (room.hostId === oldSocketId) {
        room.hostId = socketId;
      }

      return { success: true, room, rejoined: true };
    }

    return { error: 'Game already in progress' };
  }

  if (room.players.length >= 8) return { error: 'Room is full (max 8 players)' };

  const colors = room.players.map(p => p.color.trim().toLowerCase());
  let finalColor = (playerColor || '#00e5ff').trim().toLowerCase();
  if (colors.includes(finalColor)) {
    finalColor = getUniqueColor(room);
  }

  const newPlayer = {
    id: socketId,
    name: playerName || `Player ${room.players.length + 1}`,
    color: finalColor,
    isHost: false,
    isAI: false,
    autoDefend: true
  };

  room.players.push(newPlayer);
  return { success: true, room };
}

function changeAIPersonality(roomCode, targetPlayerId, newPersonality) {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found' };

  const player = room.players.find(p => p.id === targetPlayerId);
  if (!player) return { error: 'Player not found' };
  if (!player.isAI) return { error: 'Only AI personalities can be customized' };

  const validPersonalities = ['normal', 'strategic', 'kind', 'goofball', 'cynical', 'aggressive'];
  if (!validPersonalities.includes(newPersonality)) {
    return { error: 'Invalid personality type' };
  }

  player.personality = newPersonality;
  return { success: true, room };
}

function addAIPlayer(roomCode, name, color) {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'LOBBY') return { error: 'Game already in progress' };
  if (room.players.length >= 8) return { error: 'Room is full' };

  const id = `ai_${Math.random().toString(36).substr(2, 9)}`;
  const colors = room.players.map(p => p.color.trim().toLowerCase());
  let finalColor = (color || '#a855f7').trim().toLowerCase();
  if (colors.includes(finalColor)) {
    finalColor = getUniqueColor(room);
  }

  // Generate dynamic unique combat name
  const aiNames = ['Atlas', 'Nero', 'Zara', 'Odin', 'Kira', 'Rex', 'Lyra', 'Drake'];
  const takenNames = new Set(room.players.map(p => p.name.toLowerCase()));
  let finalName = name;
  if (!finalName) {
    const availableNames = aiNames.filter(n => !takenNames.has(n.toLowerCase()));
    finalName = availableNames.length > 0 ? availableNames[0] : `AI Bot ${room.players.filter(p => p.isAI).length + 1}`;
  }

  const personalities = ['normal', 'strategic', 'kind', 'goofball', 'cynical', 'aggressive'];
  
  // Find personalities already occupied by other AI players in the room
  const takenPersonalities = room.players
    .filter(p => p.isAI && p.personality)
    .map(p => p.personality);

  // Filter out taken personalities to find remaining options
  const availablePersonalities = personalities.filter(p => !takenPersonalities.includes(p));

  // Fall back to the full pool if more than 6 AIs exist and all are occupied
  const selectionPool = availablePersonalities.length > 0 ? availablePersonalities : personalities;
  const chosenPersonality = selectionPool[Math.floor(Math.random() * selectionPool.length)];

  const aiPlayer = {
    id,
    name: finalName,
    color: finalColor,
    isHost: false,
    isAI: true,
    autoDefend: true,
    trustScores: {},
    personality: chosenPersonality
  };

  room.players.push(aiPlayer);
  return { success: true, room };
}

function removePlayer(socketId) {
  for (const code in rooms) {
    const room = rooms[code];
    const playerIdx = room.players.findIndex(p => p.id === socketId);
    if (playerIdx !== -1) {
      const player = room.players[playerIdx];
      if (room.status === 'LOBBY') {
        room.players.splice(playerIdx, 1);
        // If host left, assign new host or delete room
        if (player.isHost && room.players.length > 0) {
          room.players[0].isHost = true;
          room.hostId = room.players[0].id;
        }
        if (room.players.length === 0) {
          delete rooms[code];
        }
        return { success: true, code, status: 'LOBBY', leftPlayer: player };
      } else {
        // In-game: turn player into an AI bot so game continues!
        player.isAI = true;
        if (!player.originalName) {
          player.originalName = player.name;
        }
        player.name = `${player.originalName} (AI)`;
        player.disconnected = true;

        if (room.gameState) {
          const statePlayer = room.gameState.players.find(p => p.id === socketId);
          if (statePlayer) {
            statePlayer.isAI = true;
            if (!statePlayer.originalName) {
              statePlayer.originalName = statePlayer.name;
            }
            statePlayer.name = `${statePlayer.originalName} (AI)`;
            statePlayer.disconnected = true;
          }
        }
        return { success: true, code, status: 'PLAYING', leftPlayer: player };
      }
    }
  }
  return null;
}

function startGame(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'LOBBY') return { error: 'Game already started' };

  if (room.gameState && room.gameState.territories && room.gameState.turnIndex !== undefined) {
    room.status = 'PLAYING';
    return { success: true, room };
  }

  const activeMapData = (room.asNormalMap && room.activeMapData) ? room.activeMapData : room.mapData;
  const mapData = activeMapData;
  const isScenario = !room.asNormalMap && !!(activeMapData && activeMapData.isScenario && activeMapData.nations && activeMapData.nations.length > 0);

  if (isScenario) {
    const disabledSet = new Set(room.disabledNationIds || []);
    const activeNations = (activeMapData.nations || [])
      .filter(n => !disabledSet.has(n.id))
      .map((n, idx) => ({ ...n, turnOrder: n.turnOrder !== undefined ? n.turnOrder : idx + 1 }))
      .sort((a, b) => a.turnOrder - b.turnOrder);
    const finalPlayers = [];
    const personalities = ['normal', 'strategic', 'kind', 'goofball', 'cynical', 'aggressive'];

    activeNations.forEach((n, idx) => {
      // Find player matching this nation
      const existingPlayer = room.players.find(p => p.selectedNationId === n.id || p.nationId === n.id || p.name === n.name);

      if (existingPlayer && !existingPlayer.isAI) {
        existingPlayer.originalName = existingPlayer.originalName || existingPlayer.name;
        existingPlayer.nationName = n.name;
        existingPlayer.nationId = n.id;
        existingPlayer.name = `${n.name} (${existingPlayer.originalName})`;
        existingPlayer.color = n.color; // Override color with nation color
        existingPlayer.startingNukes = n.startingNukes || 0;
        existingPlayer.startingThermonukes = n.startingThermonukes || 0;
        finalPlayers.push(existingPlayer);
      } else if (existingPlayer && existingPlayer.isAI) {
        existingPlayer.nationName = n.name;
        existingPlayer.nationId = n.id;
        existingPlayer.name = n.name;
        existingPlayer.color = n.color;
        existingPlayer.personality = existingPlayer.personality || personalities[idx % personalities.length];
        existingPlayer.startingNukes = n.startingNukes || 0;
        existingPlayer.startingThermonukes = n.startingThermonukes || 0;
        finalPlayers.push(existingPlayer);
      } else {
        // Unchosen nation becomes an AI player with varied personality!
        const assignedPersonality = personalities[idx % personalities.length];
        const aiPlayer = {
          id: `ai_${Math.random().toString(36).substr(2, 9)}`,
          name: n.name,
          nationName: n.name,
          nationId: n.id,
          color: n.color,
          isHost: false,
          isAI: true,
          autoDefend: true,
          trustScores: {},
          personality: assignedPersonality,
          startingNukes: n.startingNukes || 0,
          startingThermonukes: n.startingThermonukes || 0
        };
        finalPlayers.push(aiPlayer);
      }
    });

    room.players = finalPlayers;
  } else {
    if (room.players.length < 2) return { error: 'Need at least 2 players to start' };

    // Failsafe: Enforce unique colors for non-scenario players
    const takenColors = new Set();
    room.players.forEach(p => {
      let pColor = p.color.trim().toLowerCase();
      if (takenColors.has(pColor)) {
        const uniqueColor = getUniqueColor(room);
        p.color = uniqueColor;
        takenColors.add(uniqueColor.trim().toLowerCase());
      } else {
        takenColors.add(pColor);
      }
    });
  }

  room.status = 'PLAYING';
  GameEngine.initializeGame(room, activeMapData, room.gameMode || 'conquest');

  return { success: true, room };
}

// Orchestrate the AI turn updates with intervals
function runAITurn(room, io) {
  const gameState = room.gameState;
  if (!gameState || room.status !== 'PLAYING' || gameState.turnStage === 'GAME_OVER' || room.isPaused) return;

  // Guard against concurrent overlapping execution loops
  if (room.aiActionInProgress) {
    return;
  }

  const currentPlayer = gameState.players[gameState.turnIndex];
  if (!currentPlayer || currentPlayer.eliminated) {
    return;
  }

  // Fallback to true if the room is globally locked to hot-seat Generative mode
  const isGlobalGenerative = !!(room.generativeAIMode || gameState.generativeAIMode);

  // A connected human player should NEVER be auto-played by AI/LLM.
  // Only AI players (isAI=true) or disconnected humans should be auto-played.
  const isConnectedHuman = !currentPlayer.isAI && !currentPlayer.disconnected;
  if (isConnectedHuman) {
    return;
  }

  const currentPlayerIsLLM = !!(currentPlayer.isLLM || isGlobalGenerative);

  room.aiActionInProgress = true; // Lock the AI turn process
  room.lastAIActionTime = Date.now();

  // AUTO-TRADE CARDS FOR ALL AI MODES (Traditional and LLM)
  if (gameState.turnStage === 'DRAFT') {
    let tradeAttempts = 0;
    while (currentPlayer.cards && currentPlayer.cards.length >= 3 && tradeAttempts < 5) {
      tradeAttempts++;
      const traded = tradeAICardsIfPossible(room, currentPlayer.id);
      if (!traded) break;
    }
  }

  const config = room.llmProviderConfig;
  const isDirectAPI = currentPlayerIsLLM && config && config.provider && config.provider !== 'clipboard';

  if (isDirectAPI) {
    runLLMAITurn(room, io);
    return;
  }

  // Update AI trust scores at the start of its turn
  if (gameState.turnStage === 'SETUP_CLAIM' || gameState.turnStage === 'SETUP_FORTIFY' || gameState.turnStage === 'DRAFT') {
    AIEngine.updateAITrustScores(room);
  }

  // Tick down active mercy ceasefires on draft phase start
  if (gameState.turnStage === 'DRAFT') {
    if (currentPlayer.mercyCeasefireTurns) {
      Object.keys(currentPlayer.mercyCeasefireTurns).forEach(pId => {
        currentPlayer.mercyCeasefireTurns[pId]--;
        if (currentPlayer.mercyCeasefireTurns[pId] <= 0) {
          delete currentPlayer.mercyCeasefireTurns[pId];
          if (currentPlayer.doNotAttack) {
            delete currentPlayer.doNotAttack[pId];
          }
          const partner = gameState.players.find(p => p.id === pId) || { name: 'the commander' };
          gameState.logs.push({
            timestamp: new Date().toLocaleTimeString(),
            message: `🕊️ Ceasefire Expired: The temporary mercy truce between ${currentPlayer.name} and ${partner.name} has ended.`
          });
        }
      });
    }
  }

  // Dynamic AI turn flavor dialogue trigger
  if (gameState.turnStage === 'DRAFT') {
    const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === currentPlayer.id);
    const total = Object.keys(gameState.territories).length;
    const controlRatio = owned.length / total;
    const isWinnerBrag = controlRatio > 0.45;
    
    let dialogueType = "";
    let randomTarget = gameState.players.find(p => p.id !== currentPlayer.id && !p.eliminated);

    // Scaling boast chance based on map control
    let boastChance = 0.35;
    if (controlRatio >= 0.89) {
      boastChance = 0.75;
    } else if (controlRatio >= 0.70) {
      boastChance = 0.67;
    } else if (controlRatio >= 0.55) {
      boastChance = 0.50;
    }

    if (isWinnerBrag && Math.random() < boastChance) {
      dialogueType = "DOMINANCE_BRAG";
    } else if (owned.length <= 2 && Math.random() < 0.40) {
      dialogueType = "DESPERATION";
    } else if (Math.random() < 0.30) {
      dialogueType = "RANDOM_CHATTER"; // 30% baseline chance for passive turn chatter
    }

    if (dialogueType) {
      const text = AIEngine.getDialogue(dialogueType, currentPlayer.personality || 'normal', { sender: currentPlayer.name, gameMode: room.gameState.gameMode });
      sendAIChatMessage(room, io, currentPlayer, text, '📢', false, '[AI]');

      // Trigger active, staggered responses from OTHER AIs when this AI boasts
      if (dialogueType === "DOMINANCE_BRAG") {
        const otherActiveAIs = gameState.players.filter(p => p.isAI && !p.eliminated && p.id !== currentPlayer.id);
        otherActiveAIs.forEach((ai, idx) => {
          if (Math.random() < 0.50) {
            setTimeout(() => {
              const currentRoom = getRoom(room.code);
              if (!currentRoom || currentRoom.status !== 'PLAYING') return;

              const responseText = AIEngine.getDialogue("BRAG_RESPONSE", ai.personality || 'normal', { sender: currentPlayer.name, gameMode: room.gameState.gameMode });
              const replyMsg = {
                senderName: `${ai.name} [AI]`,
                senderColor: ai.color,
                text: `💬 "${responseText}"`,
                timestamp: new Date().toLocaleTimeString()
              };
              currentRoom.gameState.chatArchive.push(replyMsg);
              io.to(room.code).emit('chatMessage', replyMsg);
            }, 1000 + idx * 600); // Staggered delays
          }
        });
      }
    } else if (randomTarget && randomTarget.isAI && Math.random() < 0.10) {
      // 10% chance of initiating public random chatter with another AI (properly uses @ prefix)
      const otherName = `@${randomTarget.name}`;
      const convMsg = {
        senderName: `${currentPlayer.name} [AI]`,
        senderColor: currentPlayer.color,
        text: `💬 "${otherName}, your forces look strong. Let us agree to mutual peace."`,
        timestamp: new Date().toLocaleTimeString()
      };
      gameState.chatArchive = gameState.chatArchive || [];
      gameState.chatArchive.push(convMsg);
      io.to(room.code).emit('chatMessage', convMsg);
    }
  }

  // Handle vacateTerritory instruction if set verbally!
  if (gameState.turnStage === 'DRAFT' && currentPlayer.vacateTerritory) {
    const vacId = currentPlayer.vacateTerritory;
    const terr = gameState.territories[vacId];
    if (terr && terr.ownerId === currentPlayer.id && terr.armies > 1) {
      // Find an interior adjacent owned territory
      const adjs = GameEngine.getAdjacentTerritories(room.mapData.connections, vacId);
      const escape = adjs.find(aid => gameState.territories[aid] && gameState.territories[aid].ownerId === currentPlayer.id);
      if (escape) {
        const movedArmies = terr.armies - 1;
        terr.armies = 1;
        gameState.territories[escape].armies += movedArmies;
        gameState.logs.push({
          timestamp: new Date().toLocaleTimeString(),
          message: `🛡️ Promised Move: ${currentPlayer.name} moved ${movedArmies} armies from ${room.mapData.territories.find(t => t.id === vacId).name} to ease tensions.`
        });
      }
    }
    currentPlayer.vacateTerritory = null; // complete promise
  }

  // Trigger stage specific AI action after a short delay based on aiSpeed setting
  const turnDelay = room.aiSpeed !== undefined ? room.aiSpeed : 400;
  const stepDelay = Math.max(0, Math.floor(turnDelay * 0.25));

  setTimeout(() => {
    if (room.status !== 'PLAYING') {
      room.aiActionInProgress = false; // Release lock on exit
      return;
    }
    
    // Safety check in case turn changed during timeout
    const checkPlayer = gameState.players[gameState.turnIndex];
    if (checkPlayer.id !== currentPlayer.id) {
      room.aiActionInProgress = false; // Release lock on exit
      return;
    }

    if (gameState.turnStage === 'SETUP_CLAIM') {
      // 1. Setup claim phase — pick a territory to claim
      const unclaimed = Object.keys(gameState.territories).filter(
        tid => gameState.territories[tid].ownerId === null
      );
      if (unclaimed.length > 0) {
        const owned = Object.keys(gameState.territories).filter(
          tid => gameState.territories[tid].ownerId === currentPlayer.id
        );

        let targetId = null;

        if (owned.length === 0) {
          // First claim: pick a random unclaimed territory (avoid insertion-order bias)
          targetId = unclaimed[Math.floor(Math.random() * unclaimed.length)];
        } else {
          // Prefer unclaimed territories adjacent to ones we already own
          // Score each adjacent unclaimed: prefer those in our target continent
          const targetCont = AIEngine.chooseTargetContinent(gameState, room.mapData, currentPlayer.id);
          const scored = [];

          for (const oId of owned) {
            const adj = GameEngine.getAdjacentTerritories(room.mapData.connections, oId);
            for (const adjId of adj) {
              if (gameState.territories[adjId] && gameState.territories[adjId].ownerId === null) {
                let score = Math.random() * 2; // base randomness
                if (targetCont && targetCont.territoryIds.includes(adjId)) score += 5;
                scored.push({ id: adjId, score });
              }
            }
          }

          if (scored.length > 0) {
            scored.sort((a, b) => b.score - a.score);
            targetId = scored[0].id;
          } else {
            // No adjacent unclaimed — pick from unclaimed in target continent first
            const contUnclaimed = targetCont
              ? unclaimed.filter(tid => targetCont.territoryIds.includes(tid))
              : [];
            if (contUnclaimed.length > 0) {
              targetId = contUnclaimed[Math.floor(Math.random() * contUnclaimed.length)];
            } else {
              // Pure random fallback
              targetId = unclaimed[Math.floor(Math.random() * unclaimed.length)];
            }
          }
        }

        GameEngine.claimTerritory(room, currentPlayer.id, targetId);
        io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
      }
      // Trigger next step
      setTimeout(() => {
        room.aiActionInProgress = false; // Release lock right before next action
        runAITurn(room, io);
      }, 50);

    } else if (gameState.turnStage === 'SETUP_FORTIFY') {
      // 2. Setup fortify phase
      const owned = Object.keys(gameState.territories).filter(
        tid => gameState.territories[tid].ownerId === currentPlayer.id
      );
      if (owned.length > 0) {
        // place on territory with highest threat
        const pressures = AIEngine.evaluateBorders(gameState, room.mapData, currentPlayer.id);
        owned.sort((a, b) => pressures[b] - pressures[a]);
        GameEngine.fortifySetup(room, currentPlayer.id, owned[0], 1);
        io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
      }
      // Trigger next step
      setTimeout(() => {
        room.aiActionInProgress = false; // Release lock right before next action
        runAITurn(room, io);
      }, 50);

    } else if (gameState.turnStage === 'CAPITAL_SELECTION') {
      if (!gameState.capitals[currentPlayer.id]) {
        const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === currentPlayer.id);
        owned.sort((a, b) => gameState.territories[b].armies - gameState.territories[a].armies);
        const best = owned[0];
        if (best) {
          GameEngine.selectCapital(room, currentPlayer.id, best);
          io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
        }
      }
      setTimeout(() => {
        room.aiActionInProgress = false; // Release lock right before next action
        runAITurn(room, io);
      }, 50);

    } else if (gameState.turnStage === 'DRAFT') {
      // 1. Core Draft Phase Execution - Keep trading valid card sets until done or under 3 cards
      let tradeAttempts = 0;
      while (currentPlayer.cards && currentPlayer.cards.length >= 3 && tradeAttempts < 5) {
        tradeAttempts++;
        const traded = tradeAICardsIfPossible(room, currentPlayer.id);
        if (!traded) break;
      }

      let safetyAttempts = 0;
      while (gameState.draftPool > 0 && safetyAttempts < 50) {
        safetyAttempts++;
        const decision = AIEngine.makeDraftDecision(room, currentPlayer.id);
        if (decision && decision.amount > 0 && decision.territoryId) {
          const res = GameEngine.placeDraft(room, currentPlayer.id, decision.territoryId, decision.amount);
          if (res && res.error) break;
        } else {
          break;
        }
      }

      // Failsafe: Dump any remaining draft pool on any owned territory so AI is never stuck in draft
      if (gameState.draftPool > 0) {
        const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === currentPlayer.id);
        if (owned.length > 0) {
          GameEngine.placeDraft(room, currentPlayer.id, owned[0], gameState.draftPool);
        } else {
          gameState.draftPool = 0;
        }
      }

      // Ensure turnStage moves to ATTACK for AI commanders
      if (gameState.draftPool === 0) {
        gameState.turnStage = 'ATTACK';
      }
      io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));

      // 2. Evaluate Diplomatic/Conversational Proposals (AI-to-AI or AI-to-Human)
      const pactProp = AIEngine.evaluateDiplomaticProposalsToSend(room, currentPlayer.id);
      if (pactProp) {
        const targetPlayer = gameState.players.find(p => p.id === pactProp.targetPlayerId);
        
        if (targetPlayer && !targetPlayer.eliminated) {
          // Determine the action type (Bypass and force 'non_aggression' if it's a mercy ceasefire plea)
          let chosenType = pactProp.isDesperateMercy ? 'non_aggression' : pactProp.type; 
          if (!pactProp.isDesperateMercy && Math.random() < 0.40) {
            chosenType = Math.random() < 0.5 ? 'move_troops' : 'claim_territory';
          }

          // Find a subject for alliances if needed
          let subjectName = '';
          const otherActivePlayers = gameState.players.filter(p => p.id !== currentPlayer.id && p.id !== targetPlayer.id && !p.eliminated);
          if (otherActivePlayers.length > 0) {
            subjectName = otherActivePlayers[Math.floor(Math.random() * otherActivePlayers.length)].name;
          }

          // Find a shared border territory for contextual text references
          const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === currentPlayer.id);
          let borderTerritoryId = null;
          for (const tid of owned) {
            const adj = GameEngine.getAdjacentTerritories(room.mapData.connections, tid);
            const found = adj.find(aid => gameState.territories[aid] && gameState.territories[aid].ownerId === targetPlayer.id);
            if (found) {
              borderTerritoryId = found;
              break;
            }
          }
          const borderTerrName = borderTerritoryId ? (room.mapData.territories.find(t => t.id === borderTerritoryId)?.name || 'the border') : 'the border';

          let continentName = 'the region';
          if (borderTerritoryId) {
            const cont = room.mapData.continents.find(c => c.territoryIds.includes(borderTerritoryId));
            if (cont) continentName = cont.name;
          }

          // Calculate an active territory owned by the responding AI
          const targetOwned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === targetPlayer.id);
          const aiTerrName = targetOwned.length > 0 
            ? (room.mapData.territories.find(t => t.id === targetOwned[Math.floor(Math.random() * targetOwned.length)])?.name || 'my borders')
            : 'my borders';

          let accept = AIEngine.evaluateDiplomacyProposal(room, targetPlayer.id, { sender: currentPlayer.id, type: chosenType });

          // Compiles context with subject key populated
          let context = { 
            sender: currentPlayer.name,
            subject: subjectName,
            border_territory: borderTerrName,
            requested_territory: borderTerrName,
            continent_name: continentName,
            ai_territory: aiTerrName,
            gameMode: room.gameState.gameMode
          };

          // Generate dynamic question (or mercy plea) in the AI's unique voice
          let proposalText = "";
          if (pactProp.isDesperateMercy) {
            proposalText = AIEngine.getDialogue("DESPERATION", currentPlayer.personality || 'normal', context) + ` Please sign a ceasefire truce, @${targetPlayer.name}.`;
          } else {
            proposalText = AIEngine.getProposalTemplate(chosenType, currentPlayer.personality || 'normal', targetPlayer.name, borderTerrName, subjectName);
          }

          // Print proposal message (Subject to 3-message turn limit)
          sendAIChatMessage(room, io, currentPlayer, proposalText, '💬', false, '[AI]');

          if (targetPlayer.isAI) {
            let responseText = "...";
            let dialogueType = "";

            if (chosenType === 'alliance') {
              dialogueType = accept ? "ALLIANCE_ACCEPT" : "ALLIANCE_DECLINE";
              responseText = AIEngine.getDialogue(dialogueType, targetPlayer.personality || 'normal', context);
            } else if (chosenType === 'non_aggression') {
              dialogueType = accept ? "CEASEFIRE_ACCEPT" : "CEASEFIRE_DECLINE";
              responseText = AIEngine.getDialogue(dialogueType, targetPlayer.personality || 'normal', context);
            } else if (chosenType === 'move_troops') {
              if (accept) {
                targetPlayer.vacateTerritory = borderTerritoryId;
                responseText = AIEngine.getDialogue("MOVE_TROOPS_ACCEPT", targetPlayer.personality || 'normal', context);
              } else {
                responseText = AIEngine.getDialogue("MOVE_TROOPS_DECLINE", targetPlayer.personality || 'normal', context);
              }
            } else if (chosenType === 'claim_territory') {
              if (accept && borderTerritoryId) {
                targetPlayer.doNotAttack = targetPlayer.doNotAttack || {};
                targetPlayer.doNotAttack[currentPlayer.id] = borderTerritoryId;
                responseText = AIEngine.getDialogue("CLAIM_TERRITORY_ACCEPT", targetPlayer.personality || 'normal', context);
              } else {
                responseText = AIEngine.getDialogue("CLAIM_TERRITORY_DECLINE", targetPlayer.personality || 'normal', context);
              }
            }

            // Respond to proposal (Bypasses limit since this is directly addressed)
            sendAIChatMessage(room, io, targetPlayer, responseText, '💬', true, '[AI]');

            if (accept && (chosenType === 'alliance' || chosenType === 'non_aggression')) {
              gameState.pacts.push({
                type: chosenType,
                playerA: currentPlayer.id,
                playerB: targetPlayer.id
              });
              gameState.logs.push({
                timestamp: new Date().toLocaleTimeString(),
                message: `🤝 Pact Formed: ${currentPlayer.name} and ${targetPlayer.name} formed a ${chosenType.replace('_', ' ')}!`
              });

              if (pactProp.isDesperateMercy) {
                currentPlayer.doNotAttack = currentPlayer.doNotAttack || {};
                currentPlayer.doNotAttack[targetPlayer.id] = 'all';
                currentPlayer.mercyCeasefireTurns = currentPlayer.mercyCeasefireTurns || {};
                currentPlayer.mercyCeasefireTurns[targetPlayer.id] = 2;
              }

              targetPlayer.trustScores = targetPlayer.trustScores || {};
              targetPlayer.trustScores[currentPlayer.id] = Math.min(100, (targetPlayer.trustScores[currentPlayer.id] || 50) + 15);
            } else if (!accept) {
              targetPlayer.trustScores = targetPlayer.trustScores || {};
              targetPlayer.trustScores[currentPlayer.id] = Math.max(0, (targetPlayer.trustScores[currentPlayer.id] || 50) - 5);
            }

            io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));
            setTimeout(() => {
              room.aiActionInProgress = false; // Release lock right before next action
              runAITurn(room, io);
            }, 50);

          } else {
            // AI-to-Human Negotiation flow
            if (chosenType === 'alliance' || chosenType === 'non_aggression') {
              const propId = `prop_${Math.random().toString(36).substr(2, 9)}`;
              const proposal = {
                id: propId,
                type: chosenType,
                sender: currentPlayer.id,
                receiver: targetPlayer.id
              };
              gameState.diplomacyProposals.push(proposal);
              io.to(targetPlayer.id).emit('diplomacyReceived', {
                id: propId,
                type: chosenType,
                senderName: currentPlayer.name
              });

              if (pactProp.isDesperateMercy) {
                currentPlayer.doNotAttack = currentPlayer.doNotAttack || {};
                currentPlayer.doNotAttack[targetPlayer.id] = 'all'; // setup turn-based mercy ceasefire tethers
                currentPlayer.mercyCeasefireTurns = currentPlayer.mercyCeasefireTurns || {};
                currentPlayer.mercyCeasefireTurns[targetPlayer.id] = 2;
              }
            }
            
            io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));
            setTimeout(() => {
              room.aiActionInProgress = false; // Release lock right before next action
              runAITurn(room, io);
            }, 50);
          }

          return; // Interrupt immediate advancement to allow the negotiation timeline to resolve
        }
      }

      // No negotiations triggered, proceed to attack immediately
      setTimeout(() => {
        room.aiActionInProgress = false; // Release lock right before next action
        runAITurn(room, io);
      }, 50);
    } else if (gameState.turnStage === 'ATTACK') {
      // 4. Attack phase
      const decision = AIEngine.makeAttackDecision(room, currentPlayer.id, io);
      if (decision) {
        let res;
        if (room.aiBlitz) {
          res = GameEngine.executeBlitzAttack(room, currentPlayer.id, decision.sourceId, decision.targetId);
        } else {
          res = GameEngine.executeAttack(room, currentPlayer.id, decision.sourceId, decision.targetId, decision.diceCount);
        }

        if (res && res.error) {
          // Attack failed due to invalid state: advance AI stage to FORTIFY so it doesn't loop infinitely
          gameState.turnStage = 'FORTIFY';
          io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
          room.aiActionInProgress = false; // Release lock
          runAITurn(room, io);
          return;
        }

        io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
        if (res && (res.diceResult || (res.blitzResult && res.blitzResult.lastDiceResult))) {
          handleCombatDialogue(room, io, res.diceResult || res.blitzResult.lastDiceResult);
        }

        // If attack transitioned stage to DEFENDER_DICE_DECISION, record timestamp and pause AI loop until defense resolves
        if (gameState.turnStage === 'DEFENDER_DICE_DECISION') {
          room.lastDefenderStageTime = Date.now();
          room.aiActionInProgress = false; // Release lock so future callback can continue
          return;
        }

        setTimeout(() => {
          room.aiActionInProgress = false; // Release lock
          runAITurn(room, io);
        }, stepDelay);
      } else {
        // End attack, move to fortify
        gameState.turnStage = 'FORTIFY';
        io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
        setTimeout(() => {
          room.aiActionInProgress = false; // Release lock
          runAITurn(room, io);
        }, stepDelay);
      }

    } else if (gameState.turnStage === 'POST_ATTACK_MOVE') {
      const decision = AIEngine.makePostAttackMoveDecision(room, currentPlayer.id);
      const res = GameEngine.executePostAttackMove(room, currentPlayer.id, decision);
      if (res && res.error) {
        gameState.postAttackContext = null;
        gameState.turnStage = 'ATTACK';
      }
      io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
      setTimeout(() => {
        room.aiActionInProgress = false; // Release lock
        runAITurn(room, io);
      }, stepDelay);

    } else if (gameState.turnStage === 'FORTIFY') {
      // 5. Fortify phase
      const decision = AIEngine.makeFortifyDecision(room, currentPlayer.id);
      if (decision) {
        const res = GameEngine.executeFortify(room, currentPlayer.id, decision.sourceId, decision.targetId, decision.amount);
        if (res && res.error) {
          GameEngine.endTurn(room);
        }
      } else {
        GameEngine.endTurn(room);
      }
      io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));
      
      // Reset AI step counter for new turn
      room._aiTurnStepCount = 0;

      // Reset turn activity lock
      room.aiActionInProgress = false;

      // If turn shifted to another AI, continue loop
      const nextPlayer = gameState.players[gameState.turnIndex];
      if (nextPlayer && nextPlayer.isAI && room.status === 'PLAYING') {
        setTimeout(() => runAITurn(room, io), stepDelay);
      }
    }
  }, turnDelay);
}

// Execute live automated LLM turn via API provider
async function runLLMAITurn(room, io) {
  const gameState = room.gameState;
  if (!gameState || room.status !== 'PLAYING' || gameState.turnStage === 'GAME_OVER' || room.isPaused) return;

  const currentPlayer = gameState.players[gameState.turnIndex];
  if (!currentPlayer || currentPlayer.eliminated) return;

  room.lastAIActionTime = Date.now();

  try {
    const prompt = generateLLMPrompt(room, currentPlayer.id);
    const config = room.llmProviderConfig || { provider: 'groq' };

    console.log(`[LLM Provider API Call] Commander ${currentPlayer.name} invoking ${config.provider}...`);
    const action = await callLLMProvider({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      prompt,
      commanderName: currentPlayer.name
    });

    if (action && typeof action === 'object') {
      executeParsedLLMAction(room, currentPlayer, action, io);
    } else {
      throw new Error('LLM returned invalid response format');
    }
  } catch (err) {
    console.error(`[LLM API Execution Error for ${currentPlayer.name}]:`, err.message);
    if (gameState.turnStage === 'POST_ATTACK_MOVE') {
      GameEngine.executePostAttackMove(room, currentPlayer.id, 0);
    }
    GameEngine.endTurn(room, currentPlayer.id);
    GameEngine.addLog(gameState, `⚠️ ${currentPlayer.name}'s LLM API turn encountered an error: ${err.message.substring(0, 80)}. Turn auto-passed.`);
    io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));

    const delay = room.llmDelay !== undefined ? parseInt(room.llmDelay) : 3000;
    setTimeout(() => {
      room.aiActionInProgress = false; // Release lock right before next action
      runAITurn(room, io);
    }, delay);
  }
}

function executeParsedLLMAction(room, activePlayer, action, io) {
  const gameState = room.gameState;
  if (!gameState || !activePlayer) return;

  // Save the private strategic internal note back to the active player's state
  if (action.internalNote && typeof action.internalNote === 'string') {
    activePlayer.internalNote = action.internalNote.substring(0, 600); // 600-character safety ceiling
  }

  // 1. Broadcast commentary if provided (Subject to 3-message turn limit)
  if (action.commentary && typeof action.commentary === 'string') {
    sendAIChatMessage(room, io, activePlayer, action.commentary, '🤖', false, '[LLM]');
  }

  // 1.5 Process Setup Claim & Setup Fortify Stages
  if (gameState.turnStage === 'SETUP_CLAIM') {
    const targetId = action.territoryId || action.targetId;
    if (targetId && gameState.territories[targetId] && gameState.territories[targetId].ownerId === null) {
      GameEngine.claimTerritory(room, activePlayer.id, targetId);
    } else {
      // Failsafe: Pick the first available unclaimed territory
      const unclaimed = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === null);
      if (unclaimed.length > 0) {
        GameEngine.claimTerritory(room, activePlayer.id, unclaimed[0]);
      }
    }
    io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));
    const delay = room.llmDelay !== undefined ? parseInt(room.llmDelay) : 3000;
    setTimeout(() => {
      room.aiActionInProgress = false; // Release lock right before next action
      runAITurn(room, io);
    }, delay);
    return;
  }

  if (gameState.turnStage === 'SETUP_FORTIFY') {
    const targetId = action.territoryId || action.targetId;
    const amount = parseInt(action.amount) || 1;
    if (targetId && gameState.territories[targetId] && gameState.territories[targetId].ownerId === activePlayer.id) {
      GameEngine.fortifySetup(room, activePlayer.id, targetId, amount);
    } else {
      // Failsafe: Pick the owned territory with the lowest troop count
      const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === activePlayer.id);
      if (owned.length > 0) {
        owned.sort((a, b) => gameState.territories[a].armies - gameState.territories[b].armies);
        GameEngine.fortifySetup(room, activePlayer.id, owned[0], 1);
      }
    }
    io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));
    const delay = room.llmDelay !== undefined ? parseInt(room.llmDelay) : 3000;
    setTimeout(() => {
      room.aiActionInProgress = false; // Release lock right before next action
      runAITurn(room, io);
    }, delay);
    return;
  }

  // 2. Process Diplomacy (Decoupled & Parallel Parsing)
  const actionStr = typeof action.action === 'string' ? action.action : '';
const typeStr = typeof action.type === 'string' ? action.type : '';
const actType = (actionStr || typeStr || '').toUpperCase();
  
  // A. Process Pact Proposals (Handles explicit actions or concurrent objects)
  if (actType === 'PROPOSE_PACT' || actType === 'PROPOSE_ALLIANCE' || action.proposePact) {
    const prop = action.proposePact || action;
    const targetId = prop.targetPlayerId || prop.targetId;
    const pType = (prop.type || prop.pactType || 'non_aggression').toLowerCase();
    const typeStr = pType.includes('all') ? 'alliance' : 'non_aggression';
    
    gameState.diplomacyProposals = gameState.diplomacyProposals || [];
    const existing = gameState.diplomacyProposals.find(p => p.proposerId === activePlayer.id && p.targetId === targetId);
    if (!existing && targetId && targetId !== activePlayer.id) {
      gameState.diplomacyProposals.push({
        id: Math.random().toString(36).substr(2, 9),
        proposerId: activePlayer.id,
        targetId,
        type: typeStr
      });
      const tgtPlayer = gameState.players.find(p => p.id === targetId);
      GameEngine.addLog(gameState, `📜 ${activePlayer.name} proposed a ${typeStr === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance'} to ${tgtPlayer ? tgtPlayer.name : targetId}.`);
    }
  }

  // B. Process Pact Acceptances
  if (actType === 'ACCEPT_PACT' || action.acceptPact) {
    const ap = action.acceptPact || action;
    const proposerId = ap.proposerId || ap.targetPlayerId || ap.targetId;
    
    gameState.diplomacyProposals = gameState.diplomacyProposals || [];
    const propIndex = gameState.diplomacyProposals.findIndex(p => 
      (p.targetId === activePlayer.id || p.receiver === activePlayer.id) && 
      (p.proposerId === proposerId || p.sender === proposerId)
    );
    if (propIndex !== -1) {
      const prop = gameState.diplomacyProposals.splice(propIndex, 1)[0];
      gameState.pacts = gameState.pacts || [];
      
      const pId = prop.proposerId || prop.sender;
      const pactExists = gameState.pacts.some(p => (p.playerA === pId && p.playerB === activePlayer.id) || (p.playerB === pId && p.playerA === activePlayer.id));
      if (!pactExists) {
        gameState.pacts.push({ playerA: pId, playerB: activePlayer.id, type: prop.type });
        const propPlayer = gameState.players.find(p => p.id === proposerId);
        GameEngine.addLog(gameState, `🤝 ${activePlayer.name} accepted the ${prop.type === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance'} proposal from ${propPlayer ? propPlayer.name : proposerId}!`);
      }
    }
  }

  // B2. Process Explicit Pact Rejections
  const isExplicitReject = actType === 'REJECT_PACT' || actType === 'DECLINE_PACT' || action.rejectPact || action.declinePact;
  if (isExplicitReject) {
    const rp = action.rejectPact || action.declinePact || action;
    const proposerId = rp.proposerId || rp.targetPlayerId || rp.targetId;
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
  }

  // B3. Process Implicit Rejections (Ignored Proposals on Turn End)
  gameState.diplomacyProposals = gameState.diplomacyProposals || [];
  const ignoredProposals = gameState.diplomacyProposals.filter(p => p.targetId === activePlayer.id || p.receiver === activePlayer.id);
  ignoredProposals.forEach(prop => {
    const propIndex = gameState.diplomacyProposals.findIndex(p => p.id === prop.id);
    if (propIndex !== -1) {
      gameState.diplomacyProposals.splice(propIndex, 1);
      const proposerId = prop.proposerId || prop.sender;
      const propPlayer = gameState.players.find(p => p.id === proposerId);
      GameEngine.addLog(gameState, `❌ Pact Declined: ${activePlayer.name} did not accept the treaty proposal from ${propPlayer ? propPlayer.name : proposerId}.`);
    }
  });

  // C. Process Pact Betrayals
  if (actType === 'BREAK_PACT' || action.breakPact) {
    const bp = action.breakPact || action;
    const targetId = bp.targetPlayerId || bp.targetId;
    
    gameState.pacts = gameState.pacts || [];
    const pactIndex = gameState.pacts.findIndex(p => (p.playerA === activePlayer.id && p.playerB === targetId) || (p.playerB === activePlayer.id && p.playerA === targetId));
    if (pactIndex !== -1) {
      gameState.pacts.splice(pactIndex, 1);
      const targetPlayer = gameState.players.find(p => p.id === targetId);
      GameEngine.addLog(gameState, `💔 ${activePlayer.name} HAS BETRAYED AND BROKEN THEIR TREATY WITH ${targetPlayer ? targetPlayer.name : targetId}!`);
    }
  }

  // 3. Card Trade
  if (actType === 'TRADE_CARDS' || (activePlayer.cards && activePlayer.cards.length >= 5)) {
    GameEngine.tradeAllCards(room, activePlayer.id);
  }

  // 4. DRAFT PHASE EXECUTION
  if (gameState.turnStage === 'DRAFT') {
    if (Array.isArray(action.draftSequence) && action.draftSequence.length > 0) {
      action.draftSequence.forEach(item => {
        const tid = item.territoryId || item.targetId;
        const amt = parseInt(item.amount) || 1;
        if (tid && gameState.draftPool > 0) {
          GameEngine.placeDraft(room, activePlayer.id, tid, Math.min(amt, gameState.draftPool));
        }
      });
    }

    if ((actType === 'DRAFT' || actType === 'PLACE_DRAFT') && action.territoryId) {
      const amt = parseInt(action.amount) || gameState.draftPool || 1;
      if (gameState.draftPool > 0) {
        GameEngine.placeDraft(room, activePlayer.id, action.territoryId, Math.min(amt, gameState.draftPool));
      }
    }

    // Ensure turnStage moves to ATTACK for AI commanders
    if (gameState.draftPool === 0) {
      gameState.turnStage = 'ATTACK';
    }
  }
  // 5. ATTACK PHASE EXECUTION
  else if (gameState.turnStage === 'ATTACK' || gameState.turnStage === 'POST_ATTACK_MOVE') {
    if (gameState.turnStage === 'POST_ATTACK_MOVE') {
      GameEngine.executePostAttackMove(room, activePlayer.id, 0);
    }

    const singleSrcId = action.sourceId || action.source || action.from || action.src;
    const singleTgtId = action.targetId || action.target || action.to || action.tgt;

    // Execute multi-attack sequence
    if (Array.isArray(action.attackSequence) && action.attackSequence.length > 0) {
      action.attackSequence.forEach(atk => {
        const srcId = atk.sourceId || atk.source || atk.from || atk.src;
        const tgtId = atk.targetId || atk.target || atk.to || atk.tgt;
        if (!srcId || !tgtId) return;

        if (gameState.turnStage === 'POST_ATTACK_MOVE') {
          GameEngine.executePostAttackMove(room, activePlayer.id, 0);
        }
        const srcTerr = gameState.territories[srcId];
        const tgtTerr = gameState.territories[tgtId];
        if (srcTerr && tgtTerr && srcTerr.ownerId === activePlayer.id && srcTerr.armies >= 2 && tgtTerr.ownerId !== activePlayer.id) {
          const requestedMove = parseInt(atk.postAttackMove) || parseInt(atk.moveAmount) || 0;
          if (atk.blitz !== false) {
            GameEngine.executeBlitzAttack(room, activePlayer.id, srcId, tgtId);
            if (gameState.turnStage === 'POST_ATTACK_MOVE') {
              GameEngine.executePostAttackMove(room, activePlayer.id, requestedMove);
            }
          } else {
            GameEngine.executeAttack(room, activePlayer.id, srcId, tgtId, Math.min(3, srcTerr.armies - 1));
            if (gameState.turnStage === 'POST_ATTACK_MOVE') {
              GameEngine.executePostAttackMove(room, activePlayer.id, requestedMove);
            }
          }
        }
      });

      // AUTO-TRANSITION TO FORTIFY AFTER SEQUENCE COMPLETION
      if (gameState.turnStage === 'ATTACK') {
        gameState.turnStage = 'FORTIFY';
        GameEngine.addLog(gameState, `🏳️ Turn Consolidator: Completed attack sequence, transitioned safely to Fortify stage.`);
      }
    }

    // Execute single attack
    if ((actType === 'ATTACK' || actType === 'BLITZ') && singleSrcId && singleTgtId) {
      const srcTerr = gameState.territories[singleSrcId];
      const tgtTerr = gameState.territories[singleTgtId];
      if (srcTerr && tgtTerr && srcTerr.ownerId === activePlayer.id && srcTerr.armies >= 2 && tgtTerr.ownerId !== activePlayer.id) {
        if (action.blitz !== false) {
          GameEngine.executeBlitzAttack(room, activePlayer.id, singleSrcId, singleTgtId);
          if (gameState.turnStage === 'POST_ATTACK_MOVE') {
            GameEngine.executePostAttackMove(room, activePlayer.id, 0);
          }
        } else {
          GameEngine.executeAttack(room, activePlayer.id, singleSrcId, singleTgtId, Math.min(3, srcTerr.armies - 1));
        }
      }
    }

    // Only transition to FORTIFY if the action explicitly requests it or no attacks were performed/targeted
    if (gameState.turnStage === 'ATTACK') {
      if (actType === 'END_ATTACK' || actType === 'FORTIFY' || actType === 'END_TURN') {
        gameState.turnStage = 'FORTIFY';
      } else if (!singleSrcId && !singleTgtId && (!Array.isArray(action.attackSequence) || action.attackSequence.length === 0)) {
        gameState.turnStage = 'FORTIFY';
      }
    }
  }
  // 6. FORTIFY PHASE EXECUTION
  else if (gameState.turnStage === 'FORTIFY') {
    const fortSrcId = action.sourceId || action.source || action.from || action.src;
    const fortTgtId = action.targetId || action.target || action.to || action.tgt;

    if (actType === 'FORTIFY' && fortSrcId && fortTgtId) {
      const amt = parseInt(action.amount) || 1;
      GameEngine.executeFortify(room, activePlayer.id, fortSrcId, fortTgtId, amt);
    }
    if (gameState.turnStage === 'POST_ATTACK_MOVE') {
      GameEngine.executePostAttackMove(room, activePlayer.id, 0);
    }
    GameEngine.endTurn(room, activePlayer.id);
  }

  io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(gameState));

  const delay = room.llmDelay !== undefined ? parseInt(room.llmDelay) : 3000;
  setTimeout(() => {
    room.aiActionInProgress = false; // Release lock right before next action
    runAITurn(room, io);
  }, delay);
}

// Helper to let AI trade cards automatically
function tradeAICardsIfPossible(room, playerId) {
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.cards || player.cards.length < 3) return false;

  // Find a valid set
  for (let i = 0; i < player.cards.length - 2; i++) {
    for (let j = i + 1; j < player.cards.length - 1; j++) {
      for (let k = j + 1; k < player.cards.length; k++) {
        const selected = [player.cards[i], player.cards[j], player.cards[k]];
        // check if forms set
        const types = selected.map(c => c.type);
        const wildCount = types.filter(t => t === 'Wild').length;
        const uniqueTypes = new Set(types);
        const isValid = wildCount >= 1 || uniqueTypes.size === 1 || uniqueTypes.size === 3;
        
        if (isValid) {
          const res = GameEngine.tradeCards(room, playerId, [i, j, k]);
          return !res.error;
        }
      }
    }
  }
  return false;
}

function toggleAutoDefend(roomCode, playerId, enabled) {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found' };

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.autoDefend = !!enabled;
  }

  if (room.gameState) {
    const statePlayer = room.gameState.players.find(p => p.id === playerId);
    if (statePlayer) {
      statePlayer.autoDefend = !!enabled;
    }
  }

  return { success: true };
}

function updateGameMode(roomCode, mode) {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'LOBBY') return { error: 'Cannot change mode after game started' };

  room.gameMode = mode;
  return { success: true, room };
}

function initAIWatchdog(io) {
  if (global._aiWatchdogStarted) return;
  global._aiWatchdogStarted = true;

  setInterval(() => {
    try {
      Object.values(rooms).forEach(room => {
        if (!room || room.status !== 'PLAYING' || !room.gameState || room.gameState.turnStage === 'GAME_OVER' || room.isPaused || room.generativeAIMode || room.gameState.generativeAIMode) return;

        const now = Date.now();

        // 1. AFK / Disconnected Defender Decision Timeout Guard
        if (room.gameState.turnStage === 'DEFENDER_DICE_DECISION' && room.gameState.combatContext) {
          const defenderStageTime = room.lastDefenderStageTime || now;
          if (now - defenderStageTime > 12000) { // 12 seconds timeout for defender choice
            const ctx = room.gameState.combatContext;
            const res = GameEngine.resolveDefense(room, ctx.defenderId, ctx.maxDefDice);
            room.lastDefenderStageTime = null;
            if (res && res.diceResult) {
              handleCombatDialogue(room, io, res.diceResult);
            }
            io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));

            const curPlayer = room.gameState.players[room.gameState.turnIndex];
            if (curPlayer && curPlayer.isAI) {
              runAITurn(room, io);
            }
          }
          return;
        }

        // 2. AI Turn Stalled Guard (supports standard AI and Generative AI mode)
        const curPlayer = room.gameState.players[room.gameState.turnIndex];
        const isLLM = !!(curPlayer && (curPlayer.isLLM || room.generativeAIMode || room.gameState.generativeAIMode));
        if (curPlayer && (curPlayer.isAI || isLLM) && !curPlayer.eliminated && room.gameState.turnStage !== 'GAME_OVER') {
          const lastAction = room.lastAIActionTime || 0;
          const threshold = isLLM ? 30000 : (room.aiSpeed !== undefined ? Math.max(2000, room.aiSpeed * 3) : 3000);

          if (now - lastAction > threshold) {
            room.lastAIActionTime = now;
            room._watchdogStuckCount = (room._watchdogStuckCount || 0) + 1;

            if (room._watchdogStuckCount >= (isLLM ? 1 : 3)) {
              console.warn(`[Watchdog] AI Player ${curPlayer.name} stuck in stage ${room.gameState.turnStage}. Forcing turn advance.`);
              room._watchdogStuckCount = 0;
              room._aiTurnStepCount = 0;
              if (room.gameState.turnStage === 'POST_ATTACK_MOVE') {
                GameEngine.executePostAttackMove(room, curPlayer.id, 0);
              }
              GameEngine.endTurn(room, curPlayer.id);
              GameEngine.addLog(room.gameState, `⏭️ Watchdog Auto-Skip: ${curPlayer.name}'s turn was auto-skipped due to inactivity.`);
              io.to(room.code).emit('gameStateUpdate', getSanitizedGameState(room.gameState));

              const nextP = room.gameState.players[room.gameState.turnIndex];
              if (nextP && nextP.isAI) {
                room.aiActionInProgress = false; // Force unlock
                runAITurn(room, io);
              }
            } else if (!isLLM) {
              room.aiActionInProgress = false; // Force unlock
              runAITurn(room, io);
            }
          } else {
            room._watchdogStuckCount = 0;
          }
        }
      });
    } catch (err) {
      console.error('AI Watchdog error:', err);
    }
  }, 2000);
}

module.exports = {
  createRoom,
  joinRoom,
  addAIPlayer,
  removePlayer,
  startGame,
  getRoom,
  runAITurn,
  initAIWatchdog,
  toggleAutoDefend,
  updateGameMode,
  handleCombatDialogue,
  changeAIPersonality,
  getSanitizedGameState,
  sendAIChatMessage
};