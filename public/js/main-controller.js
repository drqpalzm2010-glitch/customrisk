(function() {

  // Default campaign map in case host doesn't upload a custom one
  const DEFAULT_MAP = {
    mapName: "Standard Skirmish",
    width: 1000,
    height: 600,
    territories: [
      { id: "t1", name: "Redwood Valley", points: [[80,80], [280,80], [280,260], [80,260]], center: [180, 170] },
      { id: "t2", name: "Whispering Peaks", points: [[280,80], [480,80], [480,260], [280,260]], center: [380, 170] },
      { id: "t3", name: "Glimmering Shore", points: [[80,260], [480,260], [480,480], [80,480]], center: [280, 370] },
      { id: "t4", name: "Emerald Forest", points: [[520,80], [720,80], [720,260], [520,260]], center: [620, 170] },
      { id: "t5", name: "Golden Plains", points: [[720,80], [920,80], [920,260], [720,260]], center: [820, 170] },
      { id: "t6", name: "Dread Marsh", points: [[520,260], [920,260], [920,480], [520,480]], center: [720, 370] }
    ],
    connections: [
      ["t1", "t2"], ["t1", "t3"], ["t2", "t3"],
      ["t4", "t5"], ["t4", "t6"], ["t5", "t6"],
      { from: "t3", to: "t6", type: "sea" }
    ],
    continents: [
      { id: "c1", name: "Western Outpost", bonus: 2, color: "#ff3366", territoryIds: ["t1", "t2", "t3"] },
      { id: "c2", name: "Eastern Empire", bonus: 2, color: "#33ff66", territoryIds: ["t4", "t5", "t6"] }
    ]
  };

  class MainController {
    constructor() {
      this.playerName = 'Commander';
      this.playerColor = '#00e5ff';
      this.selectedMap = DEFAULT_MAP;
      this.watchAiMap = null;
      
      this.gameClient = new window.GameClient();
      this.mapEditor = new window.MapEditor();

      this.mapTheme = localStorage.getItem('map-theme') || 'default';
      this.initAudio();
      this.setMapTheme(this.mapTheme);

      this.initMenu();
      this.initAccountUI();
      this.initFriendsUI();
      this.initLobby();
      this.initInfoTips();
    }

    showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const active = document.getElementById(`screen-${screenId}`);
      if (active) active.classList.add('active');
      if (screenId === 'menu') {
        this.renderWatchAINationsUI();
      } else if (screenId === 'lobby') {
        this.updateLobbyScenarioUI();
      }
    }

    joinRoomByCode(code) {
      const cleanCode = (code || '').trim().toUpperCase();
      if (cleanCode.length !== 4) {
        showToast('Room code must be exactly 4 letters.', 'warning');
        return;
      }

      // Close all modals immediately
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

      const inputCode = document.getElementById('input-room-code');
      if (inputCode) inputCode.value = cleanCode;

      const pName = (this.currentAccountData && this.currentAccountData.username) || this.playerName || 'Commander';
      const pColor = this.playerColor || '#00e5ff';

      window.SocketClient.joinRoom(cleanCode, pName, pColor, (res) => {
        if (res.error) {
          showToast(`Unable to join room ${cleanCode}: ${res.error}`, 'error');
        } else {
          window.SocketClient.mapData = res.mapData;
          this.selectedMap = res.mapData;
          if (res.status === 'PLAYING') {
            this.showScreen('game');
            this.gameClient.startCampaign(this.selectedMap, res.gameState);
          } else {
            this.showScreen('lobby');
            this.updateLobbyUI(res.players, false, res.roomCode);
            this.renderLobbyPreview();
            
            // Set game mode values
            const modeSelect = document.getElementById('lobby-game-mode');
            if (modeSelect) modeSelect.value = res.gameMode || 'conquest';
            const lblMode = document.getElementById('lbl-lobby-mode-name');
            if (lblMode) {
              lblMode.textContent = res.gameMode === 'capital_rush' ? 'Capital Rush' : 'Conquest';
            }
          }
          showToast(`<i class="fa-solid fa-circle-check"></i> Connected to campaign lobby ${res.roomCode}!`, 'success');
        }
      });
    }

    initMenu() {
      // Color presets selection
      const presets = document.querySelectorAll('.color-preset');
      const customColorPicker = document.getElementById('input-player-color');

      presets.forEach(p => {
        p.addEventListener('click', () => {
          presets.forEach(pr => pr.classList.remove('active'));
          p.classList.add('active');
          this.playerColor = p.dataset.color;
          customColorPicker.value = this.playerColor;
        });
      });

      customColorPicker.addEventListener('input', (e) => {
        presets.forEach(pr => pr.classList.remove('active'));
        this.playerColor = e.target.value;
      });

      // Player name
      const nameInput = document.getElementById('input-player-name');
      nameInput.value = this.playerName;
      nameInput.addEventListener('input', (e) => {
        this.playerName = e.target.value.trim() || 'Commander';
      });

      // Create lobby button — opens map selection (default / earth / upload)
      document.getElementById('btn-create-lobby').addEventListener('click', async () => {
        const choice = await this.showMapSelectionModal();
        if (!choice) return; // modal cancelled

        if (choice === 'upload') {
          this.promptUploadMap();
          return;
        }
        if (choice === 'earth') {
          this.launchWithBuiltInMap('earth_map.json');
          return;
        }

        // Default skirmish
        this.selectedMap = DEFAULT_MAP;
        window.SocketClient.mapData = DEFAULT_MAP;
        this.createLobbyRoom();
      });

      // Join lobby button & input
      const inputRoomCode = document.getElementById('input-room-code');
      const btnJoinLobby = document.getElementById('btn-join-lobby');
      if (btnJoinLobby && inputRoomCode) {
        btnJoinLobby.addEventListener('click', () => {
          this.joinRoomByCode(inputRoomCode.value);
        });
        inputRoomCode.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            this.joinRoomByCode(inputRoomCode.value);
          }
        });
      }

      // Bind Map Theme selectors across screens
      ['select-menu-theme', 'select-game-theme', 'select-editor-theme', 'select-lobby-theme'].forEach(id => {
        const selectEl = document.getElementById(id);
        if (selectEl) {
          selectEl.value = this.mapTheme;
          selectEl.addEventListener('change', (e) => {
            this.setMapTheme(e.target.value);
          });
        }
      });

      // Lobby AI Speed control
      const lobbyAiSpeedSelect = document.getElementById('lobby-ai-speed');
      if (lobbyAiSpeedSelect) {
        lobbyAiSpeedSelect.addEventListener('change', (e) => {
          window.SocketClient.changeAISpeed(e.target.value, () => {});
        });
      }

      // LLM Provider UI Toggle & Sync
      const selectLlmProvider = document.getElementById('select-llm-provider');
      const llmApiKeyBox = document.getElementById('llm-api-key-box');
      const inputLlmApiKey = document.getElementById('input-llm-api-key');
      const savedApiKey = localStorage.getItem('llm_api_key') || '';
      if (inputLlmApiKey && savedApiKey) {
        inputLlmApiKey.value = savedApiKey;
      }

      const syncLLMProviderConfig = () => {
        if (!selectLlmProvider) return;
        const provider = selectLlmProvider.value;
        if (llmApiKeyBox) {
          llmApiKeyBox.style.display = provider === 'clipboard' ? 'none' : 'block';
        }
        const apiKey = inputLlmApiKey ? inputLlmApiKey.value.trim() : '';
        if (apiKey) {
          localStorage.setItem('llm_api_key', apiKey);
        }
        if (window.SocketClient.roomCode) {
          window.SocketClient.configureLLMProvider(provider, '', apiKey, '', () => {});
        }
      };

      if (selectLlmProvider) selectLlmProvider.addEventListener('change', syncLLMProviderConfig);
      if (inputLlmApiKey) inputLlmApiKey.addEventListener('input', syncLLMProviderConfig);

      const selectLlmDelay = document.getElementById('select-llm-delay');
      if (selectLlmDelay) {
        selectLlmDelay.addEventListener('change', (e) => {
          if (window.SocketClient.roomCode) {
            window.SocketClient.changeLLMDelay(e.target.value, () => {});
          }
        });
      }

      // Watch AI Battle controls
      let watchAiMap = null; // null = use DEFAULT_MAP

      const syncWatchAILobbyUI = () => {
        const disableNations = document.getElementById('chk-watch-ai-disable-nations')?.checked;
        const asNormal = document.getElementById('chk-watch-ai-as-normal')?.checked;
        const disableOptions = disableNations || asNormal;
        
        // Hide Blizzard options if blizzards are incompatible (e.g. if map rules are disabled, etc.)
        const blizzardBox = document.getElementById('watch-ai-nations-container');
        // Any custom sync can go here
      };

      const aiCountSlider = document.getElementById('input-ai-count');
      const aiCountLabel = document.getElementById('lbl-ai-count');
      if (aiCountSlider && aiCountLabel) {
        aiCountSlider.addEventListener('input', () => {
          aiCountLabel.textContent = aiCountSlider.value;
        });
      }

      // Watch AI map upload
      const watchMapInput = document.getElementById('watch-ai-map-upload');
      const watchMapLabel = document.getElementById('lbl-watch-ai-map');
      if (watchMapInput && watchMapLabel) {
        watchMapInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              let data = JSON.parse(evt.target.result);
              if (data && !data.territories && data.mapData && data.mapData.territories) {
                if (data.gameState) {
                  data.mapData.gameState = data.gameState;
                }
                data = data.mapData;
              }
              if (data && data.territories && data.territories.length > 0) {
                this.watchAiMap = data;
                watchMapLabel.textContent = file.name.replace('.json', '');
                this.renderWatchAINationsUI();
              } else {
                alert('Invalid map file — no territories found.');
                watchMapInput.value = '';
              }
            } catch {
              alert('Could not parse map file. Make sure it\'s a valid .json from the Map Editor.');
              watchMapInput.value = '';
            }
          };
          reader.readAsText(file);
        });
      }

      // Load & Resume Saved Campaign (.json)
      const saveFileInput = document.getElementById('input-savegame-upload');
      if (saveFileInput) {
        saveFileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const saveData = JSON.parse(evt.target.result);
              if (!saveData || !saveData.mapData || !saveData.gameState) {
                alert('Invalid campaign save file format.');
                saveFileInput.value = '';
                return;
              }

              window.SocketClient.loadSavedCampaign(saveData, (res) => {
                if (res.error) {
                  alert(res.error);
                } else {
                  window.SocketClient.mapData = res.mapData;
                  window.SocketClient.roomCode = res.roomCode;
                  window.SocketClient.spectatorMode = !!res.spectatorMode;
                  this.selectedMap = res.mapData;
                  this.showScreen('game');
                  this.gameClient.startCampaign(res.mapData, res.gameState);
                }
                saveFileInput.value = '';
              });
            } catch (err) {
              console.error(err);
              alert('Could not read or parse save file.');
              saveFileInput.value = '';
            }
          };
          reader.readAsText(file);
        });
      }

      // Watch AI Battle Generative Provider UI Sync
      const watchAiGenerativeChk = document.getElementById('chk-watch-ai-generative');
      const watchAiLlmContainer = document.getElementById('watch-ai-llm-api-container');
      const watchAiLlmProvider = document.getElementById('select-watch-ai-llm-provider');
      const watchAiLlmKeyBox = document.getElementById('watch-ai-llm-api-key-box');
      const watchAiLlmKeyInput = document.getElementById('input-watch-ai-llm-api-key');

      if (watchAiLlmKeyInput && savedApiKey) {
        watchAiLlmKeyInput.value = savedApiKey;
      }
      if (watchAiLlmKeyInput) {
        watchAiLlmKeyInput.addEventListener('input', () => {
          const val = watchAiLlmKeyInput.value.trim();
          if (val) localStorage.setItem('llm_api_key', val);
        });
      }

      if (watchAiGenerativeChk) {
        watchAiGenerativeChk.addEventListener('change', (e) => {
          if (watchAiLlmContainer) watchAiLlmContainer.style.display = e.target.checked ? 'block' : 'none';
        });
      }
      if (watchAiLlmProvider) {
        watchAiLlmProvider.addEventListener('change', (e) => {
          if (watchAiLlmKeyBox) watchAiLlmKeyBox.style.display = e.target.value === 'clipboard' ? 'none' : 'block';
        });
      }

      document.getElementById('btn-watch-ai').addEventListener('click', () => {
        const aiCount = parseInt(document.getElementById('input-ai-count').value) || 4;
        const modeSelect = document.getElementById('select-watch-ai-mode');
        const selectedMode = modeSelect ? modeSelect.value : 'auto';
        const asNormalChk = document.getElementById('chk-watch-ai-as-normal');
        const asNormal = asNormalChk ? asNormalChk.checked : false;
        const disableNationsChk = document.getElementById('chk-watch-ai-disable-nations');
        const disableNations = disableNationsChk ? disableNationsChk.checked : false;
        const premadeAlliancesChk = document.getElementById('chk-watch-ai-premade-alliances');
        const honorPremadeAlliances = premadeAlliancesChk ? premadeAlliancesChk.checked : true;

        const disabledNationIds = [];
        document.querySelectorAll('.chk-watch-ai-specific-nation').forEach(chk => {
          if (!chk.checked) disabledNationIds.push(chk.getAttribute('data-id'));
        });

        const cardRuleSelect = document.getElementById('select-watch-ai-card-rule');
        const cardTradeRule = cardRuleSelect ? cardRuleSelect.value : 'progressive';

        const generativeChk = document.getElementById('chk-watch-ai-generative');
        const generativeAIMode = generativeChk ? generativeChk.checked : false;

        const watchAiLlmProvider = document.getElementById('select-watch-ai-llm-provider');
        const watchAiLlmKey = document.getElementById('input-watch-ai-llm-api-key');

        const llmProviderConfig = {
          provider: watchAiLlmProvider ? watchAiLlmProvider.value : 'clipboard',
          apiKey: watchAiLlmKey ? watchAiLlmKey.value.trim() : ''
        };

        const map = this.watchAiMap || this.selectedMap || window.SocketClient.mapData;
        const reqBlizzardCount = parseInt(document.getElementById('input-watch-ai-blizzard-count')?.value) || 0;
        const reqStartingNukes = parseInt(document.getElementById('input-watch-ai-starting-nukes')?.value) || 0;
        const reqStartingThermonukes = parseInt(document.getElementById('input-watch-ai-starting-thermonukes')?.value) || 0;
        const reqAllowCrafting = !!document.getElementById('chk-watch-ai-allow-crafting')?.checked;

        // Read the 3 new mode checkboxes:
        const reqZombieMode = !!document.getElementById('chk-watch-ai-zombies')?.checked;
        const reqSupplyMode = !!document.getElementById('chk-watch-ai-supply')?.checked;
        const reqBuildingsMode = !!document.getElementById('chk-watch-ai-buildings')?.checked;

        window.SocketClient.watchAIBattle(
          map, 
          aiCount, 
          selectedMode, 
          asNormal, 
          disableNations, 
          honorPremadeAlliances, 
          disabledNationIds, 
          cardTradeRule, 
          generativeAIMode, 
          llmProviderConfig, 
          reqBlizzardCount, 
          reqStartingNukes, 
          reqStartingThermonukes, 
          reqAllowCrafting,
          reqZombieMode,
          reqSupplyMode,
          reqBuildingsMode,
          (res) => {
            if (res.error) { alert(res.error); return; }

            window.SocketClient.mapData = res.mapData;
            this.showScreen('game');

            const oldBanner = document.getElementById('spectator-banner');
            if (oldBanner) oldBanner.remove();

            const banner = document.createElement('div');
            banner.className = 'spectator-banner';
            banner.id = 'spectator-banner';
            banner.innerHTML = `
              <i class="fa-solid fa-eye"></i> SPECTATOR MODE — Watching AI Battle
              <span style="margin-left: 15px; font-weight: 500; font-size: 12px; color: #fff; opacity: 0.9;">Game Speed:</span>
              <select id="select-spectator-speed" style="background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; margin-left: 6px; outline: none;">
                <option value="1000">1.0x (Normal)</option>
                <option value="400">2.5x (Fast)</option>
                <option value="100">10.0x (Blazing)</option>
                <option value="20">50.0x (Instant)</option>
                <option value="10">100.0x (Ultra Fast)</option>
                <option value="0">MAX (Instant Simulation)</option>
              </select>
            `;
            document.body.appendChild(banner);

            const speedSelect = document.getElementById('select-spectator-speed');
            if (speedSelect) {
              speedSelect.addEventListener('change', (e) => {
                window.SocketClient.changeAISpeed(e.target.value, () => {});
              });
            }

            const controlIds = [
              'btn-end-phase', 'btn-trade-cards', 'btn-quit-game',
              'btn-diplomacy', 'btn-submit-pact', 'chk-auto-attack', 'chk-auto-defend',
              'attack-dice-modal', 'defend-dice-modal', 'post-attack-modal'
            ];
            controlIds.forEach(id => {
              const el = document.getElementById(id);
              if (el) el.style.display = 'none';
            });

            this.gameClient.allPlayers = res.players;
            this.gameClient.startCampaign(res.mapData, res.gameState);
          }
        );
      });

      // Open editor button & grant Cartographer feat
      document.getElementById('btn-open-editor').addEventListener('click', () => {
        if (window.SocketClient && window.SocketClient.triggerSecretAchievement) {
          window.SocketClient.triggerSecretAchievement('cartographer', true, () => {});
        }
        this.showScreen('editor');
        this.mapEditor.startEditor();
      });

      // Play Game Timelapse file upload handler
      const timelapseInput = document.getElementById('input-timelapse-upload');
      if (timelapseInput) {
        timelapseInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (evt) => {
            try {
              let jsonText;
              const arrayBuffer = evt.target.result;
              const bytes = new Uint8Array(arrayBuffer);
              // Check for Gzip magic bytes (0x1F, 0x8B)
              if (bytes.length > 2 && bytes[0] === 0x1F && bytes[1] === 0x8B) {
                if (typeof DecompressionStream !== 'undefined') {
                  const blob = new Blob([arrayBuffer]);
                  const ds = new DecompressionStream('gzip');
                  const decompressedStream = blob.stream().pipeThrough(ds);
                  jsonText = await new Response(decompressedStream).text();
                } else {
                  alert('Your browser does not support native gzip decompression.');
                  timelapseInput.value = '';
                  return;
                }
              } else {
                jsonText = new TextDecoder('utf-8').decode(arrayBuffer);
              }

              const data = JSON.parse(jsonText);
              if (data.mapData && data.history && data.history.length > 0) {
                window.SocketClient.mapData = data.mapData;
                this.showScreen('game');
                this.gameClient.startTimelapse(data);
              } else {
                alert('Invalid timelapse file structure. Make sure it contains mapData and history logs.');
                timelapseInput.value = '';
              }
            } catch (err) {
              console.error(err);
              alert('Could not parse timelapse file. Make sure it is a valid .json or .json.gz exported from the victory screen.');
              timelapseInput.value = '';
            }
          };
          reader.readAsArrayBuffer(file);
        });
      }

      // Convert Timelapse to Text Summary button on Main Menu
      const btnMenuConvert = document.getElementById('btn-menu-convert-timelapse');
      if (btnMenuConvert) {
        btnMenuConvert.addEventListener('click', () => {
          this.gameClient.openTimelapseConverterModal();
          const fileInputConverter = document.getElementById('input-timelapse-converter-file');
          if (fileInputConverter && !this.gameClient.converterTimelapseData) {
            fileInputConverter.click();
          }
        });
      }
    }

    createLobbyRoom() {
      const pName = (this.currentAccountData && this.currentAccountData.username) || this.playerName || 'Commander';
      const pColor = this.playerColor || '#00e5ff';
      window.SocketClient.createRoom(pName, pColor, this.selectedMap, (res) => {
        if (res.error) {
          alert(res.error);
        } else {
          window.SocketClient.mapData = this.selectedMap;
          this.showScreen('lobby');
          this.updateLobbyUI(res.players, true, res.roomCode);
          this.renderLobbyPreview();
        }
      });
    }
    // Map selection modal — resolves 'default' | 'earth' | 'upload' | null (cancelled)
    showMapSelectionModal() {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal confirm-modal';
        overlay.style.zIndex = '100000';

        const options = [
          { key: 'default', icon: 'fa-chess-board', title: 'Default Skirmish', desc: 'Quick 6-territory arena. Best for a fast match.' },
          { key: 'earth', icon: 'fa-earth-americas', title: 'Earth Map (Classic Risk)', desc: 'The classic 42-territory world with authentic continent bonuses.' },
          { key: 'upload', icon: 'fa-upload', title: 'Upload Custom Map', desc: 'Load a map JSON exported from the Map Editor.' }
        ];

        overlay.innerHTML = `
          <div class="modal-content glass confirm-modal-content" role="dialog" aria-modal="true" aria-labelledby="map-select-title">
            <div class="modal-header">
              <h2 id="map-select-title"><i class="fa-solid fa-map" style="margin-right: 8px; color: var(--primary);"></i>Choose a Battleground</h2>
            </div>
            <div class="modal-body" style="padding-bottom: 18px;">
              ${options.map(o => `
                <button type="button" class="btn outline-btn w-full" data-map-choice="${o.key}" style="display: flex; align-items: center; gap: 12px; text-align: left; margin-bottom: 10px; padding: 12px 14px;">
                  <i class="fa-solid ${o.icon}" style="font-size: 20px; color: var(--primary); flex-shrink: 0;"></i>
                  <span style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: 700; font-size: 13px;">${o.title}</span>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 400;">${o.desc}</span>
                  </span>
                </button>
              `).join('')}
            </div>
            <div class="confirm-modal-actions">
              <button type="button" class="btn outline-btn" data-map-cancel>Cancel</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        let settled = false;
        const prevOverflow = document.body.style.overflow;

        const close = (result) => {
          if (settled) return;
          settled = true;
          document.body.style.overflow = prevOverflow;
          document.removeEventListener('keydown', onKey);
          overlay.classList.remove('active');
          setTimeout(() => overlay.remove(), 220);
          resolve(result);
        };

        const onKey = (e) => { if (e.key === 'Escape') close(null); };

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) { close(null); return; }
          const btn = e.target.closest('[data-map-choice]');
          if (btn) close(btn.getAttribute('data-map-choice'));
        });
        overlay.querySelector('[data-map-cancel]').addEventListener('click', () => close(null));
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => overlay.classList.add('active'));
      });
    }



    // Built-in map shipped in /public — fetch, validate, and open the lobby with it
    launchWithBuiltInMap(filename) {
      fetch(`/${filename}?_t=${Date.now()}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data && !data.territories && data.mapData && data.mapData.territories) {
            data = data.mapData;
          }
          if (!data || !data.territories || data.territories.length === 0) {
            throw new Error('Invalid map format.');
          }
          this.selectedMap = data;
          window.SocketClient.mapData = data;
          const lbl = document.getElementById('lobby-map-filename');
          if (lbl) lbl.innerHTML = '<i class="fa-solid fa-earth-americas"></i> Earth Map (built-in)';
          this.createLobbyRoom();
        })
        .catch((err) => {
          console.error('Built-in map load failed:', err);
          if (window.showToast) window.showToast('Could not load the built-in Earth map. Falling back to Default Skirmish.', 'error');
          else alert('Could not load the built-in Earth map. Falling back to Default Skirmish.');
          this.selectedMap = DEFAULT_MAP;
          window.SocketClient.mapData = DEFAULT_MAP;
          this.createLobbyRoom();
        });
    }

    // File-picker upload flow chosen from the map selection modal
    promptUploadMap() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) {
          input.remove();
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          input.remove();
          try {
            let data = JSON.parse(event.target.result);
            if (data && !data.territories && data.mapData && data.mapData.territories) {
              data = data.mapData;
            }
            if (!data || !data.territories || data.territories.length === 0) {
              if (window.showToast) window.showToast('Invalid map format.', 'error');
              else alert('Invalid map format.');
              return;
            }
            this.selectedMap = data;
            window.SocketClient.mapData = data;
            const lbl = document.getElementById('lobby-map-filename');
            if (lbl) lbl.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> ${file.name}`;
            this.createLobbyRoom();
          } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('Error parsing map file.', 'error');
            else alert('Error parsing map file.');
          }
        };
        reader.onerror = () => {
          input.remove();
          if (window.showToast) window.showToast('Could not read the selected file.', 'error');
          else alert('Could not read the selected file.');
        };
        reader.readAsText(file);
      });

      input.click();
    }

    initLobby() {
      // Add AI Player
      document.getElementById('btn-add-ai').addEventListener('click', () => {
        const colors = ['#ff3366', '#33ff66', '#3366ff', '#ffcc00', '#ff00ff', '#00ffff', '#ffffff', '#ff9900'];
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        window.SocketClient.addAI('', randColor, (res) => {
          if (res.error) alert(res.error);
        });
      });
      // Heuristic AI Difficulty change (host only)
      const lobbyDifficultySelect = document.getElementById('lobby-ai-difficulty');
      if (lobbyDifficultySelect) {
        lobbyDifficultySelect.addEventListener('change', (e) => {
          window.SocketClient.socket.emit('changeAIDifficulty', { roomCode: window.SocketClient.roomCode, difficulty: e.target.value }, (res) => {
            if (res && res.error) alert(res.error);
          });
        });
      }

      // Lobby custom map upload (host only)
      document.getElementById('lobby-map-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              let data = JSON.parse(event.target.result);
              if (data && !data.territories && data.mapData && data.mapData.territories) {
                data = data.mapData;
              }
              if (data && data.territories && data.territories.length > 0) {
                this.selectedMap = data;
                window.SocketClient.mapData = data;
                document.getElementById('lobby-map-filename').innerHTML = `<i class="fa-solid fa-file-circle-check"></i> ${file.name}`;
                this.renderLobbyPreview();
                this.updateLobbyScenarioUI();
                alert('Custom map uploaded. Preview updated!');
              } else {
                alert('Invalid map format.');
              }
            } catch (err) {
              alert('Error parsing map file.');
            }
          };
          reader.readAsText(file);
        }
      });

      // Scenario nation select dropdown change
      const scenSelect = document.getElementById('lobby-scenario-nation-select');
      if (scenSelect) {
        scenSelect.addEventListener('change', (e) => {
          const nationId = e.target.value;
          if (nationId) {
            window.SocketClient.selectNation(nationId, (res) => {
              if (res.error) alert(res.error);
            });
          }
        });
      }

      // Leave lobby
      document.getElementById('btn-leave-lobby').addEventListener('click', () => {
        window.location.reload(); // simple leave lobby resets state
      });

      // Start Campaign Game
      document.getElementById('btn-start-game').addEventListener('click', () => {
        // Read nuclear settings at the moment the lobby Start button is pressed so
        // the game ALWAYS begins with exactly what the host set in the lobby UI —
        // even if a background updateNuclearSettings emit failed or raced with it.
        const nuclearSettings = {
          blizzardCount: parseInt(document.getElementById('select-lobby-blizzard-count')?.value) || 0,
          startingNukes: parseInt(document.getElementById('select-lobby-starting-nukes')?.value) || 0,
          startingThermonukes: parseInt(document.getElementById('select-lobby-starting-thermonukes')?.value) || 0,
          allowCrafting: !!document.getElementById('chk-lobby-allow-crafting')?.checked,
          // Advanced game modes — read at Start-click so the game ALWAYS begins
          // with exactly what the lobby checkboxes show (same robustness as the
          // nuclear settings path above).
          zombieMode: !!document.getElementById('chk-lobby-zombies')?.checked,
          supplyMode: !!document.getElementById('chk-lobby-supply')?.checked,
          buildingsMode: !!document.getElementById('chk-lobby-buildings')?.checked
        };
        if (window.console && window.console.info) {
          window.console.info('[FactionalRisk] Starting game with nuclear settings:', JSON.stringify(nuclearSettings));
        }
        window.SocketClient.startGame(nuclearSettings, (res) => {
          if (res.error) alert(res.error);
        });
      });

      // Game Mode change (host only)
      const lobbyModeSelect = document.getElementById('lobby-game-mode');
      const lobbySupplyChk = document.getElementById('chk-lobby-supply');
      if (lobbyModeSelect) {
        lobbyModeSelect.addEventListener('change', (e) => {
          const newMode = e.target.value;
          // Two-way linkage: leaving Capital Rush while Supply Lines is on
          // would silently neuter supply (engine gates it to capital_rush),
          // so auto-uncheck and warn.
          if (newMode !== 'capital_rush' && lobbySupplyChk && lobbySupplyChk.checked) {
            lobbySupplyChk.checked = false;
            if (window.showToast) window.showToast('<i class="fa-solid fa-route"></i> Supply Lines disabled — requires Capital Rush mode.', 'warning');
          }
          window.SocketClient.updateGameMode(newMode, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      // Supply Lines checkbox: enabling it auto-selects Capital Rush (the only
      // mode the engine applies supply penalties in) and pushes that mode to
      // the server — same code path as the game-mode select's own listener.
      if (lobbySupplyChk && lobbyModeSelect) {
        lobbySupplyChk.addEventListener('change', (e) => {
          if (e.target.checked && lobbyModeSelect.value !== 'capital_rush') {
            lobbyModeSelect.value = 'capital_rush';
            window.SocketClient.updateGameMode('capital_rush', (res) => {
              if (res.error) alert(res.error);
            });
            if (window.showToast) window.showToast('<i class="fa-solid fa-route"></i> Supply Lines enabled — game mode set to Capital Rush.', 'info');
          }
        });
      }

      // Fog of War change (host only)
      const lobbyFogOfWarChk = document.getElementById('chk-lobby-fog-of-war');
      if (lobbyFogOfWarChk) {
        lobbyFogOfWarChk.addEventListener('change', (e) => {
          window.SocketClient.toggleFogOfWar(e.target.checked, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      // Card Trade Rule change (host only)
      const lobbyCardRuleSelect = document.getElementById('lobby-card-rule');
      if (lobbyCardRuleSelect) {
        lobbyCardRuleSelect.addEventListener('change', (e) => {
          window.SocketClient.changeCardTradeRule(e.target.value, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      // Generative AI Mode toggle (host only)
      const lobbyGenerativeChk = document.getElementById('chk-lobby-generative-ai');
      if (lobbyGenerativeChk) {
        lobbyGenerativeChk.addEventListener('change', (e) => {
          window.SocketClient.toggleGenerativeAIMode(e.target.checked, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      // Socket Lobby settings update
      window.SocketClient.onLobbySettingsUpdate(({ gameMode }) => {
        const modeSel = document.getElementById('lobby-game-mode');
        if (modeSel) modeSel.value = gameMode;
        
        const lblMode = document.getElementById('lbl-lobby-mode-name');
        if (lblMode) {
          lblMode.textContent = gameMode === 'capital_rush' ? 'Capital Rush' : 'Conquest';
        }
      });

      // Socket Lobby listener
      window.SocketClient.onPlayersUpdate((players) => {
        const isHost = players.some(p => p.id === window.SocketClient.socket.id && p.isHost);
        this.updateLobbyUI(players, isHost, window.SocketClient.roomCode);
      });

      window.SocketClient.onRoomStateUpdate((data) => {
        if (data.fogOfWar !== undefined) {
          const fowChk = document.getElementById('chk-lobby-fog-of-war');
          if (fowChk) fowChk.checked = !!data.fogOfWar;
        }
        if (data.blizzardCount !== undefined) {
          const selectBlizz = document.getElementById('select-lobby-blizzard-count');
          if (selectBlizz) selectBlizz.value = data.blizzardCount;
        }
        if (data.startingNukes !== undefined) {
          const selectTact = document.getElementById('select-lobby-starting-nukes');
          if (selectTact) selectTact.value = data.startingNukes;
        }
        if (data.startingThermonukes !== undefined) {
          const selectTher = document.getElementById('select-lobby-starting-thermonukes');
          if (selectTher) selectTher.value = data.startingThermonukes;
        }
        if (data.allowCrafting !== undefined) {
          const chkCraft = document.getElementById('chk-lobby-allow-crafting');
          if (chkCraft) chkCraft.checked = !!data.allowCrafting;
        }

        if (data.cardTradeRule) {
          const ruleSelect = document.getElementById('lobby-card-rule');
          if (ruleSelect) ruleSelect.value = data.cardTradeRule;
        }
        if (data.generativeAIMode !== undefined) {
          const genChk = document.getElementById('chk-lobby-generative-ai');
          if (genChk) genChk.checked = !!data.generativeAIMode;
        }
        if (data.aiDifficulty) {
          const diffSelect = document.getElementById('lobby-ai-difficulty');
          if (diffSelect) diffSelect.value = data.aiDifficulty;
        }
        if (data.disabledNationIds) {
          this.currentRoomDisabledNationIds = data.disabledNationIds;
          this.rerenderLobbyPreviewIfVisible();
        }
        if (data.asNormalMap !== undefined) {
          const asNormalChk = document.getElementById('chk-lobby-play-as-normal');
          if (asNormalChk) asNormalChk.checked = !!data.asNormalMap;
          this.rerenderLobbyPreviewIfVisible();
        }
        if (data.disableNations !== undefined) {
          const disableNationsChk = document.getElementById('chk-lobby-disable-nations');
          if (disableNationsChk) disableNationsChk.checked = !!data.disableNations;
          this.rerenderLobbyPreviewIfVisible();
        }
        if (data.teamMode !== undefined) {
          this.currentRoomTeamMode = !!data.teamMode;
        }
        if (data.teams !== undefined) {
          this.currentRoomTeams = Array.isArray(data.teams) ? data.teams : [];
        }
        if (data.players) {
          const isHost = data.players.some(p => p.id === window.SocketClient.socket.id && p.isHost);
          this.updateLobbyUI(data.players, isHost, window.SocketClient.roomCode);
        } else {
          this.updateLobbyScenarioUI();
        }
      });

      window.SocketClient.onGameStarted(({ roomCode, mapData, gameState, spectatorMode }) => {
        const activeMap = mapData || this.selectedMap || window.SocketClient.mapData;
        window.SocketClient.mapData = activeMap;
        window.SocketClient.roomCode = roomCode || window.SocketClient.roomCode;
        // gameStarted is the authoritative source of our role: normal lobby starts
        // omit spectatorMode (we are a real player), while Watch AI / saved-campaign
        // loads emit it explicitly. Always assign so a stale spectator flag from an
        // earlier watch/save can never leak into a freshly started multiplayer match.
        window.SocketClient.spectatorMode = !!spectatorMode;
        this.selectedMap = activeMap;
        this.showScreen('game');
        this.gameClient.startCampaign(activeMap, gameState);
      });
    }

    renderWatchAINationsUI() {
      const container = document.getElementById('watch-ai-nations-container');
      const list = document.getElementById('watch-ai-nations-list');
      const labelCount = document.getElementById('lbl-watch-ai-enabled-nations');
      const map = this.watchAiMap || this.selectedMap || window.SocketClient.mapData;

      if (!container || !list) return;

      if (map && map.isScenario && map.nations && map.nations.length > 0) {
        container.style.display = 'block';
        list.innerHTML = '';

        map.nations.forEach((n) => {
          const item = document.createElement('label');
          item.style.cssText = `display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; cursor: pointer; color: ${n.color}; font-weight: 500; font-size: 11px;`;
          item.innerHTML = `
            <span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${n.color}; margin-right:5px;"></span>${n.name}</span>
            <input type="checkbox" class="chk-watch-ai-specific-nation" data-id="${n.id}" checked style="cursor: pointer;">
          `;

          item.querySelector('input').onchange = () => {
            const checkedCount = list.querySelectorAll('.chk-watch-ai-specific-nation:checked').length;
            if (labelCount) labelCount.textContent = `${checkedCount}/${map.nations.length} Active`;

            const slider = document.getElementById('input-ai-count');
            const countLbl = document.getElementById('lbl-ai-count');
            if (slider) {
              slider.max = Math.max(2, Math.min(24, checkedCount));
              if (parseInt(slider.value) > checkedCount) {
                slider.value = Math.max(2, checkedCount);
                if (countLbl) countLbl.textContent = slider.value;
              }
            }
          };

          list.appendChild(item);
        });

        if (labelCount) labelCount.textContent = `${map.nations.length}/${map.nations.length} Active`;
      } else {
        container.style.display = 'none';
      }
    }

    updateLobbyScenarioUI() {
      const map = this.selectedMap || window.SocketClient.mapData;
      const box = document.getElementById('lobby-scenario-nation-box');
      const select = document.getElementById('lobby-scenario-nation-select');
      const desc = document.getElementById('lobby-scenario-nation-desc');
      const asNormalContainer = document.getElementById('lobby-as-normal-toggle-container');
      const asNormalChk = document.getElementById('chk-lobby-play-as-normal');
      const disableNationsContainer = document.getElementById('lobby-disable-nations-toggle-container');
      const disableNationsChk = document.getElementById('chk-lobby-disable-nations');
      const premadeAlliancesContainer = document.getElementById('lobby-premade-alliances-toggle-container');
      const premadeAlliancesChk = document.getElementById('chk-lobby-premade-alliances');
      const specificNationsContainer = document.getElementById('lobby-specific-nations-container');
      const specificNationsList = document.getElementById('lobby-specific-nations-list');
      const teamModeContainer = document.getElementById('lobby-team-mode-toggle-container');
      const teamModeChk = document.getElementById('chk-lobby-team-mode');
      const teamEditorContainer = document.getElementById('lobby-team-editor-container');

      if (!box || !select || !desc) return;

      const disabledSet = new Set(this.currentRoomDisabledNationIds || []);

      const isHost = !!this.isLobbyHost;

      if (map && map.isScenario) {
        // Toggle configurations based on whether the current user is the host
        if (asNormalContainer) asNormalContainer.style.display = isHost ? 'flex' : 'none';
        if (disableNationsContainer) disableNationsContainer.style.display = isHost ? 'flex' : 'none';

        const hasPremadeAlliances = !!(map.premadeAlliances && map.premadeAlliances.length > 0);
        if (premadeAlliancesContainer) premadeAlliancesContainer.style.display = (hasPremadeAlliances && isHost) ? 'flex' : 'none';

        // Team Mode requires: host, scenario nations active (not played as normal,
        // nations not disabled) and Honor Premade Alliances enabled.
        const mapPlayedAsNormal = !!(asNormalChk && asNormalChk.checked);
        const nationsDisabled = !!(disableNationsChk && disableNationsChk.checked);
        const honorAlliances = premadeAlliancesChk ? premadeAlliancesChk.checked : true;
        const teamEligible = isHost && !mapPlayedAsNormal && !nationsDisabled && honorAlliances;

        if (teamModeContainer) teamModeContainer.style.display = teamEligible ? 'flex' : 'none';
        if (teamEditorContainer) teamEditorContainer.style.display = (teamEligible && this.currentRoomTeamMode) ? 'block' : 'none';
        if (teamModeChk) {
          teamModeChk.checked = !!this.currentRoomTeamMode;
          if (teamEligible) {
            teamModeChk.onchange = () => {
              window.SocketClient.updateTeamMode(teamModeChk.checked, (res) => {
                if (res && res.error) {
                  alert(res.error);
                  teamModeChk.checked = !teamModeChk.checked;
                }
              });
            };
          }
        }
        if (teamEligible && this.currentRoomTeamMode) {
          this.renderLobbyTeamEditor();
        }

        if (specificNationsContainer && map.nations && Array.isArray(map.nations) && map.nations.length > 0) {
          specificNationsContainer.style.display = isHost ? 'block' : 'none';
          if (specificNationsList && isHost) {
            specificNationsList.innerHTML = '';
            map.nations.forEach((n) => {
              const isDisabled = disabledSet.has(n.id);
              const item = document.createElement('label');
              item.style.cssText = `display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; cursor: pointer; color: ${n.color}; font-size: 11px; font-weight: 500; background: rgba(0,0,0,0.25); border-radius: 4px;`;
              item.innerHTML = `
                <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${n.color}; margin-right:6px;"></span>${n.name}</span>
                <input type="checkbox" class="chk-lobby-specific-nation" data-id="${n.id}" ${!isDisabled ? 'checked' : ''} style="cursor: pointer;">
              `;

              item.querySelector('input').onchange = (e) => {
                const disable = !e.target.checked;
                // Optimistically update the local disabled set so the map
                // preview re-renders instantly; the roomStateUpdate broadcast
                // will confirm/correct it.
                const nextSet = new Set(this.currentRoomDisabledNationIds || []);
                if (disable) nextSet.add(n.id); else nextSet.delete(n.id);
                this.currentRoomDisabledNationIds = [...nextSet];
                window.SocketClient.toggleSpecificNation(n.id, disable, () => {});
                // Immediately reflect the nation appearing/disappearing on the map preview
                this.rerenderLobbyPreviewIfVisible();
              };

              specificNationsList.appendChild(item);
            });
          }
        }

        if (asNormalChk) {
          asNormalChk.onchange = () => {
            const checked = asNormalChk.checked;
            if (checked && disableNationsChk) disableNationsChk.checked = false;
            const hideNationBox = (asNormalChk && asNormalChk.checked) || (disableNationsChk && disableNationsChk.checked);
            if (box) box.style.display = hideNationBox ? 'none' : 'block';
            // Playing as a normal map removes scenario nations -> teams are invalid
            if (checked && this.currentRoomTeamMode) {
              this.currentRoomTeamMode = false;
              this.currentRoomTeams = [];
              window.SocketClient.updateTeamMode(false, () => {});
            }
            window.SocketClient.toggleNormalMapRules(checked, () => {});
            // Immediately update the map preview (all pre-existing nations removed)
            this.rerenderLobbyPreviewIfVisible();
          };
        }

        if (disableNationsChk) {
          disableNationsChk.onchange = () => {
            const checked = disableNationsChk.checked;
            if (checked && asNormalChk) asNormalChk.checked = false;
            const hideNationBox = (asNormalChk && asNormalChk.checked) || (disableNationsChk && disableNationsChk.checked);
            if (box) box.style.display = hideNationBox ? 'none' : 'block';
            // Disabling all nations removes scenario nations -> teams are invalid
            if (checked && this.currentRoomTeamMode) {
              this.currentRoomTeamMode = false;
              this.currentRoomTeams = [];
              window.SocketClient.updateTeamMode(false, () => {});
            }
            window.SocketClient.toggleDisableNations(checked, () => {});
            // Immediately update the map preview (all pre-existing nations removed)
            this.rerenderLobbyPreviewIfVisible();
          };
        }

        if (premadeAlliancesChk) {
          premadeAlliancesChk.onchange = () => {
            const checked = premadeAlliancesChk.checked;
            // Unchecking Honor Premade Alliances bans teams (they rely on premade structure)
            if (!checked && this.currentRoomTeamMode) {
              this.currentRoomTeamMode = false;
              this.currentRoomTeams = [];
              window.SocketClient.updateTeamMode(false, () => {});
              if (teamModeChk) teamModeChk.checked = false;
              if (teamEditorContainer) teamEditorContainer.style.display = 'none';
            }
            window.SocketClient.togglePremadeAlliances(checked, () => {});
          };
        }

        const mapIsPlayedAsNormal = (asNormalChk && asNormalChk.checked);
        const nationsAreDisabled = (disableNationsChk && disableNationsChk.checked);
        const hideNationBox = mapIsPlayedAsNormal || nationsAreDisabled;
        box.style.display = hideNationBox ? 'none' : 'block';

        select.innerHTML = '<option value="">-- Choose Your Nation --</option>';
        if (this.selectedMap.nations && this.selectedMap.nations.length > 0) {
          this.selectedMap.nations.forEach((n, idx) => {
            const isDisabled = disabledSet.has(n.id);
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.disabled = isDisabled;
            opt.textContent = `Turn #${idx + 1}: ${n.name}${isDisabled ? ' (Disabled - Neutral Defender)' : ''}`;
            select.appendChild(opt);
          });
        }

        select.onchange = () => {
          const chosen = (this.selectedMap.nations || []).find(n => n.id === select.value);
          if (chosen) {
            const ownedTerrs = (this.selectedMap.territories || []).filter(t => t.startingOwnerId === chosen.id);
            const defaultDummy = (this.selectedMap.scenarioSettings && this.selectedMap.scenarioSettings.defaultDummyArmies) || 1;
            const startingArmies = ownedTerrs.reduce((sum, t) => sum + (t.startingArmies !== undefined ? t.startingArmies : defaultDummy), 0);

            let continentBonus = 0;
            (this.selectedMap.continents || []).forEach(c => {
              if (c.territoryIds && c.territoryIds.length > 0) {
                const ownsAll = c.territoryIds.every(tid => {
                  const terr = (this.selectedMap.territories || []).find(t => t.id === tid);
                  return terr && terr.startingOwnerId === chosen.id;
                });
                if (ownsAll) continentBonus += (c.bonus || 0);
              }
            });

            const baseDraft = Math.max(3, Math.floor(ownedTerrs.length / 3));
            const totalIncome = baseDraft + continentBonus;

            desc.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${chosen.color};"></span>
                <strong style="color: #fff; font-size:13px;">${chosen.name}</strong>
              </div>
              <div style="margin-bottom: 6px; font-size: 11px; color: rgba(255,255,255,0.85);">${chosen.description || 'No description provided.'}</div>
              <div style="display:flex; justify-content:space-between; border-top:1px dashed rgba(255,255,255,0.15); padding-top:4px; font-size:11px;">
                <span><i class="fa-solid fa-earth-americas" style="color:#4ade80;"></i> Terrs: <strong style="color:#fff;">${ownedTerrs.length}</strong></span>
                <span><i class="fa-solid fa-person-military-pointing" style="color:#38bdf8;"></i> Armies: <strong style="color:#fff;">${startingArmies}</strong></span>
                <span><i class="fa-solid fa-plus-circle" style="color:#facc15;"></i> Draft/Turn: <strong style="color:#facc15;">+${totalIncome}</strong></span>
              </div>
            `;
            window.SocketClient.selectNation(chosen.id, (res) => {
              if (res.error) alert(res.error);
            });
          } else {
            desc.textContent = 'Select a nation to view details.';
          }
        };
      } else {
        if (asNormalContainer) asNormalContainer.style.display = 'none';
        if (disableNationsContainer) disableNationsContainer.style.display = 'none';
        const teamModeContainer = document.getElementById('lobby-team-mode-toggle-container');
        const teamEditorContainer = document.getElementById('lobby-team-editor-container');
        if (teamModeContainer) teamModeContainer.style.display = 'none';
        if (teamEditorContainer) teamEditorContainer.style.display = 'none';
        box.style.display = 'none';
      }
    }

    // Resolve a lobby player's team from their selected nation (Team Mode).
    getTeamForLobbyPlayer(player) {
      if (!this.currentRoomTeamMode || !Array.isArray(this.currentRoomTeams)) return null;
      const nationId = player.selectedNationId || player.nationId;
      if (!nationId) return null;
      return this.currentRoomTeams.find(t => Array.isArray(t.nationIds) && t.nationIds.includes(nationId)) || null;
    }

    // Host-only team editor: create/rename/color teams and assign scenario nations.
    renderLobbyTeamEditor() {
      const teamsList = document.getElementById('lobby-teams-list');
      const btnAddTeam = document.getElementById('btn-lobby-add-team');
      const map = this.selectedMap || window.SocketClient.mapData;
      if (!teamsList || !btnAddTeam || !map || !map.nations) return;

      const teams = Array.isArray(this.currentRoomTeams) ? this.currentRoomTeams : [];
      teamsList.innerHTML = '';

      if (teams.length === 0) {
        teamsList.innerHTML = '<p class="map-hint" style="margin:0;">No teams yet — click "Add Team" to create one.</p>';
      }

      const pushUpdate = () => {
        window.SocketClient.updateTeams(teams, () => {});
      };

      // Team rows: color + name + delete
      teams.forEach((team, idx) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); padding:4px 6px; border-radius:5px;';
        row.innerHTML = `
          <input type="color" value="${team.color || '#6366f1'}" title="Team color" style="width:26px; height:26px; padding:0; border:none; background:none; cursor:pointer; flex-shrink:0;">
          <input type="text" value="${String(team.name || '').replace(/"/g, '&quot;')}" placeholder="Team name" maxlength="24" style="flex:1; min-width:0; background:rgba(0,0,0,0.4); border:1px solid var(--border-glass); color:#fff; padding:3px 6px; border-radius:4px; font-size:11px;">
          <span style="font-size:10px; color:rgba(255,255,255,0.6); flex-shrink:0;">${(team.nationIds || []).length} nation(s)</span>
          <button class="btn outline-btn btn-sm" title="Remove team" style="padding:2px 7px; font-size:10px; color:#ff3366; border-color:#ff3366;"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('input[type="color"]').addEventListener('change', (e) => {
          team.color = e.target.value;
          pushUpdate();
        });
        row.querySelector('input[type="text"]').addEventListener('change', (e) => {
          team.name = e.target.value.trim();
          pushUpdate();
        });
        row.querySelector('button').addEventListener('click', () => {
          teams.splice(idx, 1);
          pushUpdate();
        });
        teamsList.appendChild(row);
      });

      // Nation assignment rows: each scenario nation -> Independent or a team
      const assignWrap = document.createElement('div');
      assignWrap.style.cssText = 'display:flex; flex-direction:column; gap:3px; margin-top:6px;';
      map.nations.forEach((n) => {
        const assignedTeam = teams.find(t => Array.isArray(t.nationIds) && t.nationIds.includes(n.id));
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:6px; padding:2px 6px; background:rgba(0,0,0,0.25); border-radius:4px;';
        const opts = ['<option value="">Independent</option>']
          .concat(teams.map((t, ti) => `<option value="${t.id}" ${assignedTeam === t ? 'selected' : ''}>${String(t.name || `Team ${ti + 1}`).replace(/</g, '&lt;')}</option>`))
          .join('');
        row.innerHTML = `
          <span style="font-size:11px; font-weight:500; color:${n.color}; display:flex; align-items:center; gap:5px; min-width:0;">
            <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${n.color}; flex-shrink:0;"></span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${n.name}</span>
          </span>
          <select style="background:rgba(0,0,0,0.4); border:1px solid var(--border-glass); color:#fff; padding:2px 4px; border-radius:4px; font-size:10px; max-width:45%;">${opts}</select>
        `;
        row.querySelector('select').addEventListener('change', (e) => {
          const newTeamId = e.target.value;
          teams.forEach(t => {
            t.nationIds = (t.nationIds || []).filter(id => id !== n.id);
          });
          if (newTeamId) {
            const target = teams.find(t => t.id === newTeamId);
            if (target) target.nationIds = (target.nationIds || []).concat(n.id);
          }
          pushUpdate();
        });
        assignWrap.appendChild(row);
      });
      teamsList.appendChild(assignWrap);

      btnAddTeam.onclick = () => {
        const palette = ['#6366f1', '#f97316', '#14b8a6', '#ec4899', '#a855f7', '#eab308'];
        const usedColors = new Set(teams.map(t => t.color));
        const color = palette.find(c => !usedColors.has(c)) || '#6366f1';
        teams.push({
          id: `team_${Math.random().toString(36).substr(2, 9)}`,
          name: `Team ${teams.length + 1}`,
          color,
          nationIds: []
        });
        pushUpdate();
        this.renderLobbyTeamEditor();
      };
    }

    updateLobbyUI(players, isHost, roomCode) {
      this.isLobbyHost = isHost; // Store host status to handle individual scenario elements
      document.getElementById('lobby-room-code').textContent = roomCode;
      document.getElementById('lobby-player-count').textContent = players.length;

      this.updateLobbyScenarioUI();

      // Render players list
      const list = document.getElementById('lobby-player-list');
      list.innerHTML = '';
      players.forEach(p => {
        const item = document.createElement('div');
        item.setAttribute('class', 'player-item');
        
        const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
        const canEditColor = (isHost && p.isAI) || (p.id === myId);
        const personalities = ['normal', 'strategic', 'kind', 'goofball', 'cynical', 'aggressive'];

        let selectHtml = '';
        if (isHost && p.isAI) {
          selectHtml = `
            <select class="lobby-ai-type-select" data-id="${p.id}" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 2px 6px; margin-left: 8px; border-radius: 4px; font-size: 11px; cursor: pointer; outline: none; font-weight: 600;">
              <option value="traditional" ${!p.isLLM ? 'selected' : ''}>Heuristic AI</option>
              <option value="llm" ${p.isLLM ? 'selected' : ''}>LLM AI</option>
            </select>
            <select class="lobby-personality-select" data-id="${p.id}" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 2px 6px; margin-left: 8px; border-radius: 4px; font-size: 11px; cursor: pointer; outline: none; ${p.isLLM ? 'display: none;' : ''}">
              ${personalities.map(pers => `<option value="${pers}" ${p.personality === pers ? 'selected' : ''}>${pers.toUpperCase()}</option>`).join('')}
            </select>
          `;
        } else {
          selectHtml = p.isAI ? `<span class="personality-badge ${p.isLLM ? 'llm' : (p.personality || 'normal')}">${p.isLLM ? 'LLM AI' : (p.personality || 'normal').toUpperCase()}</span>` : '';
        }

        // Format name: NationName (CommanderName) if scenario nation assigned
        let displayName = p.name;
        if (p.nationName && p.originalName) {
          displayName = `${p.nationName} (${p.originalName})`;
        } else if (p.nationName) {
          displayName = `${p.nationName} (${p.name})`;
        }

        item.innerHTML = `
          ${canEditColor ? 
            `<input type="color" class="lobby-color-picker" data-id="${p.id}" value="${p.color}" title="${p.isAI ? 'Click to change AI Color' : 'Click to change your Color'}">` :
            `<div class="player-color-dot" style="background-color: ${p.color};"></div>`
          }
          <span class="player-name">${displayName}</span>
          ${selectHtml}
          ${p.isHost ? '<span class="player-badge host" style="margin-left: 4px;">Host</span>' : ''}
          ${p.isAI ? '<span class="player-badge ai" style="margin-left: 4px;">AI Bot</span>' : ''}
        `;
        
        // Listen to live updates
        if (canEditColor) {
          const picker = item.querySelector('.lobby-color-picker');
          if (picker) {
            picker.addEventListener('change', (e) => {
              const targetId = e.target.getAttribute('data-id');
              const val = e.target.value;
              window.SocketClient.changePlayerColor(targetId, val, (res) => {
                if (res.error) {
                  alert(res.error);
                  e.target.value = p.color;
                }
              });
            });
          }
        }

        if (isHost && p.isAI) {
          const selectType = item.querySelector('.lobby-ai-type-select');
          const selectPers = item.querySelector('.lobby-personality-select');

          if (selectType) {
            selectType.addEventListener('change', (e) => {
              const targetId = e.target.getAttribute('data-id');
              const isLLM = e.target.value === 'llm';
              window.SocketClient.togglePlayerLLM(targetId, isLLM, (res) => {
                if (res.error) {
                  alert(res.error);
                  e.target.value = p.isLLM ? 'llm' : 'traditional';
                } else if (selectPers) {
                  selectPers.style.display = isLLM ? 'none' : 'inline-block';
                }
              });
            });
          }

          const select = item.querySelector('.lobby-personality-select');
          if (select) {
            select.addEventListener('change', (e) => {
              const targetId = e.target.getAttribute('data-id');
              const val = e.target.value;
              window.SocketClient.changeAIPersonality(targetId, val, (res) => {
                if (res.error) {
                  alert(res.error);
                  e.target.value = p.personality;
                }
              });
            });
          }
        }

        list.appendChild(item);
      });

      // Enable/Disable buttons based on player roles
          const hostCtrls = document.getElementById('host-only-controls');
          const waitMsg = document.getElementById('client-waiting-msg');
          const btnStart = document.getElementById('btn-start-game');

          if (isHost) {
            hostCtrls.style.display = 'block';
            waitMsg.style.display = 'none';
            
            // Check if we are playing a Scenario match with pre-defined nations
            const playAsNormal = document.getElementById('chk-lobby-play-as-normal')?.checked;
            const disableNations = document.getElementById('chk-lobby-disable-nations')?.checked;
            const isScenario = !!(this.selectedMap && this.selectedMap.isScenario && !playAsNormal && !disableNations);
            const hasScenarioNations = !!(this.selectedMap && this.selectedMap.nations && this.selectedMap.nations.length >= 2);

            // Bind update listeners for lobby Blizzard and Nuke inputs
          const selectBlizz = document.getElementById('select-lobby-blizzard-count');
          const selectTact = document.getElementById('select-lobby-starting-nukes');
          const selectTher = document.getElementById('select-lobby-starting-thermonukes');
          const chkCraft = document.getElementById('chk-lobby-allow-crafting');

          const updateLobbyNuclearConfig = () => {
            if (!isHost) return;
            window.SocketClient.updateNuclearSettings(
              selectBlizz ? selectBlizz.value : 0,
              selectTact ? selectTact.value : 0,
              selectTher ? selectTher.value : 0,
              chkCraft ? chkCraft.checked : false,
              (res) => {
                if (res && res.error) {
                  showToast(`<i class="fa-solid fa-triangle-exclamation"></i> Nuclear settings not saved: ${res.error}`, 'error');
                }
              }
            );
          };

          if (selectBlizz) selectBlizz.onchange = updateLobbyNuclearConfig;
          if (selectTact) selectTact.onchange = updateLobbyNuclearConfig;
          if (selectTher) selectTher.onchange = updateLobbyNuclearConfig;
          if (chkCraft) chkCraft.onchange = updateLobbyNuclearConfig;

          // Enable start button if there are multiple humans/AIs, or if it's a multi-nation scenario
            if (players.length >= 2 || (isScenario && hasScenarioNations)) {
              btnStart.disabled = false;
            } else {
              btnStart.disabled = true;
            }
          } else {
        hostCtrls.style.display = 'none';
        waitMsg.style.display = 'block';
      }
    }
    
    getRankInsigniaInfo(level, isAI = false) {
      if (isAI) {
        return { tierClass: 'rank-tier-bot', icon: '<i class="fa-solid fa-robot"></i>', rankTitle: 'AI Automaton' };
      }
      const lvl = Math.max(1, parseInt(level) || 1);

      if (lvl >= 100) return { tierClass: 'rank-tier-marshal', icon: '<i class="fa-solid fa-crown"></i>', rankTitle: 'Supreme Field Marshal' };
      if (lvl >= 90)  return { tierClass: 'rank-tier-gen',     icon: '<i class="fa-solid fa-star"></i>', rankTitle: 'General of the Army' };
      if (lvl >= 80)  return { tierClass: 'rank-tier-bgen',    icon: '<i class="fa-solid fa-star-half-stroke"></i>', rankTitle: 'Brigadier General' };
      if (lvl >= 70)  return { tierClass: 'rank-tier-col',     icon: '<i class="fa-solid fa-shield-halved"></i>', rankTitle: 'Colonel' };
      if (lvl >= 60)  return { tierClass: 'rank-tier-maj',     icon: '<i class="fa-solid fa-gem"></i>', rankTitle: 'Major' };
      if (lvl >= 50)  return { tierClass: 'rank-tier-cpt',     icon: '<i class="fa-solid fa-crosshairs"></i>', rankTitle: 'Captain' };
      if (lvl >= 40)  return { tierClass: 'rank-tier-lt',      icon: '<i class="fa-solid fa-bars"></i>', rankTitle: 'Lieutenant' };
      if (lvl >= 30)  return { tierClass: 'rank-tier-msgt',    icon: '<i class="fa-solid fa-ribbon"></i>', rankTitle: 'Master Sergeant' };
      if (lvl >= 20)  return { tierClass: 'rank-tier-sgt',     icon: '<i class="fa-solid fa-angles-up"></i>', rankTitle: 'Sergeant' };
      if (lvl >= 10)  return { tierClass: 'rank-tier-cpl',     icon: '<i class="fa-solid fa-angle-up"></i>', rankTitle: 'Corporal' };
      return { tierClass: 'rank-tier-pvt', icon: '<i class="fa-solid fa-chevron-up"></i>', rankTitle: 'Private' };
    }

    renderBattleCardHTML(player, isMe = false, isHost = false, isEditing = false, allowColorEdit = false) {
      const card = player.battleCard || { theme: 'default', option: 1, showcasedBadges: [], equippedTitle: '' };
      const themeKey = (card.theme || 'default').toLowerCase();
      const optionNum = Math.max(1, Math.min(3, parseInt(card.option) || 1));
      const cardClass = `player-battlecard bcard-theme-${themeKey}-${optionNum}`;

      const insignia = this.getRankInsigniaInfo(player.level, player.isAI);
      const lvlStr = player.isAI ? 'AI' : `Lvl ${player.level || 1}`;
      const eloStr = player.isAI ? '' : `<span style="color:#10b981; font-size:9.5px; margin-left:4px; font-weight:800;" title="Multiplayer Elo Rating"><i class="fa-solid fa-trophy"></i> ${player.elo || 1200}</span>`;
      let colorSwatch = `<span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${player.color}; border:1.5px solid #fff; box-shadow:0 0 6px ${player.color}; flex-shrink:0;"></span>`;

      // Host can change a bot's color directly from its lobby battle card.
      // (Only at bot-creation time is HSV overlap auto-prevented; later manual
      // changes may legally result in similar colors.)
      if (allowColorEdit && player.isAI) {
        colorSwatch = `<input type="color" class="lobby-color-picker bcard-color-picker" data-id="${player.id}" value="${player.color}" title="Click to change this bot's color" style="margin-right: 2px;">`;
      }

      const titleBadge = card.equippedTitle 
        ? `<span class="bcard-equipped-title" title="Commander Title">${card.equippedTitle}</span>`
        : '';

      // Transient team badge (set by updateLobbyUI when Team Mode is active)
      const teamBadge = player._teamName
        ? `<span title="Permanent Team" style="font-size:9.5px; font-weight:800; padding:2px 6px; border-radius:5px; background:rgba(0,0,0,0.55); color:${player._teamColor || '#facc15'}; border:1px solid ${player._teamColor || '#facc15'}; letter-spacing:0.4px; display:inline-flex; align-items:center; gap:3px;"><i class="fa-solid fa-people-group"></i> ${player._teamName}</span>`
        : '';

      // Mini level progress calculation
      const lvl = Math.max(1, parseInt(player.level) || 1);
      const needed = Math.min(3000, 100 + (lvl - 1) * 50);
      const xp = player.currentXP || 0;
      const xpPct = player.isAI ? 100 : Math.min(100, Math.round((xp / needed) * 100));

      let badgesHtml = '';
      const showcased = card.showcasedBadges || [];

      if (isEditing) {
        let slotItems = '';
        for (let i = 0; i < 3; i++) {
          const achId = showcased[i];
          if (achId) {
            const achObj = this.allAchievementsData[achId];
            const rarity = achObj ? achObj.rarity : 'common';
            const iconSvg = window.getAchievementSvgIcon(achId, 20);
            slotItems += `<span class="bcard-achievement-slot slot-equipped ach-glow-${rarity}" data-slot-index="${i}" title="${achObj ? achObj.title : achId}">${iconSvg}</span>`;
          } else {
            slotItems += `<span class="bcard-achievement-slot bcard-slot-empty" data-slot-index="${i}" title="Empty Medal Slot"><i class="fa-solid fa-plus"></i></span>`;
          }
        }
        badgesHtml = `<div style="display: flex; gap: 6px;">${slotItems}</div>`;
      } else if (showcased.length > 0) {
        let slotItems = '';
        showcased.slice(0, 3).forEach(achId => {
          if (achId) {
            const achObj = this.allAchievementsData[achId];
            const rarity = achObj ? achObj.rarity : 'common';
            const iconSvg = window.getAchievementSvgIcon(achId, 20);
            slotItems += `<span class="bcard-achievement-slot ach-glow-${rarity}" title="${achObj ? achObj.title : 'Medal'}">${iconSvg}</span>`;
          }
        });
        if (slotItems) badgesHtml = `<div style="display: flex; gap: 6px;">${slotItems}</div>`;
      }

      let userHandle = player.accountId || player.username;
      if (!userHandle && isMe) {
        userHandle = (this.currentAccountData && this.currentAccountData.username) ||
                     (window.SocketClient && window.SocketClient.currentAccount && window.SocketClient.currentAccount.username);
        if (!userHandle) {
          try {
            const saved = JSON.parse(localStorage.getItem('factional_risk_account') || '{}');
            if (saved && saved.username) userHandle = saved.username;
          } catch(e) {}
        }
      }

      let bottomTag = '';
      if (player.isAI) {
        bottomTag = player.personality ? player.personality.toUpperCase() : 'AI BOT';
      } else if (userHandle) {
        bottomTag = player.isHost ? `👑 @${userHandle}` : `@${userHandle}`;
      } else if (player.isHost) {
        bottomTag = '👑 Room Host';
      } else if (player.name && player.name !== 'Commander' && player.name !== 'Host Player') {
        bottomTag = `@${player.name}`;
      } else {
        bottomTag = 'Guest';
      }

      return `
        <div class="${cardClass}" data-player-id="${player.id}" title="Click to inspect commander statistics">
          <div class="bcard-art-overlay"></div>
          <div class="bcard-content-layer">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="rank-insignia-icon ${insignia.tierClass}">${insignia.icon}</div>
                <div>
                  <div style="font-weight: 800; font-size: 14px; color: #fff; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px; flex-wrap: wrap;">
                    ${colorSwatch}
                    <span>${player.name}</span>
                    ${titleBadge}
                    ${teamBadge}
                  </div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.75); font-weight: 600;">
                    ${insignia.rankTitle}
                  </div>
                </div>
              </div>
              <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: rgba(0,0,0,0.6); color: var(--primary); border: 1px solid rgba(0,229,255,0.4); letter-spacing: 0.5px;">
                ${lvlStr}${eloStr}
              </span>
            </div>

            <!-- Mini XP bar removed -->

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.7);">
              <span style="font-weight: 600;">${bottomTag}</span>
              ${badgesHtml}
            </div>
          </div>
        </div>
      `;
    }

    updateLobbyUI(players, isHost, roomCode) {
      this.isLobbyHost = isHost;
      document.getElementById('lobby-room-code').textContent = roomCode;
      document.getElementById('lobby-player-count').textContent = players.length;

      this.updateLobbyScenarioUI();

      // Render Large Battle Cards Grid in Lobby
      const cardsContainer = document.getElementById('lobby-battlecards-container');
      if (cardsContainer) {
        cardsContainer.innerHTML = '';
        const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;

        players.forEach(p => {
          const isMe = p.id === myId;
          // Team badge (Team Mode only): resolve this lobby player's team via nation assignment
          const team = this.getTeamForLobbyPlayer(p);
          p._teamName = team ? team.name : null;
          p._teamColor = team ? team.color : null;
          const cardHtml = this.renderBattleCardHTML(p, isMe, p.isHost, false, isHost);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = cardHtml;
          const cardEl = wrapper.firstElementChild;

          // Click to inspect player stats
          cardEl.addEventListener('click', () => {
            this.openPlayerInspectorModal(p);
          });

          // Host can edit bot colors directly on the battle card
          const colorPicker = cardEl.querySelector('.bcard-color-picker');
          if (colorPicker) {
            // Opening the native color dialog must not trigger the inspect modal
            colorPicker.addEventListener('click', (e) => e.stopPropagation());
            colorPicker.addEventListener('change', (e) => {
              e.stopPropagation();
              const targetId = colorPicker.getAttribute('data-id');
              window.SocketClient.changePlayerColor(targetId, e.target.value, (res) => {
                if (res && res.error) {
                  alert(res.error);
                  colorPicker.value = p.color; // revert on failure
                }
              });
            });
          }

          cardsContainer.appendChild(cardEl);
        });
      }

      // Enable/Disable buttons based on player roles
      const hostCtrls = document.getElementById('host-only-controls');
      const waitMsg = document.getElementById('client-waiting-msg');
      const btnStart = document.getElementById('btn-start-game');

      if (isHost) {
        hostCtrls.style.display = 'block';
        waitMsg.style.display = 'none';
        const playAsNormal = document.getElementById('chk-lobby-play-as-normal')?.checked;
        const disableNations = document.getElementById('chk-lobby-disable-nations')?.checked;
        const isScenario = !!(this.selectedMap && this.selectedMap.isScenario && !playAsNormal && !disableNations);
        const hasScenarioNations = !!(this.selectedMap && this.selectedMap.nations && this.selectedMap.nations.length >= 2);

        if (players.length >= 2 || (isScenario && hasScenarioNations)) {
          // Team Mode: require at least 2 distinct factions (teams + independents)
          // represented among the players before starting.
          let canStart = true;
          if (this.currentRoomTeamMode) {
            const factions = new Set();
            players.forEach(pl => {
              const t = this.getTeamForLobbyPlayer(pl);
              factions.add(t ? t.id : `solo_${pl.id}`);
            });
            canStart = factions.size >= 2;
          }
          btnStart.disabled = !canStart;
        } else {
          btnStart.disabled = true;
        }
      } else {
        hostCtrls.style.display = 'none';
        waitMsg.style.display = 'block';
      }
    }

    openPlayerInspectorModal(player) {
      const modal = document.getElementById('inspect-player-modal');
      const body = document.getElementById('inspect-modal-body');
      if (!modal || !body) return;

      if (player.isAI) {
        body.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 38px; color: #818cf8; margin-bottom: 8px;"><i class="fa-solid fa-robot"></i></div>
            <h3 style="color: #fff; margin: 0 0 4px 0;">${player.name}</h3>
            <span style="font-size: 12px; color: var(--primary); font-weight: 700;">Tactical AI Persona: ${player.personality ? player.personality.toUpperCase() : 'NORMAL'}</span>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 10px;">
              This commander is controlled by the tactical simulation engine.
            </p>
          </div>
        `;
        modal.classList.add('active');
        return;
      }

      // Fetch user profile from database
      const accountName = player.accountId || player.name;
      window.SocketClient.getAccountStats(accountName, (res) => {
        const u = res.success ? res.user : null;
        const allAchs = res.allAchievements || {};
        const pvp = u ? (u.multiplayerStats || {}) : {};
        const solo = u ? (u.soloStats || {}) : {};
        const lvl = u ? (u.level || 1) : 1;
        const xp = u ? (u.currentXP || 0) : 0;
        const needed = u ? (u.xpNeeded || 100) : 100;
        const insignia = this.getRankInsigniaInfo(lvl, false);

        const bioText = u && u.bio ? u.bio : 'No commander bio set.';
        const eloVal = u && u.elo !== undefined ? u.elo : 1200;
        const usernameStr = u && u.username ? `<span style="font-size: 11px; color: #94a3b8; font-weight: 600;">(@${u.username})</span>` : '';
        const unlockedList = (u && u.unlockedAchievements) ? u.unlockedAchievements : [];

        // Build a merged player object using live DB data so the battle card
        // shows the correct theme, level, elo, equipped title and badges.
        const inspectPlayerObj = {
          ...player,
          accountId: (u && u.username) || player.accountId || player.username || null,
          username: (u && u.username) || player.username || player.accountId || null,
          level: lvl,
          currentXP: xp,
          elo: eloVal,
          battleCard: (u && u.battleCard) ? u.battleCard : (player.battleCard || { theme: 'default', option: 1, showcasedBadges: [] }),
        };
        const battleCardHtml = this.renderBattleCardHTML(inspectPlayerObj, false, player.isHost, false, false);

        body.innerHTML = `
          <!-- Battle Card Preview -->
          <div style="margin-bottom: 14px; pointer-events: none; cursor: default;">
            ${battleCardHtml}
          </div>

          <!-- Add Friend Action (if viewing someone else and logged in) -->
          ${(this.currentAccountData && u && u.username && u.username.toLowerCase() !== this.currentAccountData.username.toLowerCase()) ? `
            <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
              <button id="btn-inspect-add-friend" class="btn primary-btn btn-sm" style="font-size: 11px; padding: 4px 12px;">
                <i class="fa-solid fa-user-plus"></i> Add Friend
              </button>
            </div>
          ` : ''}

          <!-- Bio Quote -->
          <div style="background: rgba(255,255,255,0.03); border-left: 3px solid var(--primary); padding: 8px 12px; border-radius: 4px; font-size: 11.5px; color: rgba(255,255,255,0.9); font-style: italic; margin-bottom: 14px;">
            "${bioText}"
          </div>

          <!-- Tab Bar -->
          <div style="display: flex; gap: 6px; margin-bottom: 12px;">
            <button id="tab-inspect-overview" class="btn primary-btn btn-sm w-full active"><i class="fa-solid fa-chart-simple"></i> Overview & Stats</button>
            <button id="tab-inspect-achievements" class="btn outline-btn btn-sm w-full"><i class="fa-solid fa-trophy"></i> Achievements (${unlockedList.length})</button>
          </div>

          <!-- Tab Pane 1: Overview & Stats -->
          <div id="pane-inspect-overview" style="display: block;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 8px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; border: 1px solid var(--border-glass);">
                <span style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; display: block;">Multiplayer (PVP)</span>
                <strong style="color: #fff; font-size: 15px;">${pvp.matchesWon || 0}W - ${Math.max(0, (pvp.matchesPlayed || 0) - (pvp.matchesWon || 0))}L</strong>
                <div style="color: var(--primary); font-size: 11px; font-weight: 600; margin-top: 2px;">${pvp.matchesPlayed ? Math.round(((pvp.matchesWon || 0) / pvp.matchesPlayed) * 100) : 0}% Win Rate (${pvp.matchesPlayed || 0} matches)</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; border: 1px solid var(--border-glass);">
                <span style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; display: block;">Solo vs AI</span>
                <strong style="color: #fff; font-size: 15px;">${solo.matchesWon || 0}W - ${Math.max(0, (solo.matchesPlayed || 0) - (solo.matchesWon || 0))}L</strong>
                <div style="color: var(--primary); font-size: 11px; font-weight: 600; margin-top: 2px;">${solo.matchesPlayed ? Math.round(((solo.matchesWon || 0) / solo.matchesPlayed) * 100) : 0}% Win Rate (${solo.matchesPlayed || 0} matches)</div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px;">
              <div style="background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-glass);">
                <span style="color: var(--text-muted); font-size: 10px; display: block;">Combat Conquests</span>
                <strong style="color: #10b981;">${(pvp.territoriesConquered || 0) + (solo.territoriesConquered || 0)}</strong>
              </div>
              <div style="background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-glass);">
                <span style="color: var(--text-muted); font-size: 10px; display: block;">Armies Defeated (Kills)</span>
                <strong style="color: #38bdf8;">${(pvp.armiesKilled || 0) + (solo.armiesKilled || 0)}</strong>
              </div>
            </div>
          </div>

          <!-- Tab Pane 2: Achievements Gallery -->
          <div id="pane-inspect-achievements" style="display: none;">
            <div id="inspect-achievements-list" class="achievements-gallery-grid" style="max-height: 300px; overflow-y: auto;">
              <!-- Cards populated below -->
            </div>
          </div>
        `;

        // Render Unlocked Achievements List for Inspected Player
        const achListContainer = body.querySelector('#inspect-achievements-list');
        if (achListContainer) {
          if (unlockedList.length === 0) {
            achListContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; font-style: italic; padding: 20px; text-align: center; grid-column: 1 / -1;">This commander has not unlocked any achievements yet.</p>';
          } else {
            // List of achievements the viewer (you) has unlocked
            const myUnlockedList = (this.currentAccountData && this.currentAccountData.unlockedAchievements) || 
                                   (window.SocketClient.currentAccount && window.SocketClient.currentAccount.unlockedAchievements) || [];

            unlockedList.forEach(achId => {
              const ach = allAchs[achId] || { title: achId, desc: 'Achievement unlocked', rarity: 'common', commanderTitle: '', secret: false };
              
              // Spoiler protection: Hide secret details if you haven't unlocked it yet
              const isSecret = !!ach.secret;
              const iAlsoHaveIt = myUnlockedList.includes(achId);
              const shouldCensor = isSecret && !iAlsoHaveIt;

              const displayTitle = shouldCensor ? '??? (Secret Feat)' : ach.title;
              const displayDesc = shouldCensor ? 'Secret achievement unlocked by this commander. Criteria hidden until you discover it!' : ach.desc;
              const iconSvg = shouldCensor 
                ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2"><circle cx="12" cy="12" r="10" stroke="#facc15" stroke-dasharray="3 3"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`
                : window.getAchievementSvgIcon(achId, 28);

              const titleBadge = (!shouldCensor && ach.commanderTitle) 
                ? `<div style="margin-top: 3px;"><span style="font-size: 8px; color: #facc15; font-weight: 800; background: rgba(0,0,0,0.5); padding: 1px 4px; border-radius: 3px;">"${ach.commanderTitle}"</span></div>` 
                : '';

              const card = document.createElement('div');
              card.className = `achievement-card ach-glow-${ach.rarity} unlocked`;

              card.innerHTML = `
                <div class="ach-icon-box">${iconSvg}</div>
                <div class="ach-info-box">
                  <div class="ach-title-row">
                    <strong>${displayTitle}</strong>
                    <span class="ach-rarity-pill ${ach.rarity}">${ach.rarity.toUpperCase()}</span>
                  </div>
                  <div class="ach-desc">${displayDesc}</div>
                  ${titleBadge}
                </div>
              `;
              achListContainer.appendChild(card);
            });
          }
        }

        // Tab Switching Handlers
        const tabOverview = body.querySelector('#tab-inspect-overview');
        const tabAchievements = body.querySelector('#tab-inspect-achievements');
        const paneOverview = body.querySelector('#pane-inspect-overview');
        const paneAchievements = body.querySelector('#pane-inspect-achievements');

        if (tabOverview && tabAchievements) {
          tabOverview.onclick = () => {
            tabOverview.className = 'btn primary-btn btn-sm w-full active';
            tabAchievements.className = 'btn outline-btn btn-sm w-full';
            paneOverview.style.display = 'block';
            paneAchievements.style.display = 'none';
          };
          tabAchievements.onclick = () => {
            tabAchievements.className = 'btn primary-btn btn-sm w-full active';
            tabOverview.className = 'btn outline-btn btn-sm w-full';
            paneOverview.style.display = 'none';
            paneAchievements.style.display = 'block';
          };
        }

        const btnAddFriend = body.querySelector('#btn-inspect-add-friend');
        if (btnAddFriend && u && u.username) {
          btnAddFriend.onclick = () => {
            btnAddFriend.disabled = true;
            window.SocketClient.sendFriendRequest(u.username, (res) => {
              if (res.error) {
                showToast(res.error, 'warning');
                btnAddFriend.disabled = false;
              } else {
                showToast(`<i class="fa-solid fa-paper-plane"></i> Friend request sent to ${u.username}!`, 'success');
                btnAddFriend.innerHTML = '<i class="fa-solid fa-check"></i> Request Sent';
              }
            });
          };
        }

        modal.classList.add('active');
      });
    }

    // Build the map data copy the lobby preview should show, reflecting the
    // current host settings: "Play as Normal Map" / "Disable All Nations"
    // strip every pre-existing nation, and individually disabled scenario
    // nations turn into neutral defenders (their territories render neutral).
    getLobbyPreviewMapData() {
      const map = this.selectedMap || window.SocketClient.mapData;
      if (!map) return map;
      const asNormal = !!document.getElementById('chk-lobby-play-as-normal')?.checked;
      const disableNations = !!document.getElementById('chk-lobby-disable-nations')?.checked;
      const disabledIds = new Set(this.currentRoomDisabledNationIds || []);
      const stripAllNations = asNormal || disableNations;
      if (!stripAllNations && disabledIds.size === 0) return map;

      const preview = {
        ...map,
        territories: (map.territories || []).map(t => {
          const ownerId = t.startingOwnerId;
          if (ownerId && ownerId !== 'dummy' && (stripAllNations || disabledIds.has(ownerId))) {
            // Disabled nations act as neutral defenders: keep their pre-set
            // armies, but reset the starting owner so they render neutral.
            return { ...t, startingOwnerId: 'dummy' };
          }
          return t;
        })
      };
      if (stripAllNations) {
        preview.isScenario = false;
        preview.nations = [];
        preview.premadeAlliances = [];
      } else {
        preview.nations = (map.nations || []).filter(n => !disabledIds.has(n.id));
      }
      return preview;
    }

    // Re-render the lobby preview only if it has already been drawn (i.e. we
    // are in the lobby with a map loaded); no-ops otherwise.
    rerenderLobbyPreviewIfVisible() {
      const lobbyPreview = document.getElementById('lobby-map-preview-container');
      if (lobbyPreview && lobbyPreview.innerHTML !== '') {
        this.renderLobbyPreview();
      }
    }

    renderLobbyPreview() {
      const container = document.getElementById('lobby-map-preview-container');
      container.innerHTML = '';
      const renderer = new window.SVGRenderer('lobby-map-preview-container', { isEditor: false });
      renderer.render(this.getLobbyPreviewMapData());
    }

    initAudio() {
      const defaultTracks = ['imagesandsounds/conflict1.mp3', 'imagesandsounds/conflict2.mp3'];
      let currentTrackIdx = 0;
      this.bgMusic = new Audio();
      this.bgMusic.volume = 0.2;
      this.isMusicMuted = false; // Unmute music by default — user can mute via btn-toggle-music
      this.isSFXMuted = false; // SFX plays by default!

      this.updateBGMTrack = () => {
        const isAnime = this.mapTheme === 'anime';
        const targetSrc = isAnime ? 'imagesandsounds/animesong.mp3' : defaultTracks[currentTrackIdx];

        if (!this.bgMusic.src || !this.bgMusic.src.endsWith(targetSrc)) {
          this.bgMusic.src = targetSrc;
          this.bgMusic.currentTime = 0;
        }
        this.bgMusic.loop = isAnime; // Loop animesong continuously

        if (!this.isMusicMuted) {
          this.bgMusic.play().catch(err => {
            // Autoplay may be deferred until user interaction
          });
        }
      };

      this.updateBGMTrack();

      // Browser autoplay policy: unlock audio immediately upon first user gesture
      const unlockAudio = () => {
        if (!this.isMusicMuted && this.bgMusic && this.bgMusic.paused) {
          this.bgMusic.play().catch(() => {});
        }
      };
      ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { once: true });
      });

      this.bgMusic.addEventListener('ended', () => {
        if (this.mapTheme !== 'anime') {
          currentTrackIdx = (currentTrackIdx + 1) % defaultTracks.length;
          this.bgMusic.src = defaultTracks[currentTrackIdx];
          if (!this.isMusicMuted) {
            this.bgMusic.play().catch(err => console.log('Music ended playback blocked'));
          }
        }
      });

      const btnToggle = document.getElementById('btn-toggle-music');
      if (btnToggle) {
        let musicToggleCount = 0;
        btnToggle.addEventListener('click', () => {
          this.isMusicMuted = !this.isMusicMuted;
          musicToggleCount++;
          if (musicToggleCount >= 15 && window.SocketClient && window.SocketClient.triggerSecretAchievement) {
            window.SocketClient.triggerSecretAchievement('dj_commander', musicToggleCount, () => {});
          }
          if (this.isMusicMuted) {
            this.bgMusic.pause();
            btnToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btnToggle.classList.add('muted');
          } else {
            this.updateBGMTrack();
            btnToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btnToggle.classList.remove('muted');
          }
        });
        // Set initial icon state to match unmuted-by-default audio
        if (!this.isMusicMuted) {
          btnToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
          btnToggle.classList.remove('muted');
        }
      }
    }

    playSFX(path) {
      if (this.isSFXMuted) return;
      const sfx = new Audio(path);
      sfx.volume = 0.5;
      sfx.play().catch(err => console.log('SFX blocked', err));
    }

    setMapTheme(theme) {
      this.mapTheme = theme;
      localStorage.setItem('map-theme', theme);
      document.body.setAttribute('data-map-theme', theme);

      // --- Secret Achievement: "Just Choose Already" (switch themes 6+ times in one turn) ---
      // Only count real user switches (skip the constructor-init call when mapTheme is unchanged).
      this._themeSwitchCount = (this._themeSwitchCount || 0);
      let isInitCall = false;
      if (this._lastSetTheme && this._lastSetTheme === null) isInitCall = false;
      if (this._themeSwitchCount === 0 && this._firstThemeSet === undefined) {
        this._firstThemeSet = theme;
        isInitCall = true; // first call from constructor
      }
      this._themeSwitchCount++;
      const isManual = !(this._firstThemeSet && this._themeSwitchCount === 1);
      if (isManual && this._themeSwitchCount >= 6) {
        if (window.SocketClient && window.SocketClient.triggerSecretAchievement) {
          window.SocketClient.triggerSecretAchievement('secret_choose_already', this._themeSwitchCount, (res) => {
            if (res && res.achievement) {
              if (window.showToast) window.showToast(`<i class="fa-solid fa-trophy"></i> Secret achievement unlocked: <strong>${res.achievement.title}</strong>!`, 'success');
            }
          });
        }
      }
      this._lastSetTheme = theme;

      // Filter out and sanitize old map themes into premium replacements
      const deprecatedThemes = new Set(['satellite', 'pastel', 'basiclight', 'light', 'molten', 'glacial']);
      if (deprecatedThemes.has(theme)) {
        theme = 'scifi'; // Redirect deprecated templates to Sci-Fi
      }

      // Synchronize all theme selectors on the page (added select-lobby-theme)
      ['select-menu-theme', 'select-game-theme', 'select-editor-theme', 'select-lobby-theme'].forEach(id => {
        const select = document.getElementById(id);
        if (select) select.value = theme;
      });

      // Force instant map re-render and card list redraw on theme swap
      if (this.gameClient && this.gameClient.gameState && this.gameClient.renderer) {
        this.gameClient.renderer.render(window.SocketClient.mapData || this.gameClient.gameState.mapData, this.gameClient.gameState);
        this.gameClient.renderCards();
      }

          // Force instant lobby preview re-render if active
      const lobbyPreview = document.getElementById('lobby-map-preview-container');
      if (lobbyPreview && lobbyPreview.innerHTML !== '') {
        this.renderLobbyPreview();
      }

            // Swap BGM track on theme change (e.g., anime theme plays animesong.mp3)
      if (this.updateBGMTrack) this.updateBGMTrack();
    }

    // Replace CSS-only .info-tip tooltips with a single JS-positioned
    // fixed bubble clamped to the viewport and immune to sidebar overflow.
    initInfoTips() {
      const tooltip = document.createElement('div');
      tooltip.className = 'info-tip-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      document.body.appendChild(tooltip);

      const EDGE_MARGIN = 10;
      const V_GAP = 8;

      let activeEl = null;
      let visible = false;

      const hide = () => {
        if (!visible && !activeEl) return;
        visible = false;
        activeEl = null;
        tooltip.classList.remove('visible', 'above', 'below', 'dark');
        tooltip.style.cssText = '';
        tooltip.textContent = '';
      };

      const position = (el) => {
        if (!visible) return;
        const rect = el.getBoundingClientRect();
        // Measure while hidden so clamping uses the real rendered size
        tooltip.classList.remove('visible');
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const spaceAbove = rect.top - V_GAP;
        const spaceBelow = vh - rect.bottom - V_GAP;
        const placeBelow = spaceAbove < th + EDGE_MARGIN && spaceBelow > spaceAbove;

        // Horizontal center on the icon, clamped to the viewport
        let left = rect.left + rect.width / 2 - tw / 2;
        left = Math.max(EDGE_MARGIN, Math.min(vw - tw - EDGE_MARGIN, left));

        const arrowLeft = Math.max(12, Math.min(tw - 12, (rect.left + rect.width / 2) - left));

        tooltip.classList.toggle('above', !placeBelow);
        tooltip.classList.toggle('below', placeBelow);

        let top;
        if (placeBelow) {
          top = Math.min(vh - th - EDGE_MARGIN, rect.bottom + V_GAP);
        } else {
          top = Math.max(EDGE_MARGIN, rect.top - V_GAP - th);
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.setProperty('--arrow-pos', `${arrowLeft}px`);
        tooltip.classList.add('visible');
      };

      const show = (el) => {
        const text = (el.getAttribute('data-tip') || '').trim();
        if (!text) return;
        activeEl = el;
        tooltip.textContent = text;
        tooltip.classList.toggle('dark', el.classList.contains('info-tip--dark'));
        visible = true;
        position(el);
      };

      const closestTip = (node) =>
        node && node.closest ? node.closest('.info-tip') : null;

      // Delegated listeners also cover info icons added dynamically later
      document.addEventListener('mouseover', (e) => {
        const el = closestTip(e.target);
        if (el && el !== activeEl) show(el);
      });
      document.addEventListener('mouseout', (e) => {
        if (!activeEl) return;
        const next = closestTip(e.relatedTarget);
        if (!next) hide();
      });
      document.addEventListener('click', () => hide());

      // Keyboard accessibility (hover-less usage)
      document.addEventListener('focusin', (e) => {
        const el = closestTip(e.target);
        if (el) show(el);
      });
      document.addEventListener('focusout', (e) => {
        if (!activeEl) return;
        const next = closestTip(e.relatedTarget);
        if (!next) hide();
      });

      window.addEventListener('resize', () => {
        if (activeEl) position(activeEl);
      });
      window.addEventListener('scroll', () => {
        if (activeEl) position(activeEl);
      }, true);
      window.addEventListener('blur', () => hide());
    }
    initAccountUI() {
      const authModal = document.getElementById('account-auth-modal');
      const statsModal = document.getElementById('account-stats-modal');
      const inspectModal = document.getElementById('inspect-player-modal');
      const btnCloseInspect = document.getElementById('btn-close-inspect-modal');
      if (btnCloseInspect && inspectModal) {
        btnCloseInspect.onclick = () => inspectModal.classList.remove('active');
      }

      const btnOpenAuth = document.getElementById('btn-open-login-modal');
      const btnCloseAuth = document.getElementById('btn-close-auth-modal');
      const btnCloseStats = document.getElementById('btn-close-stats-modal');
      const tabLogin = document.getElementById('tab-auth-login');
      const tabRegister = document.getElementById('tab-auth-register');
      const btnSubmitAuth = document.getElementById('btn-submit-auth');
      const inputUser = document.getElementById('input-auth-username');
      const inputPass = document.getElementById('input-auth-password');
      const authStatus = document.getElementById('auth-status-msg');
      const btnLogout = document.getElementById('btn-account-logout');
      const btnViewStats = document.getElementById('btn-view-my-stats');
      const loggedOutView = document.getElementById('account-logged-out-view');
      const loggedInView = document.getElementById('account-logged-in-view');
      const lblUsername = document.getElementById('lbl-logged-in-username');

      const tabStatsPvp = document.getElementById('tab-stats-pvp');
      const tabStatsSolo = document.getElementById('tab-stats-solo');
      const tabStatsCard = document.getElementById('tab-stats-card-customize');
      const tabStatsAch = document.getElementById('tab-stats-achievements');

      const statsGrid = document.getElementById('profile-stats-grid');
      const cardCustomizer = document.getElementById('profile-card-customizer');
      const achTab = document.getElementById('profile-achievements-tab');

      const selectCardTheme = document.getElementById('select-card-theme');
      const selectCardOption = document.getElementById('select-card-option');
      const selectCardTitle = document.getElementById('select-card-title');
      const cardPreview = document.getElementById('my-card-preview-render');
      const btnSaveCard = document.getElementById('btn-save-battle-card');

      const filterCategory = document.getElementById('select-ach-category-filter');
      const filterRarity = document.getElementById('select-ach-rarity-filter');

      this.currentAccountData = null;
      this.allAchievementsData = {};
      let activeStatsMode = 'pvp';

      // Live Achievement Toast Notification Listener
      if (window.SocketClient && window.SocketClient.socket) {
        window.SocketClient.socket.on('achievementUnlocked', ({ achievement, xpReward, newLevel, currentXP, xpNeeded }) => {
          if (!achievement) return;
          const toast = document.createElement('div');
          toast.className = `achievement-unlock-toast ach-glow-${achievement.rarity}`;
          
          const iconSvg = window.getAchievementSvgIcon(achievement.id, 36);
          const titleStr = achievement.commanderTitle ? ` • Title Unlocked: <span style="color:#facc15;">"${achievement.commanderTitle}"</span>` : '';

          toast.innerHTML = `
            <div class="ach-toast-icon">${iconSvg}</div>
            <div class="ach-toast-info">
              <div class="ach-toast-header">
                <span class="ach-toast-badge ${achievement.rarity}">🏆 ${achievement.rarity.toUpperCase()} (+${xpReward} XP)</span>
              </div>
              <strong class="ach-toast-title">${achievement.title}</strong>
              <p class="ach-toast-desc">${achievement.desc}${titleStr}</p>
            </div>
          `;

          document.body.appendChild(toast);
          if (window.MainController) window.MainController.playSFX('imagesandsounds/conflict1.mp3');

          setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 400);
          }, 6500);
        });
      }

      const updateStatsDisplay = () => {
        if (!this.currentAccountData || !statsGrid) return;
        const st = activeStatsMode === 'pvp' ? (this.currentAccountData.multiplayerStats || {}) : (this.currentAccountData.soloStats || {});
        
        const won = st.matchesWon || 0;
        const played = st.matchesPlayed || 0;
        const lost = Math.max(0, played - won);
        const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

        document.getElementById('stat-record-val').textContent = `${won}W - ${lost}L`;
        document.getElementById('stat-winrate-val').textContent = `${winRate}% Win Rate (${played} matches)`;
        document.getElementById('stat-conquests-val').textContent = `${st.territoriesConquered || 0} Conquered`;
        document.getElementById('stat-lost-val').textContent = `${st.territoriesLost || 0} Lost`;
        document.getElementById('stat-kills-val').textContent = `${st.armiesKilled || 0} Kills`;
        document.getElementById('stat-armies-lost-val').textContent = `${st.armiesLost || 0} Armies Lost`;
        document.getElementById('stat-nukes-val').textContent = `${st.tacticalNukesFired || 0} Tactical`;
        document.getElementById('stat-thermo-val').textContent = `${st.thermonukesFired || 0} Thermos`;
      };

      const populateTitlesDropdown = () => {
        if (!selectCardTitle || !this.currentAccountData) return;
        const currentTitle = this.currentAccountData.battleCard?.equippedTitle || '';
        selectCardTitle.innerHTML = '<option value="">-- No Title Equipped --</option>';

        const unlockedList = this.currentAccountData.unlockedAchievements || [];
        unlockedList.forEach(achId => {
          const ach = this.allAchievementsData[achId];
          if (ach && ach.commanderTitle) {
            const opt = document.createElement('option');
            opt.value = ach.commanderTitle;
            opt.textContent = `"${ach.commanderTitle}" — (${ach.title})`;
            if (ach.commanderTitle === currentTitle) opt.selected = true;
            selectCardTitle.appendChild(opt);
          }
        });
      };

      const updateCardPreview = () => {
        if (!cardPreview || !this.currentAccountData) return;
        const theme = selectCardTheme ? selectCardTheme.value : 'default';
        const opt = selectCardOption ? selectCardOption.value : 1;
        const equippedTitle = selectCardTitle ? selectCardTitle.value : (this.currentAccountData.battleCard?.equippedTitle || '');
        const mockPlayer = {
          id: 'me',
          name: this.playerName || this.currentAccountData.username,
          accountId: this.currentAccountData.username,
          username: this.currentAccountData.username,
          color: this.playerColor || '#00e5ff',
          level: this.currentAccountData.level || 1,
          elo: this.currentAccountData.elo || 1200,
          isAI: false,
          battleCard: { theme, option: opt, equippedTitle, showcasedBadges: this.currentAccountData.battleCard?.showcasedBadges || [] }
        };
        cardPreview.innerHTML = this.renderBattleCardHTML(mockPlayer, true, false, true);

        cardPreview.querySelectorAll('.bcard-achievement-slot').forEach(slot => {
          slot.onclick = () => {
            if (tabStatsAch) tabStatsAch.click();
          };
        });
      };

      const renderAchievementsGallery = () => {
        const galleryEl = document.getElementById('stats-achievements-container');
        if (!galleryEl || !this.currentAccountData) return;

        galleryEl.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'achievements-gallery-grid';

        const cat = filterCategory ? filterCategory.value : 'all';
        const rar = filterRarity ? filterRarity.value : 'all';
        const unlockedList = this.currentAccountData.unlockedAchievements || [];

        Object.keys(this.allAchievementsData).forEach(achId => {
          const ach = this.allAchievementsData[achId];
          const isUnlocked = unlockedList.includes(achId);
          const isShowcased = (this.currentAccountData.battleCard?.showcasedBadges || []).includes(achId);

          // Filtering rules
          if (cat !== 'all' && ach.category !== cat) return;
          if (rar === 'unlocked' && !isUnlocked) return;
          if (rar === 'locked' && isUnlocked) return;
          if (['common', 'rare', 'epic', 'legendary'].includes(rar) && ach.rarity !== rar) return;

          const rarityClass = `ach-glow-${ach.rarity}`;
          const card = document.createElement('div');
          card.className = `achievement-card ${rarityClass} ${isUnlocked ? 'unlocked' : 'locked'}`;

          const iconSvg = window.getAchievementSvgIcon(achId, 30);
          const titleText = (!isUnlocked && ach.secret) ? '???' : ach.title;
          const descText = (!isUnlocked && ach.secret) ? 'Secret achievement. Criteria hidden until unlocked.' : ach.desc;

          card.innerHTML = `
            <div class="ach-icon-box">${iconSvg}</div>
            <div class="ach-info-box">
              <div class="ach-title-row">
                <strong>${titleText}</strong>
                <span class="ach-rarity-pill ${ach.rarity}">${ach.rarity.toUpperCase()} (+${ach.rarity === 'legendary' ? 500 : ach.rarity === 'epic' ? 200 : ach.rarity === 'rare' ? 100 : 50} XP)</span>
              </div>
              <div class="ach-desc">${descText}</div>
            </div>
            ${isUnlocked ? `
              <button class="btn btn-sm ${isShowcased ? 'success-btn' : 'outline-btn'} btn-equip-badge" data-ach-id="${achId}">
                ${isShowcased ? 'Showcased' : 'Showcase'}
              </button>
            ` : ''}
          `;

          const btnEquip = card.querySelector('.btn-equip-badge');
          if (btnEquip) {
            btnEquip.onclick = () => {
              let currentBadges = [...(this.currentAccountData.battleCard?.showcasedBadges || [])];
              if (currentBadges.includes(achId)) {
                currentBadges = currentBadges.filter(id => id !== achId);
                showToast(`Removed <strong>${ach.title}</strong> from Battle Card showcase.`, 'info');
              } else {
                if (currentBadges.length >= 3) {
                  currentBadges.shift(); // rotate first out to maintain max 3
                }
                currentBadges.push(achId);
                showToast(`<i class="fa-solid fa-star"></i> Equipped <strong>${ach.title}</strong> to Battle Card!`, 'success');
              }
              window.SocketClient.updateBattleCard({ ...this.currentAccountData.battleCard, showcasedBadges: currentBadges }, (saveRes) => {
                if (saveRes.success) {
                  this.currentAccountData.battleCard = saveRes.battleCard;
                  renderAchievementsGallery();
                  updateCardPreview();
                }
              });
            };
          }

          grid.appendChild(card);
        });

        galleryEl.appendChild(grid);
      };

      if (filterCategory) filterCategory.onchange = renderAchievementsGallery;
      if (filterRarity) filterRarity.onchange = renderAchievementsGallery;

      if (selectCardTheme) selectCardTheme.onchange = updateCardPreview;
      if (selectCardOption) selectCardOption.onchange = updateCardPreview;
      if (selectCardTitle) selectCardTitle.onchange = updateCardPreview;

      if (btnSaveCard) {
        btnSaveCard.onclick = () => {
          const theme = selectCardTheme.value;
          const option = selectCardOption.value;
          const equippedTitle = selectCardTitle.value;
          window.SocketClient.updateBattleCard({ theme, option, equippedTitle }, (res) => {
            if (res.success) {
              if (this.currentAccountData) this.currentAccountData.battleCard = res.battleCard;
              showToast('<i class="fa-solid fa-check"></i> Battle Card & Title saved!', 'success');
            }
          });
        };
      }

      const hideAllPanels = () => {
        if (statsGrid) statsGrid.style.display = 'none';
        if (cardCustomizer) cardCustomizer.style.display = 'none';
        if (achTab) achTab.style.display = 'none';
        [tabStatsPvp, tabStatsSolo, tabStatsCard, tabStatsAch].forEach(tab => {
          if (tab) tab.className = 'btn outline-btn btn-sm';
        });
      };

      if (tabStatsPvp) {
        tabStatsPvp.onclick = () => {
          hideAllPanels();
          activeStatsMode = 'pvp';
          tabStatsPvp.className = 'btn primary-btn btn-sm';
          if (statsGrid) statsGrid.style.display = 'grid';
          updateStatsDisplay();
        };
      }

      if (tabStatsSolo) {
        tabStatsSolo.onclick = () => {
          hideAllPanels();
          activeStatsMode = 'solo';
          tabStatsSolo.className = 'btn primary-btn btn-sm';
          if (statsGrid) statsGrid.style.display = 'grid';
          updateStatsDisplay();
        };
      }

      if (tabStatsCard) {
        tabStatsCard.onclick = () => {
          hideAllPanels();
          tabStatsCard.className = 'btn primary-btn btn-sm';
          if (cardCustomizer) cardCustomizer.style.display = 'flex';
          updateCardPreview();
        };
      }

      if (tabStatsAch) {
        tabStatsAch.onclick = () => {
          hideAllPanels();
          tabStatsAch.className = 'btn primary-btn btn-sm';
          if (achTab) achTab.style.display = 'flex';
          renderAchievementsGallery();
        };
      }

      const updateAuthUI = (account) => {
        this.currentAccountData = account;
        if (account) {
          this.playerName = account.username;
          const nameInput = document.getElementById('input-player-name');
          if (nameInput) nameInput.value = account.username;
          if (loggedOutView) loggedOutView.style.display = 'none';
          if (loggedInView) loggedInView.style.display = 'flex';
          if (lblUsername) lblUsername.textContent = account.username;
          window.SocketClient.registerOnline();
          if (this.refreshFriendsBadge) this.refreshFriendsBadge();
        } else {
          if (loggedOutView) loggedOutView.style.display = 'flex';
          if (loggedInView) loggedInView.style.display = 'none';
          const badge = document.getElementById('friends-req-badge');
          if (badge) badge.style.display = 'none';
        }
      };

      const savedAuth = localStorage.getItem('factional_risk_account');
      if (savedAuth) {
        try {
          const { username, token } = JSON.parse(savedAuth);
          if (username && token) {
            window.SocketClient.autoLoginAccount(username, token, (res) => {
              if (res.success) updateAuthUI(res.user);
            });
          }
        } catch (e) {
          localStorage.removeItem('factional_risk_account');
        }
      }

      if (btnOpenAuth) btnOpenAuth.onclick = () => authModal && authModal.classList.add('active');
      if (btnCloseAuth) btnCloseAuth.onclick = () => authModal && authModal.classList.remove('active');
      if (btnCloseStats) btnCloseStats.onclick = () => statsModal && statsModal.classList.remove('active');

      let isRegisterMode = false;
      if (tabLogin && tabRegister) {
        tabLogin.onclick = () => {
          isRegisterMode = false;
          tabLogin.className = 'btn primary-btn btn-sm w-full active';
          tabRegister.className = 'btn outline-btn btn-sm w-full';
          btnSubmitAuth.textContent = 'Sign In';
          if (authStatus) authStatus.textContent = '';
        };
        tabRegister.onclick = () => {
          isRegisterMode = true;
          tabRegister.className = 'btn primary-btn btn-sm w-full active';
          tabLogin.className = 'btn outline-btn btn-sm w-full';
          btnSubmitAuth.textContent = 'Create Account';
          if (authStatus) authStatus.textContent = '';
        };
      }

      if (btnSubmitAuth) {
        btnSubmitAuth.onclick = () => {
          const u = inputUser ? inputUser.value.trim() : '';
          const p = inputPass ? inputPass.value : '';
          if (!u || !p) {
            if (authStatus) { authStatus.textContent = 'Please fill in all fields.'; authStatus.style.color = '#ef4444'; }
            return;
          }
          const cb = (res) => {
            if (res.error) {
              if (authStatus) { authStatus.textContent = res.error; authStatus.style.color = '#ef4444'; }
            } else {
              updateAuthUI(res.user);
              if (authModal) authModal.classList.remove('active');
              showToast(`<i class="fa-solid fa-circle-check"></i> Welcome, ${res.user.username}!`, 'success');
              if (inputPass) inputPass.value = '';
            }
          };
          if (isRegisterMode) window.SocketClient.registerAccount(u, p, cb);
          else window.SocketClient.loginAccount(u, p, cb);
        };
      }

      if (btnLogout) {
        btnLogout.onclick = () => {
          window.SocketClient.logoutAccount();
          updateAuthUI(null);
          showToast('Signed out of account.', 'info');
        };
      }

      if (btnViewStats) {
        btnViewStats.onclick = () => {
          const acc = window.SocketClient.currentAccount;
          if (!acc) return;

          window.SocketClient.getAccountStats(acc.username, (res) => {
            if (res.error) { alert(res.error); return; }
            this.currentAccountData = res.user;
            this.allAchievementsData = res.allAchievements || {};
            const u = res.user;

            document.getElementById('lbl-stats-modal-user').textContent = u.username;
            const insignia = this.getRankInsigniaInfo(u.level, false);
            const badgeEl = document.getElementById('my-profile-insignia-badge');
            if (badgeEl) {
              badgeEl.className = `rank-insignia-icon insignia-sm ${insignia.tierClass}`;
              badgeEl.innerHTML = insignia.icon;
            }
            document.getElementById('lbl-profile-rank-title').textContent = `Rank: ${insignia.rankTitle}`;
            document.getElementById('lbl-profile-level-num').textContent = u.level || 1;
            document.getElementById('lbl-profile-xp-current').textContent = u.currentXP || 0;
            document.getElementById('lbl-profile-xp-needed').textContent = u.xpNeeded || 100;
            const eloEl = document.getElementById('lbl-profile-elo');
            if (eloEl) eloEl.textContent = u.elo || 1200;

            const inputBio = document.getElementById('input-profile-bio');
            if (inputBio) inputBio.value = u.bio || '';
            const btnSaveBio = document.getElementById('btn-save-bio');
            if (btnSaveBio) {
              btnSaveBio.onclick = () => {
                const bioVal = inputBio.value.trim();
                window.SocketClient.updateBio(bioVal, (res) => {
                  if (res && res.success) {
                    showToast('Bio updated successfully!', 'success');
                  }
                });
              };
            }

            const pct = Math.min(100, Math.round(((u.currentXP || 0) / (u.xpNeeded || 100)) * 100));
            document.getElementById('profile-xp-bar-fill').style.width = `${pct}%`;

            if (selectCardTheme && u.battleCard) selectCardTheme.value = u.battleCard.theme || 'default';
            if (selectCardOption && u.battleCard) selectCardOption.value = u.battleCard.option || 1;
            populateTitlesDropdown();

            if (tabStatsPvp) tabStatsPvp.click();
            if (statsModal) statsModal.classList.add('active');
          });
        };
      }
    }

    initFriendsUI() {
      const btnOpenFriends = document.getElementById('btn-open-friends-modal');
      const modalFriends = document.getElementById('friends-modal');
      const btnCloseFriends = document.getElementById('btn-close-friends-modal');
      const reqBadge = document.getElementById('friends-req-badge');
      const lblReqBadge = document.getElementById('lbl-requests-badge');
      const lblFriendsUnreadBadge = document.getElementById('lbl-friends-unread-badge');

      const tabFriends = document.getElementById('tab-friends-list');
      const tabRequests = document.getElementById('tab-friends-requests');
      const paneFriends = document.getElementById('pane-friends-list');
      const paneRequests = document.getElementById('pane-friends-requests');

      const viewMain = document.getElementById('view-friends-main');
      const viewDm = document.getElementById('view-friends-dm');
      const btnBackToList = document.getElementById('btn-back-to-friends-list');

      const inputAddFriend = document.getElementById('input-add-friend-username');
      const btnSendFriendReq = document.getElementById('btn-send-friend-request');

      const friendsContainer = document.getElementById('friends-list-container');
      const incomingContainer = document.getElementById('incoming-requests-container');
      const sentContainer = document.getElementById('sent-requests-container');
      const lblFriendsCount = document.getElementById('lbl-friends-count');

      const dmFriendDot = document.getElementById('dm-active-friend-dot');
      const dmFriendName = document.getElementById('dm-active-friend-name');
      const dmMessagesBox = document.getElementById('dm-messages-container');
      const inputDmText = document.getElementById('input-dm-text');
      const btnSendDm = document.getElementById('btn-send-dm');

      let currentDmFriend = null;
      let cachedFriendsData = null;
      let incomingRequestsCount = 0;
      let totalUnreadDmsCount = 0;
      const unreadByFriend = new Map();

      const refreshBadge = () => {
        const total = incomingRequestsCount + totalUnreadDmsCount;
        if (total > 0) {
          if (reqBadge) {
            reqBadge.textContent = total;
            reqBadge.style.display = 'inline-block';
          }
        } else {
          if (reqBadge) reqBadge.style.display = 'none';
        }

        if (lblReqBadge) {
          if (incomingRequestsCount > 0) {
            lblReqBadge.textContent = incomingRequestsCount;
            lblReqBadge.style.display = 'inline-block';
          } else {
            lblReqBadge.style.display = 'none';
          }
        }

        if (lblFriendsUnreadBadge) {
          if (totalUnreadDmsCount > 0) {
            lblFriendsUnreadBadge.textContent = totalUnreadDmsCount;
            lblFriendsUnreadBadge.style.display = 'inline-block';
          } else {
            lblFriendsUnreadBadge.style.display = 'none';
          }
        }
      };

      this.refreshFriendsBadge = () => {
        window.SocketClient.getFriends((res) => {
          if (res && res.success) {
            incomingRequestsCount = (res.receivedRequests || []).length;
            totalUnreadDmsCount = res.totalUnreadDms || 0;
            unreadByFriend.clear();
            if (res.friends) {
              res.friends.forEach(f => {
                if (f.unreadCount > 0) {
                  unreadByFriend.set(f.username.toLowerCase(), f.unreadCount);
                }
              });
            }
            refreshBadge();
          }
        });
      };

      const renderFriendsList = (friends) => {
        if (!friendsContainer) return;
        if (lblFriendsCount) lblFriendsCount.textContent = friends.length;

        if (friends.length === 0) {
          friendsContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 30px 10px; font-style: italic;">
              <i class="fa-solid fa-user-group" style="font-size: 24px; opacity: 0.4; display: block; margin-bottom: 8px;"></i>
              No comrades yet. Enter a commander's username above to forge an alliance!
            </div>
          `;
          return;
        }

        const inRoom = !!window.SocketClient.roomCode;
        const currentRoomCode = window.SocketClient.roomCode;

        friendsContainer.innerHTML = friends.map(f => {
          const statusColor = f.isOnline ? '#10b981' : '#64748b';
          const statusTitle = f.isOnline ? 'Online' : 'Offline';
          const cardTheme = (f.battleCard && f.battleCard.theme) ? f.battleCard.theme : 'default';
          const cardOpt = (f.battleCard && f.battleCard.option) ? f.battleCard.option : 1;
          const unreadCount = unreadByFriend.get(f.username.toLowerCase()) || f.unreadCount || 0;
          const unreadBadge = unreadCount > 0 
            ? `<span style="background: #ef4444; color: #fff; border-radius: 10px; font-size: 9px; font-weight: 800; padding: 1px 6px; box-shadow: 0 0 6px #ef4444;" title="${unreadCount} unread transmission(s)">${unreadCount} NEW</span>`
            : '';

          return `
            <div class="glass" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 8px; border: 1px solid ${unreadCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-glass)'}; background: ${unreadCount > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0,0,0,0.25)'};">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 ${f.isOnline ? '6px' : '0px'} ${statusColor}; flex-shrink: 0;" title="${statusTitle}"></span>
                <div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <strong style="color: #fff; font-size: 13px;">${f.username}</strong>
                    ${unreadBadge}
                    <span style="font-size: 10px; color: #10b981; font-weight: 700;"><i class="fa-solid fa-trophy"></i> ${f.elo || 1200}</span>
                  </div>
                  <span style="font-size: 10.5px; color: var(--text-muted);">Lvl ${f.level || 1} • <span style="color: ${statusColor}; font-weight: 600;">${statusTitle}</span></span>
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${inRoom ? (
                  f.isOnline ? `
                    <button class="btn success-btn btn-sm btn-friend-invite" data-username="${f.username}" title="Invite to current lobby (${currentRoomCode})" style="font-size: 10.5px; padding: 3px 8px;">
                      <i class="fa-solid fa-paper-plane"></i> Invite
                    </button>
                  ` : `
                    <button class="btn outline-btn btn-sm" disabled title="${f.username} is currently offline" style="font-size: 10.5px; padding: 3px 8px; opacity: 0.45; cursor: not-allowed;">
                      <i class="fa-solid fa-paper-plane"></i> Invite
                    </button>
                  `
                ) : ''}
                <button class="btn primary-btn btn-sm btn-friend-dm" data-username="${f.username}" data-online="${f.isOnline ? '1' : '0'}" title="Direct Transmission" style="font-size: 10.5px; padding: 3px 8px;">
                  <i class="fa-solid fa-comment-dots"></i> Message
                </button>
                <button class="btn outline-btn btn-sm btn-friend-remove" data-username="${f.username}" title="Remove Friend" style="font-size: 10.5px; padding: 3px 8px; border-color: rgba(239,68,68,0.4); color: #ef4444;">
                  <i class="fa-solid fa-user-xmark"></i>
                </button>
              </div>
            </div>
          `;
        }).join('');

        // Wire Action Buttons
        friendsContainer.querySelectorAll('.btn-friend-invite').forEach(btn => {
          btn.onclick = () => {
            const targetUser = btn.dataset.username;
            if (!currentRoomCode) return;
            btn.disabled = true;
            window.SocketClient.inviteFriendToLobby(targetUser, currentRoomCode, (res) => {
              btn.disabled = false;
              if (res.error) showToast(res.error, 'warning');
              else showToast(`<i class="fa-solid fa-envelope-circle-check"></i> Invite dispatched to ${targetUser}!`, 'success');
            });
          };
        });

        friendsContainer.querySelectorAll('.btn-friend-dm').forEach(btn => {
          btn.onclick = () => {
            const targetUser = btn.dataset.username;
            const isOnline = btn.dataset.online === '1';
            openDmView(targetUser, isOnline);
          };
        });

        friendsContainer.querySelectorAll('.btn-friend-remove').forEach(btn => {
          btn.onclick = async () => {
            const targetUser = btn.dataset.username;
            if (window.showConfirm) {
              const ok = await window.showConfirm(`Sever military alliance with commander ${targetUser}?`, {
                title: 'Sever Alliance',
                okLabel: 'Remove',
                cancelLabel: 'Keep',
                danger: true
              });
              if (!ok) return;
            }
            window.SocketClient.removeFriend(targetUser, (res) => {
              if (res.error) showToast(res.error, 'error');
              else {
                showToast(`Commander ${targetUser} removed from friends.`, 'info');
                loadFriendsData();
              }
            });
          };
        });
      };

      const renderRequestsList = (incoming, sent) => {
        if (!incomingContainer || !sentContainer) return;

        if (incoming.length === 0) {
          incomingContainer.innerHTML = '<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">No incoming friend requests.</span>';
        } else {
          incomingContainer.innerHTML = incoming.map(r => `
            <div class="glass" style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-radius: 6px; background: rgba(0,0,0,0.2);">
              <div>
                <strong style="color: #fff; font-size: 12.5px;">${r.username}</strong>
                <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">Lvl ${r.level || 1} • <i class="fa-solid fa-trophy" style="color: #10b981;"></i> ${r.elo || 1200}</span>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="btn success-btn btn-sm btn-req-accept" data-username="${r.username}" style="font-size: 10px; padding: 2px 7px;">
                  <i class="fa-solid fa-check"></i> Accept
                </button>
                <button class="btn outline-btn btn-sm btn-req-decline" data-username="${r.username}" style="font-size: 10px; padding: 2px 7px; border-color: #ef4444; color: #ef4444;">
                  <i class="fa-solid fa-xmark"></i> Decline
                </button>
              </div>
            </div>
          `).join('');

          incomingContainer.querySelectorAll('.btn-req-accept').forEach(btn => {
            btn.onclick = () => {
              const fromUser = btn.dataset.username;
              btn.disabled = true;
              window.SocketClient.respondFriendRequest(fromUser, true, (res) => {
                if (res.error) showToast(res.error, 'error');
                else {
                  showToast(`<i class="fa-solid fa-handshake"></i> You and ${fromUser} are now friends!`, 'success');
                  loadFriendsData();
                }
              });
            };
          });

          incomingContainer.querySelectorAll('.btn-req-decline').forEach(btn => {
            btn.onclick = () => {
              const fromUser = btn.dataset.username;
              btn.disabled = true;
              window.SocketClient.respondFriendRequest(fromUser, false, (res) => {
                if (res.error) showToast(res.error, 'error');
                else {
                  showToast(`Request from ${fromUser} declined.`, 'info');
                  loadFriendsData();
                }
              });
            };
          });
        }

        if (sent.length === 0) {
          sentContainer.innerHTML = '<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">No pending outgoing requests.</span>';
        } else {
          sentContainer.innerHTML = sent.map(s => `
            <div class="glass" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,0.15);">
              <div>
                <span style="color: #fff; font-size: 12px;">${s.username}</span>
                <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(Pending transmission)</span>
              </div>
              <button class="btn outline-btn btn-sm btn-cancel-sent-req" data-username="${s.username}" style="font-size: 9.5px; padding: 2px 6px; border-color: rgba(255,255,255,0.2); color: var(--text-muted);">
                Cancel
              </button>
            </div>
          `).join('');

          sentContainer.querySelectorAll('.btn-cancel-sent-req').forEach(btn => {
            btn.onclick = () => {
              const target = btn.dataset.username;
              window.SocketClient.removeFriend(target, () => {
                showToast(`Cancelled request to ${target}.`, 'info');
                loadFriendsData();
              });
            };
          });
        }
      };

      const loadFriendsData = () => {
        window.SocketClient.getFriends((res) => {
          if (res.error) {
            showToast(res.error, 'error');
            return;
          }
          cachedFriendsData = res;
          incomingRequestsCount = (res.receivedRequests || []).length;
          totalUnreadDmsCount = res.totalUnreadDms || 0;
          unreadByFriend.clear();
          if (res.friends) {
            res.friends.forEach(f => {
              if (f.unreadCount > 0) {
                unreadByFriend.set(f.username.toLowerCase(), f.unreadCount);
              }
            });
          }
          refreshBadge();
          renderFriendsList(res.friends || []);
          renderRequestsList(res.receivedRequests || [], res.sentRequests || []);
        });
      };

      const openDmView = (friendUsername, isOnline) => {
        currentDmFriend = friendUsername;
        if (viewMain) viewMain.style.display = 'none';
        if (viewDm) viewDm.style.display = 'flex';

        // Clear unread count for this friend immediately
        const friendKey = friendUsername.toLowerCase();
        const prevCount = unreadByFriend.get(friendKey) || 0;
        if (prevCount > 0) {
          totalUnreadDmsCount = Math.max(0, totalUnreadDmsCount - prevCount);
          unreadByFriend.delete(friendKey);
          refreshBadge();
          if (cachedFriendsData && cachedFriendsData.friends) {
            const fr = cachedFriendsData.friends.find(x => x.username.toLowerCase() === friendKey);
            if (fr) fr.unreadCount = 0;
            renderFriendsList(cachedFriendsData.friends);
          }
        }

        if (dmFriendName) dmFriendName.textContent = friendUsername;
        if (dmFriendDot) {
          dmFriendDot.style.background = isOnline ? '#10b981' : '#64748b';
          dmFriendDot.style.boxShadow = isOnline ? '0 0 6px #10b981' : 'none';
        }
        if (dmMessagesBox) dmMessagesBox.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px;">Loading secure communications...</div>';

        window.SocketClient.getDirectMessages(friendUsername, (res) => {
          if (res.error) {
            if (dmMessagesBox) dmMessagesBox.innerHTML = `<div style="color: #ef4444; font-size: 11px;">${res.error}</div>`;
            return;
          }
          renderDmMessages(res.messages || []);
        });
      };

      const renderDmMessages = (messages) => {
        if (!dmMessagesBox) return;
        if (messages.length === 0) {
          dmMessagesBox.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 30px 10px; font-style: italic;">
              <i class="fa-solid fa-lock" style="display: block; font-size: 20px; opacity: 0.3; margin-bottom: 6px;"></i>
              Channel secure. Send a direct transmission to commander ${currentDmFriend}.
            </div>
          `;
          return;
        }

        const myUsername = (this.currentAccountData && this.currentAccountData.username) || '';

        dmMessagesBox.innerHTML = messages.map(m => {
          const isMe = m.from.toLowerCase() === myUsername.toLowerCase();
          const align = isMe ? 'flex-end' : 'flex-start';
          const bubbleBg = isMe ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.07)';
          const borderCol = isMe ? 'rgba(0, 229, 255, 0.4)' : 'var(--border-glass)';
          const nameCol = isMe ? 'var(--primary)' : '#38bdf8';

          return `
            <div style="display: flex; flex-direction: column; align-items: ${align}; max-width: 80%;">
              <div style="font-size: 9.5px; color: var(--text-muted); margin-bottom: 2px; padding: 0 4px;">
                <span style="color: ${nameCol}; font-weight: 700;">${isMe ? 'You' : m.from}</span> • ${m.timestamp || ''}
              </div>
              <div style="padding: 7px 11px; border-radius: 8px; background: ${bubbleBg}; border: 1px solid ${borderCol}; font-size: 12px; color: #fff; word-break: break-word;">
                ${m.text}
              </div>
            </div>
          `;
        }).join('');

        dmMessagesBox.scrollTop = dmMessagesBox.scrollHeight;
      };

      // Wire Navigation and Events
      if (btnBackToList) {
        btnBackToList.onclick = () => {
          currentDmFriend = null;
          if (viewDm) viewDm.style.display = 'none';
          if (viewMain) viewMain.style.display = 'block';
        };
      }

      const lobbyBanner = document.getElementById('friends-lobby-banner');
      const lobbyCodeLbl = document.getElementById('friends-lobby-code');
      const btnLobbyInvite = document.getElementById('btn-lobby-invite-friends');
      const btnRosterInvite = document.getElementById('btn-roster-invite-friends');

      const openFriendsModal = () => {
        if (!this.currentAccountData) {
          showToast('Please log in to manage your comrades & transmissions.', 'warning');
          return;
        }

        const currentRoomCode = window.SocketClient.roomCode;
        if (lobbyBanner && lobbyCodeLbl) {
          if (currentRoomCode) {
            lobbyCodeLbl.textContent = currentRoomCode;
            lobbyBanner.style.display = 'flex';
          } else {
            lobbyBanner.style.display = 'none';
          }
        }

        if (viewDm) viewDm.style.display = 'none';
        if (viewMain) viewMain.style.display = 'block';
        if (tabFriends) tabFriends.click();
        loadFriendsData();
        if (modalFriends) modalFriends.classList.add('active');
      };

      if (btnOpenFriends) btnOpenFriends.onclick = openFriendsModal;
      if (btnLobbyInvite) btnLobbyInvite.onclick = openFriendsModal;
      if (btnRosterInvite) btnRosterInvite.onclick = openFriendsModal;

      if (btnCloseFriends) {
        btnCloseFriends.onclick = () => {
          currentDmFriend = null;
          if (modalFriends) modalFriends.classList.remove('active');
        };
      }

      if (tabFriends && tabRequests) {
        tabFriends.onclick = () => {
          tabFriends.className = 'btn primary-btn btn-sm w-full active';
          tabRequests.className = 'btn outline-btn btn-sm w-full';
          if (paneFriends) paneFriends.style.display = 'block';
          if (paneRequests) paneRequests.style.display = 'none';
        };
        tabRequests.onclick = () => {
          tabRequests.className = 'btn primary-btn btn-sm w-full active';
          tabFriends.className = 'btn outline-btn btn-sm w-full';
          if (paneFriends) paneFriends.style.display = 'none';
          if (paneRequests) paneRequests.style.display = 'block';
        };
      }

      if (btnSendFriendReq && inputAddFriend) {
        btnSendFriendReq.onclick = () => {
          const target = inputAddFriend.value.trim();
          if (!target) return;
          btnSendFriendReq.disabled = true;
          window.SocketClient.sendFriendRequest(target, (res) => {
            btnSendFriendReq.disabled = false;
            if (res.error) showToast(res.error, 'warning');
            else {
              showToast(`<i class="fa-solid fa-paper-plane"></i> Friend request dispatched to ${target}!`, 'success');
              inputAddFriend.value = '';
              loadFriendsData();
            }
          });
        };
        inputAddFriend.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btnSendFriendReq.click();
        });
      }

      const executeSendDm = () => {
        if (!currentDmFriend || !inputDmText) return;
        const text = inputDmText.value.trim();
        if (!text) return;
        btnSendDm.disabled = true;
        window.SocketClient.sendDirectMessage(currentDmFriend, text, (res) => {
          btnSendDm.disabled = false;
          if (res.error) showToast(res.error, 'error');
          else {
            inputDmText.value = '';
            // Refresh conversation messages
            window.SocketClient.getDirectMessages(currentDmFriend, (dmRes) => {
              if (dmRes.success) renderDmMessages(dmRes.messages || []);
            });
          }
        });
      };

      if (btnSendDm && inputDmText) {
        btnSendDm.onclick = executeSendDm;
        inputDmText.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') executeSendDm();
        });
      }

      // Live Server Push Notifications
      window.SocketClient.onFriendRequestReceived((data) => {
        showToast(`<i class="fa-solid fa-user-plus" style="color: #38bdf8;"></i> Incoming alliance request from <strong>${data.fromUsername}</strong>!`, 'info');
        this.refreshFriendsBadge();
        if (modalFriends && modalFriends.classList.contains('active')) {
          loadFriendsData();
        }
      });

      window.SocketClient.onFriendRequestResolved((data) => {
        if (data.accepted) {
          showToast(`<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> Commander <strong>${data.byUsername}</strong> accepted your alliance request!`, 'success');
        } else {
          showToast(`Commander ${data.byUsername} declined your alliance request.`, 'info');
        }
        if (modalFriends && modalFriends.classList.contains('active')) {
          loadFriendsData();
        }
      });

      window.SocketClient.onFriendPresenceUpdate((data) => {
        if (cachedFriendsData && cachedFriendsData.friends) {
          const friend = cachedFriendsData.friends.find(f => f.username.toLowerCase() === data.username.toLowerCase());
          if (friend) {
            friend.isOnline = data.isOnline;
            renderFriendsList(cachedFriendsData.friends);
          }
        }
        if (currentDmFriend && currentDmFriend.toLowerCase() === data.username.toLowerCase()) {
          if (dmFriendDot) {
            dmFriendDot.style.background = data.isOnline ? '#10b981' : '#64748b';
            dmFriendDot.style.boxShadow = data.isOnline ? '0 0 6px #10b981' : 'none';
          }
        }
      });

      window.SocketClient.onDirectMessageReceived((msg) => {
        const fromKey = (msg.from || '').toLowerCase();
        const isCurrentlyChatting = currentDmFriend && currentDmFriend.toLowerCase() === fromKey && modalFriends && modalFriends.classList.contains('active') && viewDm && viewDm.style.display !== 'none';

        if (isCurrentlyChatting) {
          // If DM panel is actively open for this friend, append message
          window.SocketClient.getDirectMessages(currentDmFriend, (res) => {
            if (res.success) renderDmMessages(res.messages || []);
          });
        } else {
          // Increment unread count & show red notification badge!
          const currentUnread = unreadByFriend.get(fromKey) || 0;
          unreadByFriend.set(fromKey, currentUnread + 1);
          totalUnreadDmsCount++;
          refreshBadge();

          if (cachedFriendsData && cachedFriendsData.friends) {
            const fr = cachedFriendsData.friends.find(x => x.username.toLowerCase() === fromKey);
            if (fr) fr.unreadCount = (fr.unreadCount || 0) + 1;
            renderFriendsList(cachedFriendsData.friends);
          }

          showToast(`💬 <strong>${msg.from}</strong>: ${msg.text.slice(0, 45)}${msg.text.length > 45 ? '...' : ''}`, 'info');
        }
      });

      window.SocketClient.onLobbyInviteReceived((data) => {
        const inviteToastHtml = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 12px;"><i class="fa-solid fa-gamepad" style="color: var(--primary);"></i> <strong>${data.sender}</strong> invited you to match <strong>${data.roomCode}</strong>!</div>
            <button class="btn success-btn btn-sm" id="btn-toast-join-${data.roomCode}" style="font-size: 11px; padding: 5px 12px; align-self: flex-start; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);">
              <i class="fa-solid fa-arrow-right-to-bracket"></i> Join Lobby Now
            </button>
          </div>
        `;
        const toastEl = showToast(inviteToastHtml, 'info', 15000);

        setTimeout(() => {
          const joinBtn = document.getElementById(`btn-toast-join-${data.roomCode}`);
          if (joinBtn) {
            joinBtn.onclick = (e) => {
              e.stopPropagation();
              if (toastEl && toastEl.remove) toastEl.remove();
              if (modalFriends) modalFriends.classList.remove('active');
              this.joinRoomByCode(data.roomCode);
            };
          }
        }, 50);
      });

      window.SocketClient.onFriendRemoved((data) => {
        showToast(`Commander ${data.byUsername} severed the military alliance.`, 'info');
        if (modalFriends && modalFriends.classList.contains('active')) {
          loadFriendsData();
        }
      });
    }
  }

  function initShowConfirm() {
    if (window.showConfirm) return;

    window.showConfirm = (message, options = {}) => new Promise((resolve) => {
      const isDanger = !!options.danger;
      const okLabel = options.okLabel || 'Confirm';
      const cancelLabel = options.cancelLabel || 'Cancel';
      const title = options.title || (isDanger ? 'Confirm Action' : 'Confirm');

      const overlay = document.createElement('div');
      overlay.className = 'modal confirm-modal';
      overlay.style.zIndex = '100000';

      overlay.innerHTML = `
        <div class="modal-content glass confirm-modal-content" role="alertdialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <div class="modal-header">
            <h2 id="confirm-modal-title"><i class="fa-solid ${isDanger ? 'fa-triangle-exclamation' : 'fa-circle-question'}" style="margin-right: 8px; color: ${isDanger ? 'var(--danger)' : 'var(--primary)'};"></i>${title}</h2>
          </div>
          <div class="modal-body" style="padding-bottom: 18px;"></div>
          <div class="confirm-modal-actions">
            <button type="button" class="btn outline-btn" data-confirm-cancel>${cancelLabel}</button>
            <button type="button" class="btn ${isDanger ? 'danger-btn' : 'primary-btn'}" data-confirm-ok>${okLabel}</button>
          </div>
        </div>
      `;

      const bodyEl = overlay.querySelector('.modal-body');
      const p = document.createElement('p');
      p.textContent = message;
      bodyEl.appendChild(p);

      document.body.appendChild(overlay);

      let settled = false;
      const prevOverflow = document.body.style.overflow;

      const close = (result) => {
        if (settled) return;
        settled = true;
        document.body.style.overflow = prevOverflow;
        document.removeEventListener('keydown', onKey);
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 220);
        resolve(result);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter') close(true);
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });
      overlay.querySelector('[data-confirm-ok]').addEventListener('click', () => close(true));
      overlay.querySelector('[data-confirm-cancel]').addEventListener('click', () => close(false));
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        overlay.classList.add('active');
        overlay.querySelector('[data-confirm-ok]').focus();
      });
    });
  }

  // Initialize SPA
  window.addEventListener('load', () => {
    initShowConfirm();
    window.MainController = new MainController();
  });

})();
