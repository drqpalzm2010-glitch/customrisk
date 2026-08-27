const crypto = require('crypto');

// Assign balanced card types across territories (faithful to original Risk)
// Real Risk deck: each territory gets exactly one type, distributed as evenly as
// possible across Infantry / Cavalry / Artillery, then 2 Wildcards added.
function buildBalancedDeck(territories) {
  const types = ['Infantry', 'Cavalry', 'Artillery'];
  const cards = territories.map((t, i) => ({
    territoryId: t.id,
    type: types[i % 3]   // cycle evenly: 0=Infantry, 1=Cavalry, 2=Artillery
  }));

  // Fisher-Yates shuffle so distribution is random but still balanced
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  // Add exactly 2 Wildcards at the end (they'll be shuffled into deck below)
  cards.push({ territoryId: null, type: 'Wild' });
  cards.push({ territoryId: null, type: 'Wild' });

  // Shuffle full deck
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

// Check if three cards form a valid set
function isValidCardSet(cards) {
  if (cards.length !== 3) return false;
  const types = cards.map(c => c.type);
  
  // Wildcards check
  const wildCount = types.filter(t => t === 'Wild').length;
  if (wildCount >= 1) return true; // Any wild makes it easy to form a set

  const uniqueTypes = new Set(types);
  // All same type or all different types
  return uniqueTypes.size === 1 || uniqueTypes.size === 3;
}

// Calculate army trade-in bonus for Fixed Card mode:
// 3 Infantry = 4, 3 Cavalry = 6, 3 Artillery = 8, 1 of Each (Mixed) = 10.
function calculateFixedTradeBonus(cards) {
  if (!cards || cards.length !== 3 || !isValidCardSet(cards)) return 0;
  const types = cards.map(c => c.type);
  const nWild = types.filter(t => t === 'Wild').length;
  const nInf = types.filter(t => t === 'Infantry').length;
  const nCav = types.filter(t => t === 'Cavalry').length;
  const nArt = types.filter(t => t === 'Artillery').length;

  let maxBonus = 0;
  if (nInf + nWild >= 3) maxBonus = Math.max(maxBonus, 4);
  if (nCav + nWild >= 3) maxBonus = Math.max(maxBonus, 6);
  if (nArt + nWild >= 3) maxBonus = Math.max(maxBonus, 8);

  const distinctNonWild = (nInf > 0 ? 1 : 0) + (nCav > 0 ? 1 : 0) + (nArt > 0 ? 1 : 0);
  if (distinctNonWild + nWild >= 3) maxBonus = Math.max(maxBonus, 10);

  return maxBonus;
}

// Connectivity BFS validator to prevent Blizzards from partitioning the map geometry
function isGraphConnected(territories, connections, excludedSet) {
  const activeIds = Object.keys(territories).filter(id => !excludedSet.has(id));
  if (activeIds.length === 0) return false;
  
  const startId = activeIds[0];
  const visited = new Set([startId]);
  const queue = [startId];
  
  while (queue.length > 0) {
    const curr = queue.shift();
    const adj = getAdjacentTerritories(connections, curr);
    for (const neighbor of adj) {
      if (!excludedSet.has(neighbor) && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited.size === activeIds.length;
}

// Breadth-First Search to find if there is an allied path between start and end territories
// Support traversing through allied territories (Alliances)
function hasAlliedPath(territories, connections, startId, endId, ownerId, pacts = []) {
  if (startId === endId) return true;
  if (territories[startId].ownerId !== ownerId || territories[endId].ownerId !== ownerId) return false;

  // Build list of allied player IDs
  const alliedOwners = new Set([ownerId]);
  if (pacts) {
    pacts.forEach(p => {
      if (p.type === 'alliance') {
        if (p.playerA === ownerId) alliedOwners.add(p.playerB);
        if (p.playerB === ownerId) alliedOwners.add(p.playerA);
      }
    });
  }

  const queue = [startId];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === endId) return true;

    // Find all adjacent territories
    const adjacent = getAdjacentTerritories(connections, current);
    for (const adjId of adjacent) {
      if (!visited.has(adjId) && territories[adjId] && alliedOwners.has(territories[adjId].ownerId)) {
        visited.add(adjId);
        queue.push(adjId);
      }
    }
  }
  return false;
}

const adjacencyMapCache = new WeakMap();

function getAdjacencyMap(connections) {
  if (!connections) return new Map();
  if (adjacencyMapCache.has(connections)) {
    return adjacencyMapCache.get(connections);
  }
  const map = new Map();
  for (const conn of connections) {
    let from, to;
    if (Array.isArray(conn)) {
      from = conn[0];
      to = conn[1];
    } else if (conn && typeof conn === 'object') {
      from = conn.from;
      to = conn.to;
    }
    if (from !== undefined && to !== undefined) {
      if (!map.has(from)) map.set(from, new Set());
      if (!map.has(to)) map.set(to, new Set());
      map.get(from).add(to);
      map.get(to).add(from);
    }
  }
  const resultMap = new Map();
  map.forEach((set, key) => {
    resultMap.set(key, Array.from(set));
  });
  adjacencyMapCache.set(connections, resultMap);
  return resultMap;
}

// Get adjacent territory IDs (O(1) cached lookup)
function getAdjacentTerritories(connections, territoryId) {
  if (!connections) return [];
  const map = getAdjacencyMap(connections);
  return map.get(territoryId) || [];
}

function initializeGame(room, mapData, gameMode = 'auto') {
  const players = room.players;
  const numPlayers = players.length;
  const isScenario = !room.asNormalMap && !!(mapData && mapData.isScenario);
  const effectiveGameMode = (gameMode && gameMode !== 'auto') 
    ? gameMode 
    : ((mapData && mapData.scenarioSettings && mapData.scenarioSettings.capitalRush) ? 'capital_rush' : 'conquest');

  if (isScenario) {
    const defaultDummyArmies = (mapData.scenarioSettings && mapData.scenarioSettings.defaultDummyArmies) || 1;

    if (room.disableNations) {
      // Scenario layout with Neutral Defenders (Nations converted to Dummy Defenders preserving pre-set army counts)
      const firstPlayer = players[0];
      room.gameState = {
        gameMode: effectiveGameMode,
        cardTradeRule: room.cardTradeRule || 'progressive',
        capitals: {},
        turnIndex: 0,
        turnStage: 'DRAFT', // Immediately start draft stage to conquer neutral defender garrisons!
        isScenario: true,
        disableNations: true,
        players: players.map(p => ({
          ...p,
          cards: [],
          cardsTradedCount: 0,
          startingArmiesPool: 0,
          eliminated: false,
          stats: { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 }
        })),
        territories: {},
        pacts: [],
        diplomacyProposals: [],
        logs: [],
        cardDeck: buildBalancedDeck(mapData.territories),
        conqueredThisTurn: false,
        lastDiceRolls: null,
        tradeInCount: 0,
        history: []
      };

      mapData.territories.forEach(t => {
        const armies = t.startingArmies !== undefined ? t.startingArmies : defaultDummyArmies;
        room.gameState.territories[t.id] = {
          ownerId: 'dummy',
          armies: Math.max(1, armies)
        };
      });

      if (firstPlayer) {
        room.gameState.draftPool = calculateReinforcements(room.gameState, mapData, firstPlayer.id);
        addLog(room.gameState, `Scenario initialized with Neutral Defenders! ${firstPlayer.name}'s turn. Draft stage: ${room.gameState.draftPool} armies available.`);
      }
      return;
    }

    // Map nation IDs to active player IDs in the room (ignoring disabled specific nations)
    const disabledNationSet = new Set(room.disabledNationIds || []);
    const nationToPlayerId = {};
    (mapData.nations || []).filter(n => !disabledNationSet.has(n.id)).forEach(n => {
      const activeP = players.find(p => p.nationId === n.id || p.name === n.name || (p.name && p.name.startsWith(n.name)));
      if (activeP) {
        nationToPlayerId[n.id] = activeP.id;
      }
    });

    // Generate random Blizzards at start (safeguarded against map partitioning and Capital overlaps)
    const blizzards = [];
    const blizzardCount = Math.min(10, Math.max(0, parseInt(room.blizzardCount) || 0));
    if (blizzardCount > 0 && mapData.territories) {
      const excludedSet = new Set();
      const tempTerritories = {};
      mapData.territories.forEach(t => tempTerritories[t.id] = {});

      const activeCapitals = [];
      if (effectiveGameMode === 'capital_rush' && mapData.nations) {
        mapData.nations.forEach(n => {
          if (n.capitalTerritoryId) activeCapitals.push(n.capitalTerritoryId);
        });
      }
      const capitalSet = new Set(activeCapitals);

      const candidates = mapData.territories.filter(t => !capitalSet.has(t.id));
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      for (let i = 0; i < candidates.length && blizzards.length < blizzardCount; i++) {
        const tId = candidates[i].id;
        excludedSet.add(tId);
        if (isGraphConnected(tempTerritories, mapData.connections, excludedSet)) {
          blizzards.push(tId);
        } else {
          excludedSet.delete(tId);
        }
      }
    }

    room.gameState = {
      gameMode: effectiveGameMode,
      cardTradeRule: room.cardTradeRule || 'progressive',
      blizzards,
      radiation: {},
      allowCrafting: room.allowCrafting !== false,
      capitals: {},
      turnIndex: 0,
      turnStage: 'DRAFT', // Skip SETUP_CLAIM / SETUP_FORTIFY / CAPITAL_SELECTION completely!
      isScenario: true,
      players: players.map(p => ({
        ...p,
        cards: [],
        nukes: parseInt(room.startingNukes) || 0,
        thermonukes: parseInt(room.startingThermonukes) || 0,
        cardsTradedCount: 0,
        startingArmiesPool: 0,
        eliminated: false,
        stats: { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 }
      })),
      isScenario: true,
      players: players.map(p => ({
        ...p,
        cards: [],
        cardsTradedCount: 0,
        startingArmiesPool: 0,
        eliminated: false,
        stats: { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 }
      })),
      territories: {},
      pacts: [],
      diplomacyProposals: [],
      logs: [],
      cardDeck: buildBalancedDeck(mapData.territories),
      conqueredThisTurn: false,
      lastDiceRolls: null,
      tradeInCount: 0,
      history: []
    };

    // Assign scenario capitals if capital rush mode is active for this match
    if (effectiveGameMode === 'capital_rush' && mapData.nations) {
      mapData.nations.forEach(n => {
        const pId = nationToPlayerId[n.id];
        if (pId && n.capitalTerritoryId) {
          room.gameState.capitals[pId] = n.capitalTerritoryId;
        }
      });
    }

    // Initialize premade alliances if enabled for this scenario match
    const honorAlliances = room.honorPremadeAlliances !== false;
    if (honorAlliances && mapData.premadeAlliances && Array.isArray(mapData.premadeAlliances)) {
      mapData.premadeAlliances.forEach((alliance, idx) => {
        const pA_id = nationToPlayerId[alliance.nationAId];
        const pB_id = nationToPlayerId[alliance.nationBId];

        if (pA_id && pB_id && pA_id !== pB_id) {
          // Add active non-aggression alliance pact (no minimum turn requirement!)
          const existingPact = room.gameState.pacts.find(p => (p.playerA === pA_id && p.playerB === pB_id) || (p.playerB === pA_id && p.playerA === pB_id));
          if (!existingPact) {
            room.gameState.pacts.push({
              id: `pact_premade_${idx}_${Date.now()}`,
              playerA: pA_id,
              playerB: pB_id,
              type: 'alliance',
              isPremade: true
            });
          }

          // +10 AI Trust Boost for premade alliance partners
          const pA = room.gameState.players.find(p => p.id === pA_id);
          const pB = room.gameState.players.find(p => p.id === pB_id);

          if (pA && pA.isAI) {
            pA.trustScores = pA.trustScores || {};
            pA.trustScores[pB_id] = (pA.trustScores[pB_id] ?? 50) + 10;
          }
          if (pB && pB.isAI) {
            pB.trustScores = pB.trustScores || {};
            pB.trustScores[pA_id] = (pB.trustScores[pA_id] ?? 50) + 10;
          }
        }
      });
    }

    // Populate starting territories and armies from scenario data
    mapData.territories.forEach(t => {
      let ownerId = 'dummy';
      if (t.startingOwnerId && t.startingOwnerId !== 'dummy' && nationToPlayerId[t.startingOwnerId]) {
        ownerId = nationToPlayerId[t.startingOwnerId];
      }
      const armies = t.startingArmies !== undefined ? t.startingArmies : defaultDummyArmies;
      room.gameState.territories[t.id] = {
        ownerId,
        armies: Math.max(1, armies)
      };
    });

    // Calculate draft pool for first player so they can draft and attack immediately
    if (room.gameState.players.length > 0) {
      const firstPlayer = room.gameState.players[0];
      room.gameState.draftPool = calculateReinforcements(room.gameState, mapData, firstPlayer.id);
      addLog(room.gameState, `Scenario Campaign Initialized! ${firstPlayer.name}'s turn. Draft stage: ${room.gameState.draftPool} armies available.`);
    }
    return;
  }
  
  // Determine starting armies per player based on standard Risk rules
  let startingArmies = 35;
  if (numPlayers === 2) startingArmies = 40;
  else if (numPlayers === 3) startingArmies = 35;
  else if (numPlayers === 4) startingArmies = 30;
  else if (numPlayers === 5) startingArmies = 25;
  else if (numPlayers >= 6) startingArmies = 20;

  // Generate random Blizzards at start (safeguarded against map partitioning and Capital overlaps)
  const blizzards = [];
  const blizzardCount = Math.min(10, Math.max(0, parseInt(room.blizzardCount) || 0));
  if (blizzardCount > 0 && mapData.territories) {
    const excludedSet = new Set();
    const tempTerritories = {};
    mapData.territories.forEach(t => tempTerritories[t.id] = {});

    // Create a pool of candidate territories (excluding pre-set capitals if Capital Rush is active)
    const activeCapitals = [];
    if (effectiveGameMode === 'capital_rush' && mapData.nations) {
      mapData.nations.forEach(n => {
        if (n.capitalTerritoryId) activeCapitals.push(n.capitalTerritoryId);
      });
    }
    const capitalSet = new Set(activeCapitals);

    const candidates = mapData.territories.filter(t => !capitalSet.has(t.id));
    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < candidates.length && blizzards.length < blizzardCount; i++) {
      const tId = candidates[i].id;
      excludedSet.add(tId);
      if (isGraphConnected(tempTerritories, mapData.connections, excludedSet)) {
        blizzards.push(tId);
      } else {
        excludedSet.delete(tId); // rollback if it would isolate territories
      }
    }
  }

  // Reset players
  room.gameState = {
    gameMode: effectiveGameMode,
    cardTradeRule: room.cardTradeRule || 'progressive',
    blizzards,
    radiation: {},
    allowCrafting: room.allowCrafting !== false,
    capitals: {},
    turnIndex: 0,
    turnStage: 'SETUP_CLAIM',
    players: players.map(p => ({
      ...p,
      cards: [],
      nukes: parseInt(room.startingNukes) || 0,
      thermonukes: parseInt(room.startingThermonukes) || 0,
      cardsTradedCount: 0,
      startingArmiesPool: startingArmies,
      eliminated: false,
      stats: { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 }
    })),
    territories: {},
    pacts: [],
    diplomacyProposals: [],
    logs: [],
    cardDeck: [],
    conqueredThisTurn: false,
    lastDiceRolls: null,
    tradeInCount: 0,
    history: []
  };

  room.gameState.cardDeck = buildBalancedDeck(mapData.territories);

  const blizzardSet = new Set(room.gameState.blizzards);
  mapData.territories.forEach(t => {
    room.gameState.territories[t.id] = {
      ownerId: blizzardSet.has(t.id) ? 'dummy' : null,
      armies: blizzardSet.has(t.id) ? 0 : 0
    };
  });

  addLog(room.gameState, 'Game initialized. Setup phase started: claim territories.');
}

function addLog(gameState, message) {
  if (!gameState) return;
  gameState.logs = gameState.logs || [];
  gameState.logs.push({
    timestamp: new Date().toLocaleTimeString(),
    message
  });
  if (gameState.logs.length > 100) {
    gameState.logs.shift();
  }
}

// Calculate reinforcement draft armies for a player
function calculateReinforcements(gameState, mapData, playerId) {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.eliminated) return 0;

  const blizzardSet = new Set(gameState.blizzards || []);

  // 1. Territories count divided by 3 (min 3, excluding blizzards)
  const ownedTerritories = Object.keys(gameState.territories).filter(
    tid => gameState.territories[tid].ownerId === playerId && !blizzardSet.has(tid)
  );
  let baseReinforcements = Math.max(3, Math.floor(ownedTerritories.length / 3));

  // 2. Continent bonuses (blizzards are bypassed)
  let continentBonus = 0;
  if (mapData.continents) {
    mapData.continents.forEach(cont => {
      const activeContinentTerritories = cont.territoryIds.filter(tid => !blizzardSet.has(tid));
      if (activeContinentTerritories.length === 0) return;

      const allOwned = activeContinentTerritories.every(
        tid => gameState.territories[tid] && gameState.territories[tid].ownerId === playerId
      );
      if (allOwned) {
        continentBonus += cont.bonus;
      }
    });
  }

  return baseReinforcements + continentBonus;
}

// Setup claim: click on an empty territory to own it with 1 army
function claimTerritory(room, playerId, territoryId) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'SETUP_CLAIM') return { error: 'Not in territory claim stage' };

  // Blizzard restriction
  if (gameState.blizzards && gameState.blizzards.includes(territoryId)) {
    return { error: 'Cannot claim a territory locked under a Blizzard!' };
  }

  const territory = gameState.territories[territoryId];
  if (!territory) return { error: 'Invalid territory ID' };
  if (territory.ownerId !== null) return { error: 'Territory already claimed' };

  // Set owner and add 1 army
  territory.ownerId = playerId;
  territory.armies = 1;
  currentPlayer.startingArmiesPool--;

  addLog(gameState, `${currentPlayer.name} claimed ${getTerritoryName(room.mapData, territoryId)}.`);

  // Check if there are still unclaimed territories
  const unclaimed = Object.keys(gameState.territories).filter(
    tid => gameState.territories[tid].ownerId === null
  );

  if (unclaimed.length === 0) {
    // All territories claimed. Move to SETUP_FORTIFY
    gameState.turnStage = 'SETUP_FORTIFY';
    addLog(gameState, 'All territories claimed. Start placing remaining starting armies.');
  }

  advanceSetupTurn(gameState);
  return { success: true };
}

// Place remaining starting armies on owned territories
function fortifySetup(room, playerId, territoryId, amount = 1) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'SETUP_FORTIFY') return { error: 'Not in setup fortify stage' };

  const territory = gameState.territories[territoryId];
  if (!territory) return { error: 'Invalid territory ID' };
  if (territory.ownerId !== playerId) return { error: 'You do not own this territory' };

  if (amount > currentPlayer.startingArmiesPool) {
    amount = currentPlayer.startingArmiesPool;
  }
  if (amount <= 0) return { error: 'Invalid army count' };

  territory.armies += amount;
  currentPlayer.startingArmiesPool -= amount;

  addLog(gameState, `${currentPlayer.name} placed ${amount} army on ${getTerritoryName(room.mapData, territoryId)}.`);

  // Check if all players have placed their starting armies
  const armiesLeft = gameState.players.reduce((sum, p) => sum + p.startingArmiesPool, 0);
  if (armiesLeft === 0) {
    if (gameState.gameMode === 'capital_rush') {
      gameState.turnStage = 'CAPITAL_SELECTION';
      gameState.capitals = {};
      
      // Auto-assign capitals for AIs immediately
      gameState.players.forEach(p => {
        if (p.isAI) {
          const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === p.id);
          owned.sort((a, b) => gameState.territories[b].armies - gameState.territories[a].armies);
          const best = owned[0];
          if (best) {
            gameState.capitals[p.id] = best;
            addLog(gameState, `🤖 AI ${p.name} has chosen its capital.`);
          }
        }
      });
      
      // Check if all active players already have capitals assigned (e.g. AI-only matches)
      const allSelected = gameState.players
        .filter(p => !p.eliminated)
        .every(p => gameState.capitals[p.id] !== undefined && gameState.capitals[p.id] !== null);

      if (allSelected) {
        gameState.turnStage = 'DRAFT';
        gameState.turnIndex = 0;
        const firstPlayer = gameState.players[0];
        gameState.draftPool = calculateReinforcements(gameState, room.mapData, firstPlayer.id);
        addLog(gameState, `🌍 All capitals established! ${firstPlayer.name}'s turn. Draft stage: ${gameState.draftPool} armies.`);
      } else {
        addLog(gameState, `Setup complete. Commanders must now select their capital territory!`);
      }
    } else {
      gameState.turnStage = 'DRAFT';
      gameState.turnIndex = 0;
      // Calculate draft pool for first player
      const firstPlayer = gameState.players[0];
      gameState.draftPool = calculateReinforcements(gameState, room.mapData, firstPlayer.id);
      addLog(gameState, `Setup complete. ${firstPlayer.name}'s turn. Draft stage: ${gameState.draftPool} armies available.`);
    }
  } else {
    advanceSetupTurn(gameState);
  }

  return { success: true };
}

// Advance turn during setup phase (skip players with 0 starting armies pool)
function advanceSetupTurn(gameState) {
  let attempts = 0;
  const numPlayers = gameState.players.length;
  do {
    gameState.turnIndex = (gameState.turnIndex + 1) % numPlayers;
    attempts++;
  } while (
    gameState.players[gameState.turnIndex].startingArmiesPool <= 0 &&
    attempts < numPlayers &&
    gameState.turnStage === 'SETUP_FORTIFY'
  );
}

// Place draft units during player's turn
function placeDraft(room, playerId, territoryId, amount) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'DRAFT') return { error: 'Not in Draft stage' };

  const territory = gameState.territories[territoryId];
  if (!territory) return { error: 'Invalid territory ID' };
  if (territory.ownerId !== playerId) return { error: 'You do not own this territory' };

  if (amount <= 0 || amount > gameState.draftPool) {
    return { error: 'Invalid amount of armies' };
  }

  territory.armies += amount;
  gameState.draftPool -= amount;

  currentPlayer.stats = currentPlayer.stats || { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 };
  currentPlayer.stats.drafted += amount;

  addLog(gameState, `${currentPlayer.name} drafted ${amount} armies to ${getTerritoryName(room.mapData, territoryId)}.`);

  if (gameState.draftPool === 0) {
    if (currentPlayer.isAI || currentPlayer.cards.length < 5) {
      gameState.turnStage = 'ATTACK';
      addLog(gameState, `${currentPlayer.name} enters Attack stage.`);
      saveHistorySnapshot(room);
    } else {
      addLog(gameState, `${currentPlayer.name} holds ${currentPlayer.cards.length} cards and must trade in a set before entering Attack stage.`);
    }
  }

  return { success: true };
}

// Attack logic
function executeAttack(room, playerId, sourceId, targetId, diceCount) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'ATTACK') return { error: 'Not in Attack stage' };

  const source = gameState.territories[sourceId];
  const target = gameState.territories[targetId];

  if (!source || !target) return { error: 'Invalid territories' };
  if (source.ownerId !== playerId) return { error: 'You do not own the source territory' };
  if (target.ownerId === playerId) return { error: 'Cannot attack your own territory' };

  // Adjacency check
  const adjacent = getAdjacentTerritories(room.mapData.connections, sourceId);
  if (!adjacent.includes(targetId)) return { error: 'Territories are not adjacent' };

  // Blizzard and Radiation restrictions
  if (gameState.blizzards && gameState.blizzards.includes(targetId)) {
    return { error: 'Cannot interact with territories locked under a Blizzard.' };
  }
  if (gameState.radiation && gameState.radiation[targetId] > 0) {
    return { error: 'Cannot attack: territory is currently radioactive and un-interactable!' };
  }

  // Unclaimed Nuke-Devastated Claiming Block
  if (target.ownerId === null && target.armies === 0) {
    if (source.armies < 2) {
      return { error: 'Must have at least 2 armies to move forward and claim this un-owned land.' };
    }
    // Claim territory instantly
    target.ownerId = playerId;
    target.armies = 1;
    source.armies -= 1;
    
    addLog(gameState, `🚀 ${currentPlayer.name} marched into un-owned ruins to claim ${getTerritoryName(room.mapData, targetId)}!`);
    gameState.conqueredThisTurn = true;
    checkWinCondition(room);
    return { success: true };
  }

  // Check armies count
  if (source.armies < 2) return { error: 'Attacking territory must have at least 2 armies' };

  // Validate dice counts based on troop constraints:
  // 3 dice requires at least 4 armies
  // 2 dice requires at least 3 armies
  // 1 die requires at least 2 armies
  if (diceCount === 3 && source.armies < 4) {
    return { error: '3 dice requires at least 4 armies on attacking territory' };
  }
  if (diceCount === 2 && source.armies < 3) {
    return { error: '2 dice requires at least 3 armies on attacking territory' };
  }
  if (diceCount === 1 && source.armies < 2) {
    return { error: '1 die requires at least 2 armies on attacking territory' };
  }
  if (diceCount < 1 || diceCount > 3) {
    return { error: 'Invalid attacker dice count' };
  }

  const defenderId = target.ownerId;
  const defenderPlayer = gameState.players.find(p => p.id === defenderId);
  const maxDefDice = target.armies >= 2 ? 2 : 1;

  // If defender is AI or has autoDefend enabled, resolve instantly
  if (!defenderPlayer || defenderPlayer.isAI || defenderPlayer.autoDefend) {
    const diceResult = resolveCombatRolls(room, sourceId, targetId, diceCount, maxDefDice);
    return { success: true, diceResult };
  }

  // Otherwise, transition to DEFENDER_DICE_DECISION stage to wait for defender input
  gameState.turnStage = 'DEFENDER_DICE_DECISION';
  gameState.combatContext = {
    sourceId,
    targetId,
    attackerDiceCount: diceCount,
    defenderId,
    maxDefDice
  };

  addLog(gameState, `⚔️ ${currentPlayer.name} launched an attack on ${defenderPlayer.name}'s ${getTerritoryName(room.mapData, targetId)}! Awaiting defense decision.`);

  return { success: true, pendingDefense: true };
}

// Blitz / Fight to the Death Attack Logic
function executeBlitzAttack(room, playerId, sourceId, targetId) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'ATTACK') return { error: 'Not in Attack stage' };

  const source = gameState.territories[sourceId];
  const target = gameState.territories[targetId];

  if (!source || !target) return { error: 'Invalid territories' };
  if (source.ownerId !== playerId) return { error: 'You do not own the source territory' };
  if (target.ownerId === playerId) return { error: 'Cannot attack your own territory' };

  const adjacent = getAdjacentTerritories(room.mapData.connections, sourceId);
  if (!adjacent.includes(targetId)) return { error: 'Territories are not adjacent' };

  if (source.armies < 2) return { error: 'Attacking territory must have at least 2 armies' };

  let roundsFought = 0;
  let totalAttackerLosses = 0;
  let totalDefenderLosses = 0;
  let lastDiceResult = null;

  while (source.armies >= 2 && target.ownerId !== playerId && gameState.turnStage !== 'GAME_OVER') {
    const attackerDice = source.armies >= 4 ? 3 : (source.armies === 3 ? 2 : 1);
    const maxDefDice = target.armies >= 2 ? 2 : 1;

    const diceResult = resolveCombatRolls(room, sourceId, targetId, attackerDice, maxDefDice);
    if (!diceResult) break;

    roundsFought++;
    totalAttackerLosses += diceResult.attackerLosses || 0;
    totalDefenderLosses += diceResult.defenderLosses || 0;
    lastDiceResult = diceResult;

    if (target.ownerId === playerId || gameState.turnStage === 'POST_ATTACK_MOVE' || gameState.turnStage === 'GAME_OVER') {
      break;
    }
  }

  const conquered = target.ownerId === playerId;

  addLog(gameState, `⚔️ BLITZ CAMPAIGN: ${currentPlayer.name} fought ${roundsFought} rounds against ${getTerritoryName(room.mapData, targetId)}. Attacker lost ${totalAttackerLosses}, Defender lost ${totalDefenderLosses}. ${conquered ? 'CONQUERED!' : 'Halted.'}`);

  return {
    success: true,
    blitzResult: {
      sourceId,
      targetId,
      sourceName: getTerritoryName(room.mapData, sourceId),
      targetName: getTerritoryName(room.mapData, targetId),
      roundsFought,
      totalAttackerLosses,
      totalDefenderLosses,
      conquered,
      sourceArmiesRemaining: source.armies,
      targetArmies: target.armies,
      lastDiceResult
    }
  };
}

function resolveDefense(room, playerId, defenderDiceCount) {
  const gameState = room.gameState;
  if (gameState.turnStage !== 'DEFENDER_DICE_DECISION') {
    return { error: 'Not in defender decision stage' };
  }

  const context = gameState.combatContext;
  if (!context) return { error: 'No active combat context' };
  if (context.defenderId !== playerId) return { error: 'You are not the defender in this combat' };

  // Validate dice count
  defenderDiceCount = parseInt(defenderDiceCount);
  if (!Number.isInteger(defenderDiceCount) || defenderDiceCount < 1 || defenderDiceCount > context.maxDefDice) {
    return { error: `Invalid defender dice count. Must be between 1 and ${context.maxDefDice}` };
  }

  const diceResult = resolveCombatRolls(room, context.sourceId, context.targetId, context.attackerDiceCount, defenderDiceCount);
  
  // Clear context
  gameState.combatContext = null;

  return { success: true, diceResult };
}

function resolveCombatRolls(room, sourceId, targetId, attackerDiceCount, defenderDiceCount) {
  const gameState = room.gameState;
  const source = gameState.territories[sourceId];
  const target = gameState.territories[targetId];
  const currentPlayer = gameState.players[gameState.turnIndex];
  const attackerPlayer = currentPlayer;
  const defenderId = target.ownerId;
  const defenderPlayer = gameState.players.find(p => p.id === defenderId);

  // Declare all outcome flags at the top of the function to prevent ReferenceErrors on failed attacks
  let eliminatedPlayerId = null;
  let killerPlayerId = null;
  let lostCapitalOwnerId = null;
  let badDicePlayerId = null;
  let bullyingVictimId = null;
  let bullyingAttackerId = null;

  // --- Safety clamps: ensure dice counts are valid integers ---
  attackerDiceCount = Math.max(1, Math.min(3, Math.floor(attackerDiceCount) || 1));
  defenderDiceCount = Math.max(1, Math.min(2, Math.floor(defenderDiceCount) || 1));

  // Roll dice
  const attackerRolls = [];
  for (let i = 0; i < attackerDiceCount; i++) {
    attackerRolls.push(Math.floor(Math.random() * 6) + 1);
  }
  const defenderRolls = [];
  for (let i = 0; i < defenderDiceCount; i++) {
    defenderRolls.push(Math.floor(Math.random() * 6) + 1);
  }

  // Sort descending
  attackerRolls.sort((a, b) => b - a);
  defenderRolls.sort((a, b) => b - a);

  // Compare pairs — ties go to defender (Risk rule)
  let attackerLosses = 0;
  let defenderLosses = 0;

  // Track consecutive turns attacked for bullying evaluation
  if (defenderPlayer && defenderPlayer.isAI) {
    const turnNum = Math.floor(gameState.history.length / gameState.players.length) + 1;
    defenderPlayer.lastAttackRecord = defenderPlayer.lastAttackRecord || {};
    
    if (defenderPlayer.lastAttackRecord.attackerId === currentPlayer.id) {
      if (defenderPlayer.lastAttackRecord.turnNum === turnNum - 1) {
        defenderPlayer.lastAttackRecord.consecutiveCount++;
      } else if (defenderPlayer.lastAttackRecord.turnNum !== turnNum) {
        defenderPlayer.lastAttackRecord.consecutiveCount = 1;
      }
    } else {
      defenderPlayer.lastAttackRecord = {
        attackerId: currentPlayer.id,
        turnNum: turnNum,
        consecutiveCount: 1
      };
    }
    defenderPlayer.lastAttackRecord.turnNum = turnNum;

    if (defenderPlayer.lastAttackRecord.consecutiveCount === 3) {
      defenderPlayer.lastAttackRecord.consecutiveCount = 0; // Reset triggers to prevent spam
      bullyingVictimId = defenderPlayer.id;
      bullyingAttackerId = currentPlayer.id;
    }
  }
  const comparisons = Math.min(attackerRolls.length, defenderRolls.length);

  for (let i = 0; i < comparisons; i++) {
    if (attackerRolls[i] > defenderRolls[i]) {
      defenderLosses++;
    } else {
      attackerLosses++; // ties go to defender
    }
  }

  // Check diplomacy breach before executing combat!
  const activePactIndex = gameState.pacts.findIndex(
    p => (p.playerA === currentPlayer.id && p.playerB === defenderId) ||
         (p.playerB === currentPlayer.id && p.playerA === defenderId)
  );

  let betrayed = false;
  if (activePactIndex !== -1) {
    betrayed = true;
    gameState.pacts.splice(activePactIndex, 1);
    
    // Save betrayal records
    if (currentPlayer.isAI) {
      currentPlayer.betrayedPlayers = currentPlayer.betrayedPlayers || {};
      currentPlayer.betrayedPlayers[defenderId] = true;
    } else if (defenderPlayer && defenderPlayer.isAI) {
      // Human player betrayed an AI defender
      defenderPlayer.betrayedByPlayers = defenderPlayer.betrayedByPlayers || {};
      defenderPlayer.betrayedByPlayers[currentPlayer.id] = true;
    }

    gameState.players.forEach(p => {
      if (p.isAI) {
        if (!p.trustScores) p.trustScores = {};
        if (p.id === defenderId) {
          p.trustScores[currentPlayer.id] = 0;
        } else if (p.id === currentPlayer.id) {
          p.trustScores[defenderId] = 0;
        } else {
          p.trustScores[currentPlayer.id] = Math.max(0, (p.trustScores[currentPlayer.id] || 100) - 40);
        }
      }
    });

    addLog(gameState, `⚠️ BETRAYAL! ${currentPlayer.name} broke their pact and attacked ${defenderPlayer ? defenderPlayer.name : 'an ally'}!`);
  }

  // Track consecutive battle losses to trigger Bad Dice commentary
  const checkBadDice = (player, losses) => {
    player.battleLossesHistory = player.battleLossesHistory || [];
    player.battleLossesHistory.push(losses);
    if (player.battleLossesHistory.length >= 2) {
      const len = player.battleLossesHistory.length;
      const last = player.battleLossesHistory[len - 1];
      const prev = player.battleLossesHistory[len - 2];
      if (last >= 2 && prev >= 2) {
        player.battleLossesHistory = []; // Reset history so we don't spam dialogue
        return true;
      }
    }
    return false;
  };

  const attPlayerObj = gameState.players.find(p => p.id === currentPlayer.id);
  const defPlayerObj = gameState.players.find(p => p.id === defenderId);

  if (attPlayerObj && checkBadDice(attPlayerObj, attackerLosses)) {
    badDicePlayerId = attPlayerObj.id;
  } else if (defPlayerObj && checkBadDice(defPlayerObj, defenderLosses)) {
    badDicePlayerId = defPlayerObj.id;
  }

  // Apply casualties — source must always keep at least 1 army
  source.armies = Math.max(1, source.armies - attackerLosses);
  target.armies = Math.max(0, target.armies - defenderLosses);

  let captured = false;
  if (target.armies === 0) {
    captured = true;
    gameState.conqueredThisTurn = true;
    target.ownerId = currentPlayer.id;

    // Move-in: at least attackerDiceCount armies, clamped so source keeps at least 1
    const minMove = Math.min(attackerDiceCount, source.armies - 1);
    const safeMinMove = Math.max(1, minMove); // always move at least 1 army in
    
    // If source doesn't even have 2 armies left (edge case after casualties), move 1
    const actualMove = source.armies > 1 ? safeMinMove : 1;
    
    if (source.armies <= 1) {
      // Extremely edge case: attacker lost everything but still won
      // Move 1 army, source gets 0 (it's now empty — but still owned by attacker)
      target.armies = 1;
      source.armies = Math.max(0, source.armies - 1);
    } else {
      target.armies = actualMove;
      source.armies -= actualMove;
    }

    // Check if the conquered territory is a Capital in Capital Rush mode
    if (gameState.gameMode === 'capital_rush' && gameState.capitals) {
      const capOwnerId = Object.keys(gameState.capitals).find(pId => gameState.capitals[pId] === targetId);
      if (capOwnerId && capOwnerId !== currentPlayer.id) {
        lostCapitalOwnerId = capOwnerId;
      }
    }

    // Check if defender is eliminated
    if (defenderPlayer) {
      const defenderTerritories = Object.keys(gameState.territories).filter(
        tid => gameState.territories[tid].ownerId === defenderId
      );

      if (defenderTerritories.length === 0) {
        defenderPlayer.eliminated = true;
        eliminatedPlayerId = defenderPlayer.id;
        killerPlayerId = currentPlayer.id;
        addLog(gameState, `💀 ${defenderPlayer.name} has been eliminated!`);

        // Clear all active alliances and ceasefires involving the eliminated player
        if (gameState.pacts) {
          const originalPactCount = gameState.pacts.length;
          gameState.pacts = gameState.pacts.filter(
            p => p.playerA !== defenderId && p.playerB !== defenderId
          );
          if (gameState.pacts.length < originalPactCount) {
            addLog(gameState, `🕊️ Dissolved active treaties involving the eliminated commander, ${defenderPlayer.name}.`);
          }
        }

        // Transfer cards to attacker
        const transferredCardsCount = defenderPlayer.cards.length;
        currentPlayer.cards.push(...defenderPlayer.cards);
        defenderPlayer.cards = [];
        addLog(gameState, `${currentPlayer.name} received ${transferredCardsCount > 0 ? transferredCardsCount : 'all'} cards from ${defenderPlayer.name}.`);
      }
    }

    // POST_ATTACK_MOVE: only if source has extra armies to move (source.armies > 1 means there's at least 1 moveable)
    const additionalMax = Math.max(0, source.armies - 1);
    if (additionalMax > 0) {
      gameState.turnStage = 'POST_ATTACK_MOVE';
      gameState.postAttackContext = {
        sourceId,
        targetId,
        minMove: actualMove, // Now stores the base move-in amount for total calculations
        additionalMax
      };
    } else {
      // No additional armies to move — check for forced card trade or continue attacking
      if (currentPlayer.cards.length >= 6) {
        gameState.turnStage = 'DRAFT';
        addLog(gameState, `${currentPlayer.name} holds ${currentPlayer.cards.length} cards and must trade in sets.`);
      } else {
        gameState.turnStage = 'ATTACK';
      }
    }
  } else {
    gameState.turnStage = 'ATTACK'; // stay in attack stage after failed attack
    addLog(gameState, `${currentPlayer.name} attacked ${getTerritoryName(room.mapData, targetId)}. Rolls — Attacker: [${attackerRolls.join(', ')}], Defender: [${defenderRolls.join(', ')}]. Attacker lost ${attackerLosses}, Defender lost ${defenderLosses}.`);
  }

  // Track territory casualties with timestamps (for battlescarred 2-turn expiry)
  gameState.territoryCasualties = gameState.territoryCasualties || {};
  gameState.territoryCasualties[targetId] = (gameState.territoryCasualties[targetId] || 0) + defenderLosses;
  gameState.territoryCasualties[sourceId] = (gameState.territoryCasualties[sourceId] || 0) + attackerLosses;

  // Per-turn casualties (for battlescarred: only single-turn heavy battles trigger it)
  const currentTurnNum = gameState.turnNum || 0;
  gameState.territoryCasualtyTurn = gameState.territoryCasualtyTurn || {};
  if (gameState.territories[targetId]) {
    gameState.territories[targetId].currentTurnCasualties = (gameState.territories[targetId].currentTurnCasualties || 0) + defenderLosses;
    if (defenderLosses > 0) gameState.territories[targetId].lastBattleTurn = currentTurnNum;
  }
  if (gameState.territories[sourceId]) {
    gameState.territories[sourceId].currentTurnCasualties = (gameState.territories[sourceId].currentTurnCasualties || 0) + attackerLosses;
    if (attackerLosses > 0) gameState.territories[sourceId].lastBattleTurn = currentTurnNum;
  }

  // Update stats
  if (attackerPlayer) {
    attackerPlayer.stats = attackerPlayer.stats || { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 };
    attackerPlayer.stats.killed += defenderLosses;
    attackerPlayer.stats.lost += attackerLosses;
    attackerPlayer.stats.diceRollsCount = (attackerPlayer.stats.diceRollsCount || 0) + attackerRolls.length;
    attackerPlayer.stats.diceRollsSum = (attackerPlayer.stats.diceRollsSum || 0) + attackerRolls.reduce((a, b) => a + b, 0);
    attackerPlayer.stats.diceRollComparisons = (attackerPlayer.stats.diceRollComparisons || 0) + comparisons;
    attackerPlayer.stats.diceRollWins = (attackerPlayer.stats.diceRollWins || 0) + defenderLosses;
    if (betrayed) {
      attackerPlayer.stats.betrayals = (attackerPlayer.stats.betrayals || 0) + 1;
    }
    if (captured) {
      attackerPlayer.stats.territoriesConquered = (attackerPlayer.stats.territoriesConquered || 0) + 1;
      attackerPlayer.stats.currentTurnConquests = (attackerPlayer.stats.currentTurnConquests || 0) + 1;
      if (attackerPlayer.stats.currentTurnConquests > (attackerPlayer.stats.maxConquestsInTurn || 0)) {
        attackerPlayer.stats.maxConquestsInTurn = attackerPlayer.stats.currentTurnConquests;
      }
    }
  }
  if (defenderPlayer) {
    defenderPlayer.stats = defenderPlayer.stats || { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 };
    defenderPlayer.stats.killed += attackerLosses;
    defenderPlayer.stats.lost += defenderLosses;
    defenderPlayer.stats.defendedKills = (defenderPlayer.stats.defendedKills || 0) + attackerLosses;
    defenderPlayer.stats.diceRollsCount = (defenderPlayer.stats.diceRollsCount || 0) + defenderRolls.length;
    defenderPlayer.stats.diceRollsSum = (defenderPlayer.stats.diceRollsSum || 0) + defenderRolls.reduce((a, b) => a + b, 0);
    defenderPlayer.stats.diceRollComparisons = (defenderPlayer.stats.diceRollComparisons || 0) + comparisons;
    defenderPlayer.stats.diceRollWins = (defenderPlayer.stats.diceRollWins || 0) + attackerLosses;
    if (captured) {
      defenderPlayer.stats.currentTurnLost = (defenderPlayer.stats.currentTurnLost || 0) + 1;
      if (defenderPlayer.stats.currentTurnLost > (defenderPlayer.stats.maxTerritoriesLostInTurn || 0)) {
        defenderPlayer.stats.maxTerritoriesLostInTurn = defenderPlayer.stats.currentTurnLost;
      }
    }
  }

  gameState.lastDiceRolls = {
    rollId: Math.random().toString(36).substr(2, 9),
    sourceId,
    targetId,
    attackerId: currentPlayer.id,
    defenderId,
    attackerRolls,
    defenderRolls,
    attackerLosses,
    defenderLosses,
    captured,
    betrayed,
    eliminatedPlayerId,
    killerPlayerId,
    badDicePlayerId,
    bullyingVictimId,
    bullyingAttackerId,
    lostCapitalOwnerId
  };

  // Check victory condition
  checkWinCondition(room);

  return gameState.lastDiceRolls;
}

// Post-Attack Move: Move additional armies from source to target after conquest
function executePostAttackMove(room, playerId, amount) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'POST_ATTACK_MOVE') return { error: 'Not in Post-Attack Move stage' };

  const context = gameState.postAttackContext;
  const source = context ? gameState.territories[context.sourceId] : null;
  const target = context ? gameState.territories[context.targetId] : null;

  // Auto-heal if context is missing or territory ownership is invalid
  if (!context || !source || !target || source.ownerId !== playerId || target.ownerId !== playerId) {
    gameState.postAttackContext = null;
    gameState.turnStage = (currentPlayer.cards && currentPlayer.cards.length >= 6) ? 'DRAFT' : 'ATTACK';
    return { success: true, recovered: true };
  }

  if (amount < 0 || amount > context.additionalMax) {
    return { error: `Invalid amount. Must be between 0 and ${context.additionalMax}` };
  }

  const moveAmount = Math.min(context.additionalMax, Math.max(0, parseInt(amount) || 0));

  if (moveAmount > 0) {
    source.armies -= moveAmount;
    target.armies += moveAmount;
    addLog(gameState, `${currentPlayer.name} moved an additional ${moveAmount} armies to ${getTerritoryName(room.mapData, context.targetId)}.`);
  }

  // Clear context
  gameState.postAttackContext = null;

  // Enforce 6+ card limit trade-in rule
  if (currentPlayer.cards && currentPlayer.cards.length >= 6) {
    gameState.turnStage = 'DRAFT';
    addLog(gameState, `${currentPlayer.name} holds ${currentPlayer.cards.length} cards and must trade in sets down to 4 or fewer before attacking.`);
  } else {
    gameState.turnStage = 'ATTACK';
  }

  return { success: true };
}

// Fortify armies at the end of turn
function executeFortify(room, playerId, sourceId, targetId, amount) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  if (currentPlayer.id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'FORTIFY') return { error: 'Not in Fortify stage' };

  const source = gameState.territories[sourceId];
  const target = gameState.territories[targetId];

  if (!source || !target) return { error: 'Invalid territories' };
  if (source.ownerId !== playerId || target.ownerId !== playerId) {
    return { error: 'You must own both territories' };
  }

  if (sourceId === targetId) return { error: 'Source and target cannot be the same' };
  if (source.armies <= amount) return { error: 'Must leave at least 1 army behind' };
  if (amount <= 0) return { error: 'Invalid amount' };

  // Verify allied path exists
  const pathExists = hasAlliedPath(gameState.territories, room.mapData.connections, sourceId, targetId, playerId, gameState.pacts);
  if (!pathExists) return { error: 'No allied path connecting these territories' };

  source.armies -= amount;
  target.armies += amount;

  addLog(gameState, `${currentPlayer.name} fortified ${amount} armies from ${getTerritoryName(room.mapData, sourceId)} to ${getTerritoryName(room.mapData, targetId)}.`);

  // Once fortification is done, end turn
  endTurn(room);
  return { success: true };
}

// End turn cleanup and advance to next player
function endTurn(room) {
  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.turnIndex];

  // Save a snapshot of the board at the end of this turn
  saveHistorySnapshot(room);

  // Reset turn-based AI message tracking counters
  gameState.aiMessagesSentThisTurn = {};

  // Ticks down Radioactive turns
  if (gameState.radiation) {
    Object.keys(gameState.radiation).forEach(tid => {
      gameState.radiation[tid]--;
      if (gameState.radiation[tid] <= 0) {
        delete gameState.radiation[tid];
        addLog(gameState, `☀️ Radioactive decay: radiation has dissipated completely at ${getTerritoryName(room.mapData, tid)}.`);
      }
    });
  }

  // Draw exactly 1 card if player conquered at least 1 territory this turn
  // Faithful Risk rule: only 1 card per turn regardless of conquests count
  if (gameState.conqueredThisTurn && gameState.cardDeck.length > 0) {
    const card = gameState.cardDeck.pop();
    currentPlayer.cards.push(card);
    addLog(gameState, `🃏 ${currentPlayer.name} drew a Risk card (${card.type}${card.territoryId ? ' — ' + getTerritoryName(room.mapData, card.territoryId) : ' Wildcard'}).`);
  }

  // Reset turn flags
  gameState.conqueredThisTurn = false;
  gameState.lastDiceRolls = null;
  gameState.turnNum = (gameState.turnNum || 0) + 1;

  if (gameState.players) {
    gameState.players.forEach(p => {
      if (p.stats) {
        p.stats.currentTurnConquests = 0;
        p.stats.currentTurnLost = 0;
      }
    });
  }

  // Snapshot single-turn casualties → recentBattleCasualties (shown as battlescarred smoke for 2 turns)
  // Then clear currentTurnCasualties for next turn
  if (gameState.territories) {
    Object.keys(gameState.territories).forEach(tid => {
      const t = gameState.territories[tid];
      const turnCas = t.currentTurnCasualties || 0;
      if (turnCas > 0) {
        // Snapshot this turn's casualties as the "recent" ones that drive battlescarred
        t.recentBattleCasualties = turnCas;
        t.recentBattleTurn = gameState.turnNum;
      }
      t.currentTurnCasualties = 0;

      // Expire battlescarred smoke after 2 full turns since the heavy battle turn
      if (t.recentBattleTurn !== undefined && gameState.turnNum - t.recentBattleTurn > 2) {
        t.recentBattleCasualties = 0;
        t.recentBattleTurn = undefined;
      }
    });
  }

  // Advance turn to next active player
  const numPlayers = gameState.players.length;
  let attempts = 0;
  do {
    gameState.turnIndex = (gameState.turnIndex + 1) % numPlayers;
    attempts++;
  } while (
    gameState.players[gameState.turnIndex].eliminated &&
    attempts < numPlayers
  );

  // If game is over, transition
  if (gameState.turnStage !== 'GAME_OVER') {
    gameState.turnStage = 'DRAFT';
    const nextPlayer = gameState.players[gameState.turnIndex];
    gameState.draftPool = calculateReinforcements(gameState, room.mapData, nextPlayer.id);
    addLog(gameState, `It is now ${nextPlayer.name}'s turn. Draft stage: ${gameState.draftPool} armies available.`);
  }
}

// Trade in a set of 3 cards for armies
function tradeCards(room, playerId, cardIndices, targetTerritoryId = null, skipStageTransition = false) {
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === playerId);

  if (!player) return { error: 'Player not found' };
  if (gameState.turnStage !== 'DRAFT') return { error: 'Can only trade cards during Draft stage' };
  if (gameState.players[gameState.turnIndex].id !== playerId) return { error: 'Not your turn' };

  if (cardIndices.length !== 3) return { error: 'Must select exactly 3 cards' };

  const selectedCards = cardIndices.map(idx => player.cards[idx]).filter(Boolean);
  if (selectedCards.length !== 3) return { error: 'Invalid card selections' };

  if (!isValidCardSet(selectedCards)) {
    return { error: 'Selected cards do not form a valid set (3 of same, or 1 of each, or including Wildcards)' };
  }

  // Calculate trade-in value: Fixed or Progressive
  const rule = gameState.cardTradeRule || (room ? room.cardTradeRule : 'progressive');
  let bonusArmies = 0;
  if (rule === 'fixed') {
    bonusArmies = calculateFixedTradeBonus(selectedCards);
  } else {
    gameState.tradeInCount++;
    const count = gameState.tradeInCount;
    if (count === 1) bonusArmies = 4;
    else if (count === 2) bonusArmies = 6;
    else if (count === 3) bonusArmies = 8;
    else if (count === 4) bonusArmies = 10;
    else if (count === 5) bonusArmies = 12;
    else if (count === 6) bonusArmies = 15;
    else bonusArmies = 15 + (count - 6) * 5;
  }

  gameState.draftPool += bonusArmies;
  player.cardsTradedCount++;

  // Risk Rule: If player owns the territory shown on one of the cards, they get 2 extra armies on that territory
  selectedCards.forEach(card => {
    if (card.territoryId) {
      const terr = gameState.territories[card.territoryId];
      if (terr && terr.ownerId === playerId) {
        terr.armies += 2;
        addLog(gameState, `🎯 Extra Bonus: ${player.name} received 2 extra armies on ${getTerritoryName(room.mapData, card.territoryId)} for holding its matching card!`);
      }
    }
  });

  // Remove cards from player's hand (sort indices descending first)
  const sortedIndices = [...cardIndices].sort((a, b) => b - a);
  sortedIndices.forEach(idx => {
    // Put back to deck bottom or discard (let's push to bottom of deck)
    const card = player.cards.splice(idx, 1)[0];
    gameState.cardDeck.unshift(card);
  });

  addLog(gameState, `${player.name} traded in a card set for ${bonusArmies} bonus armies!`);

  // Optional auto-deposit to target territory
  let autoDeposited = 0;
  if (targetTerritoryId) {
    const targetTerr = gameState.territories[targetTerritoryId];
    if (targetTerr && targetTerr.ownerId === playerId) {
      const depositAmount = Math.min(bonusArmies, gameState.draftPool);
      if (depositAmount > 0) {
        targetTerr.armies += depositAmount;
        gameState.draftPool -= depositAmount;
        player.stats = player.stats || { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 };
        player.stats.drafted += depositAmount;
        autoDeposited = depositAmount;
        addLog(gameState, `🚀 Auto-Deposit: ${player.name} deposited ${depositAmount} traded armies onto ${getTerritoryName(room.mapData, targetTerritoryId)}.`);
        if (!skipStageTransition && gameState.draftPool === 0 && player.cards.length < 5) {
          gameState.turnStage = 'ATTACK';
          addLog(gameState, `${player.name} enters Attack stage.`);
        }
      }
    }
  }

  return { success: true, bonusArmies, autoDeposited };
}

function findValidCardSetIndices(cards, rule = 'progressive') {
  if (!cards || cards.length < 3) return null;
  let bestIndices = null;
  let maxBonus = -1;

  for (let i = 0; i < cards.length - 2; i++) {
    for (let j = i + 1; j < cards.length - 1; j++) {
      for (let k = j + 1; k < cards.length; k++) {
        const triplet = [cards[i], cards[j], cards[k]];
        if (isValidCardSet(triplet)) {
          if (rule === 'fixed') {
            const bonus = calculateFixedTradeBonus(triplet);
            if (bonus > maxBonus) {
              maxBonus = bonus;
              bestIndices = [i, j, k];
            }
          } else {
            return [i, j, k];
          }
        }
      }
    }
  }
  return bestIndices;
}

// Trade all valid card sets in player's hand sequentially
function tradeAllCards(room, playerId, targetTerritoryId = null) {
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found' };
  if (gameState.turnStage !== 'DRAFT') return { error: 'Can only trade cards during Draft stage' };
  if (gameState.players[gameState.turnIndex].id !== playerId) return { error: 'Not your turn' };

  let totalBonus = 0;
  let setsTraded = 0;
  const rule = gameState.cardTradeRule || (room ? room.cardTradeRule : 'progressive');

  while (true) {
    const indices = findValidCardSetIndices(player.cards, rule);
    if (!indices) break;
    const res = tradeCards(room, playerId, indices, targetTerritoryId, true);
    if (res.error) break;
    totalBonus += (res.bonusArmies || 0);
    setsTraded++;
  }

  if (setsTraded === 0) {
    return { error: 'No valid card sets available to trade' };
  }

  addLog(gameState, `⚡ ${player.name} traded in ${setsTraded} card set(s) for a total of ${totalBonus} bonus armies!`);

  if (gameState.draftPool === 0 && player.cards.length < 5) {
    gameState.turnStage = 'ATTACK';
    addLog(gameState, `${player.name} enters Attack stage.`);
    saveHistorySnapshot(room);
  }

  return { success: true, totalBonus, setsTraded };
}


function selectCapital(room, playerId, territoryId) {
  const gameState = room.gameState;
  if (gameState.turnStage !== 'CAPITAL_SELECTION') {
    return { error: 'Not in Capital Selection stage' };
  }

  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.eliminated) return { error: 'Player not active' };

  const territory = gameState.territories[territoryId];
  if (!territory) return { error: 'Invalid territory ID' };
  if (territory.ownerId !== playerId) return { error: 'You do not own this territory' };

  gameState.capitals[playerId] = territoryId;
  addLog(gameState, `🎖️ ${player.name} has designated ${getTerritoryName(room.mapData, territoryId)} as their capital!`);

  // Check if all active players have selected their capitals
  const allSelected = gameState.players
    .filter(p => !p.eliminated)
    .every(p => gameState.capitals[p.id] !== undefined && gameState.capitals[p.id] !== null);

  if (allSelected) {
    // All capitals set, transition to DRAFT stage for player 0
    gameState.turnStage = 'DRAFT';
    gameState.turnIndex = 0;
    const firstPlayer = gameState.players[0];
    gameState.draftPool = calculateReinforcements(gameState, room.mapData, firstPlayer.id);
    addLog(gameState, `🌍 All capitals have been established! Let the campaign begin. ${firstPlayer.name}'s turn. Draft stage: ${gameState.draftPool} armies.`);
  }

  return { success: true };
}

// Check if any player owns all territories (Conquest) or all active capitals (Capital Rush)
function checkWinCondition(room) {
  const gameState = room.gameState;

  if (gameState.gameMode === 'capital_rush' && gameState.capitals) {
    // Get all designated capital territory IDs in this match
    const allCapitalTerritoryIds = [...new Set(Object.values(gameState.capitals))].filter(Boolean);

    if (allCapitalTerritoryIds.length > 0) {
      // Find the current owner of each capital territory
      const capitalOwners = allCapitalTerritoryIds.map(tid => {
        const terr = gameState.territories[tid];
        return (terr && terr.ownerId && terr.ownerId !== 'dummy') ? terr.ownerId : null;
      });

      const uniqueOwners = new Set(capitalOwners);
      // Win condition: Exactly ONE non-dummy player owns ALL capital cities
      if (uniqueOwners.size === 1 && !uniqueOwners.has(null)) {
        const winnerId = [...uniqueOwners][0];
        const winner = gameState.players.find(p => p.id === winnerId);
        if (winner) {
          gameState.turnStage = 'GAME_OVER';
          gameState.winner = winnerId;
          addLog(gameState, `🏆 GAME OVER! ${winner.name} has captured all capital cities!`);
          return;
        }
      }
    }
  }

  const activeOwners = new Set();
  Object.keys(gameState.territories).forEach(tid => {
    const owner = gameState.territories[tid].ownerId;
    if (owner && owner !== 'dummy') activeOwners.add(owner);
  });

  if (activeOwners.size === 1) {
    const winnerId = [...activeOwners][0];
    const winner = gameState.players.find(p => p.id === winnerId);
    if (winner) {
      gameState.turnStage = 'GAME_OVER';
      gameState.winner = winnerId;
      addLog(gameState, `🏆 GAME OVER! ${winner.name} has conquered the world!`);
    }
  }

  // Save final victory snapshot if game just ended
  if (gameState.turnStage === 'GAME_OVER') {
    saveHistorySnapshot(room);
  }
}

function saveHistorySnapshot(room) {
  const gameState = room.gameState;
  if (!gameState.history) gameState.history = [];
  
  const territoriesSnapshot = {};
  Object.keys(gameState.territories).forEach(tid => {
    territoriesSnapshot[tid] = {
      ownerId: gameState.territories[tid].ownerId,
      armies: gameState.territories[tid].armies,
      isCapital: gameState.capitals ? Object.values(gameState.capitals).includes(tid) : false
    };
  });

  const playersSnapshot = gameState.players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    nationId: p.nationId || p.selectedNationId || null,
    nationName: p.nationName || null,
    eliminated: p.eliminated,
    stats: p.stats ? { ...p.stats } : { drafted: 0, killed: 0, lost: 0, territoriesConquered: 0 }
  }));

  gameState.history.push({
    turnNumber: Math.floor(gameState.history.length / gameState.players.length) + 1,
    turnIndex: gameState.turnIndex,
    activePlayerId: gameState.players[gameState.turnIndex]?.id,
    territories: territoriesSnapshot,
    players: playersSnapshot,
    chatCount: gameState.chatArchive ? gameState.chatArchive.length : 0, // Store only the size
    timestamp: Date.now()
  });
}

function getTerritoryName(mapData, id) {
  const terr = mapData.territories.find(t => t.id === id);
  return terr ? terr.name : id;
}

// Craft Nuke Weapon
function craftNuke(room, playerId, cardIndices, isThermo) {
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === playerId);

  if (!player) return { error: 'Player not found' };
  if (!gameState.allowCrafting) return { error: 'Weapon crafting is disabled for this room.' };
  if (gameState.turnStage !== 'DRAFT') return { error: 'Can only craft weapons during your Draft stage!' };
  if (gameState.players[gameState.turnIndex].id !== playerId) return { error: 'Not your turn' };

  if (cardIndices.length !== 3) return { error: 'Must select exactly 3 cards to craft.' };

  const selectedCards = cardIndices.map(idx => player.cards[idx]).filter(Boolean);
  if (selectedCards.length !== 3) return { error: 'Invalid card selections.' };

  if (isThermo) {
    if (!isValidCardSet(selectedCards)) {
      return { error: 'Thermonuclear crafting requires a valid matching set of 3 cards.' };
    }
    player.thermonukes = (player.thermonukes || 0) + 1;
    addLog(gameState, `☢️ CRITICAL ASSEMBLY: ${player.name} crafted a Thermonuclear Weapon!`);
  } else {
    player.nukes = (player.nukes || 0) + 1;
    addLog(gameState, `☢️ ASSEMBLY: ${player.name} crafted a Tactical Nuke!`);
  }

  // Remove cards from hand
  const sortedIndices = [...cardIndices].sort((a, b) => b - a);
  sortedIndices.forEach(idx => {
    const card = player.cards.splice(idx, 1)[0];
    gameState.cardDeck.unshift(card);
  });

  return { success: true };
}

// Fire Nuke Weapon
function fireNuke(room, playerId, sourceId, targetId, isThermo) {
  const gameState = room.gameState;
  const player = gameState.players.find(p => p.id === playerId);

  if (!player) return { error: 'Player not found' };
  if (gameState.players[gameState.turnIndex].id !== playerId) return { error: 'Not your turn' };
  if (gameState.turnStage !== 'ATTACK') return { error: 'Can only fire weapons during your Attack stage!' };

  if (isThermo) {
    if (!player.thermonukes || player.thermonukes <= 0) return { error: 'You hold zero Thermonuclear weapons.' };
    player.thermonukes--;
  } else {
    if (!player.nukes || player.nukes <= 0) return { error: 'You hold zero Tactical Nukes.' };
    player.nukes--;
  }

  // Adjacency pathing verification
  const adjacent = getAdjacentTerritories(room.mapData.connections, sourceId);
  if (!adjacent.includes(targetId)) return { error: 'Launch pads must be adjacent to the target territory.' };

  const source = gameState.territories[sourceId];
  if (!source || source.ownerId !== playerId || source.armies < 2) {
    return { error: 'Must hold at least 2 armies on launch pad territory.' };
  }

  const target = gameState.territories[targetId];
  if (!target) return { error: 'Invalid target territory.' };

  const defenderId = target.ownerId;
  const defenderPlayer = gameState.players.find(p => p.id === defenderId);

  // Check Diplomacy breach and break active treaties
  if (defenderId && defenderId !== 'dummy' && defenderId !== playerId) {
    const activePactIndex = gameState.pacts.findIndex(
      p => (p.playerA === playerId && p.playerB === defenderId) ||
           (p.playerB === playerId && p.playerA === defenderId)
    );
    if (activePactIndex !== -1) {
      gameState.pacts.splice(activePactIndex, 1);
      addLog(gameState, `💔 TREATER BREACH: ${player.name} broke all treaties and fired a nuke on allied ${defenderPlayer ? defenderPlayer.name : defenderId}!`);
    }

    // Distrust penalties
    gameState.players.forEach(p => {
      if (p.isAI) {
        p.trustScores = p.trustScores || {};
        if (p.id === defenderId) p.trustScores[playerId] = 0; // immediate maximum distrust
      }
    });
  }

  // Execute Detonation
  target.armies = 0;
  target.ownerId = null; // Unclaimed

  if (isThermo) {
    gameState.radiation[targetId] = 2; // Radioactive for 2 turns

    // Splash damage to adjacent territories
    const splashTargets = getAdjacentTerritories(room.mapData.connections, targetId);
    splashTargets.forEach(sid => {
      const splashTerr = gameState.territories[sid];
      if (splashTerr && !gameState.blizzards.includes(sid)) {
        if (splashTerr.armies > 1) {
          splashTerr.armies = Math.ceil(splashTerr.armies / 2); // Devastate half the garrison (safeguards final remaining troop)
        }
      }
    });

    addLog(gameState, `🚀 THERMONUCLEAR DETONATION! ${player.name} detonated a thermonuclear weapon on ${getTerritoryName(room.mapData, targetId)}! Splash damage applied to adjacent borders. Radioactive for 2 turns.`);
  } else {
    gameState.radiation[targetId] = 1; // Radioactive for 1 turn
    addLog(gameState, `☢️ DETONATION: ${player.name} detonated a tactical nuke on ${getTerritoryName(room.mapData, targetId)}! Radioactive for 1 turn.`);
  }

  // Force sync
  checkWinCondition(room);

  return { success: true, result: { targetId, isThermo } };
}

module.exports = {
  addLog,
  initializeGame,
  craftNuke,
  fireNuke,
  claimTerritory,
  fortifySetup,
  selectCapital,
  placeDraft,
  executeAttack,
  executeBlitzAttack,
  resolveDefense,
  executePostAttackMove,
  executeFortify,
  tradeCards,
  tradeAllCards,
  calculateFixedTradeBonus,
  endTurn,
  calculateReinforcements,
  getAdjacentTerritories,
  hasAlliedPath,
  checkWinCondition
};
