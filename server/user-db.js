const fs = require('fs');
const path = require('path');

// DB location can be overridden (used by the automated test suite to isolate
// writes). Defaults to the legacy public location for backward compatibility.
const DB_FILE = process.env.USER_DB_PATH || path.join(__dirname, '../public/users_data.json');

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2), 'utf8');
}

function loadUsers() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[UserDB] Error reading users_data.json:', err);
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserDB] Error saving users_data.json:', err);
  }
}

function createEmptyStats() {
  return {
    matchesPlayed: 0,
    matchesWon: 0,
    conquestWins: 0,
    capitalRushWins: 0,
    territoriesConquered: 0,
    territoriesLost: 0,
    armiesDrafted: 0,
    armiesKilled: 0,
    armiesLost: 0,
    nukesCrafted: 0,
    tacticalNukesFired: 0,
    thermonukesFired: 0,
    alliancesFormed: 0,
    betrayalsCommitted: 0,
    diceRollsCount: 0,
    diceRollWins: 0,
    elo: 1200
  };
}

function getXPForLevel(level) {
  return Math.min(3000, 100 + (Math.max(1, level) - 1) * 50);
}

const RARITY_XP = {
  common: 50,
  rare: 100,
  epic: 200,
  legendary: 500
};

const ACHIEVEMENTS = {
  // 1. Combat & Conquest
  first_blood: { id: 'first_blood', title: 'First Blood', commanderTitle: 'Cadet', desc: 'Win your first territory attack.', rarity: 'common', category: 'combat' },
  lightning_advance: { id: 'lightning_advance', title: 'Lightning Advance', commanderTitle: 'Panzer', desc: 'Conquer 5 territories in a single turn.', rarity: 'common', category: 'combat' },
  steamroller: { id: 'steamroller', title: 'Steamroller', commanderTitle: 'The Tank Engine', desc: 'Conquer 12 territories in a single turn.', rarity: 'rare', category: 'combat' },
  relentless_vanguard: { id: 'relentless_vanguard', title: 'Relentless Vanguard', commanderTitle: 'The Unstoppable', desc: 'Execute 25 successful attacks in a single match.', rarity: 'common', category: 'combat' },
  clean_sweep: { id: 'clean_sweep', title: 'Clean Sweep', commanderTitle: 'Flawless Execution', desc: 'Conquer an enemy territory (holding ≥ 5 troops) during a Blitz attack without losing a single troop.', rarity: 'rare', category: 'combat' },
  decisive_strike: { id: 'decisive_strike', title: 'Decisive Strike', commanderTitle: 'Tactical General', desc: 'Wipe an enemy stack of 30+ troops in one turn.', rarity: 'rare', category: 'combat' },
  continent_breaker: { id: 'continent_breaker', title: 'Continent Breaker', commanderTitle: 'Income Saboteur', desc: 'Attack and conquer an enemy-held continent territory to break their turn bonus.', rarity: 'common', category: 'combat' },
  iron_citadel: { id: 'iron_citadel', title: 'Iron Citadel', commanderTitle: 'The Immovable Object', desc: 'Successfully defend a territory when outnumbered 3-to-1.', rarity: 'common', category: 'combat' },
  garrison_master: { id: 'garrison_master', title: 'Garrison Master', commanderTitle: 'Lieutenant', desc: 'Station 50+ armies on a single territory.', rarity: 'epic', category: 'combat' },
  border_guard: { id: 'border_guard', title: 'Border Guard', commanderTitle: 'Border Patrol', desc: 'End 3 of your consecutive turns without losing a single territory.', rarity: 'rare', category: 'combat' },
  impenetrable_border: { id: 'impenetrable_border', title: 'Impenetrable Border', commanderTitle: 'The Aegis', desc: 'End 5 of your consecutive turns without losing a single territory.', rarity: 'epic', category: 'combat' },
  hold_the_line: { id: 'hold_the_line', title: 'Hold the Line', commanderTitle: 'Not One Step Back', desc: "Successfully repel 3 separate attack attempts on the same territory during opponents' turns in one round.", rarity: 'common', category: 'combat' },
  one_man_army: { id: 'one_man_army', title: 'One-Man Army', commanderTitle: 'Last Stand', desc: 'Conquer an enemy territory when attacking with only 2 armies (1 die roll).', rarity: 'common', category: 'combat' },
  david_vs_goliath: { id: 'david_vs_goliath', title: 'David vs. Goliath', commanderTitle: 'Giant Slayer', desc: 'Attack and conquer an enemy stack of 20+ armies in one turn starting with fewer troops in all bordering territories.', rarity: 'rare', category: 'combat' },
  last_stand_thermopylae: { id: 'last_stand_thermopylae', title: 'Last Stand at Thermopylae', commanderTitle: 'Spartan', desc: 'Have your 1 army territory defend against enemy attacks 5 times in a row.', rarity: 'rare', category: 'combat' },

  // 2. Nuclear Warfare
  manhattan_project: { id: 'manhattan_project', title: 'Manhattan Project', commanderTitle: 'Demolitions Expert', desc: 'Craft your first Tactical Nuke from 3 Risk Cards.', rarity: 'common', category: 'nuclear' },
  i_am_become_death: { id: 'i_am_become_death', title: 'I Am Become Death', commanderTitle: 'Destroyer of Worlds', desc: 'Assemble and forge a Thermonuclear Weapon from a matching card set.', rarity: 'common', category: 'nuclear' },
  trinity_test: { id: 'trinity_test', title: 'Trinity Test', commanderTitle: '🔥', desc: 'Detonate your first Tactical Nuke on an enemy territory.', rarity: 'common', category: 'nuclear' },
  total_scorched_earth: { id: 'total_scorched_earth', title: 'Total Scorched Earth', commanderTitle: 'Has Nuclear Farts', desc: 'Vaporize 40+ enemy armies in a single nuclear strike (splash damage counts).', rarity: 'common', category: 'nuclear' },
  nuclear_deterrent: { id: 'nuclear_deterrent', title: 'Nuclear Deterrent', commanderTitle: 'Kim Jong Un', desc: 'Win a match holding 3+ nukes in your inventory without firing any of them.', rarity: 'epic', category: 'nuclear' },
  extinction_protocol: { id: 'extinction_protocol', title: 'Extinction Protocol', commanderTitle: 'The Eraser of Nations', desc: 'Eliminate an opponent from the game entirely with a direct nuclear strike.', rarity: 'epic', category: 'nuclear' },
  mutually_assured_destruction: { id: 'mutually_assured_destruction', title: 'Mutually Assured Destruction', commanderTitle: 'The MAD Hatter', desc: 'Launch 3 nukes in one turn.', rarity: 'epic', category: 'nuclear' },
  mass_demilitarization: { id: 'mass_demilitarization', title: 'Mass Demilitarization', commanderTitle: 'Public Enemy #1', desc: 'Devastate a territory garrisoned by ≥ 100 armies down to 0 with a single Tactical Nuke.', rarity: 'epic', category: 'nuclear' },
  nuclear_gandhi: { id: 'nuclear_gandhi', title: 'Nuclear Gandhi', commanderTitle: 'Civilization’s End', desc: 'While holding a territory named India, craft a nuke and fire a nuclear weapon in the same match.', rarity: 'epic', category: 'nuclear' },

  // 3. Diplomacy & Treachery
  handshake_protocol: { id: 'handshake_protocol', title: 'Handshake Protocol', commanderTitle: 'The Ink is Wet', desc: 'Sign your first Non-Aggression Pact.', rarity: 'common', category: 'diplomacy' },
  blood_brothers: { id: 'blood_brothers', title: 'Blood Brothers', commanderTitle: 'Brotha', desc: 'Establish a Full Alliance.', rarity: 'common', category: 'diplomacy' },
  the_coalition: { id: 'the_coalition', title: 'The Coalition', commanderTitle: 'Trusted Adult', desc: 'Maintain active alliances with 2 or more players at the exact same time.', rarity: 'rare', category: 'diplomacy' },
  et_tu_brute: { id: 'et_tu_brute', title: 'Et Tu, Brute?', commanderTitle: 'Brutus', desc: 'Break an active Full Alliance by launching a direct attack against your ally.', rarity: 'common', category: 'diplomacy' },
  cold_blooded_backstab: { id: 'cold_blooded_backstab', title: 'Cold-Blooded Backstab', commanderTitle: 'The Backstabber', desc: 'Eliminate your former ally within 1 turn of breaking your treaty.', rarity: 'epic', category: 'diplomacy' },
  switzerland: { id: 'switzerland', title: 'Switzerland', commanderTitle: 'Eternal Neutral', desc: 'Win a match having formed at least 1 treaty without ever committing a betrayal.', rarity: 'rare', category: 'diplomacy' },
  silver_tongue: { id: 'silver_tongue', title: 'Silver Tongue', commanderTitle: 'The Diplomat', desc: 'Get 3 different players to accept your treaty proposals in one match.', rarity: 'rare', category: 'diplomacy' },
  fool_me_twice: { id: 'fool_me_twice', title: 'Fool Me Twice', commanderTitle: 'Insurance Risk', desc: 'Get betrayed by the same commander twice in a single match.', rarity: 'rare', category: 'diplomacy' },
  the_red_wedding: { id: 'the_red_wedding', title: 'The Red Wedding', commanderTitle: 'The Killer', desc: "Break a Full Alliance and capture your former ally's Capital on the exact same turn.", rarity: 'epic', category: 'diplomacy' },
  machiavelli_disciple: { id: 'machiavelli_disciple', title: "Machiavelli's Disciple", commanderTitle: "Machiavelli’s Disciple", desc: 'Form alliances with all other players, break every single one, and win the match.', rarity: 'epic', category: 'diplomacy' },

  // 4. Capital Rush
  fortified_crown: { id: 'fortified_crown', title: 'Fortified Crown', commanderTitle: 'Palace Guard', desc: 'Build a garrison of 60+ armies defending your own Capital city.', rarity: 'epic', category: 'capital' },
  near_death_sovereign: { id: 'near_death_sovereign', title: 'Near-Death Sovereign', commanderTitle: 'Emperor of Mankind', desc: 'Win Capital Rush after your own Capital was breached and reclaimed.', rarity: 'rare', category: 'capital' },
  capital_crusher: { id: 'capital_crusher', title: 'Capital Crusher', commanderTitle: 'WANTED', desc: 'Win a match of Capital Rush.', rarity: 'common', category: 'capital' },
  ground_zero_capital: { id: 'ground_zero_capital', title: 'Ground Zero Capital', commanderTitle: 'Bunker Buster', desc: "Detonate a Thermonuclear weapon directly on an enemy player's designated Capital in Capital Rush mode.", rarity: 'rare', category: 'capital' },

  // 5. Fog of War
  omniscient_recon: { id: 'omniscient_recon', title: 'Omniscient Recon', commanderTitle: 'The Wise', desc: 'Achieve line-of-sight of 85% or more of the world map in Fog of War mode.', rarity: 'common', category: 'fow' },
  shared_horizons: { id: 'shared_horizons', title: 'Shared Horizons', commanderTitle: 'Eagle-eyed', desc: 'Gain line-of-sight of 10+ new territories through a Full Alliance.', rarity: 'common', category: 'fow' },

  // 6. Dice Luck & RNG
  blessed_by_rngesus: { id: 'blessed_by_rngesus', title: 'Blessed by RNGesus', commanderTitle: 'Blessed', desc: 'Roll triple 6s ([6, 6, 6]) during an offensive attack.', rarity: 'rare', category: 'dice' },
  wall_of_steel: { id: 'wall_of_steel', title: 'Wall of Steel', commanderTitle: 'The Tank', desc: 'Roll double 6s ([6, 6]) on defense.', rarity: 'rare', category: 'dice' },
  snake_eyes_tragedy: { id: 'snake_eyes_tragedy', title: 'Snake Eyes Tragedy', commanderTitle: "Fate's Cruel Joke", desc: 'Roll all 1s when attacking with 3 dice.', rarity: 'rare', category: 'dice' },
  calculated_risk: { id: 'calculated_risk', title: 'Calculated Risk', commanderTitle: 'Math-Defying Luck', desc: 'Win 10 consecutive dice comparisons in a single turn without taking a loss.', rarity: 'epic', category: 'dice' },
  lucky_skirmish: { id: 'lucky_skirmish', title: 'Lucky Skirmish', commanderTitle: 'The Gambler', desc: 'Win a battle where you attacked with 2 armies against a defender with 2 armies without losing a troop.', rarity: 'common', category: 'dice' },

  // 7. Cards & Logistics
  card_shark: { id: 'card_shark', title: 'Card Shark', commanderTitle: 'The Investor', desc: 'Trade in 5 or more complete card sets in a single match.', rarity: 'epic', category: 'cards' },
  forced_liquidation: { id: 'forced_liquidation', title: 'Forced Liquidation', commanderTitle: 'Garbage Collector', desc: 'Hit the 5-card mandatory ceiling and successfully trade down to 2 or fewer cards before attacking.', rarity: 'rare', category: 'cards' },
  arms_race_escalation: { id: 'arms_race_escalation', title: 'Arms Race Escalation', commanderTitle: 'Atomic Edger', desc: 'Trigger the 10th progressive card trade-in of a single match.', rarity: 'rare', category: 'cards' },
  jokers_wild: { id: 'jokers_wild', title: "Joker's Wild", commanderTitle: 'Joker', desc: 'Trade in a valid set that includes 2 Wildcards.', rarity: 'epic', category: 'cards' },
  matching_soil: { id: 'matching_soil', title: 'Matching Soil', commanderTitle: 'Guerrilla Fighter', desc: 'Receive the +2 army territory ownership bonus on all 3 cards in a single trade-in.', rarity: 'rare', category: 'cards' },
  double_bonus: { id: 'double_bonus', title: 'Double Bonus', commanderTitle: 'Double Trouble', desc: 'Receive the +2 matching territory bonus on 2 different cards in the same 3-card trade-in.', rarity: 'rare', category: 'cards' },
  plunder_king: { id: 'plunder_king', title: 'Plunder King', commanderTitle: 'Pirate King', desc: 'Confiscate 4 or more cards from a single player upon eliminating them from the match.', rarity: 'rare', category: 'cards' },
  infinite_supply_lines: { id: 'infinite_supply_lines', title: 'Infinite Supply Lines', commanderTitle: 'I am Inevitable', desc: 'Execute 4 complete card trade-ins in a single turn.', rarity: 'legendary', category: 'cards' },

  // 8. Tactics & Mastery
  multiverse: { id: 'multiverse', title: 'Multiverse', commanderTitle: 'Two Steps Ahead', desc: 'Win a scenario map match.', rarity: 'common', category: 'tactics' },
  no_way_home: { id: 'no_way_home', title: 'No Way Home', commanderTitle: 'The Fallen Soldier', desc: 'Be eliminated from a match.', rarity: 'common', category: 'tactics' },
  world_dominator: { id: 'world_dominator', title: 'World Dominator', commanderTitle: 'Hegemon of History', desc: 'Control 100% of the territories on a 40+ province map.', rarity: 'common', category: 'tactics' },
  continent_master: { id: 'continent_master', title: 'Continent Master', commanderTitle: 'Regional Dictator', desc: 'Control an entire continent.', rarity: 'common', category: 'tactics' },
  mother_russia: { id: 'mother_russia', title: 'Mother Russia', commanderTitle: 'Joseph Stalin', desc: 'Win a game with blizzards enabled.', rarity: 'common', category: 'tactics' },
  rags_to_riches: { id: 'rags_to_riches', title: 'Rags to Riches', commanderTitle: 'Billionaire', desc: 'Capture 90% of the world map within a single turn.', rarity: 'legendary', category: 'tactics' },
  the_silk_road: { id: 'the_silk_road', title: 'The Silk Road', commanderTitle: 'The Trader', desc: 'Fortify an army stack through 6 or more consecutive allied and owned territories in a single maneuver.', rarity: 'common', category: 'tactics' },
  the_colossus: { id: 'the_colossus', title: 'The Colossus', commanderTitle: 'Stands on the Shoulders of Giants', desc: 'Amass 200 or more troops on a single territory.', rarity: 'legendary', category: 'tactics' },
  human_wave_tactics: { id: 'human_wave_tactics', title: 'Human Wave Tactics', commanderTitle: 'The Fertile', desc: 'Control 200 or more total active troops across the board simultaneously.', rarity: 'epic', category: 'tactics' },
  minmaxing: { id: 'minmaxing', title: 'Minmaxing', commanderTitle: 'Likes Australia', desc: "Control less than 20% of the world's territories while commanding more than 80% of all active armies on the board.", rarity: 'epic', category: 'tactics' },
  blitzkrieg_world_tour: { id: 'blitzkrieg_world_tour', title: 'Blitzkrieg World Tour', commanderTitle: 'A Little Bit of Everything', desc: 'Conquer at least one territory in every continent within a single turn.', rarity: 'epic', category: 'tactics' },
  single_stack_wipeout: { id: 'single_stack_wipeout', title: 'Single-Stack Wipeout', commanderTitle: 'Overlord', desc: 'Eliminate 2 different players on the exact same turn using the same attacking army stack.', rarity: 'epic', category: 'tactics' },
  the_comeback_kid: { id: 'the_comeback_kid', title: 'The Comeback Kid', commanderTitle: 'Admin Abuser', desc: 'Win a full campaign after being reduced to only 1 territory.', rarity: 'legendary', category: 'tactics' },
  nuclear_judas: { id: 'nuclear_judas', title: 'Nuclear Judas', commanderTitle: 'Traitor', desc: 'Launch a missile directly onto a territory owned by your active Full Alliance partner.', rarity: 'rare', category: 'tactics' },
  iron_curtain: { id: 'iron_curtain', title: 'Iron Curtain', commanderTitle: 'General Secretary', desc: 'Own 8 consecutive connected border territories that each have at least 5 armies stationed.', rarity: 'epic', category: 'tactics' },
  unbroken_fortress: { id: 'unbroken_fortress', title: 'Unbroken Fortress', commanderTitle: 'The Architect', desc: 'Control an entire continent for 10 consecutive full turn rounds without losing a territory in it.', rarity: 'rare', category: 'tactics' },
  d_day: { id: 'd_day', title: 'D-Day', commanderTitle: 'Eisenhower', desc: 'Conquer 4 or more territories across ocean/sea routes in a single turn.', rarity: 'common', category: 'tactics' },
  speedrunner: { id: 'speedrunner', title: 'Speedrunner', commanderTitle: 'Speedrunner', desc: 'Achieve victory in 5 turns or less on a map with at least 20 territories.', rarity: 'legendary', category: 'tactics' },
  cyber_general: { id: 'cyber_general', title: 'Cyber General', commanderTitle: 'Cyborg', desc: 'Win a campaign while using the Sci-Fi Cybernetic theme.', rarity: 'common', category: 'tactics' },
  grand_emperor: { id: 'grand_emperor', title: 'Grand Emperor', commanderTitle: 'Napoleon Bonaparte', desc: 'Win a campaign while using the Napoleonic Era theme.', rarity: 'common', category: 'tactics' },
  modern_strategist: { id: 'modern_strategist', title: 'Modern Strategist', commanderTitle: 'Drone Operator', desc: 'Win a campaign while using the Modern Warfare theme.', rarity: 'common', category: 'tactics' },
  kawaii_commander: { id: 'kawaii_commander', title: 'Kawaii Commander', commanderTitle: 'Kawaii', desc: 'Win a campaign while using the Anime Kawaii theme.', rarity: 'common', category: 'tactics' },
  cartographer: { id: 'cartographer', title: 'Cartographer', commanderTitle: 'The Cartographer', desc: 'Open the Map Editor.', rarity: 'common', category: 'tactics' },
  worldbuilder: { id: 'worldbuilder', title: 'Worldbuilder', commanderTitle: 'Factional Leader', desc: 'Export a custom map JSON from the Map Editor.', rarity: 'rare', category: 'tactics' },
  geopolitical_mastermind: { id: 'geopolitical_mastermind', title: 'Geopolitical Mastermind', commanderTitle: 'Architect of Conflict', desc: 'Export a Scenario map JSON from the Map Editor.', rarity: 'rare', category: 'tactics' },
  party_host: { id: 'party_host', title: 'Party Host', commanderTitle: 'Aint No Party Like Mine', desc: 'Host a game lobby.', rarity: 'common', category: 'tactics' },
  literally_hitler: { id: 'literally_hitler', title: 'Literally Hitler', commanderTitle: 'Führer', desc: 'Eliminate three players in a single turn.', rarity: 'legendary', category: 'tactics' },
  // Zombie Mode Achievements
  twenty_eight_turns_later: { id: 'twenty_eight_turns_later', title: '28 Turns Later', commanderTitle: 'The Walking Dead', desc: 'Win a campaign with Zombie Mode enabled.', rarity: 'common', category: 'tactics' },
  quarantine: { id: 'quarantine', title: 'Quarantine', commanderTitle: 'The Frail', desc: 'Be the commander to eliminate the very last zombie territory from the world map.', rarity: 'rare', category: 'tactics' },
  train_to_busan: { id: 'train_to_busan', title: 'Train to Busan', commanderTitle: 'Zombie Slayer', desc: 'Conquer 3 or more zombie-held territories in a single turn.', rarity: 'rare', category: 'tactics' },
  incompetent_government: { id: 'incompetent_government', title: 'Incompetent Government', commanderTitle: 'Navy Seal', desc: 'Lose 4 or more territories to the Zombie Horde in a single turn.', rarity: 'epic', category: 'tactics' },
  damn_greenland: { id: 'damn_greenland', title: 'Damn Greenland', commanderTitle: 'Mad Scientist', desc: 'Have the Zombie Horde control every territory on the map except one of yours — then comeback and win the game.', rarity: 'legendary', category: 'secret', secret: true },

  // 9. Secret Feats
  secret_anime_scroll: { id: 'secret_anime_scroll', title: '( ͡° ͜ʖ ͡°)', commanderTitle: 'The Pervert', desc: 'Scrolled all the way to the bottom of the sidebar under the Anime Kawaii theme.', rarity: 'rare', category: 'secret', secret: true },
  secret_nuclear_bbq: { id: 'secret_nuclear_bbq', title: 'Nuclear Barbecue', commanderTitle: 'Thinks That Uranium-238 Tastes Good', desc: 'Fired a Thermonuclear weapon into a territory garrisoned by only 1 defender.', rarity: 'epic', category: 'secret', secret: true },
  secret_choose_already: { id: 'secret_choose_already', title: 'Just Choose Already', commanderTitle: 'The Gooner', desc: 'Switched interface themes 6 or more times in a single turn.', rarity: 'rare', category: 'secret', secret: true },
  samurai: { id: 'samurai', title: 'Samurai', commanderTitle: 'Samurai', desc: 'Conquer a territory named Japan three times in a single game.', rarity: 'rare', category: 'secret', secret: true },
  instructions_unclear: { id: 'instructions_unclear', title: 'Instructions Unclear', commanderTitle: 'Failure', desc: 'Detonate a nuclear missile onto your own territory.', rarity: 'epic', category: 'secret', secret: true },
  drama_queen: { id: 'drama_queen', title: 'Drama Queen', commanderTitle: 'Drama Queen', desc: 'Send 15 or more chat messages in a single match.', rarity: 'common', category: 'secret', secret: true },
  dj_commander: { id: 'dj_commander', title: 'DJ Commander', commanderTitle: 'DJ', desc: 'Press mute/unmute 15 times in one game.', rarity: 'common', category: 'secret', secret: true },
  napoleonic_mastermind: { id: 'napoleonic_mastermind', title: 'Napoleonic Mastermind', commanderTitle: 'Supreme Leader', desc: 'Win a game on the Napoleonic theme without using Blitz attacks once.', rarity: 'epic', category: 'secret', secret: true },
  pro_vs_creator: { id: 'pro_vs_creator', title: 'Pro vs Game Creator', commanderTitle: 'Hacker', desc: 'Fire a nuke or break a treaty against a commander named Daniel, Dan, Danny, Drqpalzm, or Danilla.', rarity: 'epic', category: 'secret', secret: true },
  suicide_charge: { id: 'suicide_charge', title: 'Suicide Charge', commanderTitle: 'Banzai!', desc: 'Attack a territory with 20+ armies from a territory with only 2 armies.', rarity: 'common', category: 'secret', secret: true },
  main_character_syndrome: { id: 'main_character_syndrome', title: 'Main Character Syndrome', commanderTitle: 'Discord Mod', desc: 'In Anime theme, trigger the 1% attack jumpscare at least twice, have the dance show twice, and win.', rarity: 'legendary', category: 'secret', secret: true }
};

function addXP(account, amount) {
  account.totalXP = (account.totalXP || 0) + amount;
  account.currentXP = (account.currentXP || 0) + amount;
  account.level = account.level || 1;

  while (account.currentXP >= getXPForLevel(account.level)) {
    account.currentXP -= getXPForLevel(account.level);
    account.level += 1;
  }
}

function grantAchievement(username, achId, isEligibleMultiplayer = true, io = null, socketId = null) {
  if (!username || !isEligibleMultiplayer) return null;
  const def = ACHIEVEMENTS[achId];
  if (!def) return null;

  const users = loadUsers();
  const lowerKey = username.trim().toLowerCase();
  const account = users[lowerKey];
  if (!account) return null;

  account.unlockedAchievements = account.unlockedAchievements || [];
  if (account.unlockedAchievements.includes(achId)) return null;

  account.unlockedAchievements.push(achId);
  const xpReward = RARITY_XP[def.rarity] || 50;
  addXP(account, xpReward);
  saveUsers(users);

  // If socket is available, emit unlock notification event to the client immediately
  if (io && socketId) {
    io.to(socketId).emit('achievementUnlocked', {
      achievement: def,
      xpReward,
      newLevel: account.level,
      currentXP: account.currentXP,
      xpNeeded: getXPForLevel(account.level)
    });
  }

  return { achievement: def, xpReward, newLevel: account.level, currentXP: account.currentXP };
}

function register(username, password) {
  const users = loadUsers();
  const cleanName = (username || '').trim();
  const lowerKey = cleanName.toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 20) {
    return { error: 'Username must be between 2 and 20 characters.' };
  }
  if (!password || password.length < 3) {
    return { error: 'Password must be at least 3 characters.' };
  }
  if (users[lowerKey]) {
    return { error: 'An account with that username already exists.' };
  }

  const newAccount = {
    username: cleanName,
    password: password,
    token: `tok_${Math.random().toString(36).substr(2, 12)}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    level: 1,
    currentXP: 0,
    totalXP: 0,
    elo: 1200,
    bio: 'Ready for battle.',
    battleCard: {
      theme: 'default',
      option: 1,
      showcasedBadges: []
    },
    soloStats: createEmptyStats(),
    multiplayerStats: createEmptyStats(),
    unlockedAchievements: [],
    friends: [],
    friendRequests: { sent: [], received: [] },
    directMessages: {}
  };

  users[lowerKey] = newAccount;
  saveUsers(users);
  return { success: true, user: getSafeUser(newAccount) };
}

function updateBio(username, bioText) {
  const users = loadUsers();
  const lowerKey = (username || '').trim().toLowerCase();
  const account = users[lowerKey];
  if (!account) return { error: 'Account not found' };

  account.bio = String(bioText || '').trim().substring(0, 200);
  saveUsers(users);
  return { success: true, bio: account.bio };
}

function login(username, password) {
  const users = loadUsers();
  const lowerKey = (username || '').trim().toLowerCase();
  const account = users[lowerKey];

  if (!account || account.password !== password) {
    return { error: 'Invalid username or password.' };
  }

  account.token = `tok_${Math.random().toString(36).substr(2, 12)}_${Date.now()}`;
  account.lastLogin = new Date().toISOString();
  saveUsers(users);

  return { success: true, user: getSafeUser(account) };
}

function autoLogin(username, token) {
  const users = loadUsers();
  const lowerKey = (username || '').trim().toLowerCase();
  const account = users[lowerKey];

  if (!account || account.token !== token) {
    return { error: 'Session expired. Please log in again.' };
  }

  account.lastLogin = new Date().toISOString();
  saveUsers(users);
  return { success: true, user: getSafeUser(account) };
}

function updateBattleCard(username, cardData = {}) {
  const users = loadUsers();
  const lowerKey = (username || '').trim().toLowerCase();
  const account = users[lowerKey];
  if (!account) return { error: 'Account not found' };

  account.battleCard = account.battleCard || { theme: 'default', option: 1, showcasedBadges: [], equippedTitle: '' };
  if (cardData.theme) account.battleCard.theme = cardData.theme;
  if (cardData.option) account.battleCard.option = Math.max(1, Math.min(3, parseInt(cardData.option) || 1));
  if (cardData.equippedTitle !== undefined) account.battleCard.equippedTitle = String(cardData.equippedTitle || '').trim();
  if (Array.isArray(cardData.showcasedBadges)) {
    const unlocked = account.unlockedAchievements || [];
    account.battleCard.showcasedBadges = cardData.showcasedBadges
      .filter(id => unlocked.includes(id))
      .slice(0, 3);
  }

  saveUsers(users);
  return { success: true, battleCard: account.battleCard };
}

function getSafeUser(account) {
  if (!account) return null;
  const { password, ...safe } = account;
  if (!safe.soloStats) {
    safe.soloStats = safe.lifetimeStats ? { ...createEmptyStats(), ...safe.lifetimeStats } : createEmptyStats();
  }
  if (!safe.multiplayerStats) safe.multiplayerStats = createEmptyStats();
  if (!safe.battleCard) safe.battleCard = { theme: 'default', option: 1, showcasedBadges: [] };
  if (!safe.level) safe.level = 1;
  if (safe.currentXP === undefined) safe.currentXP = 0;
  if (safe.totalXP === undefined) safe.totalXP = 0;
  if (safe.elo === undefined) safe.elo = 1200;
  if (safe.bio === undefined) safe.bio = '';
  if (!safe.unlockedAchievements) safe.unlockedAchievements = [];
  if (!safe.friends) safe.friends = [];
  if (!safe.friendRequests) safe.friendRequests = { sent: [], received: [] };
  if (!safe.friendRequests.sent) safe.friendRequests.sent = [];
  if (!safe.friendRequests.received) safe.friendRequests.received = [];
  if (!safe.directMessages) safe.directMessages = {};
  safe.xpNeeded = getXPForLevel(safe.level);
  return safe;
}

function getAccountStats(username) {
  const users = loadUsers();
  const lowerKey = (username || '').trim().toLowerCase();
  const account = users[lowerKey];
  if (!account) return { error: 'Account not found.' };
  return { success: true, user: getSafeUser(account), allAchievements: ACHIEVEMENTS };
}

function recordMatchFinished(username, stats = {}, isWinner = false, isRunnerUp = false, gameMode = 'conquest', isMultiplayer = false, matchTotals = {}) {
  if (!username) return;
  const users = loadUsers();
  const lowerKey = username.trim().toLowerCase();
  const account = users[lowerKey];
  if (!account) return;

  const targetStats = isMultiplayer ? (account.multiplayerStats = account.multiplayerStats || createEmptyStats())
                                    : (account.soloStats = account.soloStats || createEmptyStats());

  targetStats.matchesPlayed = (targetStats.matchesPlayed || 0) + 1;
  if (isWinner) {
    targetStats.matchesWon = (targetStats.matchesWon || 0) + 1;
    if (gameMode === 'capital_rush') targetStats.capitalRushWins = (targetStats.capitalRushWins || 0) + 1;
    else targetStats.conquestWins = (targetStats.conquestWins || 0) + 1;
  }

  targetStats.territoriesConquered = (targetStats.territoriesConquered || 0) + (stats.territoriesConquered || 0);
  targetStats.territoriesLost = (targetStats.territoriesLost || 0) + (stats.lost || 0);
  targetStats.armiesDrafted = (targetStats.armiesDrafted || 0) + (stats.drafted || 0);
  targetStats.armiesKilled = (targetStats.armiesKilled || 0) + (stats.killed || 0);
  targetStats.armiesLost = (targetStats.armiesLost || 0) + (stats.lost || 0);
  targetStats.betrayalsCommitted = (targetStats.betrayalsCommitted || 0) + (stats.betrayals || 0);
  targetStats.diceRollsCount = (targetStats.diceRollsCount || 0) + (stats.diceRollsCount || 0);
  targetStats.diceRollWins = (targetStats.diceRollWins || 0) + (stats.diceRollWins || 0);

  // Award match XP (applies to multiplayer games)
  const totalMatchKills = Math.max(1, matchTotals.kills || 1);
  const totalMatchConquests = Math.max(1, matchTotals.conquests || 1);
  const totalMatchDeployed = Math.max(1, matchTotals.deployed || 1);

  const playerKills = stats.killed || 0;
  const playerConquests = stats.territoriesConquered || 0;
  const playerDeployed = (stats.drafted || 0) + (stats.startingArmies || 0);

  const killXP = Math.round((playerKills / totalMatchKills) * 100);
  const conquestXP = Math.round((playerConquests / totalMatchConquests) * 100);
  const deployXP = Math.round((playerDeployed / totalMatchDeployed) * 100);

  let placementXP = 0;
  if (isWinner) placementXP = 50;
  else if (isRunnerUp) placementXP = 25;

  const xpGained = killXP + conquestXP + deployXP + placementXP;
  addXP(account, xpGained);

  saveUsers(users);
}

// Zero-Sum Multiplayer Elo Calculator
function calculateAndApplyMultiplayerElo(humanParticipants = []) {
  // humanParticipants: Array of { accountId, rank } where rank 1 = Winner, 2 = Runner-up, etc.
  if (!Array.isArray(humanParticipants) || humanParticipants.length < 2) return;

  const users = loadUsers();
  const K = 32;
  const N = humanParticipants.length;
  const validPlayers = [];

  humanParticipants.forEach(p => {
    if (!p.accountId) return;
    const lowerKey = p.accountId.trim().toLowerCase();
    const acc = users[lowerKey];
    if (acc) {
      acc.elo = acc.elo !== undefined ? acc.elo : 1200;
      validPlayers.push({ account: acc, lowerKey, rank: p.rank, elo: acc.elo, factionId: p.factionId || null });
    }
  });

  if (validPlayers.length < 2) return;

  const eloDeltas = new Array(validPlayers.length).fill(0);

  for (let i = 0; i < validPlayers.length; i++) {
    for (let j = 0; j < validPlayers.length; j++) {
      if (i === j) continue;
      // Teammates share a faction — they never trade rating against each other
      // (teams win or lose together as one unit vs outside factions).
      if (validPlayers[i].factionId && validPlayers[i].factionId === validPlayers[j].factionId) continue;
      const rA = validPlayers[i].elo;
      const rB = validPlayers[j].elo;

      // Expected score of i against j
      const expectedA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
      // Actual score based on final placement
      let actualA = 0.5;
      if (validPlayers[i].rank < validPlayers[j].rank) actualA = 1;
      else if (validPlayers[i].rank > validPlayers[j].rank) actualA = 0;

      eloDeltas[i] += (K / (N - 1)) * (actualA - expectedA);
    }
  }

  // Apply deltas and ensure zero-sum integer rounding
  let sumDelta = 0;
  validPlayers.forEach((p, idx) => {
    const delta = Math.round(eloDeltas[idx]);
    p.account.elo = Math.max(100, p.account.elo + delta);
    if (p.account.multiplayerStats) p.account.multiplayerStats.elo = p.account.elo;
    sumDelta += delta;
  });

  saveUsers(users);
}

function ensureFriendFields(account) {
  if (!account.friends) account.friends = [];
  if (!account.friendRequests) account.friendRequests = { sent: [], received: [] };
  if (!account.friendRequests.sent) account.friendRequests.sent = [];
  if (!account.friendRequests.received) account.friendRequests.received = [];
  if (!account.directMessages) account.directMessages = {};
  if (!account.lastReadDmTime) account.lastReadDmTime = {};
}

function sendFriendRequest(fromUsername, toUsername) {
  const users = loadUsers();
  const fromKey = (fromUsername || '').trim().toLowerCase();
  const toKey = (toUsername || '').trim().toLowerCase();

  if (!fromKey || !toKey) return { error: 'Invalid username.' };
  if (fromKey === toKey) return { error: 'You cannot add yourself as a friend.' };

  const fromUser = users[fromKey];
  const toUser = users[toKey];
  if (!fromUser) return { error: 'Your account was not found.' };
  if (!toUser) return { error: `User "${toUsername}" does not exist.` };

  ensureFriendFields(fromUser);
  ensureFriendFields(toUser);

  if (fromUser.friends.includes(toKey)) {
    return { error: `You are already friends with ${toUser.username}.` };
  }

  // If the other user already sent us a request, automatically accept it!
  if (fromUser.friendRequests.received.includes(toKey)) {
    return respondFriendRequest(fromUsername, toUsername, true);
  }

  if (fromUser.friendRequests.sent.includes(toKey)) {
    return { error: `Friend request already sent to ${toUser.username}.` };
  }

  fromUser.friendRequests.sent.push(toKey);
  toUser.friendRequests.received.push(fromKey);

  saveUsers(users);
  return {
    success: true,
    message: `Friend request sent to ${toUser.username}!`,
    toUser: getSafeUser(toUser)
  };
}

function respondFriendRequest(username, fromUsername, accept) {
  const users = loadUsers();
  const userKey = (username || '').trim().toLowerCase();
  const fromKey = (fromUsername || '').trim().toLowerCase();

  if (!userKey || !fromKey) return { error: 'Invalid username.' };
  const user = users[userKey];
  const otherUser = users[fromKey];
  if (!user || !otherUser) return { error: 'Account not found.' };

  ensureFriendFields(user);
  ensureFriendFields(otherUser);

  // Remove from requests lists
  user.friendRequests.received = user.friendRequests.received.filter(k => k !== fromKey);
  user.friendRequests.sent = user.friendRequests.sent.filter(k => k !== fromKey);
  otherUser.friendRequests.sent = otherUser.friendRequests.sent.filter(k => k !== userKey);
  otherUser.friendRequests.received = otherUser.friendRequests.received.filter(k => k !== userKey);

  if (accept) {
    if (!user.friends.includes(fromKey)) user.friends.push(fromKey);
    if (!otherUser.friends.includes(userKey)) otherUser.friends.push(userKey);
  }

  saveUsers(users);
  return {
    success: true,
    accepted: !!accept,
    user: getSafeUser(user),
    otherUser: getSafeUser(otherUser)
  };
}

function removeFriend(usernameA, usernameB) {
  const users = loadUsers();
  const keyA = (usernameA || '').trim().toLowerCase();
  const keyB = (usernameB || '').trim().toLowerCase();

  if (!keyA || !keyB) return { error: 'Invalid username.' };
  const userA = users[keyA];
  const userB = users[keyB];

  if (userA) {
    ensureFriendFields(userA);
    userA.friends = userA.friends.filter(k => k !== keyB);
    userA.friendRequests.sent = userA.friendRequests.sent.filter(k => k !== keyB);
    userA.friendRequests.received = userA.friendRequests.received.filter(k => k !== keyB);
  }
  if (userB) {
    ensureFriendFields(userB);
    userB.friends = userB.friends.filter(k => k !== keyA);
    userB.friendRequests.sent = userB.friendRequests.sent.filter(k => k !== keyA);
    userB.friendRequests.received = userB.friendRequests.received.filter(k => k !== keyA);
  }

  saveUsers(users);
  return { success: true };
}

function getFriendsData(username) {
  const users = loadUsers();
  const userKey = (username || '').trim().toLowerCase();
  const user = users[userKey];
  if (!user) return { error: 'Account not found.' };

  ensureFriendFields(user);

  const friends = [];
  let totalUnreadDms = 0;
  user.friends.forEach(fKey => {
    const friend = users[fKey];
    if (friend) {
      const dms = user.directMessages[fKey] || [];
      const lastRead = (user.lastReadDmTime && user.lastReadDmTime[fKey]) || 0;
      const unreadCount = dms.filter(m => m.from.toLowerCase() === fKey && (m.createdAt || 0) > lastRead).length;
      totalUnreadDms += unreadCount;
      friends.push({
        username: friend.username,
        level: friend.level || 1,
        elo: friend.elo || 1200,
        bio: friend.bio || '',
        battleCard: friend.battleCard || { theme: 'default', option: 1, showcasedBadges: [] },
        unreadCount
      });
    }
  });

  const receivedRequests = [];
  user.friendRequests.received.forEach(rKey => {
    const reqUser = users[rKey];
    if (reqUser) {
      receivedRequests.push({
        username: reqUser.username,
        level: reqUser.level || 1,
        elo: reqUser.elo || 1200,
        battleCard: reqUser.battleCard || { theme: 'default', option: 1, showcasedBadges: [] }
      });
    }
  });

  const sentRequests = [];
  user.friendRequests.sent.forEach(sKey => {
    const sentUser = users[sKey];
    if (sentUser) {
      sentRequests.push({
        username: sentUser.username,
        level: sentUser.level || 1,
        elo: sentUser.elo || 1200
      });
    }
  });

  return {
    success: true,
    friends,
    receivedRequests,
    sentRequests,
    totalUnreadDms
  };
}

function saveDirectMessage(fromUsername, toUsername, text) {
  const users = loadUsers();
  const fromKey = (fromUsername || '').trim().toLowerCase();
  const toKey = (toUsername || '').trim().toLowerCase();
  const cleanText = String(text || '').trim().slice(0, 500);

  if (!fromKey || !toKey || !cleanText) return { error: 'Invalid message.' };
  const fromUser = users[fromKey];
  const toUser = users[toKey];
  if (!fromUser || !toUser) return { error: 'User not found.' };

  ensureFriendFields(fromUser);
  ensureFriendFields(toUser);

  const msg = {
    id: `dm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    from: fromUser.username,
    to: toUser.username,
    text: cleanText,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now()
  };

  if (!fromUser.directMessages[toKey]) fromUser.directMessages[toKey] = [];
  if (!toUser.directMessages[fromKey]) toUser.directMessages[fromKey] = [];

  fromUser.directMessages[toKey].push(msg);
  toUser.directMessages[fromKey].push(msg);

  // Keep max 50 direct messages per friend pair
  if (fromUser.directMessages[toKey].length > 50) {
    fromUser.directMessages[toKey] = fromUser.directMessages[toKey].slice(-50);
  }
  if (toUser.directMessages[fromKey].length > 50) {
    toUser.directMessages[fromKey] = toUser.directMessages[fromKey].slice(-50);
  }

  saveUsers(users);
  return { success: true, message: msg };
}

function getDirectMessages(usernameA, usernameB) {
  const users = loadUsers();
  const keyA = (usernameA || '').trim().toLowerCase();
  const keyB = (usernameB || '').trim().toLowerCase();

  if (!keyA || !keyB) return { error: 'Invalid usernames.' };
  const userA = users[keyA];
  if (!userA) return { error: 'User not found.' };

  ensureFriendFields(userA);
  userA.lastReadDmTime[keyB] = Date.now();
  saveUsers(users);

  const messages = userA.directMessages[keyB] || [];
  return { success: true, messages };
}

module.exports = {
  ACHIEVEMENTS,
  RARITY_XP,
  register,
  login,
  autoLogin,
  getAccountStats,
  updateBattleCard,
  updateBio,
  grantAchievement,
  recordMatchFinished,
  calculateAndApplyMultiplayerElo,
  getXPForLevel,
  loadUsers,
  getSafeUser,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getFriendsData,
  saveDirectMessage,
  getDirectMessages
};