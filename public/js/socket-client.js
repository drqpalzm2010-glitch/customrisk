(function() {
  const socket = io({
    transports: ['websocket', 'polling']
  });
  const KEY_MAP = {
    'fogOfWar': 'fw',
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
    'cards': 'ca_hand',
    'zombieMode': 'zm',
    'supplyMode': 'sm',
    'buildingsMode': 'bm',
    'buildings': 'bg'
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
    createRoom: (arg1, arg2, arg3, arg4) => {
      let playerName, playerColor, mapData, callback;
      if (typeof arg1 === 'object' && arg1 !== null && (arg1.territories || arg1.width)) {
        mapData = arg1;
        playerName = arg2;
        playerColor = arg3;
        callback = arg4;
      } else {
        playerName = arg1;
        playerColor = arg2;
        mapData = arg3;
        callback = arg4;
      }

      let accountId = window.SocketClient.currentAccount?.username || null;
      if (!accountId && window.MainController?.currentAccountData?.username) {
        accountId = window.MainController.currentAccountData.username;
      }
      if (!accountId) {
        try {
          const saved = JSON.parse(localStorage.getItem('factional_risk_account') || '{}');
          if (saved && saved.username) accountId = saved.username;
        } catch (e) {}
      }

      socket.emit('createRoom', { mapData, playerName, playerColor, accountId }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
          // Creating a normal lobby room means we occupy a real player slot, not a
          // spectator. Clear any stale spectator flag left over from a previous
          // Watch AI battle / saved-campaign load so player-only features (e.g.
          // nuke crafting) are never silently hidden in a new match.
          window.SocketClient.spectatorMode = false;
        }
        if (callback) callback(response);
      });
    },

    joinRoom: (roomCode, playerName, playerColor, callback) => {
      let accountId = window.SocketClient.currentAccount?.username || null;
      if (!accountId && window.MainController?.currentAccountData?.username) {
        accountId = window.MainController.currentAccountData.username;
      }
      if (!accountId) {
        try {
          const saved = JSON.parse(localStorage.getItem('factional_risk_account') || '{}');
          if (saved && saved.username) accountId = saved.username;
        } catch (e) {}
      }

      socket.emit('joinRoom', { roomCode, playerName, playerColor, accountId }, (response) => {
        if (response.success) {
          window.SocketClient.roomCode = response.roomCode;
          // Joining a real lobby room makes us a player, not a spectator. Clear the
          // spectator flag so player-only features (e.g. nuke crafting) are shown.
          window.SocketClient.spectatorMode = false;
        }
        if (callback) callback(response);
      });
    },

    watchAIBattle: (...args) => {
      // 1. Automatically grab the callback if passed as the last argument
      let callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;

      // 2. Map all positional arguments safely into the payload object
      const [
        mapData, aiCount, gameMode, asNormalMap, disableNations,
        honorPremadeAlliances, disabledNationIds, cardTradeRule,
        generativeAIMode, llmProviderConfig, reqBlizzardCount,
        reqStartingNukes, reqStartingThermonukes, reqAllowCrafting,
        reqZombieMode, reqSupplyMode, reqBuildingsMode
      ] = args;

      const payload = {
        mapData,
        aiCount: aiCount || 4,
        gameMode: gameMode || 'conquest',
        asNormalMap: !!asNormalMap,
        disableNations: !!disableNations,
        honorPremadeAlliances: honorPremadeAlliances !== false,
        disabledNationIds: Array.isArray(disabledNationIds) ? disabledNationIds : [],
        cardTradeRule: cardTradeRule || 'progressive',
        generativeAIMode: !!generativeAIMode,
        llmProviderConfig: llmProviderConfig || null,
        reqBlizzardCount: reqBlizzardCount || 0,
        reqStartingNukes: reqStartingNukes || 0,
        reqStartingThermonukes: reqStartingThermonukes || 0,
        reqAllowCrafting: !!reqAllowCrafting,
        reqZombieMode: !!reqZombieMode,
        reqSupplyMode: !!reqSupplyMode,
        reqBuildingsMode: !!reqBuildingsMode
      };

      socket.emit('watchAIBattle', payload, (response) => {
        if (response && response.success) {
          window.SocketClient.roomCode = response.roomCode;
          window.SocketClient.spectatorMode = true;
        }
        if (typeof callback === 'function') callback(response);
      });
    },

    toggleFogOfWar: (fogOfWar, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('toggleFogOfWar', { roomCode: window.SocketClient.roomCode, fogOfWar }, callback);
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
      const accountId = window.SocketClient.currentAccount?.username || null;
      socket.emit('loadSavedCampaign', { saveData, accountId }, (response) => {
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

    updateTeamMode: (enabled, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('updateTeamMode', { roomCode: window.SocketClient.roomCode, enabled }, callback);
    },

    updateTeams: (teams, callback) => {
      if (!window.SocketClient.roomCode) return callback && callback({ error: 'No room context' });
      socket.emit('updateTeams', { roomCode: window.SocketClient.roomCode, teams }, callback);
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

    startGame: (arg1, arg2) => {
      if (!window.SocketClient.roomCode) {
        const cb = typeof arg1 === 'function' ? arg1 : (typeof arg2 === 'function' ? arg2 : null);
        return cb && cb({ error: 'No room context' });
      }
      // Back-compat signature shift: startGame(callback) or
      // startGame(nuclearSettings, callback)
      let nuclearSettings = null;
      let callback = null;
      if (typeof arg1 === 'function') {
        callback = arg1;
      } else if (arg1 && typeof arg1 === 'object') {
        nuclearSettings = arg1;
        callback = typeof arg2 === 'function' ? arg2 : null;
      } else if (typeof arg2 === 'function') {
        callback = arg2;
      }
      socket.emit('startGame', { roomCode: window.SocketClient.roomCode, nuclearSettings }, callback);
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

    sendMessage: (text, chatType, targetId) => {
      if (!window.SocketClient.roomCode) return;
      socket.emit('sendMessage', { roomCode: window.SocketClient.roomCode, text, chatType: chatType || 'global', targetId });
    },

    // Group Chat Methods
    createGroupChat: (groupName, callback) => {
      socket.emit('createGroupChat', { groupName, username: window.SocketClient.currentAccount?.username }, callback);
    },

    joinGroupChat: (groupId, callback) => {
      socket.emit('joinGroupChat', { groupId, username: window.SocketClient.currentAccount?.username }, callback);
    },

    leaveGroupChat: (groupId, callback) => {
      socket.emit('leaveGroupChat', { groupId, username: window.SocketClient.currentAccount?.username }, callback);
    },

    sendGroupMessage: (groupId, text, callback) => {
      socket.emit('sendGroupMessage', { groupId, username: window.SocketClient.currentAccount?.username, text }, callback);
    },

    getGroupChats: (callback) => {
      socket.emit('getGroupChats', { username: window.SocketClient.currentAccount?.username }, callback);
    },

    addMemberToGroup: (groupId, newMember, callback) => {
      socket.emit('addMemberToGroup', { groupId, username: window.SocketClient.currentAccount?.username, newMember }, callback);
    },

    onGroupChatMessage: (callback) => {
      socket.on('groupChatMessage', callback);
    },

    onGroupChatJoined: (callback) => {
      socket.on('groupChatJoined', callback);
    },

    onGroupChatMemberLeft: (callback) => {
      socket.on('groupChatMemberLeft', callback);
    },

    onGroupChatMemberJoined: (callback) => {
      socket.on('groupChatMemberJoined', callback);
    },

    // Account System
    currentAccount: null,

    registerAccount: (username, password, callback) => {
      socket.emit('accountRegister', { username, password }, (res) => {
        if (res.success) {
          window.SocketClient.currentAccount = res.user;
          localStorage.setItem('factional_risk_account', JSON.stringify({ username: res.user.username, token: res.user.token }));
        }
        if (callback) callback(res);
      });
    },

    loginAccount: (username, password, callback) => {
      socket.emit('accountLogin', { username, password }, (res) => {
        if (res.success) {
          window.SocketClient.currentAccount = res.user;
          localStorage.setItem('factional_risk_account', JSON.stringify({ username: res.user.username, token: res.user.token }));
        }
        if (callback) callback(res);
      });
    },

    autoLoginAccount: (username, token, callback) => {
      socket.emit('accountAutoLogin', { username, token }, (res) => {
        if (res.success) {
          window.SocketClient.currentAccount = res.user;
        } else {
          localStorage.removeItem('factional_risk_account');
        }
        if (callback) callback(res);
      });
    },

    getAccountStats: (username, callback) => {
      socket.emit('getAccountStats', { username }, callback);
    },
    
    updateBattleCard: (battleCard, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('updateBattleCard', { username, battleCard }, (res) => {
        if (res.success && window.SocketClient.currentAccount) {
          window.SocketClient.currentAccount.battleCard = res.battleCard;
        }
        if (callback) callback(res);
      });
    },

    updateBio: (bio, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('updateBio', { username, bio }, (res) => {
        if (res.success && window.SocketClient.currentAccount) {
          window.SocketClient.currentAccount.bio = res.bio;
        }
        if (callback) callback(res);
      });
    },

    triggerSecretAchievement: (achId, proof, callback) => {
      // NOTE: No roomCode requirement here. Map-editor achievements
      // (cartographer, worldbuilder, geopolitical_mastermind) are earned from
      // the main menu where no room exists, and the server handler already
      // treats roomCode as optional and validates every trigger itself.
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('triggerSecretAchievement', { roomCode: window.SocketClient.roomCode || null, username, achId, proof }, callback);
    },

    logoutAccount: () => {
      const username = window.SocketClient.currentAccount?.username;
      if (username) {
        socket.emit('userLogout', { username });
      }
      window.SocketClient.currentAccount = null;
      localStorage.removeItem('factional_risk_account');
    },

    // Friend System API
    registerOnline: (callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('userRegisterOnline', { username }, callback);
    },

    getFriends: (callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('getFriends', { username }, callback);
    },

    sendFriendRequest: (toUsername, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('friendSendRequest', { username, toUsername }, callback);
    },

    respondFriendRequest: (fromUsername, accept, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('friendRespond', { username, fromUsername, accept }, callback);
    },

    removeFriend: (friendUsername, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('friendRemove', { username, friendUsername }, callback);
    },

    sendDirectMessage: (toUsername, text, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('sendDirectMessage', { username, toUsername, text }, callback);
    },

    getDirectMessages: (toUsername, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('getDirectMessages', { username, toUsername }, callback);
    },

    inviteFriendToLobby: (toUsername, roomCode, callback) => {
      const username = window.SocketClient.currentAccount?.username;
      if (!username) return callback && callback({ error: 'Not logged in' });
      socket.emit('inviteFriendToLobby', { username, toUsername, roomCode }, callback);
    },

    onFriendRequestReceived: (callback) => {
      socket.on('friendRequestReceived', callback);
    },

    onFriendRequestResolved: (callback) => {
      socket.on('friendRequestResolved', callback);
    },

    onFriendPresenceUpdate: (callback) => {
      socket.on('friendPresenceUpdate', callback);
    },

    onDirectMessageReceived: (callback) => {
      socket.on('directMessageReceived', callback);
    },

    onLobbyInviteReceived: (callback) => {
      socket.on('lobbyInviteReceived', callback);
    },

    onFriendRemoved: (callback) => {
      socket.on('friendRemoved', callback);
    },
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
        try {
          callback(decompressState(compressedState));
        } catch (err) {
          // A failed decompress/apply must never kill the socket listener for
          // all future updates — log and keep the connection alive.
          console.error('[SocketClient] gameStateUpdate handling error:', err);
        }
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
