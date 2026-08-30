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
      this.setMapTheme(this.mapTheme);

      this.initMenu();
      this.initLobby();
      this.initAudio();
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

    initMenu() {
      // Color presets selection
      const presets = document.querySelectorAll('.color-preset');
      const customColorPicker = document.getElementById('input-player-color');

      presets.forEach(p => {
        p.addEventListener('click', () => {
          presets.forEach(pr => pr.classList.remove('active'));
          p.classList.add('active');
          this.playerColor = p.getAttribute('data-color');
          if (customColorPicker) {
            customColorPicker.value = this.playerColor;
          }
        });
      });

      if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
          presets.forEach(pr => pr.classList.remove('active'));
          this.playerColor = e.target.value;
        });
      }

      // Name input
      const nameInput = document.getElementById('input-player-name');
      nameInput.addEventListener('input', (e) => {
        this.playerName = e.target.value.trim() || 'Commander';
      });

      // Bind Map Theme selectors across screens (added select-lobby-theme support)
      ['select-menu-theme', 'select-game-theme', 'select-editor-theme', 'select-lobby-theme'].forEach(id => {
        const selectEl = document.getElementById(id);
        if (selectEl) {
          selectEl.value = this.mapTheme;
          selectEl.addEventListener('change', (e) => {
            this.setMapTheme(e.target.value);
          });
        }
      });

      // Create lobby button — pick a battleground first
      document.getElementById('btn-create-lobby').addEventListener('click', () => {
        this.showMapSelectionModal().then((choice) => {
          if (choice === 'earth') {
            this.launchWithBuiltInMap('earth_map.json');
          } else if (choice === 'upload') {
            this.promptUploadMap();
          } else if (choice === 'default') {
            this.selectedMap = DEFAULT_MAP;
            this.createLobbyRoom();
          }
          // choice === null (cancelled) → do nothing
        });
      });

      // Join lobby button
      document.getElementById('btn-join-lobby').addEventListener('click', () => {
        const code = document.getElementById('input-room-code').value.trim().toUpperCase();
        if (code.length !== 4) {
          alert('Room code must be exactly 4 letters.');
          return;
        }

        window.SocketClient.joinRoom(code, this.playerName, this.playerColor, (res) => {
          if (res.error) {
            alert(res.error);
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
          }
        });
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

        window.SocketClient.watchAIBattle(map, aiCount, selectedMode, asNormal, disableNations, honorPremadeAlliances, disabledNationIds, cardTradeRule, generativeAIMode, llmProviderConfig, reqBlizzardCount, reqStartingNukes, reqStartingThermonukes, reqAllowCrafting, (res) => {
          if (res.error) { alert(res.error); return; }

          window.SocketClient.mapData = res.mapData;
          this.showScreen('game');

          // Remove any old spectator banner
          const oldBanner = document.getElementById('spectator-banner');
          if (oldBanner) oldBanner.remove();

          // Inject spectator banner with Speed Control!
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
              const speedVal = e.target.value;
              window.SocketClient.changeAISpeed(speedVal, (res) => {
                if (res.error) {
                  console.error('Failed to change AI speed:', res.error);
                }
              });
            });
          }

          // Hide all player controls — spectator is read-only
          const controlIds = [
            'btn-end-phase', 'btn-trade-cards', 'btn-quit-game',
            'btn-diplomacy', 'btn-submit-pact', 'chk-auto-attack', 'chk-auto-defend',
            'attack-dice-modal', 'defend-dice-modal', 'post-attack-modal'
          ];
          controlIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });

          // Initialize game display with the returned state
          this.gameClient.allPlayers = res.players;
          this.gameClient.startCampaign(res.mapData, res.gameState);
        });
      });

      // Open editor button
      document.getElementById('btn-open-editor').addEventListener('click', () => {
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
      window.SocketClient.createRoom(this.playerName, this.playerColor, this.selectedMap, (res) => {
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
      fetch(`/${filename}`)
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
        window.SocketClient.startGame((res) => {
          if (res.error) alert(res.error);
        });
      });

      // Game Mode change (host only)
      const lobbyModeSelect = document.getElementById('lobby-game-mode');
      if (lobbyModeSelect) {
        lobbyModeSelect.addEventListener('change', (e) => {
          window.SocketClient.updateGameMode(e.target.value, (res) => {
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
        if (spectatorMode !== undefined) window.SocketClient.spectatorMode = !!spectatorMode;
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

      if (!box || !select || !desc) return;

      const disabledSet = new Set(this.currentRoomDisabledNationIds || []);

      const isHost = !!this.isLobbyHost;

      if (map && map.isScenario) {
        // Toggle configurations based on whether the current user is the host
        if (asNormalContainer) asNormalContainer.style.display = isHost ? 'flex' : 'none';
        if (disableNationsContainer) disableNationsContainer.style.display = isHost ? 'flex' : 'none';

        const hasPremadeAlliances = !!(map.premadeAlliances && map.premadeAlliances.length > 0);
        if (premadeAlliancesContainer) premadeAlliancesContainer.style.display = (hasPremadeAlliances && isHost) ? 'flex' : 'none';

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
                window.SocketClient.toggleSpecificNation(n.id, disable, () => {});
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
            window.SocketClient.toggleNormalMapRules(checked, () => {});
          };
        }

        if (disableNationsChk) {
          disableNationsChk.onchange = () => {
            const checked = disableNationsChk.checked;
            if (checked && asNormalChk) asNormalChk.checked = false;
            const hideNationBox = (asNormalChk && asNormalChk.checked) || (disableNationsChk && disableNationsChk.checked);
            if (box) box.style.display = hideNationBox ? 'none' : 'block';
            window.SocketClient.toggleDisableNations(checked, () => {});
          };
        }

        if (premadeAlliancesChk) {
          premadeAlliancesChk.onchange = () => {
            const checked = premadeAlliancesChk.checked;
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
        box.style.display = 'none';
      }
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
              () => {}
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

    renderLobbyPreview() {
      const container = document.getElementById('lobby-map-preview-container');
      container.innerHTML = '';
      const renderer = new window.SVGRenderer('lobby-map-preview-container', { isEditor: false });
      renderer.render(this.selectedMap);
    }

    initAudio() {
      const defaultTracks = ['imagesandsounds/conflict1.mp3', 'imagesandsounds/conflict2.mp3'];
      let currentTrackIdx = 0;
      this.bgMusic = new Audio();
      this.bgMusic.volume = 0.2;
      this.isMusicMuted = true;
      this.isSFXMuted = false; // SFX plays by default!

      this.updateBGMTrack = () => {
        const isAnime = this.mapTheme === 'anime';
        const targetSrc = isAnime ? 'imagesandsounds/animesong.mp3' : defaultTracks[currentTrackIdx];

        if (!this.bgMusic.src.endsWith(targetSrc)) {
          const wasPlaying = !this.bgMusic.paused;
          this.bgMusic.src = targetSrc;
          this.bgMusic.loop = isAnime; // Loop animesong continuously
          if (wasPlaying && !this.isMusicMuted) {
            this.bgMusic.play().catch(() => {});
          }
        }
      };

      this.updateBGMTrack();

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
        btnToggle.addEventListener('click', () => {
          this.isMusicMuted = !this.isMusicMuted;
          if (this.isMusicMuted) {
            this.bgMusic.pause();
            btnToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            btnToggle.classList.add('muted');
          } else {
            this.bgMusic.play().catch(err => {
              console.log('Audio playback blocked by browser');
            });
            btnToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            btnToggle.classList.remove('muted');
          }
        });
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
