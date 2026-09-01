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
    diceRollWins: 0
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
  first_blood: { id: 'first_blood', title: 'First Blood', desc: 'Win your first territory attack.', rarity: 'common', category: 'combat' },
  lightning_advance: { id: 'lightning_advance', title: 'Lightning Advance', desc: 'Conquer 5 territories in a single turn.', rarity: 'common', category: 'combat' },
  steamroller: { id: 'steamroller', title: 'Steamroller', desc: 'Conquer 12 territories in a single turn.', rarity: 'rare', category: 'combat' },
  relentless_vanguard: { id: 'relentless_vanguard', title: 'Relentless Vanguard', desc: 'Execute 25 successful attacks in a single match.', rarity: 'common', category: 'combat' },
  clean_sweep: { id: 'clean_sweep', title: 'Clean Sweep', desc: 'Conquer an enemy territory (holding ≥ 5 troops) during a Blitz attack without losing a single troop.', rarity: 'rare', category: 'combat' },
  decisive_strike: { id: 'decisive_strike', title: 'Decisive Strike', desc: 'Wipe an enemy stack of 30+ troops in one turn.', rarity: 'rare', category: 'combat' },
  continent_breaker: { id: 'continent_breaker', title: 'Continent Breaker', desc: 'Attack and conquer an enemy-held continent territory to break their turn bonus.', rarity: 'common', category: 'combat' },
  iron_citadel: { id: 'iron_citadel', title: 'Iron Citadel', desc: 'Successfully defend a territory when outnumbered 3-to-1.', rarity: 'common', category: 'combat' },
  garrison_master: { id: 'garrison_master', title: 'Garrison Master', desc: 'Station 50+ armies on a single territory.', rarity: 'epic', category: 'combat' },
  border_guard: { id: 'border_guard', title: 'Border Guard', desc: 'End 3 consecutive turns without losing a single territory.', rarity: 'rare', category: 'combat' },
  impenetrable_border: { id: 'impenetrable_border', title: 'Impenetrable Border', desc: 'End 5 consecutive turns without losing a single territory.', rarity: 'epic', category: 'combat' },

  // 2. Nuclear Warfare
  manhattan_project: { id: 'manhattan_project', title: 'Manhattan Project', desc: 'Craft your first Tactical Nuke from 3 Risk Cards.', rarity: 'common', category: 'nuclear' },
  i_am_become_death: { id: 'i_am_become_death', title: 'I Am Become Death', desc: 'Assemble and forge a Thermonuclear Weapon from a matching card set.', rarity: 'common', category: 'nuclear' },
  trinity_test: { id: 'trinity_test', title: 'Trinity Test', desc: 'Detonate your first Tactical Nuke on an enemy territory.', rarity: 'common', category: 'nuclear' },
  total_scorched_earth: { id: 'total_scorched_earth', title: 'Total Scorched Earth', desc: 'Vaporize 40+ enemy armies in a single nuclear strike (splash damage counts).', rarity: 'common', category: 'nuclear' },
  nuclear_deterrent: { id: 'nuclear_deterrent', title: 'Nuclear Deterrent', desc: 'Win a match holding 3+ nukes in your inventory without firing any of them.', rarity: 'epic', category: 'nuclear' },
  extinction_protocol: { id: 'extinction_protocol', title: 'Extinction Protocol', desc: 'Eliminate an opponent from the game entirely with a direct nuclear strike.', rarity: 'epic', category: 'nuclear' },
  mutually_assured_destruction: { id: 'mutually_assured_destruction', title: 'Mutually Assured Destruction', desc: 'Launch 3 nukes in one turn.', rarity: 'epic', category: 'nuclear' },
  mass_demilitarization: { id: 'mass_demilitarization', title: 'Mass Demilitarization', desc: 'Devastate a territory garrisoned by ≥ 100 armies down to 0 with a single Tactical Nuke.', rarity: 'epic', category: 'nuclear' },

  // 3. Diplomacy & Treachery
  handshake_protocol: { id: 'handshake_protocol', title: 'Handshake Protocol', desc: 'Sign your first Non-Aggression Pact.', rarity: 'common', category: 'diplomacy' },
  blood_brothers: { id: 'blood_brothers', title: 'Blood Brothers', desc: 'Establish a Full Alliance.', rarity: 'common', category: 'diplomacy' },
  the_coalition: { id: 'the_coalition', title: 'The Coalition', desc: 'Maintain active alliances with 2 or more players at the exact same time.', rarity: 'rare', category: 'diplomacy' },
  et_tu_brute: { id: 'et_tu_brute', title: 'Et Tu, Brute?', desc: 'Break an active Full Alliance by launching a direct attack against your ally.', rarity: 'common', category: 'diplomacy' },
  cold_blooded_backstab: { id: 'cold_blooded_backstab', title: 'Cold-Blooded Backstab', desc: 'Eliminate your former ally within 1 turn of breaking your treaty.', rarity: 'epic', category: 'diplomacy' },
  switzerland: { id: 'switzerland', title: 'Switzerland', desc: 'Win a full multiplayer match without ever breaking a single treaty.', rarity: 'rare', category: 'diplomacy' },
  silver_tongue: { id: 'silver_tongue', title: 'Silver Tongue', desc: 'Get 3 different players to accept your treaty proposals in one match.', rarity: 'rare', category: 'diplomacy' },
  fool_me_twice: { id: 'fool_me_twice', title: 'Fool Me Twice', desc: 'Get betrayed by the same commander twice in a single match.', rarity: 'rare', category: 'diplomacy' },
  the_red_wedding: { id: 'the_red_wedding', title: 'The Red Wedding', desc: "Break a Full Alliance and capture your former ally's Capital on the exact same turn.", rarity: 'epic', category: 'diplomacy' },

  // 4. Capital Rush
  fortified_crown: { id: 'fortified_crown', title: 'Fortified Crown', desc: 'Build a garrison of 60+ armies defending your own Capital city.', rarity: 'epic', category: 'capital' },
  near_death_sovereign: { id: 'near_death_sovereign', title: 'Near-Death Sovereign', desc: 'Win Capital Rush after your own Capital was breached and reclaimed.', rarity: 'rare', category: 'capital' },
  capital_crusher: { id: 'capital_crusher', title: 'Capital Crusher', desc: 'Win a match of Capital Rush.', rarity: 'common', category: 'capital' },
  ground_zero_capital: { id: 'ground_zero_capital', title: 'Ground Zero Capital', desc: "Detonate a Thermonuclear weapon directly on an enemy player's designated Capital in Capital Rush mode.", rarity: 'rare', category: 'capital' },

  // 5. Fog of War
  omniscient_recon: { id: 'omniscient_recon', title: 'Omniscient Recon', desc: 'Achieve line-of-sight of 85% or more of the world map in Fog of War mode.', rarity: 'common', category: 'fow' },
  shared_horizons: { id: 'shared_horizons', title: 'Shared Horizons', desc: 'Gain line-of-sight of 10+ new territories through a Full Alliance.', rarity: 'common', category: 'fow' },

  // 6. Dice Luck & RNG
  blessed_by_rngesus: { id: 'blessed_by_rngesus', title: 'Blessed by RNGesus', desc: 'Roll triple 6s ([6, 6, 6]) during an offensive attack.', rarity: 'rare', category: 'dice' },
  wall_of_steel: { id: 'wall_of_steel', title: 'Wall of Steel', desc: 'Roll double 6s ([6, 6]) on defense.', rarity: 'rare', category: 'dice' },
  snake_eyes_tragedy: { id: 'snake_eyes_tragedy', title: 'Snake Eyes Tragedy', desc: 'Roll all 1s when attacking with 3 dice.', rarity: 'rare', category: 'dice' },
  calculated_risk: { id: 'calculated_risk', title: 'Calculated Risk', desc: 'Win 10 consecutive dice comparisons in a single turn without taking a loss.', rarity: 'epic', category: 'dice' },

  // 7. Cards & Logistics
  card_shark: { id: 'card_shark', title: 'Card Shark', desc: 'Trade in 5 or more complete card sets in a single match.', rarity: 'epic', category: 'cards' },
  forced_liquidation: { id: 'forced_liquidation', title: 'Forced Liquidation', desc: 'Hit the 5-card mandatory ceiling and successfully trade down to 2 or fewer cards before attacking.', rarity: 'rare', category: 'cards' },
  arms_race_escalation: { id: 'arms_race_escalation', title: 'Arms Race Escalation', desc: 'Trigger the 10th progressive card trade-in of a single match.', rarity: 'rare', category: 'cards' },
  jokers_wild: { id: 'jokers_wild', title: "Joker's Wild", desc: 'Trade in a valid set that includes 2 Wildcards.', rarity: 'epic', category: 'cards' },
  matching_soil: { id: 'matching_soil', title: 'Matching Soil', desc: 'Receive the +2 army territory ownership bonus on all 3 cards in a single trade-in.', rarity: 'rare', category: 'cards' },

  // 8. Tactics & Mastery
  multiverse: { id: 'multiverse', title: 'Multiverse', desc: 'Win a scenario map match.', rarity: 'common', category: 'tactics' },
  no_way_home: { id: 'no_way_home', title: 'No Way Home', desc: 'Be eliminated from a match.', rarity: 'common', category: 'tactics' },
  world_dominator: { id: 'world_dominator', title: 'World Dominator', desc: 'Control 100% of the territories on a 40+ province map.', rarity: 'common', category: 'tactics' },
  continent_master: { id: 'continent_master', title: 'Continent Master', desc: 'Control an entire continent.', rarity: 'common', category: 'tactics' },
  mother_russia: { id: 'mother_russia', title: 'Mother Russia', desc: 'Win a game with blizzards enabled.', rarity: 'common', category: 'tactics' },
  rags_to_riches: { id: 'rags_to_riches', title: 'Rags to Riches', desc: 'Capture 90% of the world map within a single turn.', rarity: 'legendary', category: 'tactics' },
  the_silk_road: { id: 'the_silk_road', title: 'The Silk Road', desc: 'Fortify an army stack through 6 or more consecutive allied and owned territories in a single maneuver.', rarity: 'common', category: 'tactics' },
  the_colossus: { id: 'the_colossus', title: 'The Colossus', desc: 'Amass 200 or more troops on a single territory.', rarity: 'legendary', category: 'tactics' },
  human_wave_tactics: { id: 'human_wave_tactics', title: 'Human Wave Tactics', desc: 'Control 200 or more total active troops across the board simultaneously.', rarity: 'epic', category: 'tactics' },
  minmaxing: { id: 'minmaxing', title: 'Minmaxing', desc: "Control less than 20% of the world's territories while commanding more than 80% of all active armies on the board.", rarity: 'epic', category: 'tactics' },
  blitzkrieg_world_tour: { id: 'blitzkrieg_world_tour', title: 'Blitzkrieg World Tour', desc: 'Conquer at least one territory in every continent within a single turn.', rarity: 'epic', category: 'tactics' },
  single_stack_wipeout: { id: 'single_stack_wipeout', title: 'Single-Stack Wipeout', desc: 'Eliminate 2 different players on the exact same turn using the same attacking army stack.', rarity: 'epic', category: 'tactics' },
  the_comeback_kid: { id: 'the_comeback_kid', title: 'The Comeback Kid', desc: 'Win a full campaign after being reduced to only 1 territory.', rarity: 'legendary', category: 'tactics' },
  nuclear_judas: { id: 'nuclear_judas', title: 'Nuclear Judas', desc: 'Launch a missile directly onto a territory owned by your active Full Alliance partner.', rarity: 'rare', category: 'tactics' },

  // 9. Secret Feats
  secret_anime_scroll: { id: 'secret_anime_scroll', title: '( ͡° ͜ʖ ͡°)', desc: 'Scrolled all the way to the bottom of the sidebar under the Anime Kawaii theme.', rarity: 'rare', category: 'secret', secret: true },
  secret_nuclear_bbq: { id: 'secret_nuclear_bbq', title: 'Nuclear Barbecue', desc: 'Fired a Thermonuclear weapon into a territory garrisoned by only 1 defender.', rarity: 'epic', category: 'secret', secret: true },
  secret_choose_already: { id: 'secret_choose_already', title: 'Just Choose Already', desc: 'Switched interface themes 6 or more times in a single turn.', rarity: 'rare', category: 'secret', secret: true }
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
    battleCard: {
      theme: 'default',
      option: 1,
      showcasedBadges: []
    },
    soloStats: createEmptyStats(),
    multiplayerStats: createEmptyStats(),
    unlockedAchievements: []
  };

  users[lowerKey] = newAccount;
  saveUsers(users);
  return { success: true, user: getSafeUser(newAccount) };
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

  account.battleCard = account.battleCard || { theme: 'default', option: 1, showcasedBadges: [] };
  if (cardData.theme) account.battleCard.theme = cardData.theme;
  if (cardData.option) account.battleCard.option = Math.max(1, Math.min(3, parseInt(cardData.option) || 1));
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
  if (!safe.unlockedAchievements) safe.unlockedAchievements = [];
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

  if (isMultiplayer) {
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
  }

  saveUsers(users);
}

module.exports = {
  ACHIEVEMENTS,
  RARITY_XP,
  register,
  login,
  autoLogin,
  getAccountStats,
  updateBattleCard,
  grantAchievement,
  recordMatchFinished,
  getXPForLevel,
  loadUsers,
  getSafeUser
};