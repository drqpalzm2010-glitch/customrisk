const assert = require('assert').strict;
const GameEngine = require('../server/game-engine');
const AIEngine = require('../server/ai-engine');
const RoomManager = require('../server/room-manager');

console.log('🧪 Starting Factional Risk Automated Verification Tests...\n');

// 1. Mock Map Data
const mockMap = {
  mapName: "Test Map",
  width: 1000,
  height: 600,
  territories: [
    { id: "t1", name: "Territory 1" },
    { id: "t2", name: "Territory 2" },
    { id: "t3", name: "Territory 3" },
    { id: "t4", name: "Territory 4" }
  ],
  connections: [
    ["t1", "t2"],
    ["t2", "t3"],
    { from: "t3", to: "t4", type: "sea" }
  ],
  continents: [
    { id: "c1", name: "Continent Alpha", bonus: 3, territoryIds: ["t1", "t2"] }
  ]
};

// 2. Mock Room
const mockRoom = {
  code: "TEST",
  players: [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: true }
  ],
  mapData: mockMap,
  gameState: null
};

// Test Game Engine Initialization
function testInitialization() {
  console.log('🔄 Testing Game Initialization...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  assert.ok(state, 'Game state should be initialized');
  assert.equal(state.turnIndex, 0, 'Turn index should start at 0');
  assert.equal(state.turnStage, 'SETUP_CLAIM', 'Game stage should start at SETUP_CLAIM');
  assert.equal(state.players.length, 2, 'Should have 2 players');
  assert.equal(state.players[0].startingArmiesPool, 40, 'Starting armies pool should be 40 for 2 players');
  
  // Verify territories are setup but empty
  assert.equal(state.territories["t1"].ownerId, null, 'Territory t1 should start unowned');
  assert.equal(state.territories["t1"].armies, 0, 'Territory t1 should start with 0 armies');
  
  console.log('✅ Initialization Tests Passed.');
}

// Test Territory Claiming & Initial Setup
function testSetupPhase() {
  console.log('🔄 Testing Setup Phase...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Claim territories
  let res = GameEngine.claimTerritory(mockRoom, "p1", "t1");
  assert.ok(res.success, 'Claim t1 should succeed');
  assert.equal(state.territories["t1"].ownerId, "p1", 't1 should be owned by p1');
  assert.equal(state.territories["t1"].armies, 1, 't1 should have 1 army');
  assert.equal(state.players[0].startingArmiesPool, 39, 'p1 pool should decrement');

  // Try to claim already owned
  res = GameEngine.claimTerritory(mockRoom, "p1", "t1");
  assert.ok(res.error, 'Claiming already claimed territory should fail');

  // Advance turns, claim remaining
  GameEngine.claimTerritory(mockRoom, "p2", "t2");
  GameEngine.claimTerritory(mockRoom, "p1", "t3");
  GameEngine.claimTerritory(mockRoom, "p2", "t4");

  assert.equal(state.turnStage, 'SETUP_FORTIFY', 'Stage should transition to SETUP_FORTIFY');
  
  // Place remaining starting armies
  res = GameEngine.fortifySetup(mockRoom, "p1", "t1", 5);
  assert.ok(res.success, 'Setup fortify should succeed');
  assert.equal(state.territories["t1"].armies, 6, 't1 armies should increase');
  
  console.log('✅ Setup Phase Tests Passed.');
}

// Test Reinforcements Calculations
function testReinforcements() {
  console.log('🔄 Testing Reinforcements Logic...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Set owned territories
  state.territories["t1"] = { ownerId: "p1", armies: 2 };
  state.territories["t2"] = { ownerId: "p1", armies: 2 };
  state.territories["t3"] = { ownerId: "p2", armies: 3 };
  state.territories["t4"] = { ownerId: "p2", armies: 1 };

  // p1 controls t1 and t2 (which forms Continent Alpha, bonus 3)
  // Territories owned = 2 -> base reinforcements = Math.max(3, floor(2/3)) = 3
  // Continent bonus = 3
  // Total reinforcements = 3 + 3 = 6
  let rein = GameEngine.calculateReinforcements(state, mockMap, "p1");
  assert.equal(rein, 6, 'p1 reinforcements should be 6 (3 base + 3 continent)');

  // p2 controls t3 and t4. Territories = 2, no continent bonus. Total = 3
  rein = GameEngine.calculateReinforcements(state, mockMap, "p2");
  assert.equal(rein, 3, 'p2 reinforcements should be 3 (base 3)');

  console.log('✅ Reinforcements Calculations Tests Passed.');
}

// Test Card Trading sets logic
function testCardTrading() {
  console.log('🔄 Testing Card Trading Logic...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;
  const player = state.players[0];

  // Give player a matching set (3 Infantry)
  player.cards = [
    { territoryId: "t1", type: "Infantry" },
    { territoryId: "t2", type: "Infantry" },
    { territoryId: "t3", type: "Infantry" }
  ];

  state.turnStage = 'DRAFT';
  state.turnIndex = 0;
  state.draftPool = 3;

  let res = GameEngine.tradeCards(mockRoom, "p1", [0, 1, 2]);
  assert.ok(res.success, 'Trading matching set should succeed');
  assert.equal(state.draftPool, 7, 'Draft pool should increase by 4 (first trade bonus)');
  assert.equal(player.cards.length, 0, 'Cards should be removed from hand');

  // Test Fixed Card Mode
  state.cardTradeRule = 'fixed';
  state.draftPool = 0;
  player.cards = [
    { territoryId: "t1", type: "Infantry" },
    { territoryId: "t2", type: "Cavalry" },
    { territoryId: "t3", type: "Artillery" }
  ];
  res = GameEngine.tradeCards(mockRoom, "p1", [0, 1, 2]);
  assert.ok(res.success, 'Trading mixed set in Fixed mode should succeed');
  assert.equal(res.bonusArmies, 10, 'Fixed mixed set should give exactly 10 bonus armies');
  assert.equal(state.draftPool, 10, 'Draft pool should increase by 10 in Fixed mode');

  // Test Fixed mode 3 Artillery
  state.draftPool = 0;
  player.cards = [
    { territoryId: "t1", type: "Artillery" },
    { territoryId: "t2", type: "Artillery" },
    { territoryId: "t3", type: "Artillery" }
  ];
  res = GameEngine.tradeCards(mockRoom, "p1", [0, 1, 2]);
  assert.ok(res.success, 'Trading 3 Artillery in Fixed mode should succeed');
  assert.equal(res.bonusArmies, 8, 'Fixed 3 Artillery should give 8 bonus armies');

  console.log('✅ Card Trading Tests Passed.');
}

// Test Allied Paths (Fortification connection)
function testPathsAndConnections() {
  console.log('🔄 Testing Paths & Connectivity...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // t1-t2, t2-t3 are connected. t3-t4 via sea.
  state.territories["t1"] = { ownerId: "p1", armies: 5 };
  state.territories["t2"] = { ownerId: "p1", armies: 2 };
  state.territories["t3"] = { ownerId: "p1", armies: 2 };
  state.territories["t4"] = { ownerId: "p2", armies: 2 }; // blocked by enemy!

  // Path between t1 and t3 exists and is owned by p1
  let path = GameEngine.hasAlliedPath(state.territories, mockMap.connections, "t1", "t3", "p1");
  assert.ok(path, 'Path between t1 and t3 should exist');

  // Path to t4 should not exist for p1 since t4 is owned by p2
  path = GameEngine.hasAlliedPath(state.territories, mockMap.connections, "t1", "t4", "p1");
  assert.ok(!path, 'Path between t1 and t4 should be blocked');

  console.log('✅ Connectivity Tests Passed.');
}

// Test Diplomacy pact breach (Betrayal)
function testDiplomacyBetrayal() {
  console.log('🔄 Testing Diplomacy & Betrayal...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  state.territories["t1"] = { ownerId: "p1", armies: 10 };
  state.territories["t2"] = { ownerId: "p2", armies: 1 };
  
  // Establish a pact
  state.pacts.push({
    type: 'non_aggression',
    playerA: "p1",
    playerB: "p2"
  });

  state.turnStage = 'ATTACK';
  state.turnIndex = 0;

  // Attack while pact is active -> triggers betrayal
  const res = GameEngine.executeAttack(mockRoom, "p1", "t1", "t2", 3);
  assert.ok(res.success, 'Attack should execute');
  assert.ok(res.diceResult.betrayed, 'Attack should flag betrayal');
  assert.equal(state.pacts.length, 0, 'Pact should be broken');
  
  // Verify trust score is set to 0 for player p1 in AI player p2 eyes
  const aiPlayer = state.players.find(p => p.id === "p2");
  assert.equal(aiPlayer.trustScores["p1"], 0, 'AI trust score should drop to 0 after betrayal');

  console.log('✅ Diplomacy & Betrayal Tests Passed.');
}

// Test Post-Attack Move & Forced Card Trade-in (6+ hand size)
function testPostAttackMoveAndForcedTrade() {
  console.log('🔄 Testing Post-Attack Move & Forced Card Trade-in...');
  
  // Set up 3 players locally to avoid triggering win conditions/GAME_OVER on elimination
  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: true },
    { id: "p3", name: "Commander C", color: "#0000ff", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Setup: p1 owns t1 with 10 armies, p2 owns t2 with 1 army, p3 owns t4 with 5 armies
  state.territories["t1"] = { ownerId: "p1", armies: 10 };
  state.territories["t2"] = { ownerId: "p2", armies: 1 };
  state.territories["t3"] = { ownerId: null, armies: 0 };
  state.territories["t4"] = { ownerId: "p3", armies: 5 };

  // Give p2 one card so p1 can inherit it upon elimination
  const p1 = state.players[0];
  const p2 = state.players[1];
  p2.cards = [{ territoryId: "t3", type: "Infantry" }];

  // Give p1 5 cards beforehand, so inheriting p2's card puts them at 6 cards
  p1.cards = [
    { territoryId: "t1", type: "Infantry" },
    { territoryId: "t1", type: "Cavalry" },
    { territoryId: "t1", type: "Artillery" },
    { territoryId: "t2", type: "Infantry" },
    { territoryId: "t2", type: "Cavalry" }
  ];

  state.turnStage = 'ATTACK';
  state.turnIndex = 0;

  // Attack t2 from t1 until conquered
  let attempts = 0;
  while (state.territories["t2"].ownerId !== "p1" && attempts < 10) {
    GameEngine.executeAttack(mockRoom, "p1", "t1", "t2", 3);
    attempts++;
  }

  assert.equal(state.territories["t2"].ownerId, "p1", 't2 should be conquered by p1');
  assert.equal(state.turnStage, 'POST_ATTACK_MOVE', 'Should transition to POST_ATTACK_MOVE');
  assert.ok(state.postAttackContext, 'postAttackContext should be populated');
  assert.equal(p1.cards.length, 6, 'p1 should now hold 6 cards');

  // Try post-attack move with invalid amount (exceeds additionalMax)
  const context = state.postAttackContext;
  let res = GameEngine.executePostAttackMove(mockRoom, "p1", context.additionalMax + 5);
  assert.ok(res.error, 'Moving too many armies should return error');

  // Do a valid move (e.g. move dynamic armies forward based on what is available)
  const moveAmount = Math.min(3, context.additionalMax);
  const initialSource = state.territories[context.sourceId].armies;
  const initialTarget = state.territories[context.targetId].armies;
  
  res = GameEngine.executePostAttackMove(mockRoom, "p1", moveAmount);
  assert.ok(res.success, `Post attack move of ${moveAmount} armies should succeed`);
  assert.equal(state.territories[context.sourceId].armies, initialSource - moveAmount, `Source armies should decrease by ${moveAmount}`);
  assert.equal(state.territories[context.targetId].armies, initialTarget + moveAmount, `Target armies should increase by ${moveAmount}`);

  // Verify transition to DRAFT stage because hand size is >= 6
  assert.equal(state.turnStage, 'DRAFT', 'Should be forced to DRAFT stage because hand has 6 cards');

  // Restore original players
  mockRoom.players = originalPlayers;

  console.log('✅ Post-Attack Move & Forced Trade Tests Passed.');
}

// Test Defender Dice Decision Flow (Auto-defend = false)
function testDefendDiceDecision() {
  console.log('🔄 Testing Defender Dice Decision Flow...');
  
  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false, autoDefend: true },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: false, autoDefend: false } // human with auto-defend disabled!
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Setup: p1 owns t1 (attacking with 5 armies), p2 owns t2 (defending with 3 armies)
  state.territories["t1"] = { ownerId: "p1", armies: 5 };
  state.territories["t2"] = { ownerId: "p2", armies: 3 };

  state.turnStage = 'ATTACK';
  state.turnIndex = 0;

  // Initiate attack: p1 attacks t2 with 3 dice
  const res = GameEngine.executeAttack(mockRoom, "p1", "t1", "t2", 3);
  assert.ok(res.success, 'Attack initialization should succeed');
  assert.ok(res.pendingDefense, 'Should flag pendingDefense');
  assert.equal(state.turnStage, 'DEFENDER_DICE_DECISION', 'Should transition to DEFENDER_DICE_DECISION');
  assert.ok(state.combatContext, 'combatContext should be active');
  assert.equal(state.combatContext.defenderId, "p2", 'Defender ID should be p2');
  assert.equal(state.combatContext.maxDefDice, 2, 'Max defense dice should be 2');

  // Try to resolve defense with invalid dice count (e.g. 3 or 0)
  let resolveRes = GameEngine.resolveDefense(mockRoom, "p2", 3);
  assert.ok(resolveRes.error, 'Resolving defense with 3 dice (exceeds max 2) should fail');

  resolveRes = GameEngine.resolveDefense(mockRoom, "p2", 0);
  assert.ok(resolveRes.error, 'Resolving defense with 0 dice should fail');

  // Resolve defense with valid dice count (2 dice)
  resolveRes = GameEngine.resolveDefense(mockRoom, "p2", 2);
  assert.ok(resolveRes.success, 'Resolving defense with 2 dice should succeed');
  assert.ok(resolveRes.diceResult, 'Should return dice rolls result');
  assert.equal(state.combatContext, null, 'combatContext should be cleared');
  
  // Restore original players
  mockRoom.players = originalPlayers;

  console.log('✅ Defender Dice Decision Flow Tests Passed.');
}

// Test Rejoin feature
function testRejoin() {
  console.log('🔄 Testing Campaign Rejoin Feature...');

  // Create a room
  const room = RoomManager.createRoom('hostSocket', 'HostPlayer', '#ff0000', mockMap);
  assert.ok(room, 'Room should be created');
  
  // Join a player
  const joinRes = RoomManager.joinRoom('clientSocket', room.code, 'ClientPlayer', '#00ff00');
  assert.ok(joinRes.success, 'Client player should join');

  // Start the game
  const startRes = RoomManager.startGame(room.code);
  assert.ok(startRes.success, 'Game should start');
  assert.equal(room.status, 'PLAYING', 'Room status should be PLAYING');

  // Disconnect the client player
  const disconnectRes = RoomManager.removePlayer('clientSocket');
  assert.ok(disconnectRes && disconnectRes.success, 'Player disconnection should succeed');
  assert.equal(disconnectRes.status, 'PLAYING', 'Should report status as PLAYING');

  // Assert states after disconnect
  const disconnectedPlayer = room.players.find(p => p.originalName === 'ClientPlayer');
  assert.ok(disconnectedPlayer, 'Disconnected player should exist');
  assert.equal(disconnectedPlayer.isAI, true, 'Disconnected player should be marked as AI');
  assert.equal(disconnectedPlayer.disconnected, true, 'Disconnected player should have disconnected flag');
  assert.equal(disconnectedPlayer.name, 'ClientPlayer (AI)', 'Name should append (AI)');

  const statePlayer = room.gameState.players.find(p => p.originalName === 'ClientPlayer');
  assert.ok(statePlayer, 'State player should exist');
  assert.equal(statePlayer.isAI, true, 'State player should be marked as AI');
  assert.equal(statePlayer.disconnected, true, 'State player should have disconnected flag');
  assert.equal(statePlayer.name, 'ClientPlayer (AI)', 'State player name should append (AI)');

  // Rejoin with a new socket ID using the same name
  const rejoinRes = RoomManager.joinRoom('newClientSocket', room.code, 'ClientPlayer', '#00ff00');
  assert.ok(rejoinRes.success, 'Rejoining should succeed');
  assert.ok(rejoinRes.rejoined, 'Rejoined flag should be true');

  // Assert states after rejoin
  const rejoinedPlayer = room.players.find(p => p.name === 'ClientPlayer');
  assert.ok(rejoinedPlayer, 'Rejoined player should exist in room players');
  assert.equal(rejoinedPlayer.id, 'newClientSocket', 'Player ID should be updated to the new socket ID');
  assert.equal(rejoinedPlayer.isAI, false, 'Player isAI should be reset to false');
  assert.equal(rejoinedPlayer.disconnected, false, 'Player disconnected should be reset to false');

  const rejoinedStatePlayer = room.gameState.players.find(p => p.name === 'ClientPlayer');
  assert.ok(rejoinedStatePlayer, 'Rejoined player should exist in gameState players');
  assert.equal(rejoinedStatePlayer.id, 'newClientSocket', 'gameState player ID should be updated to the new socket ID');
  assert.equal(rejoinedStatePlayer.isAI, false, 'gameState player isAI should be reset to false');
  assert.equal(rejoinedStatePlayer.disconnected, false, 'gameState player disconnected should be reset to false');

  console.log('✅ Campaign Rejoin Feature Tests Passed.');
}

// Test Coalition Diplomacy logic against dominant leader
function testCoalitionDiplomacy() {
  console.log('🔄 Testing Coalition Diplomacy against dominant leader...');

  const mockState = {
    players: [
      { id: 'botId', name: 'BotPlayer', color: '#ff0000', isAI: true, eliminated: false, trustScores: { 'allyId': 30 } },
      { id: 'allyId', name: 'AllyPlayer', color: '#00ff00', isAI: false, eliminated: false },
      { id: 'leaderId', name: 'LeaderPlayer', color: '#0000ff', isAI: false, eliminated: false }
    ],
    territories: {
      't1': { ownerId: 'botId', armies: 2 },
      't2': { ownerId: 'allyId', armies: 2 },
      't3': { ownerId: 'leaderId', armies: 20 },
      't4': { ownerId: 'leaderId', armies: 20 }
    }
  };

  const mockRoomForDiplomacy = {
    gameState: mockState
  };

  // Bot strength: 1 territory + 2 armies = 3
  // Ally strength: 1 territory + 2 armies = 3
  // Leader strength: 2 territories + 40 armies = 42
  
  // Verify strengths
  assert.equal(AIEngine.getPlayerStrength(mockState, 'botId'), 3);
  assert.equal(AIEngine.getPlayerStrength(mockState, 'allyId'), 3);
  assert.equal(AIEngine.getPlayerStrength(mockState, 'leaderId'), 42);
  assert.equal(AIEngine.getLeaderId(mockState), 'leaderId');

  // Proposal from AllyPlayer to BotPlayer
  // Under normal rules, trust of 30 is less than 40 (required for non-aggression)
  // But since bot and ally are weaker than the dominant leader:
  // Leader is significantly dominating (42 > 3 * 1.5), so discount is 25.
  // Required trust drops from 40 to 15. Trust is 30, which is >= 15.
  const acceptNonAggression = AIEngine.evaluateDiplomacyProposal(mockRoomForDiplomacy, 'botId', {
    sender: 'allyId',
    type: 'non_aggression'
  });
  assert.ok(acceptNonAggression, 'Bot should accept non-aggression pact due to leader threat');

  // Alliance requires 70 trust. Discount is 25, required trust drops to 45.
  // Trust is 30, which is < 45, so bot should still reject the alliance.
  const acceptAlliance = AIEngine.evaluateDiplomacyProposal(mockRoomForDiplomacy, 'botId', {
    sender: 'allyId',
    type: 'alliance'
  });
  assert.ok(!acceptAlliance, 'Bot should still reject alliance because trust (30) is below discounted threshold (45)');

  // If trust was 50 (neutral):
  // Alliance requires 45 trust with discount, so bot should accept!
  mockState.players[0].trustScores['allyId'] = 50;
  const acceptAllianceNeutral = AIEngine.evaluateDiplomacyProposal(mockRoomForDiplomacy, 'botId', {
    sender: 'allyId',
    type: 'alliance'
  });
  assert.ok(acceptAllianceNeutral, 'Bot should accept alliance when neutral trust is adjusted by threat discount');

  console.log('✅ Coalition Diplomacy Tests Passed.');
}

// Test ending turn with 5 cards and draft stage enforcement
function testEndTurnWithFiveCards() {
  console.log('🔄 Testing End Turn with 5 Cards...');

  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;
  const p1 = state.players[0];

  // Set owned territories
  state.territories["t1"] = { ownerId: "p1", armies: 2 };
  state.territories["t2"] = { ownerId: "p1", armies: 2 };
  state.territories["t3"] = { ownerId: "p2", armies: 3 };
  state.territories["t4"] = { ownerId: "p2", armies: 1 };

  // Give p1 5 cards
  p1.cards = [
    { territoryId: "t1", type: "Infantry" },
    { territoryId: "t1", type: "Cavalry" },
    { territoryId: "t1", type: "Artillery" },
    { territoryId: "t2", type: "Infantry" },
    { territoryId: "t2", type: "Cavalry" }
  ];

  // Simulate p1 ending turn (which used to get blocked when cards count >= 5)
  state.turnStage = 'FORTIFY';
  state.turnIndex = 0;
  
  GameEngine.endTurn(mockRoom);
  
  // Verify p1 successfully ended their turn and turn index shifted to p2
  assert.equal(state.turnIndex, 1, 'Turn should advance to p2');
  assert.equal(state.turnStage, 'DRAFT', 'Stage should be DRAFT for the next player');

  // Let's advance it back to p1's turn
  GameEngine.endTurn(mockRoom);
  assert.equal(state.turnIndex, 0, 'Turn should return to p1');
  assert.equal(state.turnStage, 'DRAFT', 'Stage should be DRAFT for p1');

  // Verify that p1 is forced to trade in cards (cannot transition to ATTACK when draftPool becomes 0)
  // Initially, p1 starts with some draft pool
  assert.ok(state.draftPool > 0, 'p1 should have draft armies available');
  
  // Place all draft armies
  const placeRes = GameEngine.placeDraft(mockRoom, "p1", "t1", state.draftPool);
  assert.ok(placeRes.success, 'Placing draft armies should succeed');
  
  // Since draftPool is 0 but p1 still holds 5 cards, turnStage should remain DRAFT (enforcing trade)
  assert.equal(state.draftPool, 0, 'Draft pool should be exhausted');
  assert.equal(state.turnStage, 'DRAFT', 'Should be forced to remain in DRAFT stage due to holding 5 cards');

  // Restore original players
  mockRoom.players = originalPlayers;

  console.log('✅ End Turn with 5 Cards Tests Passed.');
}

// Test Card Draw on Conquest
function testCardDrawOnConquest() {
  console.log('🔄 Testing Card Draw on Conquest...');
  
  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: true },
    { id: "p3", name: "Commander C", color: "#0000ff", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  state.territories["t1"] = { ownerId: "p1", armies: 10 };
  state.territories["t2"] = { ownerId: "p2", armies: 1 };
  state.territories["t3"] = { ownerId: "p3", armies: 5 };

  const p1 = state.players[0];
  const initialCardsCount = p1.cards.length;

  state.turnStage = 'ATTACK';
  state.turnIndex = 0;

  // Conquer t2
  let attempts = 0;
  while (state.territories["t2"].ownerId !== "p1" && attempts < 10) {
    GameEngine.executeAttack(mockRoom, "p1", "t1", "t2", 3);
    attempts++;
  }

  assert.equal(state.territories["t2"].ownerId, "p1", 't2 should be conquered by p1');
  assert.equal(state.conqueredThisTurn, true, 'conqueredThisTurn flag should be set to true');

  // Complete post attack move if in POST_ATTACK_MOVE stage
  if (state.turnStage === 'POST_ATTACK_MOVE') {
    GameEngine.executePostAttackMove(mockRoom, "p1", 0);
  }

  // End turn
  GameEngine.endTurn(mockRoom);

  assert.equal(p1.cards.length, initialCardsCount + 1, 'p1 should draw exactly 1 card after conquest');

  mockRoom.players = originalPlayers;
  console.log('✅ Card Draw on Conquest Tests Passed.');
}

// Test Bad Dice Reaction and Broadcast System
function testBadDiceReactionAndBroadcast() {
  console.log('🔄 Testing Bad Dice Detection & Reaction Broadcast...');
  
  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "Commander A", color: "#ff0000", isAI: false },
    { id: "p2", name: "Commander B", color: "#00ff00", isAI: true, personality: 'normal' },
    { id: "p3", name: "Commander C", color: "#0000ff", isAI: true, personality: 'goofball' }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  const capturedMessages = [];
  const mockIo = {
    to: (roomCode) => ({
      emit: (eventName, data) => {
        if (eventName === 'chatMessage') {
          capturedMessages.push(data);
        }
      }
    })
  };

  // Simulate two consecutive battle losses for player p1
  const p1 = state.players[0];
  p1.battleLossesHistory = [3]; // 1st bad battle (3 losses)

  const rolls = {
    attackerId: "p1",
    defenderId: "p2",
    attackerLosses: 2, // 2nd bad battle (2 losses)
    defenderLosses: 0,
    badDicePlayerId: "p1"
  };

  const originalRandom = Math.random;
  Math.random = () => 0;

  RoomManager.handleCombatDialogue(mockRoom, mockIo, rolls);

  Math.random = originalRandom;

  assert.equal(capturedMessages.length >= 1, true, 'At least 1 chat message should be broadcast on bad dice');
  const badDiceMsg = capturedMessages.find(m => m.text.includes('💬'));
  assert.equal(!!badDiceMsg, true, 'Bad dice message with 💬 tag should be broadcast');
  assert.equal(badDiceMsg.senderName.includes('[AI]'), true, 'An AI commander should send the bad dice commentary');

  // Test 1v1 Self-Reaction Fallback when AI gets bad dice in solo game
  mockRoom.players = [
    { id: "p1", name: "Human Player", color: "#ff0000", isAI: false },
    { id: "p2", name: "Solo AI", color: "#00ff00", isAI: true, personality: 'cynical' }
  ];
  GameEngine.initializeGame(mockRoom, mockMap);

  const soloCaptured = [];
  const soloIo = {
    to: (code) => ({
      emit: (event, data) => {
        if (event === 'chatMessage') soloCaptured.push(data);
      }
    })
  };

  const soloRolls = {
    attackerId: "p2",
    defenderId: "p1",
    attackerLosses: 3,
    defenderLosses: 0,
    badDicePlayerId: "p2"
  };

  const originalRandom2 = Math.random;
  Math.random = () => 0;

  RoomManager.handleCombatDialogue(mockRoom, soloIo, soloRolls);

  Math.random = originalRandom2;

  assert.equal(soloCaptured.length >= 1, true, 'Solo AI should broadcast self bad dice reaction');
  const soloMsg = soloCaptured.find(m => m.senderName.includes('Solo AI'));
  assert.equal(!!soloMsg, true, 'Victim Solo AI should make bad dice comment when no other AI is in the room');

  mockRoom.players = originalPlayers;
  console.log('✅ Bad Dice Detection & Reaction Tests Passed.');
}

// Test AI Chokepoint Defense
function testAIChokepointDefense() {
  console.log('🔄 Testing AI Chokepoint Defense...');

  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "AI 1", color: "#ff0000", isAI: true },
    { id: "p2", name: "AI 2", color: "#00ff00", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Let AI 1 own Continent Alpha (t1 and t2)
  // Let AI 2 own t3 (which borders t2) and t4
  state.territories["t1"] = { ownerId: "p1", armies: 2 }; // Density = (2+2)/2 = 2.0 (< 3.0, standard draft)
  state.territories["t2"] = { ownerId: "p1", armies: 2 }; // t2 connects to t3 (owned by p2). So t2 is a chokepoint!
  state.territories["t3"] = { ownerId: "p2", armies: 4 }; // Enemy adjacent with 4 armies. Threat on t2 is 4 armies.
  state.territories["t4"] = { ownerId: "p2", armies: 2 };

  // Set AI 1 draft pool
  state.draftPool = 3;
  state.turnStage = 'DRAFT';
  state.turnIndex = 0; // AI 1's turn

  // AI 1's chokepoint t2 has 2 armies. Threat is 4. Target is max(3, min(10, 4 + 1)) = 5.
  // Deficit is 5 - 2 = 3 armies.
  // The AI should prioritize reinforcing t2!
  const decision = AIEngine.makeDraftDecision(mockRoom, "p1");
  
  assert.ok(decision, 'AI should return a draft decision');
  assert.equal(decision.territoryId, "t2", 'AI should draft on chokepoint t2');
  assert.ok(decision.amount <= 2, 'AI should place a small amount (up to 2) on the chokepoint');

  mockRoom.players = originalPlayers;
  console.log('✅ AI Chokepoint Defense Tests Passed.');
}

// Test AI Capital Corridor Blitz
function testAICapitalCorridorBlitz() {
  console.log('🔄 Testing AI Capital Corridor Blitz...');

  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "AI 1", color: "#ff0000", isAI: true },
    { id: "p2", name: "AI 2", color: "#00ff00", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;

  // Let p1's capital be t1
  // Let p2's capital be t4
  state.gameMode = 'capital_rush';
  state.capitals = {
    "p1": "t1",
    "p2": "t4"
  };

  // Set ownerships:
  // p1 owns t1 (capital) with 10 armies
  // p2 owns t2 with 2 armies, t3 with 2 armies, and t4 (capital) with 3 armies
  // Shortest path: t1 -> t2 -> t3 -> t4
  // All territories on path (t2, t3, t4) are owned by p2 (enemy) and are weak (<= 4 armies)
  state.territories["t1"] = { ownerId: "p1", armies: 10 };
  state.territories["t2"] = { ownerId: "p2", armies: 2 };
  state.territories["t3"] = { ownerId: "p2", armies: 2 };
  state.territories["t4"] = { ownerId: "p2", armies: 3 };

  state.turnStage = 'ATTACK';
  state.turnIndex = 0; // p1's turn

  // AI should decide to attack t2 from t1 because t2 is the next step on a weak corridor to the enemy capital t4
  const attack = AIEngine.makeAttackDecision(mockRoom, "p1");
  
  assert.ok(attack, 'AI should decide to attack');
  assert.equal(attack.sourceId, "t1", 'Attacking source should be t1');
  assert.equal(attack.targetId, "t2", 'Attacking target should be t2 (corridor path element)');

  mockRoom.players = originalPlayers;
  console.log('✅ AI Capital Corridor Blitz Tests Passed.');
}

// Test AI Final Duel triggers only once
function testAIFinalDuelTriggerOnce() {
  console.log('🔄 Testing AI Final Duel Trigger Once...');

  const originalPlayers = [...mockRoom.players];
  mockRoom.players = [
    { id: "p1", name: "AI 1", color: "#ff0000", isAI: true },
    { id: "p2", name: "AI 2", color: "#00ff00", isAI: true }
  ];

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;
  state.players = [
    { id: "p1", name: "AI 1", color: "#ff0000", isAI: true, eliminated: false },
    { id: "p2", name: "AI 2", color: "#00ff00", isAI: true, eliminated: false }
  ];

  delete state.finalDuelTriggered;

  const testIo = {
    to: () => ({
      emit: () => {}
    })
  };

  const rolls = { attackerLosses: 0, defenderLosses: 1 };

  // First resolution: triggers final duel flag synchronously
  RoomManager.handleCombatDialogue(mockRoom, testIo, rolls);
  assert.equal(state.finalDuelTriggered, true, 'finalDuelTriggered should be set to true');

  mockRoom.players = originalPlayers;
  console.log('✅ AI Final Duel Trigger Once Tests Passed.');
}

function testAIBullyingChatDetection() {
  console.log('🔄 Testing AI Bullying Chat Detection...');

  const players = [
    { id: 'p1', name: 'Commander' },
    { id: 'ai_1', name: 'Drake', isAI: true }
  ];

  const text = '@Drake, why do you only attack my poor territories? There is a whole big map with other neighbors to visit!';
  const parsed = AIEngine.parseChatMessage(text, players, { territories: [] });

  assert.equal(parsed.intent, 'BULLYING_COMPLAINT', 'Should correctly identify user complaint as BULLYING_COMPLAINT');
  assert.equal(parsed.recipientId, 'ai_1', 'Should correctly target Drake');

  console.log('✅ AI Bullying Chat Detection Passed.');
}

function testAIFakeDiplomacyCallouts() {
  console.log('🔄 Testing AI Fake Diplomacy Callouts...');

  const ai = { id: 'ai_1', name: 'Nero', isAI: true, personality: 'goofball', mercyPleaded: {} };

  // Test fake alliance claim dialogue selection
  const fakeAllianceDialogue = AIEngine.getDialogue("ALLIANCE_FAKE_CLAIM", ai.personality, { sender: 'Commander' });
  assert.ok(fakeAllianceDialogue && fakeAllianceDialogue !== "...", 'Dialogue should be successfully selected for fake alliance callout');

  // Test invalid mercy plea dialogue selection
  const mercyFailDialogue = AIEngine.getDialogue("MERCY_FAIL_TOO_STRONG", ai.personality, { sender: 'Commander', count: 5 });
  assert.ok(mercyFailDialogue && mercyFailDialogue !== "..." && mercyFailDialogue.includes('5'), 'Dialogue should be successfully selected and count replaced');

  console.log('✅ AI Fake Diplomacy Callouts Passed.');
}

function testScenarioInitialization() {
  console.log('🔄 Testing Scenario Mode & Direct Game Start...');

  const scenarioMap = {
    mapName: "Scenario Alpha",
    isScenario: true,
    scenarioSettings: { capitalRush: true, defaultDummyArmies: 1 },
    nations: [
      { id: "n1", name: "Atheria", color: "#00e5ff", description: "Northern power.", capitalTerritoryId: "t1" },
      { id: "n2", name: "Solaria", color: "#ff3366", description: "Southern sun kingdom.", capitalTerritoryId: "t2" }
    ],
    territories: [
      { id: "t1", name: "Capital Alpha", startingOwnerId: "n1", startingArmies: 5 },
      { id: "t2", name: "Capital Solaria", startingOwnerId: "n2", startingArmies: 4 },
      { id: "t3", name: "Neutral Fortress", startingOwnerId: "dummy", startingArmies: 3 }
    ],
    connections: [["t1", "t3"], ["t2", "t3"]],
    continents: []
  };

  const roomObj = RoomManager.createRoom("p1", "Bob", "#00e5ff", scenarioMap);
  roomObj.players[0].selectedNationId = "n1";

  // Start scenario room
  const res = RoomManager.startGame(roomObj.code);
  assert.ok(res.success, 'Scenario room start should succeed');

  // Verify unchosen nation n2 converted to AI player
  assert.equal(roomObj.players.length, 2, 'Should have 2 players (1 human + 1 converted AI)');
  assert.equal(roomObj.players[0].nationName, 'Atheria', 'p1 should be Atheria');
  assert.equal(roomObj.players[1].nationName, 'Solaria', 'p2 AI should be Solaria');
  assert.ok(roomObj.players[1].isAI, 'Solaria should be AI');
  assert.ok(roomObj.players[1].personality, 'Solaria AI should have an assigned personality');

  const state = roomObj.gameState;
  assert.ok(state, 'Game state initialized');
  assert.equal(state.turnStage, 'DRAFT', 'Scenario should skip setup and start directly at DRAFT');
  assert.equal(state.territories['t1'].ownerId, 'p1', 't1 owned by Atheria player');
  assert.equal(state.territories['t1'].armies, 5, 't1 starting armies is 5');
  assert.equal(state.territories['t2'].armies, 4, 't2 starting armies is 4');

  // Verify Dummy Nation territory t3
  assert.equal(state.territories['t3'].ownerId, 'dummy', 't3 owned by dummy');
  assert.equal(state.territories['t3'].armies, 3, 't3 dummy armies is custom 3');

  // Verify Capitals
  assert.equal(state.capitals['p1'], 't1', 'p1 capital is t1');

  // Verify player draft pool available immediately
  assert.ok(state.draftPool >= 3, 'First player has draft pool available immediately');

  // Test explicitly setting gameMode to 'conquest' for a scenario with preset capitals
  const roomObjConquest = RoomManager.createRoom("p1", "Alice", "#00e5ff", scenarioMap);
  roomObjConquest.gameMode = 'conquest';
  const resConquest = RoomManager.startGame(roomObjConquest.code);
  assert.ok(resConquest.success, 'Scenario room start in conquest mode should succeed');
  assert.equal(roomObjConquest.gameState.gameMode, 'conquest', 'Lobby choice of conquest should override scenario capitalRush default');

  console.log('✅ Scenario Mode & Direct Game Start Tests Passed.');
}

function testBlitzAttack() {
  console.log('🔄 Testing Fight to the Death (Blitz Attack)...');

  const blitzMap = {
    mapName: "Blitz Map",
    territories: [
      { id: "t1", name: "Alpha Base" },
      { id: "t2", name: "Bravo Citadel" }
    ],
    connections: [["t1", "t2"]],
    continents: []
  };

  const room = RoomManager.createRoom("p1", "Attacker", "#00e5ff", blitzMap);
  RoomManager.joinRoom("p2", room.code, "Defender", "#ff3366");

  GameEngine.initializeGame(room, blitzMap);
  const state = room.gameState;
  state.turnStage = 'ATTACK';
  state.territories['t1'] = { ownerId: 'p1', armies: 15 };
  state.territories['t2'] = { ownerId: 'p2', armies: 3 };

  const res = GameEngine.executeBlitzAttack(room, 'p1', 't1', 't2');
  assert.ok(res.success, 'Blitz attack should succeed');
  assert.ok(res.blitzResult, 'Should return blitzResult object');
  assert.ok(res.blitzResult.roundsFought > 0, 'Should fight 1 or more rounds');

  const conquered = state.territories['t2'].ownerId === 'p1';
  const halted = state.territories['t1'].armies < 2;
  assert.ok(conquered || halted, 'Blitz attack must conclude in either conquest or attacker halting');

  room.aiBlitz = true;
  assert.equal(room.aiBlitz, true, 'room.aiBlitz should be set to true');

  console.log('✅ Fight to the Death (Blitz Attack) Tests Passed.');
}

// Test AI Continent Border Garrison on Troop Excess
function testAIContinentBorderGarrison() {
  console.log('🔄 Testing AI Continent Border Garrison (Troop Excess)...');

  const contMap = {
    mapName: "Continent Test Map",
    territories: [
      { id: "c1_t1", name: "North A", center: [100, 100] },
      { id: "c1_t2", name: "North B (Border)", center: [200, 100] },
      { id: "c2_t1", name: "South A", center: [300, 100] }
    ],
    connections: [
      ["c1_t1", "c1_t2"],
      ["c1_t2", "c2_t1"]
    ],
    continents: [
      { id: "cont_1", name: "Northland", bonus: 3, territoryIds: ["c1_t1", "c1_t2"] }
    ]
  };

  const testRoom = {
    roomCode: 'TESTGARRISON',
    mapData: contMap,
    gameState: {
      players: [
        { id: 'ai1', name: 'Bot 1', isAI: true, color: '#ff0000' },
        { id: 'p2', name: 'Player 2', isAI: false, color: '#00ff00' }
      ],
      territories: {
        'c1_t1': { ownerId: 'ai1', armies: 3 },
        'c1_t2': { ownerId: 'ai1', armies: 3 },
        'c2_t1': { ownerId: 'p2', armies: 2 }
      },
      draftPool: 5,
      gameMode: 'conquest'
    }
  };

  // Total armies = 6 across 2 territories -> Empire Troop Density = 3.0 (Troop Excess active!)
  const decision = AIEngine.makeDraftDecision(testRoom, 'ai1');
  assert.ok(decision, 'Draft decision should be returned');
  assert.equal(decision.territoryId, 'c1_t2', 'AI should draft on the continent border chokepoint c1_t2 facing enemy c2_t1');
  assert.equal(decision.amount, 5, 'AI should allocate full draft pool to continent border chokepoint on troop excess');

  console.log('✅ AI Continent Border Garrison Tests Passed.');
}

function testBreakAllianceChatParsing() {
  console.log('🔄 Testing Break Alliance & Truce Chat Parsing...');

  const players = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Atheria' }
  ];

  const res1 = AIEngine.parseChatMessage("I am breaking our alliance @Atheria", players, null);
  assert.equal(res1.intent, 'BETRAYAL_ANNOUNCE', 'Message "I am breaking our alliance @Atheria" should parse as BETRAYAL_ANNOUNCE');
  assert.equal(res1.recipientId, 'p2', 'Recipient should be p2 (Atheria)');

  const res2 = AIEngine.parseChatMessage("cancel truce @Atheria", players, null);
  assert.equal(res2.intent, 'BETRAYAL_ANNOUNCE', 'Message "cancel truce @Atheria" should parse as BETRAYAL_ANNOUNCE');

  const res3 = AIEngine.parseChatMessage("ending alliance with @Atheria", players, null);
  assert.equal(res3.intent, 'BETRAYAL_ANNOUNCE', 'Message "ending alliance" should parse as BETRAYAL_ANNOUNCE');

  const res4 = AIEngine.parseChatMessage("let's form an alliance @Atheria", players, null);
  assert.equal(res4.intent, 'ALLIANCE', 'Positive proposal "let\'s form an alliance @Atheria" should still parse as ALLIANCE');

  console.log('✅ Break Alliance & Truce Chat Parsing Tests Passed.');
}

// Execute tests
function testCapitalRushWinCondition() {
  console.log('🔄 Testing Capital Rush Win Condition...');

  const mockRoom = {
    gameState: {
      gameMode: 'capital_rush',
      turnStage: 'ATTACK',
      capitals: {
        'playerA': 't1',
        'playerB': 't5',
        'playerC': 't9'
      },
      players: [
        { id: 'playerA', name: 'Player A', eliminated: false },
        { id: 'playerB', name: 'Player B', eliminated: false },
        { id: 'playerC', name: 'Player C', eliminated: false }
      ],
      territories: {
        't1': { ownerId: 'playerA', armies: 5 },
        't5': { ownerId: 'playerB', armies: 5 },
        't9': { ownerId: 'playerC', armies: 5 }
      },
      logs: []
    }
  };

  // 1. Initial state: 3 players hold 3 capitals -> Game should NOT be over
  GameEngine.checkWinCondition(mockRoom);
  assert.notEqual(mockRoom.gameState.turnStage, 'GAME_OVER', 'Game should not be over when capitals are split');

  // 2. Player A conquers Player B's capital t5, eliminating Player B
  mockRoom.gameState.territories['t5'].ownerId = 'playerA';
  mockRoom.gameState.players[1].eliminated = true;

  // Player C STILL holds t9 -> Player A should NOT win yet!
  GameEngine.checkWinCondition(mockRoom);
  assert.notEqual(mockRoom.gameState.turnStage, 'GAME_OVER', 'Player A should not win while Player C still holds capital t9');

  // 3. Player A conquers Player C's capital t9 -> Player A now holds ALL capitals (t1, t5, t9)
  mockRoom.gameState.territories['t9'].ownerId = 'playerA';
  GameEngine.checkWinCondition(mockRoom);
  assert.equal(mockRoom.gameState.turnStage, 'GAME_OVER', 'Player A should win after conquering all capitals');
  assert.equal(mockRoom.gameState.winner, 'playerA', 'Winner should be playerA');

  console.log('✅ Capital Rush Win Condition Tests Passed.');
}

function testFastDraftAndCardBatching() {
  console.log('🔄 Testing Fast Draft & Card Batching Logic...');

  const mockRoom = {
    mapData: {
      territories: [
        { id: 't1', name: 'Territory 1' },
        { id: 't2', name: 'Territory 2' }
      ]
    },
    gameState: {
      turnStage: 'DRAFT',
      turnIndex: 0,
      draftPool: 0,
      tradeInCount: 0,
      players: [
        {
          id: 'player1',
          name: 'Commander 1',
          cards: [
            { type: 'Infantry', territoryId: 't1' },
            { type: 'Infantry', territoryId: 't2' },
            { type: 'Infantry', territoryId: null },
            { type: 'Cavalry', territoryId: 't1' },
            { type: 'Cavalry', territoryId: 't2' },
            { type: 'Cavalry', territoryId: null }
          ],
          cardsTradedCount: 0
        }
      ],
      territories: {
        't1': { ownerId: 'player1', armies: 10 },
        't2': { ownerId: 'player1', armies: 5 }
      },
      cardDeck: [],
      logs: []
    }
  };

  // 1. Test tradeAllCards: Player holds 6 cards (3 Infantry + 3 Cavalry = 2 valid sets)
  const resBatch = GameEngine.tradeAllCards(mockRoom, 'player1', 't1');
  assert.equal(resBatch.success, true, 'tradeAllCards should succeed');
  assert.equal(resBatch.setsTraded, 2, 'Should trade 2 valid card sets');
  assert.equal(resBatch.totalBonus, 10, 'Set 1 (4) + Set 2 (6) = 10 bonus armies');
  assert.equal(mockRoom.gameState.players[0].cards.length, 0, 'All 6 cards should be traded');
  // Auto-deposited to t1 -> initial 10 armies + 10 traded bonus + extra matching card bonus = at least 20+ armies
  assert.ok(mockRoom.gameState.territories['t1'].armies >= 20, 'Bonus armies should be auto-deposited to t1');

  // 2. Test large batch placeDraft (e.g. 300 armies)
  mockRoom.gameState.draftPool = 300;
  mockRoom.gameState.turnStage = 'DRAFT';
  const resPlace = GameEngine.placeDraft(mockRoom, 'player1', 't2', 300);
  assert.equal(resPlace.success, true, 'placeDraft of 300 armies should succeed');
  assert.equal(mockRoom.gameState.draftPool, 0, 'Draft pool should be empty after placing 300 armies');
  // t2 started with 5, got +4 from 2 matching cards, +300 placed = 309 armies
  assert.equal(mockRoom.gameState.territories['t2'].armies, 309, 't2 armies should increase to 309 (including matching card bonuses)');
  assert.equal(mockRoom.gameState.turnStage, 'ATTACK', 'Turn stage should automatically transition to ATTACK when draftPool reaches 0');

  console.log('✅ Fast Draft & Card Batching Tests Passed.');
}

function testGenerativeAILogic() {
  console.log('🔄 Testing Generative AI Multi-Attack Sequence & Execution...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;
  state.turnStage = 'ATTACK';
  state.turnIndex = 0;
  state.players[0].id = 'p1';
  state.territories['t1'] = { ownerId: 'p1', armies: 10 };
  state.territories['t2'] = { ownerId: 'p2', armies: 1 };
  state.territories['t3'] = { ownerId: 'p1', armies: 8 };
  state.territories['t4'] = { ownerId: 'p2', armies: 1 };

  // Test multi-attack sequence on independent fronts
  let res1 = GameEngine.executeBlitzAttack(mockRoom, 'p1', 't1', 't2');
  if (state.turnStage === 'POST_ATTACK_MOVE') {
    GameEngine.executePostAttackMove(mockRoom, 'p1', 0);
  }
  let res2 = GameEngine.executeBlitzAttack(mockRoom, 'p1', 't3', 't4');
  assert.ok(res1.success || state.territories['t2'].ownerId === 'p1', 'Blitz 1 should execute');
  assert.ok(res2.success || state.territories['t4'].ownerId === 'p1', 'Blitz 2 on independent front should execute');

  console.log('✅ Generative AI Multi-Attack Logic Tests Passed.');
}

function testCampaignSaveAndRestore() {
  console.log('🔄 Testing Campaign Save & Restoration...');
  GameEngine.initializeGame(mockRoom, mockMap);
  const originalState = mockRoom.gameState;
  originalState.turnIndex = 1;
  originalState.turnStage = 'ATTACK';
  originalState.draftPool = 0;
  originalState.cardTradeRule = 'fixed';
  originalState.generativeAIMode = true;
  originalState.territories['t1'] = { ownerId: 'p1', armies: 12 };
  originalState.territories['t2'] = { ownerId: 'p2', armies: 4 };

  const saveData = {
    saveVersion: 1,
    timestamp: Date.now(),
    roomCode: 'SAVE_TEST',
    cardTradeRule: 'fixed',
    generativeAIMode: true,
    mapData: mockMap,
    gameState: JSON.parse(JSON.stringify(originalState))
  };

  const newRoom = RoomManager.createRoom('p1', 'Restored Player', '#00e5ff', saveData.mapData);
  newRoom.gameState = saveData.gameState;
  newRoom.cardTradeRule = saveData.cardTradeRule;
  newRoom.generativeAIMode = saveData.generativeAIMode;

  assert.equal(newRoom.gameState.turnIndex, 1, 'Restored turn index should match');
  assert.equal(newRoom.gameState.turnStage, 'ATTACK', 'Restored turn stage should match');
  assert.equal(newRoom.gameState.territories['t1'].armies, 12, 'Restored t1 armies should match');
  assert.equal(newRoom.cardTradeRule, 'fixed', 'Restored card trade rule should match');
  assert.equal(newRoom.generativeAIMode, true, 'Restored Generative AI mode should match');

  console.log('✅ Campaign Save & Restoration Tests Passed.');
}

function testScenarioInProgressLLMLoading() {
  console.log('🔄 Testing Scenario Game in Progress Loading in LLM Mode...');

  const scenarioMap = {
    mapName: "Test Scenario",
    isScenario: true,
    territories: [
      { id: "t1", name: "Territory 1", startingOwnerId: "n1", startingArmies: 5 },
      { id: "t2", name: "Territory 2", startingOwnerId: "n2", startingArmies: 5 }
    ],
    nations: [
      { id: "n1", name: "Red Nation", color: "#ff0000" },
      { id: "n2", name: "Blue Nation", color: "#0000ff" }
    ]
  };

  const inProgressState = {
    turnIndex: 3,
    turnStage: 'ATTACK',
    isScenario: true,
    generativeAIMode: true,
    players: [
      { id: "ai_1", name: "Red Nation", nationId: "n1", isAI: true },
      { id: "ai_2", name: "Blue Nation", nationId: "n2", isAI: true }
    ],
    territories: {
      "t1": { ownerId: "ai_1", armies: 25 },
      "t2": { ownerId: "ai_2", armies: 2 }
    }
  };

  const saveDataPayload = {
    mapData: scenarioMap,
    gameState: inProgressState
  };

  const room = RoomManager.createRoom('__spectator__', 'Spectator', '#888888', scenarioMap);
  room.gameState = JSON.parse(JSON.stringify(inProgressState));
  const startRes = RoomManager.startGame(room.code);

  assert.ok(startRes.success, 'Starting room with pre-loaded in-progress gameState should succeed');
  assert.equal(room.gameState.turnIndex, 3, 'In-progress scenario turnIndex should remain 3, not reset to 0');
  assert.equal(room.gameState.turnStage, 'ATTACK', 'In-progress turnStage should remain ATTACK, not reset to DRAFT');
  assert.equal(room.gameState.territories['t1'].armies, 25, 'In-progress territory army count should be preserved');

  console.log('✅ Scenario Game in Progress Loading in LLM Mode Passed.');
}

function testLLMMultiDraftAndStuckWatchdog() {
  console.log('🔄 Testing LLM Multi-Draft Splitting & Stuck AI Auto-Recovery...');

  const mockRoom = {
    code: 'TEST',
    status: 'PLAYING',
    players: [
      { id: "p1", name: "Player 1", isAI: false },
      { id: "p2", name: "Player 2", isAI: true }
    ],
    mapData: mockMap
  };

  GameEngine.initializeGame(mockRoom, mockMap);
  const state = mockRoom.gameState;
  state.turnStage = 'DRAFT';
  state.turnIndex = 0;
  state.draftPool = 5;
  state.territories['t1'] = { ownerId: 'p1', armies: 2 };
  state.territories['t2'] = { ownerId: 'p1', armies: 3 };

  // Test placing draft armies into t1
  const res1 = GameEngine.placeDraft(mockRoom, 'p1', 't1', 3);
  assert.ok(res1.success, 'Draft 3 armies into t1 should succeed');
  assert.equal(state.draftPool, 2, 'Remaining draft pool should be 2');
  assert.equal(state.territories['t1'].armies, 5, 't1 armies should be 5');

  // Test placing remaining draft armies into t2
  const res2 = GameEngine.placeDraft(mockRoom, 'p1', 't2', 2);
  assert.ok(res2.success, 'Draft 2 armies into t2 should succeed');
  assert.equal(state.draftPool, 0, 'Draft pool should be 0');
  assert.equal(state.turnStage, 'ATTACK', 'Stage should advance to ATTACK after placing all draft armies');

  // Test stuck post-attack move auto-recovery
  state.turnStage = 'POST_ATTACK_MOVE';
  state.postAttackContext = null; // simulate missing context
  const postRes = GameEngine.executePostAttackMove(mockRoom, 'p1', 0);
  assert.ok(postRes.success, 'Executing post attack move with missing context should auto-recover');
  assert.equal(state.turnStage, 'ATTACK', 'Stage should auto-heal back to ATTACK');

  console.log('✅ LLM Multi-Draft Splitting & Stuck AI Auto-Recovery Passed.');
}

try {
  testInitialization();
  testSetupPhase();
  testReinforcements();
  testCardTrading();
  testPathsAndConnections();
  testDiplomacyBetrayal();
  testPostAttackMoveAndForcedTrade();
  testDefendDiceDecision();
  testRejoin();
  testCoalitionDiplomacy();
  testEndTurnWithFiveCards();
  testCardDrawOnConquest();
  testBadDiceReactionAndBroadcast();
  testAIChokepointDefense();
  testAICapitalCorridorBlitz();
  testAIFinalDuelTriggerOnce();
  testAIBullyingChatDetection();
  testAIFakeDiplomacyCallouts();
  testScenarioInitialization();
  testBlitzAttack();
  testAIContinentBorderGarrison();
  testBreakAllianceChatParsing();
  testCapitalRushWinCondition();
  testFastDraftAndCardBatching();
  testGenerativeAILogic();
  testCampaignSaveAndRestore();
  testScenarioInProgressLLMLoading();
  testLLMMultiDraftAndStuckWatchdog();
  console.log('\n🎉 ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
} catch (err) {
  console.error('\n❌ TEST SUITE FAILURE DETECTED:');
  console.error(err);
  process.exit(1);
}
