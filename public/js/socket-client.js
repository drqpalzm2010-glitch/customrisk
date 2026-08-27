(function() {
  const socket = io();

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

  const REVERSE_KEY_MAP = {};
  for (const [key, value] of Object.entries(KEY_MAP)) {
    REVERSE_KEY_MAP[value] = key;
  }

  function decompressState(state) {
    if (!state || typeof state !== 'object') return state;
    if (Array.isArray(state)) {
      return state.map(decompressState);
    }
    const decompressed = {};
    for (const [key, val] of Object.entries(state)) {
      const longKey = REVERSE_KEY_MAP[key] || key;
      decompressed[longKey] = decompressState(val);
    }
    return decompressed;
  }

  // Expose socket and wrapper functions to the window
  window.SocketClient = {
    socket,
    roomCode: null,

    // Emitters
    createRoom: (playerName, playerColor, mapData, callback) => {
      socket.emit('createRoom', { mapData, playerName, playerColor }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
        }
        callback(response);
      });
    },

    joinRoom: (roomCode, playerName, playerColor, callback) => {
      socket.emit('joinRoom', { roomCode, playerName, playerColor }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
        }
        callback(response);
      });
    },

    watchAIBattle: (mapData, aiCount, gameMode, asNormalMap, disableNations, honorPremadeAlliances, disabledNationIds, cardTradeRule, generativeAIMode, llmProviderConfig, reqBlizzardCount, reqStartingNukes, reqStartingThermonukes, reqAllowCrafting, callback) => {
      if (typeof gameMode === 'function') {
        callback = gameMode;
        gameMode = 'conquest';
        asNormalMap = false;
        disableNations = false;
        honorPremadeAlliances = true;
        disabledNationIds = [];
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof asNormalMap === 'function') {
        callback = asNormalMap;
        asNormalMap = false;
        disableNations = false;
        honorPremadeAlliances = true;
        disabledNationIds = [];
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof disableNations === 'function') {
        callback = disableNations;
        disableNations = false;
        honorPremadeAlliances = true;
        disabledNationIds = [];
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof honorPremadeAlliances === 'function') {
        callback = honorPremadeAlliances;
        honorPremadeAlliances = true;
        disabledNationIds = [];
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof disabledNationIds === 'function') {
        callback = disabledNationIds;
        disabledNationIds = [];
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof cardTradeRule === 'function') {
        callback = cardTradeRule;
        cardTradeRule = 'progressive';
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof generativeAIMode === 'function') {
        callback = generativeAIMode;
        generativeAIMode = false;
        llmProviderConfig = null;
      } else if (typeof llmProviderConfig === 'function') {
        callback = llmProviderConfig;
        llmProviderConfig = null;
      }
      socket.emit('watchAIBattle', { mapData, aiCount, gameMode, asNormalMap, disableNations, honorPremadeAlliances, disabledNationIds, cardTradeRule, generativeAIMode, llmProviderConfig, reqBlizzardCount, reqStartingNukes, reqStartingThermonukes, reqAllowCrafting }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
          window.SocketClient.spectatorMode = true;
        }
        if (typeof callback === 'function') callback(response);
      });
    },

    changeCardTradeRule: (cardTradeRule, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('changeCardTradeRule', { roomCode: window.SocketClient.roomCode, cardTradeRule }, callback);
    },

    toggleGenerativeAIMode: (generativeAIMode, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('toggleGenerativeAIMode', { roomCode: window.SocketClient.roomCode, generativeAIMode }, callback);
    },

    executeLLMAction: (action, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('executeLLMAction', { roomCode: window.SocketClient.roomCode, action }, callback);
    },

    forceSkipTurn: (callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('forceSkipTurn', { roomCode: window.SocketClient.roomCode }, callback);
    },

    configureLLMProvider: (provider, model, apiKey, baseURL, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('configureLLMProvider', { roomCode: window.SocketClient.roomCode, provider, model, apiKey, baseURL }, callback);
    },

    changeLLMDelay: (delay, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('changeLLMDelay', { roomCode: window.SocketClient.roomCode, delay }, callback);
    },

    togglePauseGame: (callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('togglePauseGame', { roomCode: window.SocketClient.roomCode }, callback);
    },

    askAIAdvisor: (callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('askAIAdvisor', { roomCode: window.SocketClient.roomCode }, callback);
    },

    loadSavedCampaign: (saveData, callback) => {
      socket.emit('loadSavedCampaign', { saveData }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
          window.SocketClient.mapData = response.mapData;
        }
        callback(response);
      });
    },

    toggleNormalMapRules: (asNormalMap, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('toggleNormalMapRules', { roomCode: window.SocketClient.roomCode, asNormalMap }, callback);
    },

    toggleDisableNations: (disableNations, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('toggleDisableNations', { roomCode: window.SocketClient.roomCode, disableNations }, callback);
    },

    togglePremadeAlliances: (honorPremadeAlliances, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('togglePremadeAlliances', { roomCode: window.SocketClient.roomCode, honorPremadeAlliances }, callback);
    },

    toggleSpecificNation: (nationId, disable, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('toggleSpecificNation', { roomCode: window.SocketClient.roomCode, nationId, disable }, callback);
    },

    updateNuclearSettings: (blizzardCount, startingNukes, startingThermonukes, allowCrafting, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('updateNuclearSettings', { roomCode: window.SocketClient.roomCode, blizzardCount, startingNukes, startingThermonukes, allowCrafting }, callback);
    },

    craftNuke: (cardIndices, isThermo, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('craftNuke', { roomCode: window.SocketClient.roomCode, cardIndices, isThermo }, callback);
    },

    fireNuke: (sourceId, targetId, isThermo, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('fireNuke', { roomCode: window.SocketClient.roomCode, sourceId, targetId, isThermo }, callback);
    },
changePlayerColor: (targetPlayerId, newColor, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('changePlayerColor', { roomCode: window.SocketClient.roomCode, targetPlayerId, newColor }, callback);
    },

    togglePlayerLLM: (targetPlayerId, isLLM, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('togglePlayerLLM', { roomCode: window.SocketClient.roomCode, targetPlayerId, isLLM }, callback);
    },

    changeAIPersonality: (targetPlayerId, newPersonality, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('changeAIPersonality', { roomCode: window.SocketClient.roomCode, targetPlayerId, newPersonality }, callback);
    },
    addAI: (name, color, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('addAI', { roomCode: window.SocketClient.roomCode, name, color }, callback);
    },

    startGame: (callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('startGame', { roomCode: window.SocketClient.roomCode }, callback);
    },

    selectNation: (nationId, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('selectNation', { roomCode: window.SocketClient.roomCode, nationId }, callback);
    },

    updateGameMode: (mode, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('updateGameMode', { roomCode: window.SocketClient.roomCode, mode }, callback);
    },

    changeAISpeed: (speed, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('changeAISpeed', { roomCode: window.SocketClient.roomCode, speed }, callback);
    },

    selectCapital: (territoryId, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('selectCapital', { roomCode: window.SocketClient.roomCode, territoryId }, callback);
    },

    placeTroops: (territoryId, amount, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('placeTroops', { roomCode: window.SocketClient.roomCode, territoryId, amount }, callback);
    },

    syncGameState: (callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('syncGameState', { roomCode: window.SocketClient.roomCode }, callback);
    },

    attack: (sourceId, targetId, diceCount, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('attack', { roomCode: window.SocketClient.roomCode, sourceId, targetId, diceCount }, callback);
    },

    blitzAttack: (sourceId, targetId, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('blitzAttack', { roomCode: window.SocketClient.roomCode, sourceId, targetId }, callback);
    },

    postAttackMove: (amount, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('postAttackMove', { roomCode: window.SocketClient.roomCode, amount }, callback);
    },

    toggleAutoDefend: (enabled, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('toggleAutoDefend', { roomCode: window.SocketClient.roomCode, enabled }, callback);
    },

    toggleAIBlitz: (enabled, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('toggleAIBlitz', { roomCode: window.SocketClient.roomCode, enabled }, callback);
    },

    resolveDefense: (diceCount, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('resolveDefense', { roomCode: window.SocketClient.roomCode, diceCount }, callback);
    },

    fortify: (sourceId, targetId, amount, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('fortify', { roomCode: window.SocketClient.roomCode, sourceId, targetId, amount }, callback);
    },

    endPhase: (callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('endPhase', { roomCode: window.SocketClient.roomCode }, callback);
    },

    tradeCards: (cardIndices, targetTerritoryId, callback) => {
      if (typeof targetTerritoryId === 'function') {
        callback = targetTerritoryId;
        targetTerritoryId = null;
      }
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('tradeCards', { roomCode: window.SocketClient.roomCode, cardIndices, targetTerritoryId }, callback);
    },

    tradeAllCards: (targetTerritoryId, callback) => {
      if (typeof targetTerritoryId === 'function') {
        callback = targetTerritoryId;
        targetTerritoryId = null;
      }
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('tradeAllCards', { roomCode: window.SocketClient.roomCode, targetTerritoryId }, callback);
    },

    requestTimelapseHistory: (callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('requestTimelapseHistory', { roomCode: window.SocketClient.roomCode }, callback);
    },

    proposePact: (targetPlayerId, pactType, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('proposePact', { roomCode: window.SocketClient.roomCode, targetPlayerId, pactType }, callback);
    },

    respondDiplomacy: (proposalId, accept, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('respondDiplomacy', { roomCode: window.SocketClient.roomCode, proposalId, accept }, callback);
    },

    breakPact: (opponentId, callback) => {
      if (!window.SocketClient.roomCode) return callback({ error: 'No room context' });
      socket.emit('breakPact', { roomCode: window.SocketClient.roomCode, opponentId }, callback);
    },

    sendMessage: (text) => {
      if (!window.SocketClient.roomCode) return;
      socket.emit('sendMessage', { roomCode: window.SocketClient.roomCode, text });
    },

    // Global Listeners setup
    onPlayersUpdate: (callback) => {
      socket.on('playersUpdate', callback);
    },

    onGameStarted: (callback) => {
      socket.on('gameStarted', (data) => {
        if (data && data.gameState) {
          data.gameState = decompressState(data.gameState);
        }
        callback(data);
      });
    },

    onFireNuclearMissileEvent: (callback) => {
      socket.on('fireNuclearMissileEvent', (data) => callback(data));
    },

    onGameStateUpdate: (callback) => {
      socket.on('gameStateUpdate', (compressedState) => {
        callback(decompressState(compressedState));
      });
    },

    onDiplomacyReceived: (callback) => {
      socket.on('diplomacyReceived', callback);
    },

    onChatMessage: (callback) => {
      socket.on('chatMessage', callback);
    },

    onLobbySettingsUpdate: (callback) => {
      socket.on('lobbySettingsUpdate', callback);
    },

    onRoomStateUpdate: (callback) => {
      socket.on('roomStateUpdate', callback);
    }
  };
})();
