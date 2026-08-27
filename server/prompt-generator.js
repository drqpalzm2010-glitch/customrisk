/**
 * Server-Side LLM Prompt Generator
 * Formats full ground-truth game state into dense micro-syntax for LLM API providers.
 */

function getPlayerName(players, id) {
  if (!id) return 'Unknown';
  if (id === 'dummy') return 'Neutral';
  const player = players ? players.find(p => p.id === id) : null;
  return player ? player.name : id;
}

function getTerritoryName(mapData, id) {
  if (!mapData || !mapData.territories) return id;
  const terr = mapData.territories.find(t => t.id === id);
  return terr ? terr.name : id;
}

function getAdjacentTerritories(mapData, territoryId) {
  if (!mapData || !mapData.connections) return [];
  const adjacent = [];
  mapData.connections.forEach(conn => {
    if (Array.isArray(conn)) {
      if (conn[0] === territoryId) adjacent.push(conn[1]);
      else if (conn[1] === territoryId) adjacent.push(conn[0]);
    } else if (conn && typeof conn === 'object') {
      if (conn.from === territoryId) adjacent.push(conn.to);
      else if (conn.to === territoryId) adjacent.push(conn.from);
    }
  });
  return [...new Set(adjacent)];
}

function hasAlliedPath(gameState, mapData, sourceId, targetId, ownerId) {
  if (sourceId === targetId) return true;
  const visited = new Set();
  const queue = [sourceId];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === targetId) return true;

    const adjs = getAdjacentTerritories(mapData, current);
    for (const neighbor of adjs) {
      const neighborTerr = gameState.territories[neighbor];
      if (neighborTerr && neighborTerr.ownerId === ownerId && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

// Compute chain-conquest targets up to a given depth (BFS, no duplicates within chain)
function getChainTargets(mapData, gameState, territoryId, ownerId, maxDepth, visited) {
  if (maxDepth <= 0) return [];
  const results = [];
  const adjs = getAdjacentTerritories(mapData, territoryId);
  for (const adjId of adjs) {
    if (visited.has(adjId)) continue;
    const adjTerr = gameState.territories[adjId];
    if (adjTerr && adjTerr.ownerId !== ownerId) {
      visited.add(adjId);
      const ownerName = getPlayerName(gameState.players, adjTerr.ownerId);
      const isNeutral = adjTerr.ownerId === 'dummy' || !adjTerr.ownerId;
      const isCapital = gameState.capitals && Object.values(gameState.capitals).includes(adjId);
      const capTag = isCapital ? '^CAPITAL' : '';
      const tag = isNeutral ? '*neutral' : '';
      results.push(`${adjId}(${ownerName},${adjTerr.armies})${capTag}${tag ? ' ' + tag : ''}`);
      // Recurse deeper into this conquered territory
      const deeper = getChainTargets(mapData, gameState, adjId, ownerId, maxDepth - 1, visited);
      results.push(...deeper);
    }
  }
  return results;
}

function generateLLMPrompt(room, targetPlayerId = null) {
  const gameState = room.gameState;
  if (!gameState) return 'Error: No active game state.';
  const mapData = room.mapData || gameState.mapData;
  if (!mapData) return 'Error: No map data available.';

  const activePlayer = gameState.players[gameState.turnIndex] || gameState.players[0];
  const me = targetPlayerId ? gameState.players.find(p => p.id === targetPlayerId) : activePlayer;
  if (!me) return 'Error: Target player not found.';

  const stage = gameState.turnStage;
  const cardRule = gameState.cardTradeRule || 'progressive';
  const gameMode = gameState.gameMode || 'conquest';

const PERSONALITY_DESCRIPTIONS = {
  strategic: "Strategic & Analytical. You talk like a cold, calculating grandmaster.\n   Prime Quotes: 1) \"Alliance confirmed. Mathematical models indicate a high success rate.\" | 2) \"Proposal rejected. The strategic cost of engaging outweighs current gains.\"",

  aggressive: "Aggressive & Ruthless. You talk like a dominant conqueror who loves blitz attacks and roasting opponents.\n   Prime Quotes: 1) \"I accept! Let's march together and crush them into the dust!\" | 2) \"Decline! I don't need your help to conquer them—or you!\"",

  cynical: "Cynical & Paranoid. You are sarcastic, suspicious of everyone, and expect betrayal.\n   Prime Quotes: 1) \"Accepted. Let's see how long this treaty lasts before someone gets greedy.\" | 2) \"Decline. I don't sign treaties with players who have daggers in their sleeves.\"",

  goofball: "Goofball & Unpredictable. You are chaotic, hilarious, and use silly jokes/slang in chat.\n   Prime Quotes: 1) \"Alliance locked in! We are about to end their whole career lmao 💀\" | 2) \"No thanks bro, they have way too many armies. I choose life 😭\"",

  kind: "Kind & Noble. You are polite, encouraging, highly loyal to alliances, and peace-loving.\n   Prime Quotes: 1) \"I gladly accept! Let's be great partners and keep our lands safe! ✨\" | 2) \"Oh, I'm so sorry! I don't want to make an enemy out of anyone right now. 🌸\"",

  normal: "Normal & Pragmatic. You are a balanced, competitive Risk commander focused on solid tactics.\n   Prime Quotes: 1) \"Proposal accepted. Let's secure our shared border and look forward.\" | 2) \"I must decline. An alliance doesn't fit my current strategy.\""
};

  const personality = (me.personality || 'normal').toLowerCase();
  const personalityDesc = PERSONALITY_DESCRIPTIONS[personality] || PERSONALITY_DESCRIPTIONS['normal'];

  // Look up the active AI's custom scenario nation description/lore if available
  const myNation = mapData.nations ? mapData.nations.find(n => n.id === me.nationId || n.name === me.nationName) : null;
  const nationLore = myNation && myNation.description ? `Nation Lore: "${myNation.description}"\n` : '';

  const privateMemoryNote = me.internalNote || "No existing memory. Formulate your long-term strategy and focus areas here.";

  let prompt = `=== FACTIONAL RISK: GENERATIVE AI COMMANDER ===\n`;
  prompt += `[PRIVATE COMMANDER MEMORY - INTERNAL STRATEGIC NOTE]\n`;
  prompt += `Your notes from last turn: "${privateMemoryNote}"\n`;
  prompt += `*(Review this note to stay consistent with your long-term goals. Write an updated version in the 'internalNote' field in your response JSON, max 5 sentences.)*\n\n`;
  prompt += `Cmdr: "${me.name}" (${me.color}) | Personality: ${personality.toUpperCase()} | Mode: ${gameMode.toUpperCase()} | Turn: ${gameState.turnIndex + 1} | Active: ${activePlayer.name} | Stage: ${stage} | CardRule: ${cardRule.toUpperCase()}\n`;
  prompt += `[PERSONALITY & CHAT PERSONA]\nRoleplay Style: ${personalityDesc}\n${nationLore}`;
  prompt += `⚠️ CRITICAL CHAT RULE (NO PRE-BATTLE HALLUCINATIONS): Keep your "commentary" to a max length of 1 short, punchy paragraph (1 to 3 sentences max). Your commentary is displayed to everyone *before* any of your attacks or drafts are rolled on the server. You DO NOT know if your attacks will succeed! You must write your commentary in the *future tense* or as *strategic intent*. Do NOT say "Svalbard falls" or "I have crushed Y" because the battle hasn't happened yet! Instead, say "My steel is marching toward Svalbard!" or "We are preparing to breach Y's borders!". Only comment on past events if they are explicitly recorded in the [RECENT LOGS] below.\n\n`;
  prompt += `[RISK STRATEGIC DIRECTIVES]\n`;
  prompt += `⭐ PRIORITY #1: CONTINENT DOMINATION. Completing full continents is how you build a massive army and win! \n`;
  prompt += `  A) Find the continent where you have the highest completion progress in [STATUS] and target those remaining sectors to COMPLETE it!\n`;
  prompt += `  B) If an opponent controls a continent (listed in "Enemy Continents"), you MUST attack at least one of their territories in that continent to BREAK their bonus!\n`;
  prompt += `  C) Once you hold a continent, heavily fortify its border bottleneck chokepoints. Do not leave internal territories over-defended.\n`;
  prompt += `  D) Don't be afraid to expand to a new continent if you've secured a current continent! And remember that the neutral dummy nations can't attack you, only you can attack them. They're free land!\n`;
  prompt += `  E) Watch out for big stacks near your borders... They are dangerous. On the other hand, if you have your own big stack to combat an enemy's big stack, attack using it! Stalemates are boring. You can also use big stacks to ravage and capture MANY territories with 1 or 2 armies.\n`;
  prompt += `  F) OPPORTUNISTIC ELIMINATION: If an opponent has very few territories left (e.g., 1 to 3) and has territories adjacent to your large stacks, prioritize attacking and ELIMINATING them entirely! Eliminating a player instantly awards you ALL of their held Risk cards, which you can trade in on your next turn to gain massive reinforcement bonuses.\n`;
  prompt += `  G) BREAK STALEMATES WITH OVERWHELMING FORCE: If you have a large stack of armies (e.g., 10 to 100+ armies) sitting adjacent to an undefended or weakly defended enemy territory (e.g., guarded by only 1 to 3 armies), DO NOT let your stack sit idle. Launch devastating blitz attacks to easily capture those adjacent territories. Keeping large armies passive on inactive borders is a waste of resource potential.\n`;
  prompt += `  H) When fortifying or drafting, draft your troops on territories that bordern an enemy! you can't use your troops if they are surrounded by your own territories.\n`;

  prompt += `⭐ PRIORITY #2: BALANCE OF POWER & Sudden Death rules:\n`;
  prompt += `  A) COALITIONS AGAINST THE LEADER: If multiple players remain and one player holds a significant lead (most territories/armies), you MUST propose/accept Alliances or Non-Aggression pacts with other weaker neighbors to coordinate your forces and gang up on that leader! Do not waste armies fighting weaker adjacent targets when a giant is on the board.\n`;
  prompt += `  B) BINARY SUDDEN DEATH: If there are ONLY 2 players remaining in the game, ALL diplomacy is dead! You cannot propose, accept, or maintain alliances or ceasefires with your final opponent. You MUST systematically attack, conquer, and destroy them to secure your win!\n`;
  prompt += `  B) YOUR GOAL IS WORLD DOMINATION: CAPTURE ALL TERRITORIES IN THE WORLD!\n`;

  if (gameMode === 'capital_rush' || gameState.capitals) {
    prompt += `🎯 CAPITAL RUSH WIN CONDITION: Controlling ALL Capitals instantly WINS the campaign! Focus your forces on conquering enemy capitals while defending your own!\n`;
  }
  prompt += `3. EXPAND AGGRESSIVELY: Risk is won by territorial expansion! Always conquer at least 1-3 territories (even more is fine and encouraged!) on your turn to earn Risk cards.\n`;
  prompt += `4. NEUTRAL/DUMMY TARGETS: Prioritize attacking Neutral/Dummy territories! They have weak 1-2 troop defenders and provide free land & continent progress.\n`;
  prompt += `5. FORCE CONCENTRATION: Place draft armies on attack frontiers and launch blitz attacks immediately!\n`;
  prompt += `6. SWEEP WEAK DEFENDERS: If you have enough armies to spare, prioritize attacking territories defended by only 1 army! They are easy pickings that expand your territory and earn you Risk cards with minimal risk. Chain multiple 1-army captures together in your attackSequence to gobble up huge swaths of the map in a single turn.\n`;
  prompt += `⚠️ TURN CONSOLIDATION RULE (STRICT ONE-REQUEST ATTACK LIMIT): You are strictly limited to exactly ONE API request for your entire Attack Phase. You cannot launch a single attack, check the result, and then make a separate request to attack again. Therefore, you must plan your entire offensive campaign in advance and bundle ALL planned attacks into the 'attackSequence' array. You are allowed to queue up dozens of attacks in this single array (including chaining conquests—such as attacking from a territory you captured earlier in the same sequence, to attack a territory you didn't have in valid attacks). Place as many attacks in this single request as required to achieve your strategic objectives. Once this array is processed, your turn stage will immediately and automatically transition to Fortify.\n\n`;

  // 1. COMMAND STATUS
  const myTerritories = Object.entries(gameState.territories).filter(([id, t]) => t.ownerId === me.id);
  const totalTerritories = Object.keys(gameState.territories).length;
  const myArmies = myTerritories.reduce((sum, [id, t]) => sum + (t.armies || 0), 0);
  const pct = Math.round((myTerritories.length / Math.max(1, totalTerritories)) * 100);

  let myContinentBonus = 0;
  const myControlledContinents = [];
  const opponentControlledContinents = [];

  if (mapData.continents) {
    mapData.continents.forEach(c => {
      if (!c.territoryIds || c.territoryIds.length === 0) return;
      const pgBlizzardSet = new Set(gameState.blizzards || []);
      const activeTids = c.territoryIds.filter(tid => !pgBlizzardSet.has(tid));
      const owners = activeTids.map(tid => gameState.territories[tid] ? gameState.territories[tid].ownerId : null);
      const firstOwner = owners[0];
      const isFullyControlled = activeTids.length > 0 && firstOwner && firstOwner !== 'dummy' && owners.every(o => o === firstOwner);

      if (isFullyControlled) {
        const ownerName = getPlayerName(gameState.players, firstOwner);
        const cBonus = c.bonus !== undefined ? c.bonus : (c.bonusArmies !== undefined ? c.bonusArmies : 0);
        if (firstOwner === me.id) {
          myContinentBonus += cBonus;
          myControlledContinents.push(`${c.name}(+${cBonus})`);
        } else {
          opponentControlledContinents.push(`${c.name}(+${cBonus} by ${ownerName})`);
        }
      }
    });
  }

  // Calculate specific continent progress percentages to guide LLM expansion
  let continentProgressStr = '';
  if (mapData.continents) {
    mapData.continents.forEach(c => {
      if (!c.territoryIds || c.territoryIds.length === 0) return;
      const ownedCount = c.territoryIds.filter(tid => gameState.territories[tid]?.ownerId === me.id).length;
      const totalCount = c.territoryIds.length;
      const compPct = Math.round((ownedCount / totalCount) * 100);
      const cBonus = c.bonus !== undefined ? c.bonus : 0;
      
      if (compPct > 0 && compPct < 100) {
        continentProgressStr += `  • ${c.name} (+${cBonus} bonus): You control ${ownedCount}/${totalCount} (${compPct}%). COMPLETE THIS CONTINENT IMMEDIATELY!\n`;
      } else if (compPct === 100) {
        continentProgressStr += `  • ${c.name} (+${cBonus} bonus): Fully Controlled (100%). Heavily fortify its border bottlenecks!\n`;
      }
    });
  }

  prompt += `[STATUS]\n`;
  prompt += `Territories: ${myTerritories.length}/${totalTerritories} (${pct}%) | Total Armies: ${myArmies}\n`;
  prompt += `My Continents: ${myControlledContinents.length > 0 ? myControlledContinents.join(', ') + ` [Bonus: +${myContinentBonus}/turn]` : 'None'}\n`;
  if (opponentControlledContinents.length > 0) prompt += `Enemy Continents: ${opponentControlledContinents.join(', ')}\n`;
  if (continentProgressStr) prompt += `Continent Completion Progress:\n${continentProgressStr}`;
  if (gameState.capitals) {
    const capEntries = Object.entries(gameState.capitals).map(([pId, tid]) => {
      const terr = gameState.territories[tid];
      const ownerName = terr ? getPlayerName(gameState.players, terr.ownerId) : 'Neutral';
      const isMine = terr && terr.ownerId === me.id;
      const terrName = getTerritoryName(mapData, tid);
      return `${tid}(${terrName}): Held by ${ownerName}${isMine ? ' [YOUR CAPITAL - DEFEND!]' : ' [ENEMY CAPITAL - CONQUER TO WIN!]'}`;
    });
    prompt += `Capitals Tracker (${capEntries.length} Total Needed For Win):\n  • ${capEntries.join('\n  • ')}\n`;
  }
  if (stage === 'DRAFT') prompt += `Draft Pool: ${gameState.draftPool || 0} armies\n`;
  const myCards = me.cards || [];
  const cardTypesStr = myCards.map(c => `${c.type}(${c.territoryId ? getTerritoryName(mapData, c.territoryId) : 'Wild'})`).join(', ');
  prompt += `Cards (${myCards.length}): [${cardTypesStr || 'None'}]\n\n`;

  // 2. DIPLOMACY & TREATIES (Actionable pending offers)
  prompt += `[TREATIES]\n`;
  const pacts = gameState.pacts || [];
  const myPacts = pacts.filter(p => p.playerA === me.id || p.playerB === me.id);
  if (myPacts.length === 0) {
    prompt += `Active Pacts: None\n`;
  } else {
    myPacts.forEach(p => {
      const oppId = p.playerA === me.id ? p.playerB : p.playerA;
      prompt += `• ${p.type === 'non_aggression' ? 'NonAggression' : 'Alliance'} w/ ${getPlayerName(gameState.players, oppId)} [ID:${oppId}]\n`;
    });
  }
  
  const proposals = gameState.diplomacyProposals || [];
  const incoming = proposals.filter(p => p.targetId === me.id);
  if (incoming.length > 0) {
    prompt += `⚠️ PENDING TREATY OFFERS RECEIVED (ACTION OPTIONAL):\n`;
    incoming.forEach(p => {
      const proposerName = getPlayerName(gameState.players, p.proposerId);
      const cleanType = p.type === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance';
      prompt += `  • "${proposerName}" [ID:${p.proposerId}] proposed a ${cleanType} with you!\n`;
      prompt += `    -> To ACCEPT this treaty, add this key-value pair to your response JSON: "acceptPact": {"proposerId": "${p.proposerId}"}\n`;
    });
  }
  prompt += `\n`;

  // 3. RECENT LOGS & CHAT
  prompt += `[RECENT LOGS]\n`;
  const recentLogs = (gameState.logs || []).slice(-5);
  if (recentLogs.length === 0) prompt += `• None\n`;
  else recentLogs.forEach(l => prompt += `• ${typeof l === 'string' ? l : l.text}\n`);
  prompt += `\n`;

  prompt += `[RECENT CHAT MESSAGES]\n`;
  const recentChats = (gameState.chatArchive || []).slice(-6);
  if (recentChats.length === 0) prompt += `• None\n`;
  else recentChats.forEach(c => prompt += `• ${c.senderName}: "${c.text}"\n`);
  prompt += `\n`;

  // 4. TOTAL BOARD STATE (Compressed format)
  prompt += `[BOARD STATE]\n`;
  const continentMap = {};
  if (mapData.continents) {
    mapData.continents.forEach(c => {
      const cBonus = c.bonus !== undefined ? c.bonus : (c.bonusArmies !== undefined ? c.bonusArmies : 0);
      continentMap[c.id] = { name: c.name, bonus: cBonus, territories: [] };
    });
  }
  continentMap['unassigned'] = { name: 'Other', bonus: 0, territories: [] };

  mapData.territories.forEach(t => {
    const stateTerr = gameState.territories[t.id];
    const ownerName = stateTerr ? getPlayerName(gameState.players, stateTerr.ownerId) : 'Neutral';
    const armies = stateTerr ? stateTerr.armies : 0;
    const isCapital = gameState.capitals && Object.values(gameState.capitals).includes(t.id) ? '^CAPITAL' : '';
    const item = `${t.id}(${t.name}):${ownerName}(${armies})${isCapital}`;
    
    if (t.continentId && continentMap[t.continentId]) {
      continentMap[t.continentId].territories.push(item);
    } else {
      continentMap['unassigned'].territories.push(item);
    }
  });

  Object.values(continentMap).forEach(c => {
    if (c.territories.length > 0) {
      prompt += `Cont:${c.name}(+${c.bonus}) -> [${c.territories.join(', ')}]\n`;
    }
  });
  prompt += `\n`;

  // 5. VALID MOVES (Compressed format)
  prompt += `[VALID MOVES]\n`;
  if (stage === 'SETUP_CLAIM') {
    const unclaimed = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === null);
    
    // Shuffle the unclaimed list to break deterministic insertion bias
    const shuffledUnclaimed = [...unclaimed];
    for (let i = shuffledUnclaimed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUnclaimed[i], shuffledUnclaimed[j]] = [shuffledUnclaimed[j], shuffledUnclaimed[i]];
    }

    prompt += `Unclaimed Territories (shuffled): [${shuffledUnclaimed.map(tid => `${tid}(${getTerritoryName(mapData, tid)})`).join(', ')}]\n`;
    prompt += `[SETUP CLAIM STRATEGY]: You are in the initial claim phase. Pick a territory to claim. You can choose to concentrate your claims within one continent to secure an early bonus, OR spread your claims out into different continents to block opponents from securing easy bonuses. If you see multiple players fighting over one continent, pivot to an uncontested area of the map to claim easy land!\n`;
  } else if (stage === 'SETUP_FORTIFY') {
    const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === me.id);
    prompt += `My Owned Territories: [${owned.map(tid => `${tid}(${getTerritoryName(mapData, tid)})`).join(', ')}]\n`;
    prompt += `[SETUP FORTIFY STRATEGY]: Place an extra army on one of your owned territories. Target your highest-threat frontier borders that touch enemy players, rather than your safe interior territories.\n`;
  } else if (stage === 'DRAFT') {
    prompt += `Draft Targets: [${myTerritories.map(([id]) => id).join(', ')}]\n`;
    if (myCards.length >= 5) {
      prompt += `Card Trade Available (Action: "TRADE_CARDS")\n`;
    }
  } else if (stage === 'ATTACK') {
    let attackCount = 0;
    myTerritories.forEach(([srcId, srcTerr]) => {
      if (srcTerr.armies >= 2) {
        const adjs = getAdjacentTerritories(mapData, srcId);
        adjs.forEach(tgtId => {
          const tgtTerr = gameState.territories[tgtId];
          if (tgtTerr && tgtTerr.ownerId !== me.id) {
            const isNeutral = tgtTerr.ownerId === 'dummy' || !tgtTerr.ownerId;
            const isCapital = gameState.capitals && Object.values(gameState.capitals).includes(tgtId);
            const capTag = isCapital ? '^CAPITAL' : '';
            const tag = isNeutral ? '*neutral' : (srcTerr.armies > tgtTerr.armies ? '*adv' : '');
            // Compute chain-conquest targets for weak defenders only (≤3 armies or neutral)
            const isWeakTarget = isNeutral || tgtTerr.armies <= 3;
            let chainHint = '';
            if (isWeakTarget) {
              const chainVisited = new Set([tgtId]);
              const chainTargets = getChainTargets(mapData, gameState, tgtId, me.id, 2, chainVisited);
              if (chainTargets.length > 0) chainHint = ` >${chainTargets.join(' >')}`;
            }
            prompt += `  ${srcId}(${srcTerr.armies}) -> ${tgtId}(${getPlayerName(gameState.players, tgtTerr.ownerId)},${tgtTerr.armies})${capTag}${tag ? ' ' + tag : ''}${chainHint}\n`;
            attackCount++;
          }
        });
      }
    });
    if (attackCount === 0) {
      prompt += `  No valid attack pairs. Output "END_ATTACK".\n`;
    } else {
            prompt += `⚠️ ATTACK CONFIRMATION RULE: You currently have ${attackCount} valid attack options listed above. To win the game, you must conquer territories and earn cards. If you choose not to attack (passing with "action": "END_ATTACK"), you must explain in your 'reasoning' why a defensive pass is preferred over launching these available attacks.\n`;
            prompt += `⚔️ ONE-REQUEST ATTACK LIMIT & CHAIN-CONQUEST MANDATE: You only get exactly ONE API request for your entire Attack Phase. You cannot make a single attack, wait for feedback, and attack again. You must pack your entire offensive campaign into the 'attackSequence' array right now. Our engine fully supports chaining conquests—if you conquer T1 using S1 (S1 -> T1), T1 is yours instantly and you can use T1 as the source for your next attack in the same array (T1 -> T2) to push deeper! Queue up dozens of planned attacks sequentially in 'attackSequence' to take as much territory as possible in this single request. Optional: Specify "postAttackMove": X for any attack to move X additional armies forward upon conquest (clamped safely to maximum available).\n`;
          }
  } else if (stage === 'FORTIFY') {
    let fortifyCount = 0;
    myTerritories.forEach(([srcId, srcTerr]) => {
      if (srcTerr.armies >= 2) {
        myTerritories.forEach(([tgtId, tgtTerr]) => {
          if (srcId !== tgtId && hasAlliedPath(gameState, mapData, srcId, tgtId, me.id)) {
            prompt += `  ${srcId}(${srcTerr.armies}) -> ${tgtId}(${tgtTerr.armies}) [Max:${srcTerr.armies - 1}]\n`;
            fortifyCount++;
          }
        });
      }
    });
    if (fortifyCount === 0) prompt += `  No valid fortify pairs. Output "END_TURN".\n`;
  }

  // 6. SCHEMAS (Decoupled diplomacy)
  prompt += `\n[RESPONSE SCHEMAS]\n`;
  prompt += `NOTE: You must include "internalNote" in all of your JSON responses to persist memory to your next turn. You can also attach optional diplomacy keys ("proposePact", "acceptPact", "breakPact") concurrently!\n`;
  prompt += `Diplomacy Options:\n`;
  prompt += `  "proposePact": {"targetPlayerId":"ID","type":"non_aggression"|"alliance"}\n`;
  prompt += `  "acceptPact": {"proposerId":"ID"}\n`;
  prompt += `  "breakPact": {"targetPlayerId":"ID"}\n\n`;

  if (stage === 'SETUP_CLAIM') {
    const unclaimed = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === null);
    const randomUnclaimedId = unclaimed.length > 0 ? unclaimed[Math.floor(Math.random() * unclaimed.length)] : 't1';
    prompt += `Claim: {"reasoning":"...","commentary":"...","internalNote":"...","action":"CLAIM","territoryId":"${randomUnclaimedId}"}\n`;
  } else if (stage === 'SETUP_FORTIFY') {
    const owned = Object.keys(gameState.territories).filter(tid => gameState.territories[tid].ownerId === me.id);
    const randomOwnedId = owned.length > 0 ? owned[Math.floor(Math.random() * owned.length)] : 't1';
    prompt += `Setup Fortify: {"reasoning":"...","commentary":"...","internalNote":"...","action":"FORTIFY_SETUP","territoryId":"${randomOwnedId}","amount":1}\n`;
  } else if (stage === 'DRAFT') {
    prompt += `Draft (Consolidated Sequence): {"reasoning":"...","commentary":"...","internalNote":"Your updated notes...","action":"DRAFT","draftSequence":[{"territoryId":"${myTerritories[0] ? myTerritories[0][0] : 't1'}","amount":${gameState.draftPool || 1}}]}\n`;
  } else if (stage === 'ATTACK') {
    prompt += `Attack (Consolidated Sequence): {"reasoning":"...","commentary":"...","internalNote":"Your updated notes...","action":"ATTACK","attackSequence":[{"sourceId":"S1","targetId":"T1","blitz":true,"postAttackMove":5},{"sourceId":"S2","targetId":"T2","blitz":true,"postAttackMove":0}]}\n`;
    prompt += `Pass (End Phase): {"reasoning":"...","commentary":"...","internalNote":"Your updated notes...","action":"END_ATTACK","attackSequence":[]}\n`;
  } else if (stage === 'FORTIFY') {
    prompt += `Fortify: {"reasoning":"...","commentary":"...","internalNote":"Your updated notes...","action":"FORTIFY","sourceId":"SRC_ID","targetId":"TGT_ID","amount":4}\n`;
    prompt += `End Turn: {"reasoning":"...","commentary":"...","internalNote":"Your updated notes...","action":"END_TURN"}\n`;
  }

  prompt += `================================================================================\n`;
  return prompt;
}

module.exports = {
  generateLLMPrompt
};