(function() {

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    document.body.appendChild(toast);

    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';

    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);

    const durations = { info: 4500, success: 4000, warning: 5500, error: 7500 };
    const delay = durations[type] || 4500;

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, delay);
  }

  // Expose the toast system globally so editor.js and main-controller.js can
  // use it too. (They load before this file, but every call happens after page
  // load, when this assignment has already run.)
  window.showToast = showToast;

  // Redirect every legacy native alert() call to a styled toast. Messages are
  // auto-classified as errors vs. informational based on their wording.
  if (!window.__toastShimInstalled) {
    window.__toastShimInstalled = true;
    window.alert = (msg) => {
      const text = String(msg || '');
      const looksLikeError = /error|invalid|fail|already|must|only accepts|cannot|can't|not allowed|denied|exceeded|required|invalid|at least/i.test(text);
      showToast(text, looksLikeError ? 'error' : 'info');
    };
  }

  class GameClient {
    constructor() {
      this.gameState = null;
      this.renderer = null;

      // Interaction States
      this.selectedSourceId = null;
      this.selectedTargetId = null;

      // Fast Draft Placement state
      this.draftStepSize = 1;
      this.activeDraftTerritoryId = null;

      // Cards selected for trading
      this.selectedCardIndices = [];
      this.lastProcessedRollId = null;

      // Combat Overlay Timeout references
      this.combatRevealTimeout = null;
      this.combatCloseTimeout = null; 

      // DOM Elements
      this.lblTurnName = document.getElementById('game-current-turn-name');
      this.lblPhaseName = document.getElementById('game-current-phase-name');
      this.lblInstructions = document.getElementById('game-instruction-banner');
      this.btnEndPhase = document.getElementById('btn-end-phase');
      this.badgeReinforcements = document.getElementById('game-reinforcements-container');
      this.lblReinforcementsCount = document.getElementById('game-reinforcements-count');
      
      this.playersList = document.getElementById('game-players-list');
      this.activePactsList = document.getElementById('game-active-pacts');
      this.cardsList = document.getElementById('game-cards-list');
      this.btnTradeCards = document.getElementById('btn-trade-cards');
      this.btnAutoSelectCards = document.getElementById('btn-auto-select-cards');
      this.btnTradeAllCards = document.getElementById('btn-trade-all-cards');
      this.selectCardTargetTerritory = document.getElementById('select-card-target-territory');

      this.draftBatchToolbar = document.getElementById('draft-batch-toolbar');
      this.btnOpenDraftModal = document.getElementById('btn-open-draft-modal');
      this.draftTroopsModal = document.getElementById('draft-troops-modal');
      this.lblDraftModalTerritory = document.getElementById('lbl-draft-modal-territory');
      this.lblDraftModalPool = document.getElementById('lbl-draft-modal-pool');
      this.inputDraftModalAmount = document.getElementById('input-draft-modal-amount');
      this.sliderDraftModalAmount = document.getElementById('slider-draft-modal-amount');
      this.btnCancelDraftModal = document.getElementById('btn-cancel-draft-modal');
      this.btnSubmitDraftModal = document.getElementById('btn-submit-draft-modal');
      
      this.chatMessages = document.getElementById('game-chat-messages');
      this.chatInput = document.getElementById('game-chat-input');
      this.btnSendChat = document.getElementById('btn-send-chat');
      this.logMessages = document.getElementById('game-log');

      // Diplomacy Modal elements
      this.diplomacyModal = document.getElementById('diplomacy-modal');
      this.btnOpenDiplomacy = document.getElementById('btn-open-diplomacy-modal');
      this.btnCloseDiplomacy = document.getElementById('btn-close-diplomacy-modal');
      this.selectDiplomacyTarget = document.getElementById('propose-target-player');
      this.selectDiplomacyType = document.getElementById('propose-pact-type');
      this.btnSubmitDiplomacy = document.getElementById('btn-submit-pact');
      this.incomingProposalsList = document.getElementById('incoming-proposals-list');

      // Post Attack modal elements
      this.postAttackModal = document.getElementById('post-attack-modal');
      this.sliderPostAttack = document.getElementById('slider-post-attack-amount');
      this.lblPostAttackCount = document.getElementById('lbl-post-attack-count');
      this.lblPostAttackMin = document.getElementById('lbl-post-attack-min');
      this.lblPostAttackMax = document.getElementById('lbl-post-attack-max');
      this.btnSubmitPostAttack = document.getElementById('btn-submit-post-attack');

      this.cardTradeStatus = document.getElementById('card-trade-status');

      // Tactical options and dice modals
      this.chkAutoAttack = document.getElementById('chk-auto-attack');
      this.chkAutoDefend = document.getElementById('chk-auto-defend');
      this.chkSkipOtherBattles = document.getElementById('chk-skip-other-battles');
      this.chkSkipOtherBattlesOverlay = document.getElementById('chk-skip-other-battles-overlay');

      const skipVal = localStorage.getItem('skip-other-battles') === 'true';
      if (this.chkSkipOtherBattles) this.chkSkipOtherBattles.checked = skipVal;
      if (this.chkSkipOtherBattlesOverlay) this.chkSkipOtherBattlesOverlay.checked = skipVal;
      
      this.attackDiceModal = document.getElementById('attack-dice-modal');
      this.btnAttackDice1 = document.getElementById('btn-attack-dice-1');
      this.btnAttackDice2 = document.getElementById('btn-attack-dice-2');
      this.btnAttackDice3 = document.getElementById('btn-attack-dice-3');

      // Generative AI LLM Control Bar & Import Modal
      this.llmControlBar = document.getElementById('llm-control-bar');
      this.btnExportLLMPrompt = document.getElementById('btn-export-llm-prompt');
      this.btnImportLLMResponse = document.getElementById('btn-import-llm-response');
      this.llmImportModal = document.getElementById('llm-import-modal');
      this.txtLLMImportJson = document.getElementById('txt-llm-import-json');
      this.lblLLMImportStatus = document.getElementById('lbl-llm-import-status');
      this.btnExecuteLLMAction = document.getElementById('btn-execute-llm-action');
      this.btnCopyLLMPromptModal = document.getElementById('btn-copy-llm-prompt-modal');
      this.btnCloseLLMImportHeader = document.getElementById('btn-close-llm-import-header');
      this.btnCloseLLMImportFooter = document.getElementById('btn-close-llm-import-footer');

      this.initLLMControlsUI();
      this.btnAttackBlitz = document.getElementById('btn-attack-blitz');
      this.btnCancelAttackDice = document.getElementById('btn-cancel-attack-dice');
      
      this.chkFightToDeath = document.getElementById('chk-fight-to-death');
      this.chkAIBlitz = document.getElementById('chk-ai-blitz');
      this.aiBlitzContainer = document.getElementById('ai-blitz-toggle-container');
      this.blitzSummaryModal = document.getElementById('blitz-summary-modal');
      this.btnCloseBlitzSummary = document.getElementById('btn-close-blitz-summary');

      this.defendDiceModal = document.getElementById('defend-dice-modal');
      this.btnDefendDice1 = document.getElementById('btn-defend-dice-1');
      this.btnDefendDice2 = document.getElementById('btn-defend-dice-2');

      this.victoryModal = document.getElementById('victory-modal');
      this.btnVictoryExit = document.getElementById('btn-victory-exit');

      this.initUI();
      this.initTimelapseConverterUI();
      this.initAnimeEvents();
    }

    initAnimeEvents() {
      // Preload anime images, mascot, and audio into device memory cache so there is 0 network delay
      ['imagesandsounds/anime1.png', 'imagesandsounds/anime2.png', 'imagesandsounds/dance1.gif', 'imagesandsounds/dance2.gif', 'imagesandsounds/dance3.gif', 'imagesandsounds/yes.png'].forEach(src => {
        const img = new Image();
        img.src = src;
      });
      new Audio('imagesandsounds/anime.mp3');
      new Audio('imagesandsounds/animesong.mp3');

      // Detect when left sidebar is scrolled all the way to the bottom to trigger red AAA text
      const leftSidebar = document.getElementById('game-left-sidebar');
      if (leftSidebar) {
        leftSidebar.addEventListener('scroll', () => {
          const theme = document.body.getAttribute('data-map-theme') || 'default';
          if (theme !== 'anime') return;

          const isAtBottom = (leftSidebar.scrollHeight - leftSidebar.scrollTop - leftSidebar.clientHeight) <= 8;
          const aaaText = document.querySelector('.anime-aaa-text');
          if (aaaText) {
            aaaText.classList.toggle('show', isAtBottom);
          }

          // Secret Achievement: "( ͡° ͜ʖ ͡°)" — scrolled sidebar to the bottom under Anime theme
          if (isAtBottom && window.SocketClient && window.SocketClient.triggerSecretAchievement) {
            const accountName = window.SocketClient.currentAccount?.username;
            if (accountName) {
              window.SocketClient.triggerSecretAchievement('secret_anime_scroll', true, (res) => {
                if (res && res.achievement && window.showToast) {
                  window.showToast(`<i class="fa-solid fa-trophy"></i> Secret achievement unlocked: <strong>${res.achievement.title}</strong>!`, 'success');
                }
              });
            }
          }
        });
      }

      // 1-minute dance GIF timer (10% total chance every 60 seconds)
      if (this.animeDanceInterval) clearInterval(this.animeDanceInterval);
      this.animeDanceInterval = setInterval(() => {
        const theme = document.body.getAttribute('data-map-theme') || 'default';
        if (theme !== 'anime') return;

        if (Math.random() < 0.10) {
          const dances = ['dance1.gif', 'dance2.gif', 'dance3.gif'];
          const chosen = dances[Math.floor(Math.random() * dances.length)];

          const img = document.createElement('img');
          img.src = `imagesandsounds/${chosen}`;
          
          const maxLeft = Math.max(20, window.innerWidth - 180);
          const maxTop = Math.max(20, window.innerHeight - 180);
          const randX = Math.floor(Math.random() * maxLeft);
          const randY = Math.floor(Math.random() * maxTop);

          img.style.cssText = `
            position: fixed;
            left: ${randX}px;
            top: ${randY}px;
            width: 140px;
            height: 140px;
            object-fit: contain;
            z-index: 999998;
            pointer-events: none;
          `;
          document.body.appendChild(img);

          setTimeout(() => {
            img.remove();
          }, 500); // 0.5s duration with no fade
        }
      }, 60000);
    }

    triggerAnimeAttackJumpscare() {
      const theme = document.body.getAttribute('data-map-theme') || 'default';
      if (theme !== 'anime') return;

      const rand = Math.random();
      if (rand < 0.01) { // 1% total chance
        // Play jumpscare audio SFX
        if (window.MainController) {
          window.MainController.playSFX('imagesandsounds/anime.mp3');
        }

        const imgSrc = rand < 0.005 ? 'imagesandsounds/anime1.png' : 'imagesandsounds/anime2.png';
        let overlay = document.getElementById('anime-flash-overlay');

        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'anime-flash-overlay';
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            z-index: 999999;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.05s ease-out;
          `;
          document.body.appendChild(overlay);
        }

        overlay.style.backgroundImage = `url('${imgSrc}')`;
        overlay.style.opacity = '1';
        overlay.style.display = 'block';

        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.style.display = 'none';
          }, 50); // 0.05s fade out
        }, 100); // 0.1s display time
      }
    }

    initLLMControlsUI() {
      // Weapons Launch targeting states
      this.selectedLaunchPadId = null;
      this.activeFiringWeaponType = null; // 'nuke' | 'thermonuke'
    }

hasFullVisionOfPlayer(playerId) {
      if (!this.gameState || !this.gameState.fogOfWar || window.SocketClient?.spectatorMode || this.gameState.turnStage === 'GAME_OVER' || this.gameState.turnStage === 'SETUP_CLAIM') {
        return true;
      }
      const myId = window.SocketClient?.socket?.id;
      if (playerId === myId) return true;

      // Full allies share vision
      if (this.gameState.pacts && this.gameState.pacts.some(p => p.type === 'alliance' && ((p.playerA === myId && p.playerB === playerId) || (p.playerB === myId && p.playerA === playerId)))) {
        return true;
      }

      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      const visibleSet = this.renderer ? this.renderer.getVisibleTerritories(this.gameState, mapData, myId) : null;
      if (!visibleSet) return true;

      // Check if EVERY territory owned by playerId is in visibleSet
      const playerTerritories = Object.keys(this.gameState.territories).filter(tid => this.gameState.territories[tid]?.ownerId === playerId);
      if (playerTerritories.length === 0) return true;
      return playerTerritories.every(tid => visibleSet.has(tid));
    }

    calculatePlayerIncome(playerId) {
      if (!this.gameState) return 3;
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      if (!mapData) return 3;

      const blizzardSet = new Set(this.gameState.blizzards || []);
      const ownedTerritories = Object.keys(this.gameState.territories).filter(
        tid => this.gameState.territories[tid].ownerId === playerId && !blizzardSet.has(tid)
      );
      let baseIncome = Math.max(3, Math.floor(ownedTerritories.length / 3));

      let continentBonus = 0;
      if (mapData.continents) {
        mapData.continents.forEach(cont => {
          const activeTids = cont.territoryIds.filter(tid => !blizzardSet.has(tid));
          const allOwned = activeTids.length > 0 && activeTids.every(
            tid => this.gameState.territories[tid] && this.gameState.territories[tid].ownerId === playerId
          );
          if (allOwned) {
            continentBonus += cont.bonus;
          }
        });
      }
      return baseIncome + continentBonus;
    }

    initUI() {
      // Tab panel switching for Left Sidebar
      const btnArsenal = document.getElementById('tab-btn-arsenal');
      const btnIntel = document.getElementById('tab-btn-intel');
      const paneArsenal = document.getElementById('tab-pane-arsenal');
      const paneIntel = document.getElementById('tab-pane-intel');

      if (btnArsenal && btnIntel && paneArsenal && paneIntel) {
        btnArsenal.addEventListener('click', () => {
          btnArsenal.classList.add('active');
          btnIntel.classList.remove('active');
          paneArsenal.style.display = 'block';
          paneIntel.style.display = 'none';
        });

        btnIntel.addEventListener('click', () => {
          btnIntel.classList.add('active');
          btnArsenal.classList.remove('active');
          paneIntel.style.display = 'block';
          paneArsenal.style.display = 'none';
        });
      }

      // Tab panel switching for Right Sidebar removed — reverted to merged panel layout

      // Sidebar Collapsing/Drawer handles
      const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
      const leftSidebar = document.getElementById('game-left-sidebar');
      if (btnToggleLeft && leftSidebar) {
        btnToggleLeft.addEventListener('click', () => {
          const collapsed = leftSidebar.classList.toggle('collapsed');
          btnToggleLeft.classList.toggle('collapsed', collapsed);
          btnToggleLeft.innerHTML = collapsed ? '<i class="fa-solid fa-chevron-right"></i>' : '<i class="fa-solid fa-chevron-left"></i>';
          // Force resize/render adjustments
          setTimeout(() => {
            const svg = document.querySelector('svg');
            if (svg && svg.__renderer) {
              svg.__renderer.applyTransform();
            }
          }, 310);
        });
      }

      const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');
      const rightSidebar = document.getElementById('game-right-sidebar');
      if (btnToggleRight && rightSidebar) {
        btnToggleRight.addEventListener('click', () => {
          const collapsed = rightSidebar.classList.toggle('collapsed');
          btnToggleRight.classList.toggle('collapsed', collapsed);
          btnToggleRight.innerHTML = collapsed ? '<i class="fa-solid fa-chevron-left"></i>' : '<i class="fa-solid fa-chevron-right"></i>';
          setTimeout(() => {
            const svg = document.querySelector('svg');
            if (svg && svg.__renderer) {
              svg.__renderer.applyTransform();
            }
          }, 310);
        });
      }

            // Dominance bar collapse toggle (remembers state across reloads)
      const btnDominanceCollapse = document.getElementById('btn-dominance-collapse');
      const dominanceContainer = document.getElementById('game-dominance-bar-container');
      if (btnDominanceCollapse && dominanceContainer) {
        const applyDominanceCollapsed = (collapsed) => {
          dominanceContainer.classList.toggle('collapsed', collapsed);
          btnDominanceCollapse.innerHTML = collapsed
            ? '<i class="fa-solid fa-chevron-up"></i>'
            : '<i class="fa-solid fa-chevron-down"></i>';
          btnDominanceCollapse.title = collapsed ? 'Expand dominance panel' : 'Collapse dominance panel';
        };
        applyDominanceCollapsed(localStorage.getItem('dominance-collapsed') === 'true');
        btnDominanceCollapse.addEventListener('click', () => {
          const collapsed = !dominanceContainer.classList.contains('collapsed');
          localStorage.setItem('dominance-collapsed', collapsed ? 'true' : 'false');
          applyDominanceCollapsed(collapsed);
        });
      }

      // High-Performance Multi-Button Proximity Glow & Map Shading System
      let glowFramePending = false;
      let lastMoveX = 0;
      let lastMoveY = 0;
      let activeGlowingElements = new Set();
      let cachedSciFiButtons = null;
      let cacheStaleTime = 0;

      document.addEventListener('mousemove', (e) => {
        lastMoveX = e.clientX;
        lastMoveY = e.clientY;
        if (glowFramePending) return;

        glowFramePending = true;
        requestAnimationFrame(() => {
          glowFramePending = false;
          const theme = document.body.getAttribute('data-map-theme') || 'default';

          if (theme === 'scifi') {
            const now = Date.now();
            // Cache query list to prevent per-pixel DOM lookups
            if (!cachedSciFiButtons || now > cacheStaleTime) {
              cachedSciFiButtons = Array.from(document.querySelectorAll('.btn, .sidebar-tab, .tool-btn, .color-picker-input, .lobby-color-picker'))
                .filter(el => el.offsetParent !== null);
              cacheStaleTime = now + 600;
            }

            const glowRadius = 90; // Proximity threshold in pixels
            const mx = lastMoveX;
            const my = lastMoveY;
            const updates = [];
            const currentlyNear = new Set();

            // Phase 1: Read all dimensions in batch (no style writes = zero layout reflow lag)
            for (let i = 0; i < cachedSciFiButtons.length; i++) {
              const el = cachedSciFiButtons[i];
              const rect = el.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;

              const dx = mx - cx;
              const dy = my - cy;

              const halfW = rect.width / 2;
              const halfH = rect.height / 2;
              const edgeDistX = Math.max(0, Math.abs(dx) - halfW);
              const edgeDistY = Math.max(0, Math.abs(dy) - halfH);
              const edgeDist = Math.hypot(edgeDistX, edgeDistY);

              if (edgeDist < glowRadius) {
                const relX = mx - rect.left;
                const relY = my - rect.top;
                const opacity = (1 - edgeDist / glowRadius).toFixed(2);
                updates.push({ el, relX, relY, opacity });
                currentlyNear.add(el);
              }
            }

            // Phase 2: Batch write styles
            // Clear any button that was glowing previously but is no longer within proximity
            activeGlowingElements.forEach(el => {
              if (!currentlyNear.has(el)) {
                el.style.setProperty('--glow-opacity', '0');
              }
            });

            // Apply glow to all buttons within proximity
            for (let i = 0; i < updates.length; i++) {
              const { el, relX, relY, opacity } = updates[i];
              el.style.setProperty('--mouse-x', `${relX}px`);
              el.style.setProperty('--mouse-y', `${relY}px`);
              el.style.setProperty('--glow-opacity', opacity);
            }

            activeGlowingElements = currentlyNear;
          } else {
            // Clean up any remaining glow if the player switches themes
            if (activeGlowingElements.size > 0) {
              activeGlowingElements.forEach(el => el.style.setProperty('--glow-opacity', '0'));
              activeGlowingElements.clear();
            }

            if (theme === 'napoleonic') {
              const container = document.getElementById('game-map-container') || document.querySelector('.svg-container');
              if (container) {
                const rect = container.getBoundingClientRect();
                const inside = lastMoveX >= rect.left && lastMoveX <= rect.right && lastMoveY >= rect.top && lastMoveY <= rect.bottom;
                if (inside) {
                  container.style.setProperty('--map-mouse-x', `${lastMoveX - rect.left}px`);
                  container.style.setProperty('--map-mouse-y', `${lastMoveY - rect.top}px`);
                  container.style.setProperty('--map-mouse-opacity', '1');
                } else {
                  container.style.setProperty('--map-mouse-opacity', '0');
                }
              }
            }
          }
        });
      });

      // End Phase button
      this.btnEndPhase.addEventListener('click', () => {
        window.SocketClient.endPhase((res) => {
          if (res.error) alert(res.error);
        });
      });

      // Trade Cards button
      this.btnTradeCards.addEventListener('click', () => {
        if (this.selectedCardIndices.length === 3) {
          const targetTerrId = this.selectCardTargetTerritory ? this.selectCardTargetTerritory.value : null;
          window.SocketClient.tradeCards(this.selectedCardIndices, targetTerrId, (res) => {
            if (res.error) {
              alert(res.error);
            } else {
              if (res.autoDeposited > 0) {
                showToast(`<i class="fa-solid fa-rocket"></i> Traded card set and auto-deposited ${res.autoDeposited} armies!`, 'success');
              } else {
                showToast(`<i class="fa-solid fa-bullseye"></i> Traded card set for +${res.bonusArmies} bonus armies!`, 'success');
              }
              this.selectedCardIndices = [];
              this.renderCards();
            }
          });
        }
      });

      // Auto-Select Card Set button
      if (this.btnAutoSelectCards) {
        this.btnAutoSelectCards.addEventListener('click', () => {
          if (!this.autoSelectCardSet(true)) {
            alert('No valid 3-card trade set found in your hand.');
          }
        });
      }

      // Trade ALL Valid Cards button
      if (this.btnTradeAllCards) {
        this.btnTradeAllCards.addEventListener('click', () => {
          const targetTerrId = this.selectCardTargetTerritory ? this.selectCardTargetTerritory.value : null;
          window.SocketClient.tradeAllCards(targetTerrId, (res) => {
            if (res.error) {
              alert(res.error);
            } else {
              showToast(`<i class="fa-solid fa-bolt"></i> Traded ${res.setsTraded} card set(s) for +${res.totalBonus} bonus armies!`, 'success');
              this.selectedCardIndices = [];
              this.renderCards();
            }
          });
        });
      }

      // Draft Batch Toolbar step buttons
      const batchBtns = document.querySelectorAll('.btn-batch-step');
      batchBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          batchBtns.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          const step = e.target.getAttribute('data-step');
          this.draftStepSize = step;
        });
      });

      // Custom Draft Amount Modal trigger
      if (this.btnOpenDraftModal) {
        this.btnOpenDraftModal.addEventListener('click', () => {
          if (this.selectedSourceId && this.gameState && this.gameState.territories[this.selectedSourceId]?.ownerId === window.SocketClient.socket.id) {
            this.openDraftModal(this.selectedSourceId);
          } else {
            const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
            const owned = Object.values(this.gameState.territories).find(t => t.ownerId === myId);
            if (owned) {
              this.openDraftModal(owned.id);
            } else {
              alert('Click on one of your territories on the map first.');
            }
          }
        });
      }

      // Sync Draft Modal input and slider
      if (this.inputDraftModalAmount && this.sliderDraftModalAmount) {
        this.inputDraftModalAmount.addEventListener('input', (e) => {
          this.sliderDraftModalAmount.value = e.target.value;
        });
        this.sliderDraftModalAmount.addEventListener('input', (e) => {
          this.inputDraftModalAmount.value = e.target.value;
        });
      }

      // Draft Preset Buttons
      const draftPresetBtns = document.querySelectorAll('.btn-draft-preset');
      draftPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const pool = this.gameState ? (this.gameState.draftPool || 1) : 1;
          let val = parseInt(this.inputDraftModalAmount.value) || 1;
          const addVal = btn.getAttribute('data-val');
          const pctVal = btn.getAttribute('data-pct');
          if (addVal) {
            val = Math.min(pool, val + parseInt(addVal));
          } else if (pctVal) {
            val = Math.max(1, Math.round(pool * parseFloat(pctVal)));
          }
          if (this.inputDraftModalAmount) this.inputDraftModalAmount.value = val;
          if (this.sliderDraftModalAmount) this.sliderDraftModalAmount.value = val;
        });
      });

      if (this.btnCancelDraftModal) {
        this.btnCancelDraftModal.addEventListener('click', () => {
          if (this.draftTroopsModal) this.draftTroopsModal.classList.remove('active');
        });
      }

      if (this.btnSubmitDraftModal) {
        this.btnSubmitDraftModal.addEventListener('click', () => {
          const amount = parseInt(this.inputDraftModalAmount.value) || 1;
          if (this.activeDraftTerritoryId) {
            window.SocketClient.placeTroops(this.activeDraftTerritoryId, amount, (res) => {
              if (res.error) alert(res.error);
              if (this.draftTroopsModal) this.draftTroopsModal.classList.remove('active');
            });
          }
        });
      }

      // Chat input
      this.btnSendChat.addEventListener('click', () => this.sendChatMessage());
      this.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });

      // Diplomacy modal toggle
      this.btnOpenDiplomacy.addEventListener('click', () => {
        this.openDiplomacyModal();
      });
      this.btnCloseDiplomacy.addEventListener('click', () => {
        this.diplomacyModal.classList.remove('active');
      });
      this.btnSubmitDiplomacy.addEventListener('click', () => {
        this.submitPactProposal();
      });

      // Toggle Auto Defend
      if (this.chkAutoDefend) {
        this.chkAutoDefend.addEventListener('change', (e) => {
          window.SocketClient.toggleAutoDefend(e.target.checked, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      // Link the two skip-other-battles checkboxes and save preference to localStorage
      const handleSkipOtherChange = (e) => {
        const val = e.target.checked;
        localStorage.setItem('skip-other-battles', val ? 'true' : 'false');
        if (this.chkSkipOtherBattles) this.chkSkipOtherBattles.checked = val;
        if (this.chkSkipOtherBattlesOverlay) this.chkSkipOtherBattlesOverlay.checked = val;
        
        // If checked, and there is a currently active combat overlay that doesn't involve the player, close it immediately
        if (val) {
          const overlay = document.getElementById('combat-overlay');
          if (overlay && overlay.classList.contains('active') && this.lastProcessedRoll) {
            const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
            const isAttacker = this.lastProcessedRoll.attackerId === myId;
            const isDefender = this.lastProcessedRoll.defenderId === myId;
            if (!isAttacker && !isDefender) {
              overlay.classList.remove('active');
              if (this.combatRevealTimeout) clearTimeout(this.combatRevealTimeout);
              if (this.combatCloseTimeout) clearTimeout(this.combatCloseTimeout);
            }
          }
        }
      };

      if (this.chkSkipOtherBattles) {
        this.chkSkipOtherBattles.addEventListener('change', handleSkipOtherChange);
      }
      if (this.chkSkipOtherBattlesOverlay) {
        this.chkSkipOtherBattlesOverlay.addEventListener('change', handleSkipOtherChange);
      }

      // Attack Dice Selection buttons
      const selectAttackDice = (diceCount) => {
        if (this.attackDiceModal) this.attackDiceModal.classList.remove('active');
        if (this.selectedSourceId && this.selectedTargetId) {
          this.triggerAnimeAttackJumpscare();
          window.SocketClient.attack(this.selectedSourceId, this.selectedTargetId, diceCount, (res) => {
            if (res.error) {
              alert(res.error);
              this.selectedSourceId = null;
              this.selectedTargetId = null;
              this.highlightSourceTarget();
            }
          });
        }
      };

      if (this.btnAttackDice1) this.btnAttackDice1.addEventListener('click', () => selectAttackDice(1));
      if (this.btnAttackDice2) this.btnAttackDice2.addEventListener('click', () => selectAttackDice(2));
      if (this.btnAttackDice3) this.btnAttackDice3.addEventListener('click', () => selectAttackDice(3));
      
      if (this.btnAttackBlitz) {
        this.btnAttackBlitz.addEventListener('click', () => {
          if (this.attackDiceModal) this.attackDiceModal.classList.remove('active');
          if (this.selectedSourceId && this.selectedTargetId) {
            this.executeBlitzAttack(this.selectedSourceId, this.selectedTargetId);
          }
        });
      }

      if (this.btnCloseBlitzSummary) {
        this.btnCloseBlitzSummary.addEventListener('click', () => {
          if (this.blitzSummaryModal) this.blitzSummaryModal.classList.remove('active');
        });
      }

      if (this.chkAIBlitz) {
        this.chkAIBlitz.addEventListener('change', (e) => {
          window.SocketClient.toggleAIBlitz(e.target.checked, (res) => {
            if (res.error) alert(res.error);
          });
        });
      }

      if (this.btnCancelAttackDice) {
        this.btnCancelAttackDice.addEventListener('click', () => {
          if (this.attackDiceModal) this.attackDiceModal.classList.remove('active');
          this.selectedSourceId = null;
          this.selectedTargetId = null;
          this.highlightSourceTarget();
        });
      }

      // Defend Dice Selection buttons
      const selectDefendDice = (diceCount) => {
        if (this.defendDiceModal) this.defendDiceModal.classList.remove('active');
        window.SocketClient.resolveDefense(diceCount, (res) => {
          if (res.error) alert(res.error);
        });
      };

      if (this.btnDefendDice1) this.btnDefendDice1.addEventListener('click', () => selectDefendDice(1));
      if (this.btnDefendDice2) this.btnDefendDice2.addEventListener('click', () => selectDefendDice(2));

      // Post-Attack Move Slider update
      if (this.sliderPostAttack) {
        this.sliderPostAttack.addEventListener('input', (e) => {
          if (this.gameState && this.gameState.postAttackContext) {
            const min = this.gameState.postAttackContext.minMove;
            this.lblPostAttackCount.textContent = min + parseInt(e.target.value);
          }
        });
      }

      // Submit Post-Attack Move
      if (this.btnSubmitPostAttack) {
        this.btnSubmitPostAttack.addEventListener('click', () => {
          const amount = parseInt(this.sliderPostAttack.value) || 0;
          window.SocketClient.postAttackMove(amount, (res) => {
            if (this.postAttackModal) this.postAttackModal.classList.remove('active');
            if (res && res.error) {
              // Auto-heal fallback to release player from stuck state
              window.SocketClient.postAttackMove(0, () => {});
            }
          });
        });
      }

      // In-game AI Speed control
      const gameAiSpeedSelect = document.getElementById('select-game-ai-speed');
      if (gameAiSpeedSelect) {
        gameAiSpeedSelect.addEventListener('change', (e) => {
          window.SocketClient.changeAISpeed(e.target.value, (res) => {
            if (res && res.error) {
              console.warn('Could not update AI speed:', res.error);
            }
          });
        });
      }

      // Craft normal Tactical Nuke
      const btnCraftNuke = document.getElementById('btn-craft-nuke');
      if (btnCraftNuke) {
        btnCraftNuke.addEventListener('click', () => {
          if (this.selectedCardIndices.length === 3) {
            window.SocketClient.craftNuke(this.selectedCardIndices, false, (res) => {
              if (res.error) {
                alert(res.error);
              } else {
                showToast(`<i class="fa-solid fa-radiation"></i> Tactical Nuke crafted successfully!`, 'success');
                this.selectedCardIndices = [];
                this.renderCards();
              }
            });
          }
        });
      }

      // Craft Thermonuclear weapon
      const btnCraftThermo = document.getElementById('btn-craft-thermonuke');
      if (btnCraftThermo) {
        btnCraftThermo.addEventListener('click', () => {
          if (this.selectedCardIndices.length === 3) {
            window.SocketClient.craftNuke(this.selectedCardIndices, true, (res) => {
              if (res.error) {
                alert(res.error);
              } else {
                showToast(`<i class="fa-solid fa-rocket"></i> Thermonuclear weapon assembled!`, 'success');
                this.selectedCardIndices = [];
                this.renderCards();
              }
            });
          }
        });
      }

      // Tactical Nuke Launch Selector
      const btnActionNuke = document.getElementById('btn-action-nuke');
      if (btnActionNuke) {
        btnActionNuke.addEventListener('click', () => {
          if (this.gameState.turnStage !== 'ATTACK') {
            alert('Weapons can only be launched during your Attack phase.');
            return;
          }
          if (this.activeFiringWeaponType === 'nuke') {
            // Deselect
            this.activeFiringWeaponType = null;
            this.selectedLaunchPadId = null;
            btnActionNuke.classList.remove('active-pulsing');
            this.lblInstructions.innerHTML = this.getInstructionText(true, 'ATTACK');
          } else {
            this.activeFiringWeaponType = 'nuke';
            btnActionNuke.classList.add('active-pulsing');
            const btnThermo = document.getElementById('btn-action-thermonuke');
            if (btnThermo) btnThermo.classList.remove('active-pulsing');
            this.selectedLaunchPadId = null;
            this.lblInstructions.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> **LAUNCH SEQUENCING**: Select one of your territories (with >= 2 armies) to act as the Launch Pad Silo.`;
          }
        });
      }

      // Thermonuclear Launch Selector
      const btnActionThermo = document.getElementById('btn-action-thermonuke');
      if (btnActionThermo) {
        btnActionThermo.addEventListener('click', () => {
          if (this.gameState.turnStage !== 'ATTACK') {
            alert('Weapons can only be launched during your Attack phase.');
            return;
          }
          if (this.activeFiringWeaponType === 'thermonuke') {
            this.activeFiringWeaponType = null;
            this.selectedLaunchPadId = null;
            btnActionThermo.classList.remove('active-pulsing');
            this.lblInstructions.innerHTML = this.getInstructionText(true, 'ATTACK');
          } else {
            this.activeFiringWeaponType = 'thermonuke';
            btnActionThermo.classList.add('active-pulsing');
            const btnTact = document.getElementById('btn-action-nuke');
            if (btnTact) btnTact.classList.remove('active-pulsing');
            this.selectedLaunchPadId = null;
            this.lblInstructions.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> **LAUNCH SEQUENCING**: Select one of your adjacent territories (with >= 2 armies) to act as the Launch Pad Silo.`;
          }
        });
      }

      // Quit Game
      document.getElementById('btn-quit-game').addEventListener('click', () => {
        window.showConfirm('Are you sure you want to quit the campaign?', {
          title: 'Quit Campaign',
          okLabel: 'Quit Campaign',
          danger: true
        }).then((ok) => {
          if (ok) window.location.reload();
        });
      });

      if (this.btnVictoryExit) {
        this.btnVictoryExit.addEventListener('click', () => {
          window.location.reload();
        });
      }

      // Close Victory Modal to inspect map
      const btnVictoryClose = document.getElementById('btn-victory-close');
      if (btnVictoryClose) {
        btnVictoryClose.addEventListener('click', () => {
          if (this.victoryModal) this.victoryModal.classList.remove('active');
          this.victoryModalDismissed = true;
          const btnReopen = document.getElementById('btn-show-victory');
          if (btnReopen) btnReopen.style.display = 'block';
        });
      }

      // Reopen Victory Modal from sidebar
      const btnShowVictory = document.getElementById('btn-show-victory');
      if (btnShowVictory) {
        btnShowVictory.addEventListener('click', () => {
          if (this.victoryModal) this.victoryModal.classList.add('active');
        });
      }

      // Export Timelapse JSON (Optimized Delta + Gzip Format)
      const btnExport = document.getElementById('btn-export-timelapse');
      if (btnExport) {
        btnExport.addEventListener('click', async () => {
          let history = this.gameState ? this.gameState.history : null;
          if (!history || history.length === 0) {
            const res = await new Promise((resolve) => {
              if (window.SocketClient && window.SocketClient.requestTimelapseHistory) {
                window.SocketClient.requestTimelapseHistory((response) => resolve(response));
              } else {
                resolve({ error: 'Unavailable' });
              }
            });
            if (res && res.history && res.history.length > 0) {
              history = res.history;
            }
          }

          if (!history || history.length === 0) {
            alert('No timelapse data available for this campaign.');
            return;
          }
          
          const mapData = window.SocketClient.mapData || (this.gameState ? this.gameState.mapData : null) || {};
          const exportData = this.encodeTimelapseData(
            history,
            mapData,
            this.gameState.chatArchive || [],
            this.gameState.gameMode,
            this.gameState.winner
          );
          
          const jsonStr = JSON.stringify(exportData);
          let blob, filename;
          const roomCode = window.SocketClient.roomCode || 'local';
          const turnCount = history.length;
          
          if (typeof CompressionStream !== 'undefined') {
            try {
              const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
              blob = await new Response(stream).blob();
              filename = `timelapse_room_${roomCode}_turn_${turnCount}.json.gz`;
            } catch (err) {
              console.warn('Gzip compression failed, saving uncompressed JSON:', err);
              blob = new Blob([jsonStr], { type: 'application/json' });
              filename = `timelapse_room_${roomCode}_turn_${turnCount}.json`;
            }
          } else {
            blob = new Blob([jsonStr], { type: 'application/json' });
            filename = `timelapse_room_${roomCode}_turn_${turnCount}.json`;
          }
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        });
      }

      // Close Combat Overlay
      const btnCloseCombat = document.getElementById('btn-close-combat');
      if (btnCloseCombat) {
        btnCloseCombat.addEventListener('click', () => {
          document.getElementById('combat-overlay').classList.remove('active');
          
          // Clear active combat timers
          if (this.combatRevealTimeout) clearTimeout(this.combatRevealTimeout);
          if (this.combatCloseTimeout) clearTimeout(this.combatCloseTimeout);

          // Clear any visual attack arrows
          document.querySelectorAll('.attack-arrow-segment, #attack-arrow-line').forEach(el => el.remove());
        });
      }

      // Socket Listeners configuration
      window.SocketClient.onGameStateUpdate((state) => {
        this.updateGameState(state);
      });

      window.SocketClient.onDiplomacyReceived((proposal) => {
        showToast(`<i class="fa-solid fa-envelope"></i> New treaty proposal received from <strong>${proposal.senderName}</strong>!`, 'info');

        // Force refresh state or popup
        this.appendLog({
          timestamp: new Date().toLocaleTimeString(),
          message: `<i class="fa-solid fa-envelope"></i> New treaty proposal received from ${proposal.senderName}!`
        });
        if (this.diplomacyModal.classList.contains('active')) {
          this.renderIncomingProposals();
        }
      });

      window.SocketClient.onChatMessage((msg) => {
        this.appendChatMessage(msg);
      });

      // Nuclear missile flight + mushroom cloud explosion for AI launches and other players launches
      window.SocketClient.onFireNuclearMissileEvent((data) => {
        if (this.renderer && data && data.srcCenter && data.tgtCenter) {
          this.renderer.fireNuclearMissile(data.srcCenter, data.tgtCenter, data.isThermo, () => {
            showToast('NUCLEAR DETONATION COMPLETE!', 'warning');
          });
        }
      });

      // Listen for tab switching / focus restoration to clear throttled timeouts and resync state
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.gameState) {
          if (this.combatRevealTimeout) { clearTimeout(this.combatRevealTimeout); this.combatRevealTimeout = null; }
          if (this.combatCloseTimeout) { clearTimeout(this.combatCloseTimeout); this.combatCloseTimeout = null; }
          
          if (this.renderer && (window.SocketClient.mapData || this.gameState.mapData)) {
            this.renderer.render(window.SocketClient.mapData || this.gameState.mapData, this.gameState);
          }

          if (window.SocketClient && window.SocketClient.syncGameState) {
            window.SocketClient.syncGameState();
          }
        }
      });

      // Staleness watchdog: in AI games the server pushes state updates every
      // few seconds. If updates stop arriving (a dropped socket frame, a failed
      // handler, or a stalled broadcast), the screen silently freezes while the
      // game keeps running server-side. Detect that and request a fresh sync to
      // self-heal instead of freezing forever.
      setInterval(() => {
        if (document.hidden || !this.gameState || !window.SocketClient) return;
        if (this.gameState.turnStage === 'GAME_OVER') return;
        const cur = this.gameState.players && this.gameState.players[this.gameState.turnIndex];
        const isMyTurn = !!(cur && cur.id === window.SocketClient.socket.id);
        // Don't auto-resync while the local human is deliberating their own turn
        if (isMyTurn && !window.SocketClient.spectatorMode) return;
        const now = Date.now();
        if (now - (this.lastStateUpdateAt || 0) > 20000 && now - (this._lastAutoResyncAt || 0) > 15000) {
          this._lastAutoResyncAt = now;
          console.warn('[GameClient] No game state updates for 20s — requesting fresh sync...');
          window.SocketClient.syncGameState();
        }
      }, 5000);

      // FX sweep: transient animation groups (projectiles, explosions, beams)
      // are tagged with data-fx-created by the renderer. Normally each map
      // rebuild destroys them, but if rendering stalls they can linger forever
      // and bloat the DOM. Sweep anything older than 15 seconds.
      setInterval(() => {
        const stale = document.querySelectorAll('#game-map-container [data-fx-created]');
        if (stale.length === 0) return;
        const now = Date.now();
        stale.forEach(el => {
          const created = parseInt(el.getAttribute('data-fx-created'));
          if (created && now - created > 15000) el.remove();
        });
      }, 10000);
    }

    startCampaign(mapData, gameState) {
      if (mapData) {
        window.SocketClient.mapData = mapData;
      }

      // Auto-collapse sidebars on small/mobile screens so the map fills the display
      if (window.innerWidth <= 900) {
        const leftSidebar = document.getElementById('game-left-sidebar');
        const rightSidebar = document.getElementById('game-right-sidebar');
        const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
        const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');

        if (leftSidebar && !leftSidebar.classList.contains('collapsed')) {
          leftSidebar.classList.add('collapsed');
          if (btnToggleLeft) {
            btnToggleLeft.classList.add('collapsed');
            btnToggleLeft.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
          }
        }
        if (rightSidebar && !rightSidebar.classList.contains('collapsed')) {
          rightSidebar.classList.add('collapsed');
          btnToggleRight.classList.add('collapsed');
          if (btnToggleRight) {
            btnToggleRight.classList.add('collapsed');
            btnToggleRight.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
          }
        }
      }

      this.renderer = new window.SVGRenderer('game-map-container', {
        isEditor: false,
        onTerritoryClick: (tid, e) => this.handleTerritoryClick(tid, e)
      });
      
      this.updateGameState(gameState);
    }

    updateGameState(state) {
      // Track last update time for the staleness watchdog
      this.lastStateUpdateAt = Date.now();

      // Perf diagnostics (Step 0): count incoming updates vs. actual renders
      // so long-game freezes can be attributed to update storms or render cost.
      this._perf = this._perf || { updates: 0, renders: 0, totalMs: 0, maxMs: 0, lastReport: Date.now() };
      this._perf.updates++;

      try {
        // Clear any visual attack arrows
        document.querySelectorAll('.attack-arrow-segment, #attack-arrow-line').forEach(el => el.remove());

        // Bandwidth Optimization Merge: Reconstruct historical log feed on client
        if (this.gameState && this.gameState.logs && state.logs) {
          const localLogs = this.gameState.logs;
          state.logs.forEach(newLog => {
            const exists = localLogs.some(l => l.timestamp === newLog.timestamp && l.message === newLog.message);
            if (!exists) {
              localLogs.push(newLog);
            }
          });
          if (localLogs.length > 100) localLogs.shift();
          state.logs = localLogs;
        }

        // Bandwidth Optimization Merge: Reconstruct historical chat feed on client
        if (this.gameState && this.gameState.chatArchive && state.chatArchive) {
          const localChats = this.gameState.chatArchive;
          state.chatArchive.forEach(newChat => {
            const exists = localChats.some(c => c.timestamp === newChat.timestamp && c.text === newChat.text && c.senderName === newChat.senderName);
            if (!exists) {
              localChats.push(newChat);
            }
          });
          if (localChats.length > 200) localChats.shift();
          state.chatArchive = localChats;
        }

        // Reset selections if turn or stage changed
        if (this.gameState) {
          if (this.gameState.turnIndex !== state.turnIndex || this.gameState.turnStage !== state.turnStage) {
            this.selectedSourceId = null;
            this.selectedTargetId = null;
            this.selectedLaunchPadId = null;
            this.activeFiringWeaponType = null;
            document.querySelectorAll('.nuke-badge').forEach(b => b.classList.remove('active-pulsing'));
          }
        }

        this.gameState = state;

        // Coalesce the expensive render work: rapid AI micro-steps can emit
        // many gameStateUpdates per second and rebuilding the whole SVG map
        // for each one progressively stalls the tab in long games. All cheap
        // state merging happens above; the full redraw runs at most once per
        // animation frame using the latest state.
        this.scheduleMapRender();
      } catch (err) {
        console.error('[GameClient] updateGameState error:', err);
        // Defensive fallback: attempt a minimal UI refresh so a single bad
        // update can never permanently freeze the game screen.
        try {
          if (this.gameState && this.gameState.players) {
            const cur = this.gameState.players[this.gameState.turnIndex];
            if (cur) this.updateUI(true, cur);
          }
        } catch (e2) { /* ignore — avoid error loops */ }
      }
    }

    // Schedule the full map redraw + UI refresh, coalesced to one run per frame
    scheduleMapRender() {
      if (this._renderQueued) return;
      this._renderQueued = true;
      const flush = () => {
        this._renderQueued = false;
        const t0 = performance.now();
        try {
          if (!this.gameState) return;
          if (!this.renderer) {
            // Late state-update race (Watch AI / rejoin): initialize the map renderer on demand
            this.renderer = new window.SVGRenderer('game-map-container', {
              isEditor: false,
              onTerritoryClick: (tid, e) => this.handleTerritoryClick(tid, e)
            });
          }
          const state = this.gameState;
          this.renderer.render(window.SocketClient.mapData || state.mapData, state);

          // Check for new dice rolls to play combat animation (latest only —
          // collapsed updates intentionally animate just the freshest roll)
          if (state.lastDiceRolls && state.lastDiceRolls.rollId !== this.lastProcessedRollId) {
            this.lastProcessedRollId = state.lastDiceRolls.rollId;
            this.lastProcessedRoll = state.lastDiceRolls;
            this.triggerCombatOverlay(state.lastDiceRolls);
          }

          const currentPlayer = state.players && state.players[state.turnIndex];
          if (!currentPlayer) return;
          const isMyTurn = (currentPlayer.id === window.SocketClient.socket.id) || !!state.generativeAIMode || !!window.SocketClient.spectatorMode;

          this.updateUI(isMyTurn, currentPlayer);
        } catch (err) {
          console.error('[GameClient] render pipeline error:', err);
        } finally {
          // Perf diagnostics: track render cost, report every 30s
          if (this._perf) {
            const dur = performance.now() - t0;
            this._perf.renders++;
            this._perf.totalMs += dur;
            if (dur > this._perf.maxMs) this._perf.maxMs = dur;
            const now = Date.now();
            if (now - this._perf.lastReport > 30000) {
              const avg = this._perf.renders > 0 ? (this._perf.totalMs / this._perf.renders).toFixed(1) : '0';
              const domNodes = document.querySelectorAll('#game-map-container *').length;
              console.log(`[GamePerf] 30s: updates=${this._perf.updates} renders=${this._perf.renders} avgRender=${avg}ms maxRender=${this._perf.maxMs.toFixed(1)}ms mapDomNodes=${domNodes}`);
              this._perf = { updates: 0, renders: 0, totalMs: 0, maxMs: 0, lastReport: now };
            }
          }
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(flush);
      } else {
        setTimeout(flush, 16);
      }
    }

    updateUI(isMyTurn, currentPlayer) {
      // 1. Header indicators
      this.lblTurnName.textContent = currentPlayer.name;
      this.lblTurnName.style.color = currentPlayer.color;
      this.lblPhaseName.textContent = this.gameState.turnStage.replace('_', ' ');

      // 2. Hide / Show Phase buttons
      const stage = this.gameState.turnStage;
      
      if (isMyTurn && (stage === 'ATTACK' || stage === 'FORTIFY')) {
        this.btnEndPhase.style.display = 'block';
        this.btnEndPhase.textContent = stage === 'ATTACK' ? 'End Attack Phase' : 'End Turn (Fortify)';
      } else {
        this.btnEndPhase.style.display = 'none';
      }

      const btnAdvisor = document.getElementById('btn-ask-ai-advisor');
      if (btnAdvisor) {
        const hasKey = !!(
          (document.getElementById('input-llm-api-key') && document.getElementById('input-llm-api-key').value.trim()) ||
          (document.getElementById('input-watch-ai-llm-api-key') && document.getElementById('input-watch-ai-llm-api-key').value.trim()) ||
          localStorage.getItem('llm_api_key') ||
          (this.gameState && this.gameState.llmConfig && this.gameState.llmConfig.apiKey)
        );
        btnAdvisor.style.display = (isMyTurn && hasKey) ? 'block' : 'none';
      }

      // 3. Draft/Reinforcements count badge & Draft batch toolbar
      if (isMyTurn && stage === 'DRAFT') {
        this.badgeReinforcements.style.display = 'inline-block';
        this.lblReinforcementsCount.textContent = this.gameState.draftPool;
        if (this.draftBatchToolbar) {
          this.draftBatchToolbar.style.display = this.gameState.draftPool > 0 ? 'flex' : 'none';
        }
      } else {
        this.badgeReinforcements.style.display = 'none';
        if (this.draftBatchToolbar) {
          this.draftBatchToolbar.style.display = 'none';
        }
      }

      // 4. Instructions text
      this.lblInstructions.innerHTML = this.getInstructionText(isMyTurn, stage);

      // Show/hide AI Blitz toggle for Host or AI Spectators
      const isHost = window.SocketClient.isHost || (this.gameState.players && this.gameState.players.find(p => p.id === window.SocketClient.socket.id)?.isHost);
      const allAI = this.gameState.players && this.gameState.players.every(p => p.isAI);
      if (this.aiBlitzContainer) {
        if (isHost || allAI) {
          this.aiBlitzContainer.style.display = 'flex';
        } else {
          this.aiBlitzContainer.style.display = 'none';
        }
      }

      // 5. Sidebar lists & Dominance Meter
      this.renderPlayersList();
      this.renderContinentsLegend();
      this.renderActivePacts();
      this.renderCards();
      this.renderLogs();
      this.renderDominanceMeter();

      // Weapons Arsenal UI Handler
      const nukesPanel = document.getElementById('game-nukes-panel');
      const btnCraftTact = document.getElementById('btn-craft-nuke');
      const btnCraftTher = document.getElementById('btn-craft-thermonuke');
      const lblTactCount = document.getElementById('lbl-nuke-count');
      const lblTherCount = document.getElementById('lbl-thermonuke-count');

      const isGenerative = !!this.gameState.generativeAIMode || !!window.SocketClient.spectatorMode;
      const mePlayer = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);

      // Only show nuclear arsenal & controls if: at least one player has a nuke OR crafting is enabled
      const isCraftingEnabled = !!this.gameState.allowCrafting;
      const anyoneHasNukes = (this.gameState.players || []).some(pl => (pl.nukes || 0) > 0 || (pl.thermonukes || 0) > 0);
      const shouldShowNukes = isCraftingEnabled || anyoneHasNukes;

      if (nukesPanel && shouldShowNukes) {
        nukesPanel.style.display = 'block';
        
        if (lblTactCount) lblTactCount.textContent = mePlayer ? (mePlayer.nukes || 0) : 0;
        if (lblTherCount) lblTherCount.textContent = mePlayer ? (mePlayer.thermonukes || 0) : 0;

        // Crafting buttons row only shows if crafting is enabled and it's the player's draft stage
        if (isMyTurn && stage === 'DRAFT' && isCraftingEnabled && !isGenerative) {
          document.getElementById('nuke-craft-buttons-row').style.display = 'flex';
          
          // Crafting validation: 3 cards of any type for Tactical Nuke
          if (btnCraftTact) btnCraftTact.disabled = !(mePlayer && mePlayer.cards && mePlayer.cards.length >= 3);
          // Crafting validation: 3 cards forming a valid set for Thermonuke
          if (btnCraftTher) btnCraftTher.disabled = !this.isValidCardSetSelected();
        } else {
          document.getElementById('nuke-craft-buttons-row').style.display = 'none';
        }
      } else if (nukesPanel) {
        nukesPanel.style.display = 'none';
      }

      // Update Diplomacy Badge
      const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
      const myProposals = this.gameState.diplomacyProposals
        ? this.gameState.diplomacyProposals.filter(p => p.receiver === myId)
        : [];
      const badge = document.getElementById('diplomacy-badge');
      if (badge) {
        if (myProposals.length > 0) {
          badge.style.display = 'flex';
          badge.textContent = myProposals.length;
        } else {
          badge.style.display = 'none';
        }
      }

      // 6. Post-Attack Modal handling
      if (stage === 'POST_ATTACK_MOVE' && isMyTurn) {
        const context = this.gameState.postAttackContext;
        if (context) {
          const srcName = this.getTerritoryName(context.sourceId);
          const tgtName = this.getTerritoryName(context.targetId);
          document.getElementById('post-attack-title').innerHTML = `${srcName} <i class="fa-solid fa-arrow-right"></i> ${tgtName}`;
          
          this.sliderPostAttack.min = 0;
          this.sliderPostAttack.max = context.additionalMax;
          this.sliderPostAttack.value = 0;
          
          this.lblPostAttackCount.textContent = context.minMove;
          this.lblPostAttackMin.textContent = context.minMove;
          this.lblPostAttackMax.textContent = context.minMove + context.additionalMax;
          
          this.postAttackModal.classList.add('active');
        } else {
          // Context is missing — auto-heal to release player back to Attack stage
          if (this.postAttackModal) this.postAttackModal.classList.remove('active');
          window.SocketClient.postAttackMove(0, () => {});
        }
      } else {
        if (this.postAttackModal) {
          this.postAttackModal.classList.remove('active');
        }
      }

      // 7. Defender Dice selection modal handling
      if (stage === 'DEFENDER_DICE_DECISION') {
        const context = this.gameState.combatContext;
        const isMeDefender = context && context.defenderId === window.SocketClient.socket.id;

        if (isMeDefender) {
          const attPlayer = this.gameState.players[this.gameState.turnIndex];
          const srcName = this.getTerritoryName(context.sourceId);
          const tgtName = this.getTerritoryName(context.targetId);
          document.getElementById('defend-dice-title').textContent = `${attPlayer.name} is attacking ${tgtName} from ${srcName}! Choose defense dice:`;
          
          this.btnDefendDice2.disabled = context.maxDefDice < 2;
          this.defendDiceModal.classList.add('active');
        } else {
          this.defendDiceModal.classList.remove('active');
        }
      } else {
        if (this.defendDiceModal) {
          this.defendDiceModal.classList.remove('active');
        }
      }

      // 8. Victory / Game Over Modal handling
      if (stage === 'GAME_OVER') {
        const btnReopen = document.getElementById('btn-show-victory');
        if (btnReopen) btnReopen.style.display = 'block';

        if (this.victoryModal && !this.victoryModalDismissed) {
          const winnerId = this.gameState.winner;
          const winner = this.gameState.players.find(p => p.id === winnerId);
          
          const title = document.getElementById('victory-title');
          const subtitle = document.getElementById('victory-subtitle');
          const modeVal = document.getElementById('victory-stat-mode');
          const terrVal = document.getElementById('victory-stat-territories');
          const armyVal = document.getElementById('victory-stat-armies');
          
          if (title && winner) {
            title.textContent = `${winner.name.toUpperCase()} WINS!`;
            title.style.color = winner.color;
          }
          if (subtitle && winner) {
            subtitle.innerHTML = `<span style="color:${winner.color}; font-weight:700;">Commander ${winner.name}</span> has achieved total domination!`;
          }
          if (modeVal) {
            modeVal.textContent = this.gameState.gameMode === 'capital_rush' ? 'Capital Rush' : 'Conquest';
          }
          if (terrVal) {
            const ownedTerrs = Object.values(this.gameState.territories).filter(t => t.ownerId === winnerId).length;
            const totalTerrs = Object.keys(this.gameState.territories).length || 1;
            const pct = Math.round((ownedTerrs / totalTerrs) * 100);
            terrVal.textContent = `${pct}% (${ownedTerrs} / ${totalTerrs})`;
          }
          if (armyVal) {
            const totalArmiesLeft = Object.values(this.gameState.territories)
              .filter(t => t.ownerId === winnerId)
              .reduce((sum, t) => sum + t.armies, 0);
            armyVal.textContent = totalArmiesLeft;
          }

          // Populate Post-Match Accolades & Records
          const accoladesListEl = document.getElementById('victory-accolades-list');
          if (accoladesListEl && this.gameState.players) {
            accoladesListEl.innerHTML = '';
            const players = this.gameState.players;
            const accolades = [];

            // 1. Lucky Gambler (Highest dice duel win rate)
            let bestGambler = null;
            let bestGamblerRate = -1;
            let bestGamblerWins = 0;
            let bestGamblerTotal = 0;
            players.forEach(p => {
              const s = p.stats || {};
              const comps = s.diceRollComparisons || 0;
              if (comps >= 2) {
                const rate = (s.diceRollWins || 0) / comps;
                if (rate > bestGamblerRate) {
                  bestGamblerRate = rate;
                  bestGambler = p;
                  bestGamblerWins = s.diceRollWins || 0;
                  bestGamblerTotal = comps;
                }
              }
            });
            if (bestGambler && bestGamblerRate > 0) {
              accolades.push({
                icon: '<i class="fa-solid fa-bullseye"></i>',
                title: 'Lucky Gambler',
                player: bestGambler,
                desc: `${Math.round(bestGamblerRate * 100)}% Dice Duel Win Rate (${bestGamblerWins}/${bestGamblerTotal})`
              });
            }

            // 2. Iron Fortress (Most casualties defended)
            let ironFortress = null;
            let maxDefended = 0;
            players.forEach(p => {
              const s = p.stats || {};
              const defKills = s.defendedKills || 0;
              if (defKills > maxDefended) {
                maxDefended = defKills;
                ironFortress = p;
              }
            });
            if (ironFortress && maxDefended > 0) {
              accolades.push({
                icon: '<i class="fa-solid fa-shield-halved"></i>',
                title: 'Iron Fortress',
                player: ironFortress,
                desc: `${maxDefended} Enemy Armies Repelled on Defense`
              });
            }

            // 3. Blitz King (Most conquests in a single turn)
            let blitzKing = null;
            let maxBlitz = 0;
            players.forEach(p => {
              const s = p.stats || {};
              const conquests = s.maxConquestsInTurn || s.territoriesConquered || 0;
              if (conquests > maxBlitz) {
                maxBlitz = conquests;
                blitzKing = p;
              }
            });
            if (blitzKing && maxBlitz > 0) {
              accolades.push({
                icon: '<i class="fa-solid fa-bolt"></i>',
                title: 'Blitz King',
                player: blitzKing,
                desc: `${maxBlitz} Territories Conquered in 1 Turn`
              });
            }

            // 4. Backstabber of the Match (Most treaties broken)
            let backstabber = null;
            let maxBetrayals = 0;
            players.forEach(p => {
              const s = p.stats || {};
              const betrayals = s.betrayals || 0;
              if (betrayals > maxBetrayals) {
                maxBetrayals = betrayals;
                backstabber = p;
              }
            });
            if (backstabber && maxBetrayals > 0) {
              accolades.push({
                icon: '<i class="fa-solid fa-snake"></i>',
                title: 'Backstabber of the Match',
                player: backstabber,
                desc: `${maxBetrayals} Non-Aggression Treaties Broken`
              });
            }

            // 5. Tragic Fall (Most territories lost in a single turn)
            let tragicFall = null;
            let maxLost = 0;
            players.forEach(p => {
              const s = p.stats || {};
              const lost = s.maxTerritoriesLostInTurn || 0;
              if (lost > maxLost) {
                maxLost = lost;
                tragicFall = p;
              }
            });
            if (tragicFall && maxLost > 0) {
              accolades.push({
                icon: '<i class="fa-solid fa-arrow-trend-down"></i>',
                title: 'Tragic Fall',
                player: tragicFall,
                desc: `${maxLost} Territories Lost in 1 Turn`
              });
            }

            // Render accolade cards
            if (accolades.length > 0) {
              accolades.forEach(acc => {
                const item = document.createElement('div');
                item.style.cssText = `
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 6px 10px;
                  background: rgba(0, 0, 0, 0.4);
                  border-left: 3px solid ${acc.player.color};
                  border-radius: 6px;
                  font-size: 12px;
                `;
                item.innerHTML = `
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">${acc.icon}</span>
                    <div>
                      <strong style="color: #fff; display: block; font-size: 12px;">${acc.title}</strong>
                      <span style="color: #94a3b8; font-size: 11px;">${acc.desc}</span>
                    </div>
                  </div>
                  <span style="font-weight: 700; color: ${acc.player.color}; font-size: 12px; white-space: nowrap; margin-left: 8px;">
                    ${acc.player.name}
                  </span>
                `;
                accoladesListEl.appendChild(item);
              });
            } else {
              const emptyItem = document.createElement('div');
              emptyItem.style.color = '#94a3b8';
              emptyItem.style.fontSize = '12px';
              emptyItem.textContent = 'Standard match recorded without notable outlier records.';
              accoladesListEl.appendChild(emptyItem);
            }
          }
          
          this.victoryModal.classList.add('active');
        }
      } else {
        this.victoryModalDismissed = false;
        const btnReopen = document.getElementById('btn-show-victory');
        if (btnReopen) btnReopen.style.display = 'none';

        if (this.victoryModal) {
          this.victoryModal.classList.remove('active');
        }
      }

      // Generative AI LLM Control Bar visibility update
      if (this.llmControlBar) {
        const isSpectator = window.SocketClient.spectatorMode;
        const isGenerative = this.gameState.generativeAIMode;
        this.llmControlBar.style.display = (isGenerative || isSpectator) ? 'flex' : 'none';
      }

      // Re-apply visual borders and highlights to SVG map after redraws
      this.highlightSourceTarget();
      // Populate visual dialogue builder dropdown selectors
      const builderTarget = document.getElementById('builder-target');
      const builderRef = document.getElementById('builder-ref-selector');
      const builderAction = document.getElementById('builder-action');
      const builderRefLabel = document.getElementById('builder-ref-label');
      // Inject the 3 new categories dynamically into the select options if not present
      if (builderAction && !builderAction.querySelector('option[value="complaint_bullying"]')) {
        const opt1 = document.createElement('option');
        opt1.value = 'complaint_bullying';
        opt1.textContent = 'Bullying Complaint';
        builderAction.appendChild(opt1);

        if (this.gameState && this.gameState.gameMode === 'capital_rush') {
          const opt2 = document.createElement('option');
          opt2.value = 'lost_capital_defiance';
          opt2.textContent = 'Lost Capital Defiance';
          builderAction.appendChild(opt2);
        }

        const opt3 = document.createElement('option');
        opt3.value = 'final_duel';
        opt3.textContent = 'Final Duel Declaration';
        builderAction.appendChild(opt3);
      }

      if (builderTarget && builderRef && builderAction) {
        const prevTargetVal = builderTarget.value;
        const prevRefVal = builderRef.value;

        builderTarget.innerHTML = '';
        builderRef.innerHTML = '';

        // Populate active AI players
        this.gameState.players.forEach(p => {
          if (p.id !== window.SocketClient.socket.id && !p.eliminated) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            builderTarget.appendChild(opt);
          }
        });

        // Toggle action requirements
        const updateRefOptions = () => {
          builderRef.innerHTML = '';
          const action = builderAction.value;

          if (action === 'alliance' || action === 'alliance_formed') {
            builderTarget.disabled = false;
            builderRef.disabled = false;
            builderRefLabel.textContent = action === 'alliance' ? 'Subject:' : 'Target:';
            this.gameState.players.forEach(p => {
              if (p.id !== builderTarget.value && !p.eliminated) {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                builderRef.appendChild(opt);
              }
            });
          } else if (action === 'ceasefire' || action === 'betrayal_announce' || action === 'mercy' || action === 'complaint_bullying' || action === 'lost_capital_defiance' || action === 'final_duel') {
            builderTarget.disabled = false;
            builderRef.disabled = true;
            builderRefLabel.textContent = 'N/A';
            const opt = document.createElement('option');
            opt.value = 'none';
            opt.textContent = 'N/A';
            builderRef.appendChild(opt);
          } else if (action === 'protest') {
            builderTarget.disabled = false;
            builderRef.disabled = false;
            builderRefLabel.textContent = 'Territory:';
            const mapData = window.SocketClient.mapData || this.gameState.mapData;
            mapData.territories.forEach(t => {
              const opt = document.createElement('option');
              opt.value = t.id;
              opt.textContent = t.name;
              builderRef.appendChild(opt);
            });
          } else if (action === 'brag') {
            builderTarget.disabled = true;
            builderRef.disabled = true;
            builderRefLabel.textContent = 'N/A';
            const opt = document.createElement('option');
            opt.value = 'none';
            opt.textContent = 'N/A';
            builderRef.appendChild(opt);
          } else {
            // move or claim -> populate territory list
            builderTarget.disabled = false;
            builderRef.disabled = false;
            builderRefLabel.textContent = 'Territory:';
            const mapData = window.SocketClient.mapData || this.gameState.mapData;
            mapData.territories.forEach(t => {
              const opt = document.createElement('option');
              opt.value = t.id;
              opt.textContent = t.name;
              builderRef.appendChild(opt);
            });
          }
        };

        builderAction.onchange = updateRefOptions;
        builderTarget.onchange = updateRefOptions;

        // Restore values if still available
        if (prevTargetVal) builderTarget.value = prevTargetVal;
        updateRefOptions();
        if (prevRefVal) builderRef.value = prevRefVal;

        // Hook Send click
        document.getElementById('btn-builder-post').onclick = () => {
          const selectedTargetId = builderTarget.value;
          const targetName = builderTarget.options[builderTarget.selectedIndex]?.text || '';
          const actionVal = builderAction.value;

          const playerTemplates = {
            brag: [
              "📢 I am completely dominating this battleground. Victory is mine!",
              "📢 Look at the board, my victory is inevitable on this map!",
              "📢 My lead is unquestionable. Prepare to face my final sweep!",
              "📢 My vanguard is dominating the board. I advise you all to yield!"
            ],
            betrayal_announce: [
              "💔 I am officially breaking my truce with @[target]. Prepare for battle!",
              "💔 Our pact is void, @[target]. I am marching my armies on your borders!",
              "💔 Consider our ceasefire canceled, @[target]. Prepare for total war!",
              "💔 I am terminating our non-aggression agreement, @[target]. Prepare to defend!"
            ],
            alliance_formed: [
              "🤝 Attention everyone: I have formed an alliance with @[target] against @[subject]!",
              "🤝 Announcement: @[target] and I have joined forces to crush @[subject]!",
              "🤝 We have established a coalition with @[target] targeting @[subject]!",
              "🤝 A formal alliance is active between @[target] and my empire against @[subject]!"
            ],
            protest: [
              "⚠️ @[target], you are amassing a highly suspicious garrison of troops on my border at [requested_territory]. Explain yourself!",
              "⚠️ Why are you building up armies on my border at [requested_territory], @[target]? Back away!",
              "⚠️ Your build-up at [requested_territory] is a major threat, @[target]. Withdraw immediately!",
              "⚠️ I protest your suspicious troop movements near [requested_territory], @[target]!"
            ],
            mercy: [
              "🏳️ @[target], my forces are on the brink of collapse. I beg of you, show mercy and spare my final garrisons!",
              "🏳️ Please show mercy and spare my remaining outposts, @[target]! I am on the ropes!",
              "🏳️ I plead for mercy, @[target]! Please cede attacks on my final sectors!",
              "🏳️ My empire is collapsing, @[target]. I beg for a temporary reprieve!"
            ],
            complaint_bullying: [
              "⚠️ @[target], why do you only attack my poor territories? There is a whole big map with other neighbors to visit!",
              "⚠️ Stop targeting my territories, @[target]! Why aren't you attacking other players?",
              "⚠️ Why am I your only target, @[target]? Go find someone else to attack!",
              "⚠️ Stop picking on my borders, @[target]! There is a whole board out there!"
            ],
            lost_capital_defiance: [
              "🎖️ My capital has fallen to your vanguard, but our resistance is not over. Prepare yourself, @[target]!",
              "🎖️ You took my capital city, @[target], but I will fight until my final breath!",
              "🎖️ My capital is lost to your forces, @[target], but the war is far from won!",
              "🎖️ Enjoy your temporary victory in my capital, @[target]. I will reclaim it!"
            ],
            final_duel: [
              "⚔️ And then there were two! Let our final standoff begin, @[target]!",
              "⚔️ It's down to a final duel, @[target]! Let's settle this campaign!",
              "⚔️ The final battle has arrived for our sudden death showdown, @[target]!",
              "⚔️ Only two remain! Settle your lines for my duel declaration, @[target]!"
            ],
            alliance: [
              "Hey @[target], let's form an alliance and coordinate an attack against @[subject].",
              "We should ally against @[subject], @[target].",
              "Let's form an alliance to deal with @[subject], @[target].",
              "Hey @[target], let's coordinate our forces to eliminate @[subject]."
            ],
            ceasefire: [
              "Hey @[target], let's declare peace and sign a ceasefire pact.",
              "I propose a non-aggression ceasefire truce, @[target].",
              "Let's sign a ceasefire truce, @[target]. Sparing our border is mutually beneficial.",
              "Hey @[target], let's agree to a ceasefire pact and stop attacking each other."
            ],
            move: [
              "Could you please withdraw your armies and move troops away from [requested_territory], @[target]?",
              "Please move your troops out of [requested_territory], @[target].",
              "Let's demilitarize [requested_territory], @[target].",
              "Please vacate your garrison in [requested_territory], @[target]."
            ],
            claim: [
              "Please leave [requested_territory] to me, @[target].",
              "Do not expand your parameters into [requested_territory], @[target].",
              "I request you steer clear of [requested_territory] shortly, @[target].",
              "Claim active. Please avoid [requested_territory] during your next turn, @[target]."
            ]
          };

          const templates = playerTemplates[actionVal] || ["@[target] "];
          let selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

          const subjectName = builderRef.options[builderRef.selectedIndex]?.text || '';
          const terrName = builderRef.options[builderRef.selectedIndex]?.text || '';

          // Do token replacements
          selectedTemplate = selectedTemplate.replace(/@\[target\]/g, `@${targetName}`);
          selectedTemplate = selectedTemplate.replace(/@\[subject\]/g, subjectName ? `@${subjectName}` : 'the others');
          selectedTemplate = selectedTemplate.replace(/\[requested_territory\]/g, terrName);

          // Trigger standard send chat
          window.SocketClient.sendMessage(selectedTemplate);
        };
      }
    }

    applyAnimeFilter(text) {
      if (!text || typeof text !== 'string') return text;
      const emoticons = [' (◕‿◕✿)', ' (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', ' (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', ' (づ｡◕‿‿◕｡)づ', ' (≧◡≦)', ' (*^ω^)', ' (o^▽^o)'];
      
      // Rule: Replace 'l'/'L' with 'w'/'W' unless at the end of a word or second-to-last before a consonant
      let converted = text.replace(/\b[a-zA-Z]+\b/g, (word) => {
        let res = '';
        for (let i = 0; i < word.length; i++) {
          const ch = word[i];
          if (ch.toLowerCase() === 'l') {
            const isLast = (i === word.length - 1);
            const isSecondToLast = (i === word.length - 2);
            const nextCh = !isLast ? word[i + 1] : '';
            const isNextConsonant = nextCh && !/[aeiouy]/i.test(nextCh);

            if (isLast || (isSecondToLast && isNextConsonant)) {
              res += ch;
            } else {
              res += ch === 'L' ? 'W' : 'w';
            }
          } else {
            res += ch;
          }
        }
        return res;
      });

      return converted;
    }

    getInstructionText(isMyTurn, stage) {
      const theme = document.body.getAttribute('data-map-theme') || 'default';
      
      // Top of map instruction banners for Anime Theme (Replace these 3 strings with your custom text)
      if (theme === 'anime') {
        if (stage === 'DRAFT') {
          return 'Pwease draft anywhere u want (^ω^)';
        }
        if (stage === 'ATTACK') {
          return 'U should attack me-I mean a territory using your big cannon of yours (❤ω❤)';
        }
        if (stage === 'FORTIFY') {
          return 'UwU';
        }
      }

      if (!isMyTurn) {
        if (stage === 'CAPITAL_SELECTION') {
          const myCapital = this.gameState.capitals[window.SocketClient.socket.id];
          if (!myCapital) {
            return 'Capital Selection: Click on **one of your territories** to designate it as your capital.';
          }
          return 'Waiting for other commanders to designate their capitals...';
        }
        return `Waiting for <strong style="color:${this.gameState.players[this.gameState.turnIndex].color}">${this.gameState.players[this.gameState.turnIndex].name}</strong> to complete their actions...`;
      }

      switch (stage) {
        case 'CAPITAL_SELECTION':
          const myCapital = this.gameState.capitals[window.SocketClient.socket.id];
          if (myCapital) {
            return 'Waiting for other commanders to designate their capitals...';
          }
          return 'Capital Selection: Click on **one of your territories** to designate it as your capital.';
        case 'SETUP_CLAIM':
          return 'Setup Phase: Click on an **unclaimed territory** to claim ownership.';
        case 'SETUP_FORTIFY':
          return 'Setup Phase: Select **your territory** to place one of your remaining starting armies.';
        case 'POST_ATTACK_MOVE':
          return 'Conquest Victory! Choose how many armies to move forward into your new territory.';
        case 'DEFENDER_DICE_DECISION':
          const combatCtx = this.gameState.combatContext;
          if (combatCtx && combatCtx.defenderId === window.SocketClient.socket.id) {
            return '<i class="fa-solid fa-triangle-exclamation"></i> **Defense warning**: You are under attack! Select how many dice to roll to defend your territory.';
          }
          const defender = this.gameState.players.find(p => p.id === (combatCtx ? combatCtx.defenderId : null));
          return `Awaiting defense decision from <strong style="color:${defender ? defender.color : '#fff'}">${defender ? defender.name : 'Defender'}</strong>...`;
        case 'DRAFT':
          const player = this.gameState.players[this.gameState.turnIndex];
          if (player && player.cards.length >= 5 && this.gameState.draftPool === 0) {
            return `<i class="fa-solid fa-triangle-exclamation"></i> **Card Trade-In Required**: You hold **${player.cards.length} cards**. You must select a set of 3 matching cards below and click **Trade Card Set** to get armies and proceed.`;
          }
          return `Draft Phase: Select **your territory** to place reinforcements. (${this.gameState.draftPool} left)`;
        case 'ATTACK':
          if (!this.selectedSourceId) {
            return 'Attack Phase: Select **your territory** (must have >= 2 armies) to attack from.';
          } else if (!this.selectedTargetId) {
            return `Attack Phase: Select an **adjacent enemy territory** to attack from ${this.getTerritoryName(this.selectedSourceId)}.`;
          } else {
            return `Attack Phase: Target locked. Press **[R]** to roll maximum dice or select action on map.`;
          }
        case 'FORTIFY':
          if (!this.selectedSourceId) {
            return 'Fortification Phase: Select **your territory** to move armies from.';
          } else if (!this.selectedTargetId) {
            return `Fortification Phase: Select an **allied connected territory** to move armies to.`;
          } else {
            return `Fortification Phase: Click selected destination again to execute maneuver.`;
          }
        case 'GAME_OVER':
          const winner = this.gameState.players.find(p => p.id === this.gameState.winner);
          return `<i class="fa-solid fa-trophy"></i> Campaign concluded! Winner: <strong style="color:${winner ? winner.color : '#fff'}">${winner ? winner.name : 'Unknown'}</strong>.`;
        default:
          return '';
      }
    }

    isPlayerOwner(player, ownerId) {
      if (!player || !ownerId) return false;
      return player.id === ownerId || 
             player.selectedNationId === ownerId || 
             player.nationId === ownerId || 
             (player.name && ownerId && player.name.trim().toLowerCase() === String(ownerId).trim().toLowerCase());
    }

    handleTerritoryClick(territoryId, event) {
      const stage = this.gameState.turnStage;
      const activePlayer = this.gameState.players[this.gameState.turnIndex];
      const isGenerative = !!this.gameState.generativeAIMode || !!window.SocketClient.spectatorMode;
      const isMyTurn = (activePlayer && activePlayer.id === window.SocketClient.socket.id) || isGenerative;

      if (!isMyTurn && stage !== 'CAPITAL_SELECTION') return;

      const territory = this.gameState.territories[territoryId];
      if (!territory) return;

      const isOwnedByMe = isGenerative ? this.isPlayerOwner(activePlayer, territory.ownerId) : (this.isPlayerOwner({ id: window.SocketClient.socket.id }, territory.ownerId) || territory.ownerId === window.SocketClient.socket.id);

      if (stage === 'CAPITAL_SELECTION') {
        const myCapital = this.gameState.capitals[window.SocketClient.socket.id];
        if (myCapital) {
          alert('You have already designated your capital!');
          return;
        }
        if (!isOwnedByMe) {
          alert('You must select one of your own territories to be your capital.');
          return;
        }
        window.showConfirm(`Establish your Capital in ${this.getTerritoryName(territoryId)}?`, {
          title: 'Designate Capital',
          okLabel: 'Establish Capital'
        }).then((ok) => {
          if (ok) {
            window.SocketClient.selectCapital(territoryId, (res) => {
              if (res.error) window.showToast(res.error, 'error');
            });
          }
        });
        return;

      } else if (stage === 'SETUP_CLAIM') {
        if (territory.ownerId !== null) {
          alert('This territory is already claimed.');
          return;
        }
        window.SocketClient.placeTroops(territoryId, 1, (res) => {
          if (res.error) alert(res.error);
        });

      } else if (stage === 'SETUP_FORTIFY') {
        if (!isOwnedByMe) {
          alert('You must select your own territory.');
          return;
        }
        window.SocketClient.placeTroops(territoryId, 1, (res) => {
          if (res.error) alert(res.error);
        });

      } else if (stage === 'DRAFT') {
        if (!isOwnedByMe) {
          alert('You must place reinforcement draft armies on your own territory.');
          return;
        }

        // Ctrl-Click, Alt-Click, or Double-Click opens Custom Amount Modal
        if (event.ctrlKey || event.altKey || event.detail === 2) {
          this.openDraftModal(territoryId);
          return;
        }

        // Batch placement calculation
        let amount = 1;
        if (event.shiftKey || this.draftStepSize === 'ALL') {
          amount = this.gameState.draftPool;
        } else {
          amount = Math.min(Number(this.draftStepSize) || 1, this.gameState.draftPool);
        }

        if (amount <= 0) return;

        window.SocketClient.placeTroops(territoryId, amount, (res) => {
          if (res.error) alert(res.error);
        });

      } else if (stage === 'ATTACK') {
        // Intercept standard click sequence if a Nuke launcher is armed
        if (this.activeFiringWeaponType) {
          const me = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);
          const isThermo = this.activeFiringWeaponType === 'thermonuke';
          const weaponStock = isThermo ? (me ? me.thermonukes : 0) : (me ? me.nukes : 0);

          if (!weaponStock || weaponStock <= 0) {
            alert('You do not hold this weapon type in your inventory.');
            this.activeFiringWeaponType = null;
            this.selectedLaunchPadId = null;
            document.querySelectorAll('.nuke-badge').forEach(b => b.classList.remove('active-pulsing'));
            this.lblInstructions.innerHTML = this.getInstructionText(true, 'ATTACK');
            return;
          }

          if (!this.selectedLaunchPadId) {
            if (!isOwnedByMe) {
              alert('You must select one of your own territories to act as the Launch Pad Silo.');
              return;
            }
            if (territory.armies < 2) {
              alert('Launch Pad Silos must have at least 2 armies stationed.');
              return;
            }
            this.selectedLaunchPadId = territoryId;
            this.lblInstructions.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> **LAUNCH SEQUENCING**: Launch pad Silo locked on ${this.getTerritoryName(territoryId)}. Select any territory on the map (self, ally, or opponent) to detonate!`;
          } else {

            window.showConfirm(`Fire a nuclear missile from ${this.getTerritoryName(this.selectedLaunchPadId)} and detonate on ${this.getTerritoryName(territoryId)}? This action is irreversible.`, {
              title: 'Detonation Warning',
              okLabel: 'Fire Missile',
              danger: true
            }).then((confirmed) => {
              if (!confirmed) return;
              const srcId = this.selectedLaunchPadId;
              const tgtId = territoryId;
              const thermoFlag = isThermo;

              // De-select armed state immediately
              this.activeFiringWeaponType = null;
              this.selectedLaunchPadId = null;
              document.querySelectorAll('.nuke-badge').forEach(b => b.classList.remove('active-pulsing'));
              this.lblInstructions.innerHTML = this.getInstructionText(true, 'ATTACK');

              window.SocketClient.fireNuke(srcId, tgtId, thermoFlag, (res) => {
                if (res.error) {
                  window.showToast(res.error, 'error');
                } else {
                  // Trigger gorgeous ballistic missile launching animation
                  const mapData = window.SocketClient.mapData || this.gameState.mapData;
                  const srcCenter = mapData.territories.find(t => t.id === srcId)?.center;
                  const tgtCenter = mapData.territories.find(t => t.id === tgtId)?.center;
                  if (srcCenter && tgtCenter && this.renderer) {
                    this.renderer.fireNuclearMissile(srcCenter, tgtCenter, thermoFlag, () => {
                      showToast('NUCLEAR DETONATION COMPLETE!', 'warning');
                    });
                  } else {
                    showToast('NUCLEAR DETONATION COMPLETE!', 'warning');
                  }
                }
              });
            });
          }
          return;
        }

        if (isOwnedByMe) {
          // Select source
          if (territory.armies < 2) {
            alert('Attacking territory must have at least 2 armies.');
            return;
          }
          this.selectedSourceId = territoryId;
          this.selectedTargetId = null;
          this.lblInstructions.innerHTML = this.getInstructionText(true, stage);
          this.highlightSourceTarget();
        } else {
          // Select target
          if (!this.selectedSourceId) {
            alert('Select one of your territories first.');
            return;
          }
          // Check adjacency
          const adjacent = this.getAdjacentTerritories(this.selectedSourceId);
          if (!adjacent.includes(territoryId)) {
            alert('Target territory must be adjacent to source.');
            return;
          }
          
          this.selectedTargetId = territoryId;
          this.highlightSourceTarget();

          const sourceArmies = this.gameState.territories[this.selectedSourceId].armies;

          // Safety: source must have at least 2 armies to attack
          if (sourceArmies < 2) {
            alert('Source territory needs at least 2 armies to attack.');
            this.selectedSourceId = null;
            this.selectedTargetId = null;
            this.highlightSourceTarget();
            return;
          }

          // maxDice: clamped so it's always between 1 and 3
          // 3 dice needs 4+ armies, 2 dice needs 3+, 1 die needs 2+
          const maxDice = Math.min(3, Math.max(1, sourceArmies - 1));

          const isFightToDeath = this.chkFightToDeath ? this.chkFightToDeath.checked : false;

          if (isFightToDeath) {
            this.executeBlitzAttack(this.selectedSourceId, this.selectedTargetId);
          } else {
            const autoAttack = this.chkAutoAttack ? this.chkAutoAttack.checked : true;
            if (autoAttack) {
              this.triggerAnimeAttackJumpscare();
              window.SocketClient.attack(this.selectedSourceId, this.selectedTargetId, maxDice, (res) => {
                if (res.error) {
                  alert(res.error);
                  this.selectedSourceId = null;
                  this.selectedTargetId = null;
                  this.highlightSourceTarget();
                }
              });
            } else {
              // Show attack dice selection modal
              const srcName = this.getTerritoryName(this.selectedSourceId);
              const tgtName = this.getTerritoryName(this.selectedTargetId);
              document.getElementById('attack-dice-title').innerHTML = `${srcName} <i class="fa-solid fa-crossed-swords"></i> ${tgtName}`;
              
              // Enable/disable buttons based on troop constraints
              if (this.btnAttackDice2) this.btnAttackDice2.disabled = sourceArmies < 3;
              if (this.btnAttackDice3) this.btnAttackDice3.disabled = sourceArmies < 4;

              if (this.attackDiceModal) this.attackDiceModal.classList.add('active');
            }
          }
        }

      } else if (stage === 'FORTIFY') {
        if (!isOwnedByMe) {
          alert('You must own the source and destination territories.');
          return;
        }

        if (!this.selectedSourceId) {
          if (territory.armies < 2) {
            alert('Source territory must have at least 2 armies to fortify from.');
            return;
          }
          this.selectedSourceId = territoryId;
          this.highlightSourceTarget();
          this.lblInstructions.innerHTML = this.getInstructionText(true, stage);
        } else {
          if (this.selectedSourceId === territoryId) {
            // Cancel selection
            this.selectedSourceId = null;
            this.highlightSourceTarget();
            this.lblInstructions.innerHTML = this.getInstructionText(true, stage);
            return;
          }

          // We selected a target destination territory
          this.selectedTargetId = territoryId;
          this.highlightSourceTarget();

          const maxMove = this.gameState.territories[this.selectedSourceId].armies - 1;
          const input = prompt(`Enter number of armies to move from ${this.getTerritoryName(this.selectedSourceId)} to ${this.getTerritoryName(this.selectedTargetId)} (1-${maxMove}):`, maxMove);
          const amount = parseInt(input);

          if (!isNaN(amount) && amount >= 1 && amount <= maxMove) {
            window.SocketClient.fortify(this.selectedSourceId, this.selectedTargetId, amount, (res) => {
              if (res.error) {
                alert(res.error);
              } else {
                this.selectedSourceId = null;
                this.selectedTargetId = null;
                this.highlightSourceTarget();
              }
            });
          } else {
            this.selectedTargetId = null;
            this.highlightSourceTarget();
          }
        }
      }
    }

    highlightSourceTarget() {
      // Clear borders & pulsing animations
      document.querySelectorAll('.territory-poly').forEach(p => {
        const tid = p.id.replace('poly-', '');
        const mapData = window.SocketClient.mapData || this.gameState.mapData;
        const cont = mapData.continents.find(c => c.territoryIds.includes(tid));
        p.style.stroke = cont ? cont.color : '';
        p.style.strokeWidth = cont ? '2px' : '';
        p.classList.remove('pulsing-glow');
      });

      if (this.selectedSourceId) {
        const poly = document.getElementById(`poly-${this.selectedSourceId}`);
        if (poly) {
          poly.style.stroke = '#00ffcc'; // active glowing cyan for source
          poly.style.strokeWidth = '4px';
        }

        // Highlight valid targets if in Attack stage (including sea connections!)
        const stage = this.gameState.turnStage;
        if (stage === 'ATTACK' && !this.selectedTargetId) {
          const adjacent = this.getAdjacentTerritories(this.selectedSourceId);
          adjacent.forEach(tid => {
            const tState = this.gameState.territories[tid];
            if (tState && tState.ownerId !== window.SocketClient.socket.id) {
              const targetPoly = document.getElementById(`poly-${tid}`);
              if (targetPoly) {
                targetPoly.style.stroke = '#ef4444'; // pulsing red for targets
                targetPoly.style.strokeWidth = '3px';
                targetPoly.classList.add('pulsing-glow');
              }
            }
          });
        }
      }

      if (this.selectedTargetId) {
        const poly = document.getElementById(`poly-${this.selectedTargetId}`);
        if (poly) {
          poly.style.stroke = '#ef4444'; // red border for target
          poly.style.strokeWidth = '4px';
        }
      }
    }

    // Sidebar Renderers
    // Sidebar Renderers
    renderPlayersList() {
      this.playersList.innerHTML = '';
      const isHost = window.SocketClient.isHost || (this.gameState.players && this.gameState.players.find(p => p.id === window.SocketClient.socket.id)?.isHost);
      const isFog = !!(this.gameState && this.gameState.fogOfWar && !window.SocketClient?.spectatorMode && this.gameState.turnStage !== 'GAME_OVER');

      this.gameState.players.forEach((p, idx) => {
        const item = document.createElement('div');
        item.setAttribute('class', `game-player-item ${idx === this.gameState.turnIndex ? 'active-turn' : ''} ${p.eliminated ? 'eliminated' : ''}`);

        const hasFullVision = this.hasFullVisionOfPlayer(p.id);

        // Get owned territories and total armies
        const owned = Object.keys(this.gameState.territories).filter(
          tid => this.isPlayerOwner(p, this.gameState.territories[tid].ownerId)
        );
        const totalArmies = owned.reduce((sum, tid) => sum + this.gameState.territories[tid].armies, 0);
        const income = this.calculatePlayerIncome(p.id);

        const displayTerrCount = hasFullVision ? owned.length : '?';
        const displayArmiesCount = hasFullVision ? totalArmies : '?';
        const displayIncome = hasFullVision ? `+${income}/turn` : '+?/turn';

        // Generate dynamic personality badge if the player is an active AI and not in LLM mode
        const pBadgeHtml = p.isAI && p.personality && !p.isLLM
          ? `<span class="personality-badge ${p.personality}">${p.personality}</span>` 
          : '';

        let selectHtml = '';
        if (isHost && p.isAI && !p.eliminated) {
          selectHtml = `
            <select class="game-ai-type-select" data-id="${p.id}" style="background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--border-glass); padding: 2px 4px; border-radius: 4px; font-size: 10px; cursor: pointer; outline: none; margin-left: 8px; font-weight: 600;">
              <option value="traditional" ${!p.isLLM ? 'selected' : ''}>Heuristic</option>
              <option value="llm" ${p.isLLM ? 'selected' : ''}>LLM</option>
            </select>
          `;
        } else {
          selectHtml = p.isAI ? `<span class="personality-badge ${p.isLLM ? 'llm' : (p.personality || 'normal')}">${p.isLLM ? 'LLM' : (p.personality || 'normal').toUpperCase()}</span>` : '';
        }

        // Show every player's nuke stockpile ONLY if crafting is enabled OR at least one player holds a nuke (and vision allows)
        const isCraftingEnabled = !!this.gameState.allowCrafting;
        const anyoneHasNukes = (this.gameState.players || []).some(pl => (pl.nukes || 0) > 0 || (pl.thermonukes || 0) > 0);
        const arsenalVisible = isCraftingEnabled || anyoneHasNukes;

        const nukeCountsHtml = arsenalVisible && hasFullVision
          ? '<span style="font-size: 10px; font-weight: 700; margin-top: 1px;"><span style="color: #22c55e;"><i class="fa-solid fa-radiation"></i> ' + (p.nukes || 0) + '</span> <span style="color: #a855f7;"><i class="fa-solid fa-rocket"></i> ' + (p.thermonukes || 0) + '</span></span>'
          : '';

        item.innerHTML = `
          <div class="player-color-dot" style="background-color: ${p.color};"></div>
          <span class="game-player-name">${p.name} ${p.isAI ? '(AI)' : ''}${pBadgeHtml}</span>
          ${selectHtml}
          <span class="game-player-stats" style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.25;">
            <span><i class="fa-solid fa-earth-americas"></i> ${displayTerrCount} | <i class="fa-solid fa-person-military-pointing"></i> ${displayArmiesCount}</span>
            <span style="color: var(--warning); font-weight: 700; font-size: 10px; margin-top: 1px;"><i class="fa-solid fa-circle-plus"></i> ${displayIncome}</span>
            ${nukeCountsHtml}
          </span>
        `;

        if (this.isTimelapseMode && p.stats) {
          item.innerHTML += `
            <div style="font-size: 9px; color: var(--text-muted); padding-left: 18px; margin-top: 4px; display: flex; gap: 8px;">
              <span>Draft: <strong style="color: #fff;">${p.stats.drafted || 0}</strong></span>
              <span>Kills: <strong style="color: #33ff88;">${p.stats.killed || 0}</strong></span>
              <span>Lost: <strong style="color: #ff5555;">${p.stats.lost || 0}</strong></span>
            </div>
          `;
        }

        if (this.isTimelapseMode) {
          const mapData = window.SocketClient.mapData || this.gameState.mapData;
          const nations = (mapData && mapData.nations) || [];
          const nationObj = nations.find(n => n.id === p.nationId || n.name === p.nationName || (p.name && p.name.startsWith(n.name)));
          if (nationObj) {
            item.innerHTML += `
              <div style="font-size: 9px; color: var(--primary); padding-left: 18px; margin-top: 2px; line-height: 1.3;">
                <strong>Nation:</strong> ${nationObj.name}${nationObj.description ? ` — <em>"${nationObj.description}"</em>` : ''}
              </div>
            `;
          }

          const ownedDetails = owned.map(tid => {
            const name = this.getTerritoryName(tid);
            const armies = this.gameState.territories[tid].armies;
            return `${name} (${armies})`;
          }).join(', ');
          
          item.innerHTML += `
            <div style="font-size: 9px; color: var(--text-muted); padding-left: 18px; margin-top: 2px; line-height: 1.3; max-width: 250px;">
              <strong>Territories:</strong> <span style="color: #cbd5e1;">${ownedDetails || 'None'}</span>
            </div>
          `;
        }

        this.playersList.appendChild(item);
      });

      // Bind change listeners to inline mid-game AI type toggles
      this.playersList.querySelectorAll('.game-ai-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
          const targetPlayerId = e.target.getAttribute('data-id');
          const isLLM = e.target.value === 'llm';
          window.SocketClient.togglePlayerLLM(targetPlayerId, isLLM, (res) => {
            if (res.error) {
              alert(res.error);
              e.target.value = isLLM ? 'traditional' : 'llm'; // Revert visual state
            } else {
              showToast(`<i class="fa-solid fa-arrows-rotate"></i> AI Commander switched to ${isLLM ? 'LLM Mode' : 'Heuristic Mode'}!`, 'success');
            }
          });
        });
      });
    }

    renderDominanceMeter() {
      const container = document.getElementById('game-dominance-bar-container');
      const bar = document.getElementById('game-dominance-bar');
      const incomeBar = document.getElementById('game-dominance-income-bar');
      if (!bar || !this.gameState || !this.gameState.territories) return;

      const isFog = !!(this.gameState && this.gameState.fogOfWar && !window.SocketClient?.spectatorMode && this.gameState.turnStage !== 'GAME_OVER');

      // Hide and disable dominance meter completely in Fog of War mode
      if (isFog) {
        if (container) container.style.display = 'none';
        return;
      } else {
        if (container) container.style.display = 'flex';
      }

      const totalTerritories = Object.keys(this.gameState.territories).length;
      if (totalTerritories === 0) return;

      // Group territory counts by player
      const counts = {};
      Object.keys(this.gameState.territories).forEach(tid => {
        const ownerId = this.gameState.territories[tid]?.ownerId || 'dummy';
        counts[ownerId] = (counts[ownerId] || 0) + 1;
      });

      // Per-player income (armies/turn): (territories / 3, minimum 3) + full
      // continent bonuses. Recomputed on every state update, so it is highly
      // dynamic — flipping a single continent visibly swings income share.
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      const continents = (mapData && Array.isArray(mapData.continents)) ? mapData.continents : [];
      const incomes = {};
      let totalIncome = 0;
      (this.gameState.players || []).forEach(p => {
        const count = counts[p.id] || 0;
        let income = 0;
        if (count > 0) {
          income = Math.max(3, Math.floor(count / 3));
          continents.forEach(cont => {
            const ids = cont.territoryIds || [];
            if (ids.length > 0 && ids.every(tid => {
              const terr = this.gameState.territories[tid];
              return terr && terr.ownerId === p.id;
            })) {
              income += cont.bonus || 0;
            }
          });
        }
        incomes[p.id] = income;
        totalIncome += income;
      });

      const makeSeg = (parent, widthPct, color, title, text) => {
        const seg = document.createElement('div');
        seg.className = 'dominance-bar-segment';
        seg.style.width = `${widthPct}%`;
        seg.style.backgroundColor = color;
        seg.title = title;
        if (text) seg.textContent = text;
        parent.appendChild(seg);
      };

      // Row 1: territory share of the world
      bar.innerHTML = '';
      (this.gameState.players || []).forEach(p => {
        const count = counts[p.id] || 0;
        if (count > 0) {
          const pct = Math.round((count / totalTerritories) * 100);
          makeSeg(bar, (count / totalTerritories) * 100, p.color || '#00e5ff',
            `${p.name}: ${count}/${totalTerritories} territories (${pct}%)`,
            pct >= 8 ? `${pct}%` : '');
        }
      });

      // Neutral / Dummy territories (hold land but earn no income)
      if (counts['dummy']) {
        const count = counts['dummy'];
        const pct = Math.round((count / totalTerritories) * 100);
        makeSeg(bar, (count / totalTerritories) * 100, '#475569',
          `Neutral: ${count}/${totalTerritories} territories (${pct}%)`,
          pct >= 8 ? `${pct}%` : '');
      }

      // Row 2: income share of the world (row hidden until someone earns income)
      const incomeRow = document.getElementById('dominance-income-row');
      if (incomeRow) incomeRow.classList.toggle('no-income', totalIncome <= 0);
      if (incomeBar) {
        incomeBar.innerHTML = '';
        if (totalIncome > 0) {
          (this.gameState.players || []).forEach(p => {
            const income = incomes[p.id] || 0;
            if (income > 0) {
              const pct = Math.round((income / totalIncome) * 100);
              makeSeg(incomeBar, (income / totalIncome) * 100, p.color || '#00e5ff',
                `${p.name}: +${income} armies/turn (${pct}% of world income)`,
                pct >= 8 ? `${pct}%` : '');
            }
          });
        }
      }
    }

    renderContinentsLegend() {
      const container = document.getElementById('game-continents-list');
      if (!container) return;

      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      if (!mapData || !mapData.continents || mapData.continents.length === 0) {
        container.innerHTML = '<p class="empty-state">No continents defined.</p>';
        return;
      }

      container.innerHTML = '';
      mapData.continents.forEach(c => {
        const item = document.createElement('div');
        item.className = 'continent-legend-item';
        item.title = `Territories: ${c.territoryIds.map(tid => this.getTerritoryName(tid)).join(', ')}`;
        
        // Check if a player controls the whole continent
        let controllerName = null;
        let controllerColor = '#ffffff';
        if (this.gameState) {
          const legendBlizzardSet = new Set(this.gameState.blizzards || []);
          const activeTerrs = c.territoryIds.filter(tid => !legendBlizzardSet.has(tid));
          const owners = activeTerrs.map(tid => this.gameState.territories[tid] ? this.gameState.territories[tid].ownerId : null);
          const firstOwner = owners[0];
          if (activeTerrs.length > 0 && firstOwner && firstOwner !== 'dummy' && owners.every(o => o === firstOwner)) {
            const player = this.gameState.players.find(p => p.id === firstOwner);
            if (player) {
              controllerName = player.name;
              controllerColor = player.color;
            }
          }
        }

        const controlText = controllerName ? ` (${controllerName})` : '';

        item.innerHTML = `
          <div class="continent-legend-left">
            <div class="continent-color-indicator" style="background-color: ${c.color || '#a855f7'}"></div>
            <span class="continent-legend-name" style="${controllerName ? `color: ${controllerColor}; text-shadow: 0 0 4px ${controllerColor}66` : ''}">${c.name}${controlText}</span>
          </div>
          <span class="continent-legend-bonus" style="${controllerName ? 'background: rgba(34,197,94,0.18); border-color: #22c55e; color: #22c55e;' : ''}">+${c.bonus}${controllerName ? ' *' : ''}</span>
        `;

        // Highlight territories on map when hovering over the continent legend item
        item.addEventListener('mouseenter', () => {
          if (this.renderer) {
            this.renderer.highlightContinent(c);
          }
        });

        item.addEventListener('mouseleave', () => {
          if (this.renderer) {
            this.renderer.clearContinentHighlight();
          }
          if (typeof this.highlightSourceTarget === 'function') {
            this.highlightSourceTarget();
          }
        });

        container.appendChild(item);
      });
    }

    renderActivePacts() {
      this.activePactsList.innerHTML = '';
      const pacts = this.gameState.pacts;

      if (!pacts || pacts.length === 0) {
        this.activePactsList.innerHTML = '<p class="empty-state">No active treaties.</p>';
        return;
      }

      pacts.forEach(p => {
        const pA = this.gameState.players.find(pl => pl.id === p.playerA);
        const pB = this.gameState.players.find(pl => pl.id === p.playerB);
        if (!pA || !pB) return;

        const isMe = p.playerA === window.SocketClient.socket.id || p.playerB === window.SocketClient.socket.id;
        const opp = p.playerA === window.SocketClient.socket.id ? pB : pA;

        const badge = document.createElement('div');
        badge.setAttribute('class', `pact-item-badge ${p.type}`);

        badge.innerHTML = `
          <div>
            <strong>${p.type === 'non_aggression' ? 'Non-Aggression' : 'Alliance'}</strong>
            <div style="font-size: 10px; color: var(--text-muted)">${pA.name} & ${pB.name}</div>
          </div>
          ${isMe ? `<button class="btn-break" data-opp="${opp.id}" title="Break Pact & Betray Player"><i class="fa-solid fa-heart-crack"></i></button>` : ''}
        `;

        const btnBreak = badge.querySelector('.btn-break');
        if (btnBreak) {
          btnBreak.addEventListener('click', () => {
            const oppId = btnBreak.getAttribute('data-opp');
            window.showConfirm(`Are you sure you want to betray and break your pact with ${this.getPlayerName(oppId)}? This will permanently lower their trust in you.`, {
              title: 'Break Pact',
              okLabel: 'Betray & Break',
              danger: true
            }).then((ok) => {
              if (ok) {
                window.SocketClient.breakPact(oppId, (res) => {
                  if (res.error) window.showToast(res.error, 'error');
                });
              }
            });
          });
        }

        this.activePactsList.appendChild(badge);
      });
    }

    openDraftModal(territoryId) {
      if (!this.gameState || this.gameState.turnStage !== 'DRAFT') return;
      const pool = this.gameState.draftPool;
      if (pool <= 0) return;
      this.activeDraftTerritoryId = territoryId;
      const terrName = this.getTerritoryName(territoryId);
      if (this.lblDraftModalTerritory) this.lblDraftModalTerritory.textContent = terrName;
      if (this.lblDraftModalPool) this.lblDraftModalPool.textContent = pool;
      
      const stepVal = parseInt(this.draftStepSize);
      const initVal = Math.min(pool, isNaN(stepVal) ? pool : (stepVal > 0 ? stepVal : Math.min(10, pool)));

      if (this.inputDraftModalAmount) {
        this.inputDraftModalAmount.max = pool;
        this.inputDraftModalAmount.value = initVal;
      }
      if (this.sliderDraftModalAmount) {
        this.sliderDraftModalAmount.max = pool;
        this.sliderDraftModalAmount.value = initVal;
      }
      if (this.draftTroopsModal) this.draftTroopsModal.classList.add('active');
    }

    calculateFixedTradeBonus(cards) {
      if (!cards || cards.length !== 3) return 0;
      const types = cards.map(c => c.type);
      const wildCount = types.filter(t => t === 'Wild').length;
      const uniqueTypes = new Set(types);
      const isValid = wildCount >= 1 || uniqueTypes.size === 1 || uniqueTypes.size === 3;
      if (!isValid) return 0;

      const nWild = wildCount;
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

    autoSelectCardSet(doSelect = true) {
      if (!this.gameState) return false;
      const me = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);
      if (!me || !me.cards || me.cards.length < 3) return false;

      const rule = (this.gameState && this.gameState.cardTradeRule) || 'progressive';
      let bestIndices = null;
      let maxVal = -1;

      for (let i = 0; i < me.cards.length - 2; i++) {
        for (let j = i + 1; j < me.cards.length - 1; j++) {
          for (let k = j + 1; k < me.cards.length; k++) {
            const selected = [me.cards[i], me.cards[j], me.cards[k]];
            const types = selected.map(c => c.type);
            const wildCount = types.filter(t => t === 'Wild').length;
            const uniqueTypes = new Set(types);
            const isValid = wildCount >= 1 || uniqueTypes.size === 1 || uniqueTypes.size === 3;
            if (isValid) {
              if (rule === 'fixed') {
                const val = this.calculateFixedTradeBonus(selected);
                if (val > maxVal) {
                  maxVal = val;
                  bestIndices = [i, j, k];
                }
              } else {
                if (doSelect) {
                  this.selectedCardIndices = [i, j, k];
                  this.renderCards();
                }
                return true;
              }
            }
          }
        }
      }

      if (rule === 'fixed' && bestIndices) {
        if (doSelect) {
          this.selectedCardIndices = bestIndices;
          this.renderCards();
        }
        return true;
      }
      return false;
    }

    populateCardTargetTerritories() {
      if (!this.selectCardTargetTerritory) return;
      const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
      if (!myId || !this.gameState || !this.gameState.territories) return;
      const currentVal = this.selectCardTargetTerritory.value;
      let html = '<option value="">-- Draft Pool --</option>';
      Object.values(this.gameState.territories).forEach(terr => {
        if (terr.ownerId === myId) {
          const name = this.getTerritoryName(terr.id);
          const selected = (terr.id === currentVal) ? 'selected' : '';
          html += `<option value="${terr.id}" ${selected}>${name} (${terr.armies} armies)</option>`;
        }
      });
      this.selectCardTargetTerritory.innerHTML = html;
    }

    renderCards() {
      this.populateCardTargetTerritories();
      this.cardsList.innerHTML = '';
      const me = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);
      
      const hasValidSet = this.autoSelectCardSet(false);
      if (this.btnTradeAllCards) this.btnTradeAllCards.disabled = !hasValidSet;
      if (this.btnAutoSelectCards) this.btnAutoSelectCards.disabled = !hasValidSet;

      if (!me || !me.cards || me.cards.length === 0) {
        this.cardsList.innerHTML = '<p class="empty-state">No cards held.</p>';
        this.btnTradeCards.disabled = true;
        return;
      }

      // Check current map theme
      const theme = document.body.getAttribute('data-map-theme') || 'default';
      const isSciFi = theme === 'scifi';
      const isModern = theme === 'modern';
      const isAnime = theme === 'anime';

      me.cards.forEach((card, idx) => {
        const item = document.createElement('label');
        item.setAttribute('class', 'card-item');

        const mapData = window.SocketClient.mapData || this.gameState.mapData;
        let terrName = card.territoryId ? this.getTerritoryName(card.territoryId) : 'Wildcard';

        let displayName = card.type;
        let icon = 'fa-person-rifle';

        if (isSciFi) {
          if (card.type === 'Infantry') { displayName = 'Cyber-Soldier'; icon = 'fa-user-ninja'; }
          else if (card.type === 'Cavalry') { displayName = 'Hyper-Tank'; icon = 'fa-shield-halved'; }
          else if (card.type === 'Artillery') { displayName = 'Star-Fighter'; icon = 'fa-jet-fighter-up'; }
          else if (card.type === 'Wild') { displayName = 'Wildcard'; icon = 'fa-star'; }
        } else if (isModern) {
          if (card.type === 'Infantry') { displayName = 'Infantry'; icon = 'fa-person-military-pointing'; }
          else if (card.type === 'Cavalry') { displayName = 'Tank'; icon = 'fa-truck-monster'; }
          else if (card.type === 'Artillery') { displayName = 'Artillery'; icon = 'fa-cannon'; }
        } else if (isAnime) {
          if (card.type === 'Infantry') { displayName = 'Chibi Idol (◕‿◕✿)'; icon = 'fa-wand-magic-sparkles'; }
          else if (card.type === 'Cavalry') { displayName = 'Mecha Suit (≧◡≦)'; icon = 'fa-robot'; }
          else if (card.type === 'Artillery') { displayName = 'Maho Cannon (*^ω^)'; icon = 'fa-star'; }
          terrName = this.applyAnimeFilter(terrName);
        } else {
          if (card.type === 'Cavalry') icon = 'fa-horse';
          else if (card.type === 'Artillery') icon = 'fa-cannon';
          else if (card.type === 'Wild') icon = 'fa-star';
        }

        const isChecked = this.selectedCardIndices.includes(idx);
        const miniSvgHtml = this.generateTerritoryMiniSVG(card.territoryId);

        item.innerHTML = `
          <input type="checkbox" data-index="${idx}" ${isChecked ? 'checked' : ''}>
          ${miniSvgHtml}
          <div class="card-details">
            <span class="card-type"><i class="fa-solid ${icon}"></i> ${displayName}</span>
            <span class="card-terr-name">${terrName}</span>
          </div>
        `;

        item.querySelector('input').addEventListener('change', (e) => {
          const index = parseInt(e.target.getAttribute('data-index'));
          if (e.target.checked) {
            if (this.selectedCardIndices.length >= 3) {
              e.target.checked = false;
              alert('You can select a maximum of 3 cards.');
              return;
            }
            this.selectedCardIndices.push(index);
          } else {
            this.selectedCardIndices = this.selectedCardIndices.filter(i => i !== index);
          }
          this.btnTradeCards.disabled = this.selectedCardIndices.length !== 3;
          this.evaluateCardTradeIndicator();
        });

        this.cardsList.appendChild(item);
      });

      this.btnTradeCards.disabled = this.selectedCardIndices.length !== 3;
      this.evaluateCardTradeIndicator();
    }

    evaluateCardTradeIndicator() {
      if (this.cardTradeStatus) {
        if (this.selectedCardIndices.length === 0) {
          this.cardTradeStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Select 3 cards to evaluate';
          this.cardTradeStatus.style.color = 'var(--text-muted)';
        } else if (this.selectedCardIndices.length < 3) {
          this.cardTradeStatus.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Selected ${this.selectedCardIndices.length}/3 cards`;
          this.cardTradeStatus.style.color = 'var(--text-muted)';
        } else {
          // Exactly 3 selected
          const isValid = this.isValidCardSetSelected();
          if (isValid) {
            const rule = (this.gameState && this.gameState.cardTradeRule) || 'progressive';
            let nextVal = 0;
            if (rule === 'fixed') {
              const me = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);
              const selectedCards = this.selectedCardIndices.map(idx => me ? me.cards[idx] : null).filter(Boolean);
              nextVal = this.calculateFixedTradeBonus(selectedCards);
              this.cardTradeStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Valid Fixed Set! Worth +${nextVal} armies.`;
            } else {
              const tradeCount = this.gameState.tradeInCount || 0;
              const count = tradeCount + 1;
              if (count === 1) nextVal = 4;
              else if (count === 2) nextVal = 6;
              else if (count === 3) nextVal = 8;
              else if (count === 4) nextVal = 10;
              else if (count === 5) nextVal = 12;
              else if (count === 6) nextVal = 15;
              else nextVal = 15 + (count - 6) * 5;
              this.cardTradeStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Valid Set! Worth +${nextVal} armies.`;
            }
            this.cardTradeStatus.style.color = '#33ff66';
          } else {
            this.cardTradeStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Invalid Set: select 3 same or 1 of each';
            this.cardTradeStatus.style.color = '#ff3366';
          }
        }
      }
    }

    isValidCardSetSelected() {
      if (this.selectedCardIndices.length !== 3) return false;
      const me = this.gameState.players.find(p => p.id === window.SocketClient.socket.id);
      if (!me) return false;

      const selected = this.selectedCardIndices.map(idx => me.cards[idx]).filter(Boolean);
      if (selected.length !== 3) return false;

      const types = selected.map(c => c.type);
      const wildCount = types.filter(t => t === 'Wild').length;
      const uniqueTypes = new Set(types);

      return wildCount >= 1 || uniqueTypes.size === 1 || uniqueTypes.size === 3;
    }

    renderLogs() {
      this.logMessages.innerHTML = '';
      if (this.gameState.logs) {
        this.gameState.logs.forEach(log => {
          const div = document.createElement('div');
          div.setAttribute('class', 'log-entry');
          div.innerHTML = `<span class="time">${log.timestamp}</span>${log.message}`;
          this.logMessages.appendChild(div);
        });
        this.logMessages.scrollTop = this.logMessages.scrollHeight;
      }
    }

    // Chat management
    sendChatMessage() {
      const text = this.chatInput.value.trim();
      if (text) {
        window.SocketClient.sendMessage(text);
        this.chatInput.value = '';
      }
    }

    appendChatMessage(msg) {
      const div = document.createElement('div');
      div.setAttribute('class', 'chat-msg-row');
      
      const escapeHTML = str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const safeName = escapeHTML(msg.senderName);
      const safeText = escapeHTML(msg.text);

      const theme = document.body.getAttribute('data-map-theme') || 'default';
      const displaySafeText = theme === 'anime' ? this.applyAnimeFilter(safeText) : safeText;

      if (msg.senderName === 'SYSTEM') {
        div.style.fontStyle = 'italic';
        div.style.color = '#e2e8f0';
        div.style.background = 'rgba(255, 255, 255, 0.03)';
        div.style.padding = '4px 8px';
        div.style.borderRadius = '4px';
        div.style.margin = '4px 0';
        div.style.borderLeft = `3px solid ${msg.senderColor || '#ff9900'}`;
        div.innerHTML = `
          <span class="time">${escapeHTML(msg.timestamp)}</span>
          <strong style="color: ${msg.senderColor || '#ffcc00'}">${safeName}:</strong>
          <span>${displaySafeText}</span>
        `;
        
        if (msg.text.includes('disconnected')) {
          showToast(safeText, 'warning');
        } else if (msg.text.includes('reconnected')) {
          showToast(safeText, 'success');
        }
      } else {
        div.innerHTML = `
          <span class="time">${escapeHTML(msg.timestamp)}</span>
          <strong style="color: ${msg.senderColor}">${safeName}:</strong>
          <span>${displaySafeText}</span>
        `;
      }
      
      this.chatMessages.appendChild(div);
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    appendLog(log) {
      const div = document.createElement('div');
      div.setAttribute('class', 'log-entry');
      div.innerHTML = `<span class="time">${log.timestamp}</span>${log.message}`;
      this.logMessages.appendChild(div);
      this.logMessages.scrollTop = this.logMessages.scrollHeight;
    }

    // Treaties & Pact modal
    openDiplomacyModal() {
      this.diplomacyModal.classList.add('active');

      // In Fog of War mode, indicate that Full Alliance gives shared vision
      const optAlliance = this.selectDiplomacyType?.querySelector('option[value="alliance"]');
      if (optAlliance) {
        optAlliance.textContent = (this.gameState && this.gameState.fogOfWar)
          ? 'Full Alliance (Shared Vision, Shared Borders & Fortifications)'
          : 'Full Alliance (Shared Borders & Path Fortifications)';
      }

      // Populate targets dropdown
      this.selectDiplomacyTarget.innerHTML = '';
      this.gameState.players.forEach(p => {
        // filter out self, eliminated, or players we already have pacts with
        const isSelf = p.id === window.SocketClient.socket.id;
        const isPactActive = this.gameState.pacts.some(
          pac => (pac.playerA === window.SocketClient.socket.id && pac.playerB === p.id) ||
                 (pac.playerB === window.SocketClient.socket.id && pac.playerA === p.id)
        );

        if (!isSelf && !p.eliminated && !isPactActive) {
          const option = document.createElement('option');
          option.value = p.id;
          option.textContent = `${p.name} ${p.isAI ? '(AI)' : ''}`;
          this.selectDiplomacyTarget.appendChild(option);
        }
      });

      if (this.selectDiplomacyTarget.children.length === 0) {
        this.selectDiplomacyTarget.innerHTML = '<option value="">-- No available commanders --</option>';
        this.btnSubmitDiplomacy.disabled = true;
      } else {
        this.btnSubmitDiplomacy.disabled = false;
      }

      this.renderIncomingProposals();
    }

    executeBlitzAttack(sourceId, targetId) {
      this.triggerAnimeAttackJumpscare();
      window.SocketClient.blitzAttack(sourceId, targetId, (res) => {
        if (res.error) {
          alert(res.error);
          this.selectedSourceId = null;
          this.selectedTargetId = null;
          this.highlightSourceTarget();
        } else if (res.blitzResult) {
          this.showBlitzSummaryModal(res.blitzResult);
        }
      });
    }

    showBlitzSummaryModal(blitz) {
      const locs = document.getElementById('blitz-summary-locations');
      const banner = document.getElementById('blitz-outcome-banner');
      const rounds = document.getElementById('blitz-stat-rounds');
      const attLosses = document.getElementById('blitz-stat-att-losses');
      const defLosses = document.getElementById('blitz-stat-def-losses');
      const armiesLeft = document.getElementById('blitz-stat-armies-left');

      if (locs) locs.innerHTML = `${blitz.sourceName} <i class="fa-solid fa-crossed-swords"></i> ${blitz.targetName}`;
      if (rounds) rounds.textContent = blitz.roundsFought;
      if (attLosses) attLosses.textContent = `-${blitz.totalAttackerLosses} Armies`;
      if (defLosses) defLosses.textContent = `-${blitz.totalDefenderLosses} Armies`;
      if (armiesLeft) armiesLeft.textContent = blitz.conquered ? `${blitz.sourceArmiesRemaining} Armies remaining` : `${blitz.sourceArmiesRemaining} Armies left (Defended)`;

      if (banner) {
        if (blitz.conquered) {
          banner.style.borderColor = 'var(--primary)';
          banner.style.color = 'var(--primary)';
          banner.style.background = 'rgba(0, 229, 255, 0.1)';
          banner.innerHTML = '<i class="fa-solid fa-trophy"></i> TERRITORY CONQUERED!';
        } else {
          banner.style.borderColor = '#ff3366';
          banner.style.color = '#ff3366';
          banner.style.background = 'rgba(255, 51, 102, 0.1)';
          banner.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ATTACK HALTED (DEFENDED)';
        }
      }

      if (this.blitzSummaryModal) this.blitzSummaryModal.classList.add('active');
    }

    submitPactProposal() {
      const targetId = this.selectDiplomacyTarget.value;
      const type = this.selectDiplomacyType.value;

      if (!targetId) return;

      window.SocketClient.proposePact(targetId, type, (res) => {
        if (res.error) {
          alert(res.error);
        } else if (res.accepted) {
          alert('Treaty accepted by AI Commander!');
          this.diplomacyModal.classList.remove('active');
        } else if (res.accepted === false) {
          alert('Treaty declined by AI Commander.');
        } else {
          alert('Proposal sent! Awaiting commander response.');
          this.diplomacyModal.classList.remove('active');
        }
      });
    }

    renderIncomingProposals() {
      this.incomingProposalsList.innerHTML = '';
      const proposals = this.gameState.diplomacyProposals.filter(
        p => p.receiver === window.SocketClient.socket.id
      );

      if (proposals.length === 0) {
        this.incomingProposalsList.innerHTML = '<p class="empty-state">No pending proposals.</p>';
        return;
      }

      proposals.forEach(prop => {
        const sender = this.gameState.players.find(p => p.id === prop.sender);
        if (!sender) return;

        const item = document.createElement('div');
        item.setAttribute('class', 'inbox-item');
        item.innerHTML = `
          <p>
            <strong>${sender.name}</strong> proposes a 
            <strong>${prop.type === 'non_aggression' ? 'Non-Aggression Pact' : 'Full Alliance'}</strong>.
          </p>
          <div class="inbox-actions">
            <button class="btn success-btn btn-sm btn-accept" data-id="${prop.id}">Accept</button>
            <button class="btn danger-btn btn-sm btn-decline" data-id="${prop.id}">Decline</button>
          </div>
        `;

        item.querySelector('.btn-accept').addEventListener('click', () => {
          window.SocketClient.respondDiplomacy(prop.id, true, (res) => {
            if (res.error) alert(res.error);
            this.renderIncomingProposals();
          });
        });

        item.querySelector('.btn-decline').addEventListener('click', () => {
          window.SocketClient.respondDiplomacy(prop.id, false, (res) => {
            if (res.error) alert(res.error);
            this.renderIncomingProposals();
          });
        });

        this.incomingProposalsList.appendChild(item);
      });
    }

    // Helper utilities
    getTerritoryName(id) {
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      const terr = mapData.territories.find(t => t.id === id);
      return terr ? terr.name : id;
    }

    getPlayerName(id) {
      const p = this.gameState.players.find(pl => pl.id === id);
      return p ? p.name : id;
    }

    getAdjacentTerritories(territoryId) {
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
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

    triggerCombatOverlay(roll) {
      // Clear any pending overlay timers before starting a new animation sequence
      if (this.combatRevealTimeout) clearTimeout(this.combatRevealTimeout);
      if (this.combatCloseTimeout) clearTimeout(this.combatCloseTimeout);

      // Hide map tooltips and reset territory polygon hovers so they don't get stuck under the modal
      if (this.renderer) {
        this.renderer.hideTooltip();
      }
      document.querySelectorAll('.territory-poly').forEach(p => {
        p.style.fillOpacity = '0.55';
        p.classList.remove('highlight-continent');
      });

      const overlay = document.getElementById('combat-overlay');
      const btnClose = document.getElementById('btn-close-combat');
      const outcome = document.getElementById('combat-outcome');
      
      const locs = document.getElementById('combat-locations');
      const attName = document.getElementById('combat-attacker-name');
      const defName = document.getElementById('combat-defender-name');
      
      const attDiceCup = document.getElementById('combat-attacker-dice');
      const defDiceCup = document.getElementById('combat-defender-dice');
      
      const attLossText = document.getElementById('combat-attacker-losses');
      const defLossText = document.getElementById('combat-defender-losses');

      if (!overlay) return;

      const myId = window.SocketClient.socket ? window.SocketClient.socket.id : null;
      const isAttacker = roll.attackerId === myId;
      const isDefender = roll.defenderId === myId;
      const skipOther = localStorage.getItem('skip-other-battles') === 'true';
      const shouldShowOverlay = !skipOther || isAttacker || isDefender;

      if (shouldShowOverlay) {
        // Reset DOM state
        overlay.classList.add('active');
        btnClose.style.display = 'none';
        outcome.textContent = 'Rolling battle dice...';
        
        attLossText.classList.remove('show');
        defLossText.classList.remove('show');
      } else {
        // Ensure overlay is closed if it shouldn't show
        overlay.classList.remove('active');
      }

      // Set text
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      const srcName = this.getTerritoryName(roll.sourceId);
      const tgtName = this.getTerritoryName(roll.targetId);
      if (locs) locs.innerHTML = `${srcName} <i class="fa-solid fa-crossed-swords"></i> ${tgtName}`;

      const mapTerritories = (mapData && mapData.territories) ? mapData.territories : [];
      const sourceTerr = mapTerritories.find(t => t.id === roll.sourceId);
      const targetTerr = mapTerritories.find(t => t.id === roll.targetId);

      const attacker = this.gameState.players.find(p => p.id === roll.attackerId) || { name: 'Attacker', color: '#00e5ff' };
      const defender = this.gameState.players.find(p => p.id === roll.defenderId) || { name: 'Defender', color: '#ff3366' };

      if (attName) {
        attName.textContent = attacker.name;
        attName.style.color = attacker.color;
      }
      if (defName) {
        defName.textContent = defender.name;
        defName.style.color = defender.color;
      }

      // Render rolling placeholder dice
      if (shouldShowOverlay) {
        attDiceCup.innerHTML = '';
        defDiceCup.innerHTML = '';

        // Play dice roll sound
        if (window.MainController) {
          window.MainController.playSFX('imagesandsounds/diceroll.mp3');
        }
      }

      // Draw visual attack arrow pointing from source to target
      if (sourceTerr && targetTerr && sourceTerr.center && targetTerr.center && this.renderer && this.renderer.transformGroup) {
        const [x1, y1] = sourceTerr.center;
        const [x2, y2] = targetTerr.center;
        const group = this.renderer.transformGroup;

        // Ensure defs and marker exist in parent SVG
        let defs = this.renderer.svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
          this.renderer.svg.appendChild(defs);
        }
        if (!defs.querySelector('#attack-arrowhead')) {
          const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
          marker.setAttribute("id", "attack-arrowhead");
          marker.setAttribute("viewBox", "0 0 10 10");
          marker.setAttribute("refX", "6");
          marker.setAttribute("refY", "5");
          marker.setAttribute("markerWidth", "6");
          marker.setAttribute("markerHeight", "6");
          marker.setAttribute("orient", "auto-start-reverse");
          
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
          path.setAttribute("fill", "#ef4444");
          
          marker.appendChild(path);
          defs.appendChild(marker);
        }

        const dx = Math.abs(x2 - x1);
        const isWrapAround = dx > (mapData.width * 0.65);
        const offset = 30; // stop 30px before target center to avoid badge overlapping

        if (isWrapAround) {
          const leftEdgeX = 0;
          const rightEdgeX = mapData.width;

          const dist1 = x1 < x2 ? x1 : (mapData.width - x1);
          const dist2 = x2 < x1 ? x2 : (mapData.width - x2);
          const totalX = dist1 + dist2 || 1;
          const yEdge = y1 + (y2 - y1) * (dist1 / totalX);

          const edgeX1 = x1 < x2 ? leftEdgeX : rightEdgeX;
          const edgeX2 = x2 < x1 ? leftEdgeX : rightEdgeX;

          // Line 1: Source to edge
          const arrow1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          arrow1.setAttribute("class", "attack-arrow-segment");
          arrow1.setAttribute("x1", x1);
          arrow1.setAttribute("y1", y1);
          arrow1.setAttribute("x2", edgeX1);
          arrow1.setAttribute("y2", yEdge);
          arrow1.setAttribute("stroke", "#ef4444");
          arrow1.setAttribute("stroke-width", "6");
          arrow1.setAttribute("stroke-dasharray", "8 4");
          group.appendChild(arrow1);

          // Line 2: Opposite edge to Target
          const arrow2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          arrow2.setAttribute("class", "attack-arrow-segment");
          const segDx = x2 - edgeX2;
          const segDy = y2 - yEdge;
          const segDist = Math.sqrt(segDx*segDx + segDy*segDy) || 1;
          arrow2.setAttribute("x1", edgeX2);
          arrow2.setAttribute("y1", yEdge);
          arrow2.setAttribute("x2", edgeX2 + segDx * (1 - offset / segDist));
          arrow2.setAttribute("y2", yEdge + segDy * (1 - offset / segDist));
          arrow2.setAttribute("stroke", "#ef4444");
          arrow2.setAttribute("stroke-width", "6");
          arrow2.setAttribute("marker-end", "url(#attack-arrowhead)");
          arrow2.setAttribute("stroke-dasharray", "8 4");
          group.appendChild(arrow2);
        } else {
          // Standard direct arrow
          const arrow = document.createElementNS("http://www.w3.org/2000/svg", "line");
          arrow.setAttribute("id", "attack-arrow-line");
          arrow.setAttribute("x1", x1);
          arrow.setAttribute("y1", y1);
          
          const lineDx = x2 - x1;
          const lineDy = y2 - y1;
          const lineDist = Math.sqrt(lineDx*lineDx + lineDy*lineDy) || 1;
          
          arrow.setAttribute("x2", x1 + lineDx * (1 - offset / lineDist));
          arrow.setAttribute("y2", y1 + lineDy * (1 - offset / lineDist));
          arrow.setAttribute("stroke", "#ef4444");
          arrow.setAttribute("stroke-width", "6");
          arrow.setAttribute("marker-end", "url(#attack-arrowhead)");
          arrow.setAttribute("stroke-dasharray", "8 4");
          group.appendChild(arrow);
        }
      }

      // Generates absolute 3D CSS transform cube markup
      const make3dDiceHTML = (isRolling, finalValue = 6) => {
        return `
          <div class="dice-container-3d">
            <div class="cube-3d ${isRolling ? 'rolling' : 'show-' + finalValue}">
              <div class="cube-face-3d face-1"><img src="imagesandsounds/dice-six-faces-one.png"></div>
              <div class="cube-face-3d face-2"><img src="imagesandsounds/dice-six-faces-two.png"></div>
              <div class="cube-face-3d face-3"><img src="imagesandsounds/dice-six-faces-three.png"></div>
              <div class="cube-face-3d face-4"><img src="imagesandsounds/dice-six-faces-four.png"></div>
              <div class="cube-face-3d face-5"><img src="imagesandsounds/dice-six-faces-five.png"></div>
              <div class="cube-face-3d face-6"><img src="imagesandsounds/dice-six-faces-six.png"></div>
            </div>
          </div>
        `;
      };

      // Shaking dice placeholders & reveal timers
      if (shouldShowOverlay) {
        attDiceCup.innerHTML = '';
        defDiceCup.innerHTML = '';

        for (let i = 0; i < roll.attackerRolls.length; i++) {
          attDiceCup.innerHTML += make3dDiceHTML(true);
        }

        const defenderDiceCount = roll.defenderRolls.length;
        for (let i = 0; i < defenderDiceCount; i++) {
          defDiceCup.innerHTML += make3dDiceHTML(true);
        }

        // After 1000ms, reveal results
        this.combatRevealTimeout = setTimeout(() => {
          // Stop shaking & rotate actual 3D face to viewport
          attDiceCup.innerHTML = '';
          roll.attackerRolls.forEach(val => {
            attDiceCup.innerHTML += make3dDiceHTML(false, val);
          });

          defDiceCup.innerHTML = '';
          roll.defenderRolls.forEach(val => {
            defDiceCup.innerHTML += make3dDiceHTML(false, val);
          });

          // Show casualties
          attLossText.textContent = `-${roll.attackerLosses} ${roll.attackerLosses === 1 ? 'Army' : 'Armies'}`;
          defLossText.textContent = `-${roll.defenderLosses} ${roll.defenderLosses === 1 ? 'Army' : 'Armies'}`;
          
          attLossText.classList.add('show');
          defLossText.classList.add('show');

          // Set outcome status
          if (roll.captured) {
            outcome.innerHTML = '<span style="color:#00ffcc">VICTORY! Territory Conquered!</span>';
          } else if (roll.betrayed) {
            outcome.innerHTML = '<span style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> BETRAYAL! Treaty Broken!</span>';
          } else {
            outcome.textContent = 'Casualties Decided!';
          }

          // Helper to trigger realistic combat visuals based on casualties
          const playCombatVisuals = () => {
            if (!this.renderer || !sourceTerr || !targetTerr || !sourceTerr.center || !targetTerr.center) return;

            // 1. If Defender took losses, show floating damage and Attacker fires artillery at Defender!
            if (roll.defenderLosses > 0) {
              this.renderer.showFloatingCasualty(roll.targetId, roll.defenderLosses);
              this.renderer.fireBallisticArtillery(sourceTerr.center, targetTerr.center, {
                shooterColor: attacker.color,
                isConquest: !!roll.captured,
                onImpact: () => {
                  if (roll.captured) {
                    // Send advancing tanks into the captured territory!
                    this.renderer.animateConquestTanks(sourceTerr.center, targetTerr.center, attacker.color);
                  }
                }
              });
            } else if (roll.captured) {
              this.renderer.animateConquestTanks(sourceTerr.center, targetTerr.center, attacker.color);
            }

            // 2. If Attacker took losses, show floating damage and Defender retaliates!
            if (roll.attackerLosses > 0) {
              this.renderer.showFloatingCasualty(roll.sourceId, roll.attackerLosses);
              this.renderer.fireBallisticArtillery(targetTerr.center, sourceTerr.center, {
                shooterColor: defender.color,
                isConquest: false
              });
            }
          };

          playCombatVisuals();

          // Show close button
          btnClose.style.display = 'inline-flex';

          // Auto close after 4 seconds
          this.combatCloseTimeout = setTimeout(() => {
            overlay.classList.remove('active');
          }, 4000);

        }, 1000);
      } else {
        // If overlay was skipped for spectators or fast turns, still play the full combat visuals on the map!
        if (this.renderer && sourceTerr && targetTerr && sourceTerr.center && targetTerr.center) {
          if (roll.defenderLosses > 0) {
            this.renderer.showFloatingCasualty(roll.targetId, roll.defenderLosses);
            this.renderer.fireBallisticArtillery(sourceTerr.center, targetTerr.center, {
              shooterColor: attacker.color,
              isConquest: !!roll.captured,
              onImpact: () => {
                if (roll.captured) {
                  this.renderer.animateConquestTanks(sourceTerr.center, targetTerr.center, attacker.color);
                }
              }
            });
          } else if (roll.captured) {
            this.renderer.animateConquestTanks(sourceTerr.center, targetTerr.center, attacker.color);
          }

          if (roll.attackerLosses > 0) {
            this.renderer.showFloatingCasualty(roll.sourceId, roll.attackerLosses);
            this.renderer.fireBallisticArtillery(targetTerr.center, sourceTerr.center, {
              shooterColor: defender.color,
              isConquest: false
            });
          }
        }
      }
    }

    generateTerritoryMiniSVG(territoryId) {
      if (!territoryId) {
        // Return a star or wildcard SVG icon for Wildcard cards
        return `
          <svg class="card-mini-svg" width="36" height="26" viewBox="0 0 36 26">
            <polygon points="18,3 22,11 31,11 24,16 27,24 18,19 9,24 12,16 5,11 14,11" fill="none" stroke="var(--primary)" stroke-width="1.5" />
          </svg>
        `;
      }

      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      const terr = mapData.territories.find(t => t.id === territoryId);
      if (!terr || !terr.points || terr.points.length === 0) {
        return '';
      }

      // Compute bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      terr.points.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });

      const w = maxX - minX;
      const h = maxY - minY;
      const width = w === 0 ? 1 : w;
      const height = h === 0 ? 1 : h;

      // Fit points into a 36x26 box with 2px padding
      const boxW = 36;
      const boxH = 26;
      const pad = 2;
      const fitW = boxW - 2 * pad;
      const fitH = boxH - 2 * pad;

      // Compute scale keeping aspect ratio
      const scale = Math.min(fitW / width, fitH / height);

      // Center the scaled polygon
      const offsetX = pad + (fitW - width * scale) / 2;
      const offsetY = pad + (fitH - height * scale) / 2;

      // Map points
      const scaledPoints = terr.points.map(([x, y]) => {
        const sx = offsetX + (x - minX) * scale;
        const sy = offsetY + (y - minY) * scale;
        return `${sx.toFixed(1)},${sy.toFixed(1)}`;
      }).join(' ');

      // Find territory color based on continent color
      let strokeColor = 'var(--primary)';
      if (mapData.continents) {
        const cont = mapData.continents.find(c => c.territoryIds.includes(territoryId));
        if (cont) strokeColor = cont.color;
      }

      return `
        <svg class="card-mini-svg" width="${boxW}" height="${boxH}" viewBox="0 0 ${boxW} ${boxH}">
          <polygon points="${scaledPoints}" fill="rgba(255,255,255,0.05)" stroke="${strokeColor}" stroke-width="1.5" />
        </svg>
      `;
    }

    startTimelapse(rawData) {
      this.activeTimelapseRawData = rawData;
      this.converterTimelapseData = rawData;
      const data = this.decodeTimelapseData(rawData);
      this.isTimelapseMode = true;
      this.timelapseHistory = data.history;
      this.timelapseMapData = data.mapData;
      this.timelapseChatArchive = data.chatArchive || []; // Capture global log once
      this.timelapseIndex = 0;
      this.timelapsePlaying = false;
      this.timelapseInterval = null;

      // Show screen and adjust UI visibility
      const controlIds = [
        'btn-end-phase', 'btn-trade-cards', 'btn-quit-game',
        'btn-diplomacy', 'btn-submit-pact', 'chk-auto-attack', 'chk-auto-defend',
        'attack-dice-modal', 'defend-dice-modal', 'post-attack-modal', 'spectator-banner'
      ];
      controlIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // Show timelapse controls panel (relative static positioning to prevent graph overlap)
      const timeControls = document.getElementById('timelapse-controls');
      if (timeControls) {
        timeControls.style.display = 'flex';
        timeControls.style.position = 'relative';
        timeControls.style.bottom = 'auto';
        timeControls.style.left = 'auto';
        timeControls.style.transform = 'none';
        timeControls.style.margin = '20px auto';
      }

      // Reposition zoom controls during timelapse to avoid overlapping the chart
      const zoomControls = document.querySelector('.zoom-controls');
      if (zoomControls) {
        zoomControls.style.bottom = 'auto';
        zoomControls.style.top = '80px';
      }

      // Hide Chat panel to make room
      const chatPanel = document.querySelector('.game-chat-panel');
      if (chatPanel) chatPanel.style.display = 'none';

      // Initialize renderer
      this.renderer = new window.SVGRenderer('game-map-container', {
        isEditor: false,
        onTerritoryClick: () => {} // no actions allowed
      });

      // Set slider max
      const slider = document.getElementById('slider-time-scrub');
      if (slider) {
        slider.max = this.timelapseHistory.length - 1;
        slider.value = 0;
      }

      // Bind local listeners for playback
      this.initTimelapseListeners();

      // Configure scrollable viewport for progress chart
      const viewport = document.querySelector('.game-viewport');
      if (viewport) {
        viewport.style.overflowY = 'auto';
      }
      const mapContainer = document.getElementById('game-map-container');
      if (mapContainer) {
        mapContainer.style.minHeight = '75vh';
        mapContainer.style.height = '75vh';
        mapContainer.style.flex = 'none';
      }

      // Show chart container
      const chartContainer = document.getElementById('timelapse-chart-container');
      if (chartContainer) {
        chartContainer.style.display = 'block';
      }

      // Build and render progress chart
      this.buildProgressChart();
      this.renderProgressChart('territories');

      // Bind metric buttons
      const btnMetricTerr = document.getElementById('btn-chart-metric-territories');
      const btnMetricArmies = document.getElementById('btn-chart-metric-armies');
      if (btnMetricTerr && btnMetricArmies) {
        btnMetricTerr.onclick = () => {
          btnMetricTerr.className = 'btn primary-btn';
          btnMetricArmies.className = 'btn outline-btn';
          this.renderProgressChart('territories');
        };
        btnMetricArmies.onclick = () => {
          btnMetricTerr.className = 'btn outline-btn';
          btnMetricArmies.className = 'btn primary-btn';
          this.renderProgressChart('armies');
        };
      }

      // Render first frame
      this.renderTimelapseFrame(0);
    }

    initTimelapseListeners() {
      const btnPlay = document.getElementById('btn-time-play');
      const btnPrev = document.getElementById('btn-time-prev');
      const btnNext = document.getElementById('btn-time-next');
      const btnExit = document.getElementById('btn-time-exit');
      const slider = document.getElementById('slider-time-scrub');
      const speedSelect = document.getElementById('select-time-speed');

      if (btnPlay) {
        btnPlay.onclick = () => this.toggleTimelapsePlay();
      }
      if (btnPrev) {
        btnPrev.onclick = () => this.stepTimelapse(-1);
      }
      if (btnNext) {
        btnNext.onclick = () => this.stepTimelapse(1);
      }
      if (btnExit) {
        btnExit.onclick = () => {
          this.stopTimelapsePlay();
          window.location.reload();
        };
      }
      if (slider) {
        slider.oninput = (e) => {
          this.stopTimelapsePlay();
          this.renderTimelapseFrame(parseInt(e.target.value));
        };
      }
      if (speedSelect) {
        speedSelect.onchange = () => {
          if (this.timelapsePlaying) {
            this.stopTimelapsePlay();
            this.startTimelapsePlay();
          }
        };
      }
    }

    toggleTimelapsePlay() {
      if (this.timelapsePlaying) {
        this.stopTimelapsePlay();
      } else {
        this.startTimelapsePlay();
      }
    }

    startTimelapsePlay() {
      this.timelapsePlaying = true;
      const btnPlay = document.getElementById('btn-time-play');
      if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';

      const speedSelect = document.getElementById('select-time-speed');
      const speed = parseInt(speedSelect ? speedSelect.value : 1500);

      this.timelapseInterval = setInterval(() => {
        if (this.timelapseIndex >= this.timelapseHistory.length - 1) {
          this.stopTimelapsePlay();
        } else {
          this.stepTimelapse(1);
        }
      }, speed);
    }

    stopTimelapsePlay() {
      this.timelapsePlaying = false;
      const btnPlay = document.getElementById('btn-time-play');
      if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
      if (this.timelapseInterval) {
        clearInterval(this.timelapseInterval);
        this.timelapseInterval = null;
      }
    }

    stepTimelapse(delta) {
      let nextIdx = this.timelapseIndex + delta;
      if (nextIdx < 0) nextIdx = 0;
      if (nextIdx >= this.timelapseHistory.length) nextIdx = this.timelapseHistory.length - 1;
      this.renderTimelapseFrame(nextIdx);
    }

    buildProgressChart() {
      if (!this.timelapseHistory || this.timelapseHistory.length === 0) return;

      const playerMap = {};
      this.timelapseHistory.forEach(frame => {
        if (frame.players) {
          frame.players.forEach(p => {
            if (!playerMap[p.id]) {
              playerMap[p.id] = { name: p.name, color: p.color };
            }
          });
        }
      });

      const playerIds = Object.keys(playerMap);
      const labels = this.timelapseHistory.map((_, idx) => `Turn ${idx + 1}`);

      const datasetTerritories = {};
      const datasetArmies = {};

      playerIds.forEach(pid => {
        datasetTerritories[pid] = [];
        datasetArmies[pid] = [];
      });

      this.timelapseHistory.forEach(frame => {
        const terrCounts = {};
        const armyCounts = {};
        playerIds.forEach(pid => {
          terrCounts[pid] = 0;
          armyCounts[pid] = 0;
        });

        if (frame.territories) {
          Object.keys(frame.territories).forEach(tid => {
            const t = frame.territories[tid];
            if (t && t.ownerId && terrCounts[t.ownerId] !== undefined) {
              terrCounts[t.ownerId]++;
              armyCounts[t.ownerId] += (t.armies || 0);
            }
          });
        }

        playerIds.forEach(pid => {
          datasetTerritories[pid].push(terrCounts[pid]);
          datasetArmies[pid].push(armyCounts[pid]);
        });
      });

      this.chartData = {
        labels,
        playerIds,
        playerMap,
        territories: datasetTerritories,
        armies: datasetArmies
      };
    }

    renderProgressChart(metric = 'territories') {
      const canvas = document.getElementById('timelapse-progress-chart');
      if (!canvas || !this.chartData) return;

      if (this.progressChartInstance) {
        this.progressChartInstance.destroy();
      }

      const datasets = this.chartData.playerIds.map(pid => {
        const p = this.chartData.playerMap[pid];
        const data = metric === 'territories' ? this.chartData.territories[pid] : this.chartData.armies[pid];
        return {
          label: p.name,
          data: data,
          borderColor: p.color,
          backgroundColor: p.color + '15',
          borderWidth: 2.5,
          pointRadius: 2,
          tension: 0.2
        };
      });

      this.progressChartInstance = new window.Chart(canvas, {
        type: 'line',
        data: {
          labels: this.chartData.labels,
          datasets: datasets
        },
        plugins: [{
          id: 'verticalLine',
          afterDraw: (chart) => {
            const activeIndex = this.timelapseIndex;
            if (activeIndex === undefined || activeIndex === null) return;
            
            const ctx = chart.ctx;
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            
            if (!xAxis || !yAxis) return;
            
            const xPos = xAxis.getPixelForValue(activeIndex);
            if (xPos === undefined || xPos < xAxis.left || xPos > xAxis.right) return;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, yAxis.top);
            ctx.lineTo(xPos, yAxis.bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#00e5ff';
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
          }
        }],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#fff',
                boxWidth: 12,
                font: {
                  family: 'Inter, system-ui, sans-serif',
                  size: 11
                }
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              titleColor: '#00e5ff',
              bodyFont: {
                family: 'Inter, system-ui, sans-serif'
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.06)'
              },
              ticks: {
                color: '#8e9aa8',
                maxRotation: 45,
                font: { size: 9 }
              }
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.06)'
              },
              ticks: {
                color: '#8e9aa8',
                font: { size: 10 }
              },
              suggestedMin: 0
            }
          }
        }
      });
    }

    renderTimelapseFrame(index) {
      this.timelapseIndex = index;
      if (this.progressChartInstance) {
        this.progressChartInstance.update('none');
      }
      const frame = this.timelapseHistory[index];
      if (!frame) return;

      const slider = document.getElementById('slider-time-scrub');
      if (slider) slider.value = index;

      const status = document.getElementById('lbl-time-status');
      if (status) {
        status.textContent = `Turn ${frame.turnNumber} [${index + 1}/${this.timelapseHistory.length}]`;
      }

      // Reconstruct mock game state
      const mockState = {
        turnIndex: frame.turnIndex,
        turnStage: 'TIMELAPSE',
        players: frame.players,
        territories: frame.territories,
        radiation: frame.radiation || {}, // Feed radioactive maps to renderer
        logs: [],
        pacts: []
      };

      this.gameState = mockState;
      this.renderer.render(this.timelapseMapData, mockState);

      const activePlayer = frame.players[frame.turnIndex];
      this.lblTurnName.textContent = activePlayer ? activePlayer.name : 'Unknown';
      this.lblTurnName.style.color = activePlayer ? activePlayer.color : '#fff';
      this.lblPhaseName.textContent = `TURN ${frame.turnNumber} REPLAY`;

      this.lblInstructions.innerHTML = activePlayer 
        ? `Replaying turn of <strong style="color: ${activePlayer.color}">${activePlayer.name}</strong>`
        : 'Replaying game history...';

      // Update Chat pane during replay!
      this.chatMessages.innerHTML = '';
      const visibleChats = this.timelapseChatArchive ? this.timelapseChatArchive.slice(0, frame.chatCount || 0) : [];
      if (visibleChats.length > 0) {
        visibleChats.forEach(msg => {
          const div = document.createElement('div');
          div.setAttribute('class', 'chat-msg-row');
          div.innerHTML = `
            <span class="time">${msg.timestamp}</span>
            <strong style="color: ${msg.senderColor}">${msg.senderName}:</strong>
            <span>${msg.text}</span>
          `;
          this.chatMessages.appendChild(div);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }

      this.renderPlayersList();
      this.renderContinentsLegend();
    }

    encodeTimelapseData(history, mapData, chatArchive, gameMode, winner) {
      if (!history || history.length === 0) return null;

      const playerMap = new Map();
      const playersHeader = [];

      history.forEach(frame => {
        if (frame.players) {
          frame.players.forEach(p => {
            if (p && p.id && !playerMap.has(p.id)) {
              const idx = playersHeader.length;
              playerMap.set(p.id, idx);
              playersHeader.push({
                id: p.id,
                name: p.name || 'Player',
                color: p.color || '#cccccc',
                nationId: p.nationId || p.selectedNationId || null,
                nationName: p.nationName || null
              });
            }
          });
        }
      });

      const deltaHistory = [];
      let prevTerritories = {};

      history.forEach((frame, idx) => {
        const isKeyframe = (idx === 0);
        const currTerritories = {};
        const terrDiff = {};

        if (frame.territories) {
          Object.keys(frame.territories).forEach(tid => {
            const t = frame.territories[tid];
            const ownerIdx = t && t.ownerId && playerMap.has(t.ownerId) ? playerMap.get(t.ownerId) : -1;
            const isCap = t && t.isCapital ? 1 : 0;
            const armies = t ? (t.armies || 0) : 0;
            const isNuked = t && t.nuked ? 1 : 0; // Capture nuked flag
            const currTuple = [ownerIdx, armies, isCap, isNuked];
            currTerritories[tid] = currTuple;

            if (isKeyframe) {
              terrDiff[tid] = currTuple;
            } else {
              const prevTuple = prevTerritories[tid];
              if (!prevTuple || prevTuple[0] !== ownerIdx || prevTuple[1] !== armies || prevTuple[2] !== isCap || prevTuple[3] !== isNuked) {
                terrDiff[tid] = currTuple;
              }
            }
          });
        }
        prevTerritories = currTerritories;

        const playersStats = (frame.players || []).map(p => {
          const pIdx = playerMap.has(p.id) ? playerMap.get(p.id) : -1;
          const st = p.stats || {};
          return [
            pIdx,
            p.eliminated ? 1 : 0,
            st.drafted || 0,
            st.killed || 0,
            st.lost || 0,
            st.territoriesConquered || 0,
            p.nukes || 0, // Compress player nukes
            p.thermonukes || 0 // Compress player thermo counts
          ];
        });

        deltaHistory.push({
          turnNumber: frame.turnNumber,
          turnIndex: frame.turnIndex,
          activePlayerIdx: playerMap.has(frame.activePlayerId) ? playerMap.get(frame.activePlayerId) : frame.turnIndex,
          t: terrDiff,
          p: playersStats,
          ra: frame.radiation || {}, // Compress active radiation levels
          chatCount: frame.chatCount || 0,
          timestamp: frame.timestamp
        });
      });

      const nationsList = mapData.nations || (this.gameState ? this.gameState.nations : null) || [];
      const cleanMapData = {
        ...mapData,
        isScenario: !!mapData.isScenario,
        scenarioSettings: mapData.scenarioSettings || { capitalRush: false, defaultDummyArmies: 1 },
        nations: nationsList
      };

      return {
        version: 2,
        isDelta: true,
        mapData: cleanMapData,
        players: playersHeader,
        history: deltaHistory,
        chatArchive: chatArchive || [],
        gameMode: gameMode,
        winner: winner
      };
    }

    decodeTimelapseData(rawData) {
      if (!rawData) return rawData;
      if (!rawData.version || !rawData.isDelta) {
        return rawData;
      }

      const playersHeader = rawData.players || [];
      const fullHistory = [];
      const currentTerritories = {};

      (rawData.history || []).forEach(frame => {
        if (frame.t) {
          Object.keys(frame.t).forEach(tid => {
            const tuple = frame.t[tid];
            const ownerPlayer = tuple[0] >= 0 ? playersHeader[tuple[0]] : null;
            currentTerritories[tid] = {
              ownerId: ownerPlayer ? ownerPlayer.id : null,
              armies: tuple[1],
              isCapital: !!tuple[2],
              nuked: !!tuple[3] // Decode ash ruins marker
            };
          });
        }

        const territoriesSnapshot = {};
        Object.keys(currentTerritories).forEach(tid => {
          territoriesSnapshot[tid] = { ...currentTerritories[tid] };
        });

        const playersSnapshot = (frame.p || []).map(pTuple => {
          const pHeader = (pTuple[0] >= 0 ? playersHeader[pTuple[0]] : null) || {};
          return {
            id: pHeader.id || `p_${pTuple[0]}`,
            name: pHeader.name || 'Player',
            color: pHeader.color || '#ffffff',
            nationId: pHeader.nationId || null,
            nationName: pHeader.nationName || null,
            eliminated: !!pTuple[1],
            nukes: pTuple[6] || 0, // Decode player nukes
            thermonukes: pTuple[7] || 0, // Decode player thermo counts
            stats: {
              drafted: pTuple[2] || 0,
              killed: pTuple[3] || 0,
              lost: pTuple[4] || 0,
              territoriesConquered: pTuple[5] || 0
            }
          };
        });

        const activePlayer = playersHeader[frame.activePlayerIdx] || playersSnapshot[frame.turnIndex];

        fullHistory.push({
          turnNumber: frame.turnNumber,
          turnIndex: frame.turnIndex,
          activePlayerId: activePlayer ? activePlayer.id : null,
          territories: territoriesSnapshot,
          players: playersSnapshot,
          radiation: frame.ra || {}, // Decode active radiation map
          chatCount: frame.chatCount || 0,
          timestamp: frame.timestamp
        });
      });

      return {
        mapData: rawData.mapData,
        history: fullHistory,
        chatArchive: rawData.chatArchive || [],
        gameMode: rawData.gameMode,
        winner: rawData.winner
      };
    }

    initTimelapseConverterUI() {
      const btnToolbarSummary = document.getElementById('btn-timelapse-convert');
      const btnCloseHeader = document.getElementById('btn-close-timelapse-converter');
      const btnCloseFooter = document.getElementById('btn-close-timelapse-converter-footer');
      const selectMode = document.getElementById('select-timelapse-converter-mode');
      const chkChat = document.getElementById('chk-timelapse-converter-chat');
      const fileInput = document.getElementById('input-timelapse-converter-file');
      const btnCopy = document.getElementById('btn-copy-timelapse-converter');
      const btnDownload = document.getElementById('btn-download-timelapse-converter');

      if (btnToolbarSummary) {
        btnToolbarSummary.onclick = () => {
          this.openTimelapseConverterModal();
        };
      }

      const closeModal = () => {
        const modal = document.getElementById('timelapse-converter-modal');
        if (modal) modal.classList.remove('active');
      };

      if (btnCloseHeader) btnCloseHeader.onclick = closeModal;
      if (btnCloseFooter) btnCloseFooter.onclick = closeModal;

      if (selectMode) {
        selectMode.onchange = () => this.updateTimelapseConverterOutput();
      }
      if (chkChat) {
        chkChat.onchange = () => this.updateTimelapseConverterOutput();
      }

      if (fileInput) {
        fileInput.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (evt) => {
            try {
              let jsonText;
              const arrayBuffer = evt.target.result;
              const bytes = new Uint8Array(arrayBuffer);
              if (bytes.length > 2 && bytes[0] === 0x1F && bytes[1] === 0x8B) {
                if (typeof DecompressionStream !== 'undefined') {
                  const blob = new Blob([arrayBuffer]);
                  const ds = new DecompressionStream('gzip');
                  const decompressedStream = blob.stream().pipeThrough(ds);
                  jsonText = await new Response(decompressedStream).text();
                } else {
                  alert('Your browser does not support native gzip decompression.');
                  return;
                }
              } else {
                jsonText = new TextDecoder('utf-8').decode(arrayBuffer);
              }

              const data = JSON.parse(jsonText);
              if (data && (data.history || data.mapData)) {
                this.converterTimelapseData = data;
                const srcLabel = document.getElementById('lbl-timelapse-converter-source');
                if (srcLabel) srcLabel.textContent = `Source: ${file.name}`;
                this.updateTimelapseConverterOutput();
                showToast(`Loaded timelapse summary from ${file.name}`, 'success');
              } else {
                alert('Invalid timelapse file structure.');
              }
            } catch (err) {
              console.error(err);
              alert('Could not parse timelapse file. Make sure it is a valid JSON.');
            }
          };
          reader.readAsArrayBuffer(file);
        };
      }

      if (btnCopy) {
        btnCopy.onclick = () => {
          const txtArea = document.getElementById('txt-timelapse-converter-output');
          if (txtArea && txtArea.value) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txtArea.value).then(() => {
                showToast('<i class="fa-solid fa-clipboard-list"></i> Summary copied to clipboard!', 'success');
              }).catch(() => {
                txtArea.select();
                document.execCommand('copy');
                showToast('<i class="fa-solid fa-clipboard-list"></i> Summary copied to clipboard!', 'success');
              });
            } else {
              txtArea.select();
              document.execCommand('copy');
              showToast('<i class="fa-solid fa-clipboard-list"></i> Summary copied to clipboard!', 'success');
            }
          }
        };
      }

      if (btnDownload) {
        btnDownload.onclick = () => {
          const txtArea = document.getElementById('txt-timelapse-converter-output');
          if (txtArea && txtArea.value) {
            const blob = new Blob([txtArea.value], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timelapse_summary_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('<i class="fa-solid fa-floppy-disk"></i> Summary text file downloaded!', 'success');
          }
        };
      }
    }

    openTimelapseConverterModal(data = null) {
      if (data) {
        this.converterTimelapseData = data;
      } else if (this.activeTimelapseRawData) {
        this.converterTimelapseData = this.activeTimelapseRawData;
      }
      const modal = document.getElementById('timelapse-converter-modal');
      if (modal) {
        modal.classList.add('active');
      }
      const srcLabel = document.getElementById('lbl-timelapse-converter-source');
      if (srcLabel && !data && this.activeTimelapseRawData) {
        srcLabel.textContent = 'Source: Active Game Replay';
      }
      this.updateTimelapseConverterOutput();
    }

    updateTimelapseConverterOutput() {
      const txtArea = document.getElementById('txt-timelapse-converter-output');
      const selectMode = document.getElementById('select-timelapse-converter-mode');
      const chkChat = document.getElementById('chk-timelapse-converter-chat');
      if (!txtArea) return;

      const mode = selectMode ? selectMode.value : 'conquests';
      const includeChat = chkChat ? chkChat.checked : false;

      if (!this.converterTimelapseData) {
        txtArea.value = "No timelapse file loaded. Click 'Load Different File' above to upload a .json or .json.gz file.";
        return;
      }

      const text = this.generateTextSummary(this.converterTimelapseData, mode, includeChat);
      txtArea.value = text;
    }

    generateTextSummary(rawData, mode = 'conquests', includeChat = false) {
      if (!rawData) return "No timelapse data provided.";
      const decoded = this.decodeTimelapseData(rawData);
      if (!decoded || !decoded.history || decoded.history.length === 0) {
        return "Invalid or empty timelapse history data.";
      }

      const history = decoded.history;
      const mapData = decoded.mapData || {};
      const gameMode = decoded.gameMode === 'capital_rush' ? 'Capital Rush' : 'Conquest';
      let winnerName = 'N/A';
      if (decoded.winner) {
        if (typeof decoded.winner === 'string') winnerName = decoded.winner;
        else if (decoded.winner.name) winnerName = decoded.winner.name;
        else if (decoded.winner.id) winnerName = decoded.winner.id;
      }

      const mapName = mapData.mapName || 'Custom Battleground';
      const totalTurns = history.length;

      // Lookup maps
      const terrNames = {};
      if (mapData.territories) {
        mapData.territories.forEach(t => {
          terrNames[t.id] = t.name || t.id;
        });
      }

      const players = history[0] ? history[0].players : [];
      const playerNames = {};
      const playerColors = {};
      const playerNations = {};
      (players || []).forEach(p => {
        playerNames[p.id] = p.name || 'Player';
        playerColors[p.id] = p.color || '#ffffff';
        if (p.nationName) playerNations[p.id] = p.nationName;
      });

      const turnChanges = [];
      const terrTimeline = {};
      let totalConquests = 0;

      Object.keys(terrNames).forEach(tid => {
        terrTimeline[tid] = [];
      });

      history.forEach((frame, idx) => {
        const turnNum = frame.turnNumber || (idx + 1);
        const activePlayerId = frame.activePlayerId;
        const activePlayerName = activePlayerId && playerNames[activePlayerId] ? playerNames[activePlayerId] : `Turn ${turnNum}`;
        const frameConquests = [];

        if (frame.territories) {
          Object.keys(frame.territories).forEach(tid => {
            const curr = frame.territories[tid];
            const currOwnerName = curr.ownerId && playerNames[curr.ownerId] ? playerNames[curr.ownerId] : (curr.ownerId ? curr.ownerId : 'Neutral');

            // Detect conquer event for turnConquests
            if (idx > 0) {
              const prevFrame = history[idx - 1];
              const prev = prevFrame && prevFrame.territories ? prevFrame.territories[tid] : null;
              if (prev && curr && curr.ownerId !== prev.ownerId) {
                totalConquests++;
                const prevOwnerName = prev.ownerId && playerNames[prev.ownerId] ? playerNames[prev.ownerId] : (prev.ownerId ? prev.ownerId : 'Neutral');
                frameConquests.push({
                  territory: terrNames[tid] || tid,
                  newOwner: currOwnerName,
                  oldOwner: prevOwnerName,
                  armies: curr.armies
                });
              }
            }

            // Build detailed territory ownership & army count timeline segment
            if (!terrTimeline[tid]) terrTimeline[tid] = [];
            const list = terrTimeline[tid];
            if (list.length === 0) {
              list.push({
                startTurn: turnNum,
                endTurn: turnNum,
                ownerId: curr.ownerId,
                ownerName: currOwnerName,
                startArmies: curr.armies,
                endArmies: curr.armies
              });
            } else {
              const lastSeg = list[list.length - 1];
              if (lastSeg.ownerId === curr.ownerId) {
                lastSeg.endTurn = turnNum;
                lastSeg.endArmies = curr.armies;
              } else {
                list.push({
                  startTurn: turnNum,
                  endTurn: turnNum,
                  ownerId: curr.ownerId,
                  ownerName: currOwnerName,
                  startArmies: curr.armies,
                  endArmies: curr.armies
                });
              }
            }
          });
        }

        if (frameConquests.length > 0) {
          turnChanges.push({
            turn: turnNum,
            player: activePlayerName,
            conquests: frameConquests
          });
        }
      });

      const finalFrame = history[history.length - 1];
      const finalTerrCounts = {};
      const peakTerrCounts = {};

      (players || []).forEach(p => {
        finalTerrCounts[p.id] = 0;
        peakTerrCounts[p.id] = 0;
      });

      history.forEach(frame => {
        const counts = {};
        (players || []).forEach(p => counts[p.id] = 0);
        if (frame.territories) {
          Object.keys(frame.territories).forEach(tid => {
            const ownerId = frame.territories[tid].ownerId;
            if (ownerId && counts[ownerId] !== undefined) counts[ownerId]++;
          });
        }
        (players || []).forEach(p => {
          if (counts[p.id] > peakTerrCounts[p.id]) peakTerrCounts[p.id] = counts[p.id];
        });
      });

      if (finalFrame && finalFrame.territories) {
        Object.keys(finalFrame.territories).forEach(tid => {
          const ownerId = finalFrame.territories[tid].ownerId;
          if (ownerId && finalTerrCounts[ownerId] !== undefined) finalTerrCounts[ownerId]++;
        });
      }

      let lines = [];
      lines.push("================================================================================");
      lines.push("                  FACTIONAL RISK - CAMPAIGN TIMELAPSE SUMMARY                   ");
      lines.push("================================================================================");
      lines.push(`Map Name:        ${mapName}`);
      lines.push(`Game Mode:       ${gameMode}`);
      lines.push(`Victor/Winner:   ${winnerName}`);
      lines.push(`Duration:        ${totalTurns} Turn(s)`);
      lines.push(`Total Conquests: ${totalConquests} Territory Flips`);
      lines.push("--------------------------------------------------------------------------------");
      lines.push("COMMANDERS:");
      (players || []).forEach(p => {
        const nationStr = playerNations[p.id] ? ` [Nation: ${playerNations[p.id]}]` : '';
        lines.push(`  • ${p.name} (${p.color})${nationStr}`);
      });

      if (mode === 'conquests') {
        lines.push("--------------------------------------------------------------------------------");
        lines.push("TURN-BY-TURN TERRITORY CONQUESTS & FLIPS:");
        lines.push("--------------------------------------------------------------------------------");
        if (turnChanges.length === 0) {
          lines.push("  (No territory ownership changes recorded during this campaign)");
        } else {
          turnChanges.forEach(tc => {
            lines.push(`[Turn ${tc.turn} - ${tc.player}]`);
            tc.conquests.forEach(c => {
              lines.push(`  ⚔️ ${c.newOwner} conquered "${c.territory}" from ${c.oldOwner} (${c.armies} armies)`);
            });
          });
        }
      } else if (mode === 'timeline') {
        lines.push("--------------------------------------------------------------------------------");
        lines.push("COMPLETE TERRITORY CONTROL TIMELINE (OWNERS & ARMY COUNTS):");
        lines.push("--------------------------------------------------------------------------------");
        Object.keys(terrNames).forEach(tid => {
          const tName = terrNames[tid] || tid;
          const timeline = terrTimeline[tid];
          lines.push(`• ${tName}:`);
          if (!timeline || timeline.length === 0) {
            lines.push(`   └─ Unclaimed / Neutral`);
          } else {
            timeline.forEach((seg, i) => {
              const isLast = (i === timeline.length - 1);
              const prefix = isLast ? "   └─" : "   ├─";
              const turnSpan = (seg.startTurn === seg.endTurn)
                ? (isLast && seg.endTurn === totalTurns ? `Turn ${seg.startTurn} -> End` : `Turn ${seg.startTurn}`)
                : (isLast && seg.endTurn === totalTurns ? `Turn ${seg.startTurn} -> End` : `Turn ${seg.startTurn} to Turn ${seg.endTurn}`);
              
              const armyStr = (seg.startArmies === seg.endArmies)
                ? `${seg.startArmies} armies`
                : `${seg.startArmies} initial → ${seg.endArmies} final armies`;

              lines.push(`${prefix} ${turnSpan}: ${seg.ownerName} (${armyStr})`);
            });
          }
        });
      } else if (mode === 'overview') {
        lines.push("--------------------------------------------------------------------------------");
        lines.push("EXECUTIVE CAMPAIGN OVERVIEW & STATS:");
        lines.push("--------------------------------------------------------------------------------");
        (players || []).forEach(p => {
          const finalCount = finalTerrCounts[p.id] || 0;
          const peakCount = peakTerrCounts[p.id] || 0;
          const isWinner = p.name === winnerName || p.id === winnerName;
          lines.push(`• Commander: ${p.name}`);
          lines.push(`   - Final Territories Controlled: ${finalCount}`);
          lines.push(`   - Peak Territory Control: ${peakCount}`);
          lines.push(`   - Status: ${isWinner ? '🏆 CAMPAIGN VICTOR' : (finalCount === 0 ? '💀 Defeated / Eliminated' : 'Active')}`);
        });
      }

      lines.push("--------------------------------------------------------------------------------");
      lines.push("FINAL TERRITORY STANDINGS:");
      const sortedPlayers = [...(players || [])].sort((a, b) => (finalTerrCounts[b.id] || 0) - (finalTerrCounts[a.id] || 0));
      sortedPlayers.forEach((p, rank) => {
        const count = finalTerrCounts[p.id] || 0;
        const crown = rank === 0 && count > 0 ? " 🏆" : "";
        lines.push(`  ${rank + 1}. ${p.name}: ${count} territory/territories${crown}`);
      });

      if (includeChat && decoded.chatArchive && decoded.chatArchive.length > 0) {
        lines.push("--------------------------------------------------------------------------------");
        lines.push("CAMPAIGN CHAT LOG:");
        lines.push("--------------------------------------------------------------------------------");
        decoded.chatArchive.forEach(chat => {
          lines.push(`  [${chat.timestamp || 'Chat'}] ${chat.senderName || 'Commander'}: ${chat.text}`);
        });
      }

      lines.push("================================================================================");
      return lines.join("\n");
    }

    // ==================== GENERATIVE AI PROMPT & ACTION PARSER ====================
    initLLMControlsUI() {
      const selectGameLlmDelay = document.getElementById('select-game-llm-delay');
      if (selectGameLlmDelay) {
        selectGameLlmDelay.addEventListener('change', (e) => {
          if (window.SocketClient && window.SocketClient.roomCode) {
            window.SocketClient.changeLLMDelay(e.target.value, () => {});
          }
        });
      }

      if (this.btnExportLLMPrompt) {
        this.btnExportLLMPrompt.addEventListener('click', () => {
          const prompt = this.generateLLMPrompt();
          navigator.clipboard.writeText(prompt).then(() => {
            window.showToast('<i class="fa-solid fa-clipboard-list"></i> Generative AI Prompt exported to clipboard!', 'success');
          }).catch(() => {
            this.openLLMImportModal();
          });
        });
      }

      if (this.btnCopyLLMPromptModal) {
        this.btnCopyLLMPromptModal.addEventListener('click', () => {
          const prompt = this.generateLLMPrompt();
          navigator.clipboard.writeText(prompt).then(() => {
            window.showToast('<i class="fa-solid fa-clipboard-list"></i> Generative AI Prompt re-copied to clipboard!', 'success');
          });
        });
      }

      if (this.btnImportLLMResponse) {
        this.btnImportLLMResponse.addEventListener('click', () => {
          this.openLLMImportModal();
        });
      }

      if (this.btnCloseLLMImportHeader) {
        this.btnCloseLLMImportHeader.addEventListener('click', () => this.closeLLMImportModal());
      }
      if (this.btnCloseLLMImportFooter) {
        this.btnCloseLLMImportFooter.addEventListener('click', () => this.closeLLMImportModal());
      }

      if (this.btnExecuteLLMAction) {
        this.btnExecuteLLMAction.addEventListener('click', () => {
          const text = this.txtLLMImportJson ? this.txtLLMImportJson.value : '';
          this.executePastedLLMAction(text);
        });
      }

      const btnForceSkip = document.getElementById('btn-force-skip-turn');
      if (btnForceSkip) {
        btnForceSkip.addEventListener('click', () => {
          window.SocketClient.forceSkipTurn((res) => {
            if (res && res.error) alert(res.error);
          });
        });
      }

      const btnTogglePause = document.getElementById('btn-toggle-pause');
      if (btnTogglePause) {
        btnTogglePause.addEventListener('click', () => {
          window.SocketClient.togglePauseGame((res) => {
            if (res && res.success) {
              btnTogglePause.innerHTML = res.isPaused ? '<i class="fa-solid fa-play"></i> Resume Match' : '<i class="fa-solid fa-pause"></i> Pause Match';
              btnTogglePause.style.borderColor = res.isPaused ? '#33ff66' : '#38bdf8';
              btnTogglePause.style.color = res.isPaused ? '#33ff66' : '#38bdf8';
            } else if (res && res.error) {
              alert(res.error);
            }
          });
        });
      }

      // AI Advisor Co-Pilot Modal Handlers
      const btnAskAdvisor = document.getElementById('btn-ask-ai-advisor');
      const modalAdvisor = document.getElementById('modal-ai-advisor');
      const spinnerAdvisor = document.getElementById('advisor-status-spinner');
      const containerAdvisor = document.getElementById('advisor-content-container');
      const btnCloseAdvisorHeader = document.getElementById('btn-close-advisor-header');
      const btnCloseAdvisorFooter = document.getElementById('btn-close-advisor-footer');

      const closeAdvisorModal = () => {
        if (modalAdvisor) modalAdvisor.style.display = 'none';
      };

      if (btnCloseAdvisorHeader) btnCloseAdvisorHeader.addEventListener('click', closeAdvisorModal);
      if (btnCloseAdvisorFooter) btnCloseAdvisorFooter.addEventListener('click', closeAdvisorModal);

      if (btnAskAdvisor) {
        btnAskAdvisor.addEventListener('click', () => {
          if (modalAdvisor) modalAdvisor.style.display = 'flex';
          if (spinnerAdvisor) spinnerAdvisor.style.display = 'block';
          if (containerAdvisor) containerAdvisor.style.display = 'none';

          window.SocketClient.askAIAdvisor((res) => {
            if (res && res.advice) {
              if (spinnerAdvisor) spinnerAdvisor.style.display = 'none';
              if (containerAdvisor) containerAdvisor.style.display = 'block';

              const adv = res.advice;
              const lblOverview = document.getElementById('lbl-advisor-overview');
              const lblAdvice = document.getElementById('lbl-advisor-advice');
              const lblDraft = document.getElementById('lbl-advisor-draft');
              const lblAttacks = document.getElementById('lbl-advisor-attacks');

              if (lblOverview) lblOverview.textContent = adv.reasoning || adv.overview || 'Position analyzed.';
              if (lblAdvice) lblAdvice.textContent = adv.advice || adv.actionPlan || 'Focus on consolidating forces.';
              if (lblDraft) lblDraft.textContent = adv.recommendedDraft || adv.draft || 'Reinforce front-line garrisons.';
              if (lblAttacks) lblAttacks.textContent = adv.recommendedAttacks || adv.attacks || 'Target enemy territories with lower troop counts.';
            } else if (res && res.error) {
              if (spinnerAdvisor) spinnerAdvisor.style.display = 'none';
              alert(res.error);
              closeAdvisorModal();
            }
          });
        });
      }

      const btnSaveGame = document.getElementById('btn-save-game');
      if (btnSaveGame) {
        btnSaveGame.addEventListener('click', () => this.exportCampaignSave());
      }
      const btnSaveBar = document.getElementById('btn-save-campaign-bar');
      if (btnSaveBar) {
        btnSaveBar.addEventListener('click', () => this.exportCampaignSave());
      }
    }

    openLLMImportModal() {
      if (this.llmImportModal) {
        this.llmImportModal.style.display = 'flex';
      }
      if (this.lblLLMImportStatus) {
        this.lblLLMImportStatus.style.display = 'none';
      }
    }

    closeLLMImportModal() {
      if (this.llmImportModal) {
        this.llmImportModal.style.display = 'none';
      }
    }

    executePastedLLMAction(jsonText) {
      if (!jsonText || !jsonText.trim()) {
        if (this.lblLLMImportStatus) {
          this.lblLLMImportStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Please paste a JSON response first.';
          this.lblLLMImportStatus.style.color = '#ff3366';
          this.lblLLMImportStatus.style.display = 'block';
        }
        return;
      }

      let data;
      try {
        let cleaned = jsonText.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
        cleaned = cleaned.trim();

        data = JSON.parse(cleaned);
      } catch (err) {
        if (this.lblLLMImportStatus) {
          this.lblLLMImportStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Invalid JSON syntax. Check quotes and commas.';
          this.lblLLMImportStatus.style.color = '#ff3366';
          this.lblLLMImportStatus.style.display = 'block';
        }
        return;
      }

      window.SocketClient.executeLLMAction(data, (res) => {
        if (res && res.error) {
          if (this.lblLLMImportStatus) {
            this.lblLLMImportStatus.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Execution Error: ${res.error}`;
            this.lblLLMImportStatus.style.color = '#ff3366';
            this.lblLLMImportStatus.style.display = 'block';
          }
        } else {
          if (this.lblLLMImportStatus) {
            this.lblLLMImportStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> LLM action executed successfully!';
            this.lblLLMImportStatus.style.color = '#33ff66';
            this.lblLLMImportStatus.style.display = 'block';
          }
          setTimeout(() => {
            this.closeLLMImportModal();
            if (this.txtLLMImportJson) this.txtLLMImportJson.value = '';
          }, 150);
        }
      });
    }

    exportCampaignSave() {
      if (!this.gameState) {
        alert('No active match to save.');
        return;
      }

      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      if (!mapData) {
        alert('No map data available.');
        return;
      }

      const cleanState = JSON.parse(JSON.stringify(this.gameState));
      cleanState.mapData = mapData;

      const saveData = {
        saveVersion: 1,
        timestamp: Date.now(),
        roomCode: window.SocketClient.roomCode || 'SAVE',
        cardTradeRule: this.gameState.cardTradeRule || 'progressive',
        generativeAIMode: !!this.gameState.generativeAIMode,
        spectatorMode: !!window.SocketClient.spectatorMode,
        fogOfWar: !!this.gameState.fogOfWar,
        allowCrafting: this.gameState.allowCrafting !== undefined ? this.gameState.allowCrafting : false,
        blizzardCount: this.gameState.blizzards ? this.gameState.blizzards.length : 0,
        startingNukes: this.gameState.startingNukes || 0,
        startingThermonukes: this.gameState.startingThermonukes || 0,
        mapData: mapData,
        gameState: cleanState
      };

      const jsonStr = JSON.stringify(saveData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const turn = this.gameState.turnIndex !== undefined ? (this.gameState.turnIndex + 1) : 1;
      a.download = `campaign_save_turn_${turn}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.showToast('<i class="fa-solid fa-floppy-disk"></i> Campaign state exported successfully! Keep this .json file to resume later from the Main Menu.', 'success');
    }

    generateLLMPrompt(targetPlayerId = null) {
      if (!this.gameState) return 'Error: No active game state.';
      const mapData = window.SocketClient.mapData || this.gameState.mapData;
      if (!mapData) return 'Error: No map data available.';

      const activePlayer = this.gameState.players[this.gameState.turnIndex] || this.gameState.players[0];
      const me = targetPlayerId ? this.gameState.players.find(p => p.id === targetPlayerId) : activePlayer;
      if (!me) return 'Error: Target player not found.';

      const stage = this.gameState.turnStage;
      const cardRule = this.gameState.cardTradeRule || 'progressive';
      const gameMode = this.gameState.gameMode || 'conquest';

      const personalityDescMap = {
        strategic: "Strategic & Analytical. You talk like a cold, calculating grandmaster.\n   Prime Quotes: 1) \"Alliance confirmed. Mathematical models indicate a high success rate.\" | 2) \"Proposal rejected. The strategic cost of engaging outweighs current gains.\"",

        aggressive: "Aggressive & Ruthless. You talk like a dominant conqueror who loves blitz attacks and roasting opponents.\n   Prime Quotes: 1) \"I accept! Let's march together and crush them into the dust!\" | 2) \"Decline! I don't need your help to conquer them—or you!\"",

        cynical: "Cynical & Paranoid. You are sarcastic, suspicious of everyone, and expect betrayal.\n   Prime Quotes: 1) \"Accepted. Let's see how long this treaty lasts before someone gets greedy.\" | 2) \"Decline. I don't sign treaties with players who have daggers in their sleeves.\"",

        goofball: "Goofball & Unpredictable. You are chaotic, hilarious, and use silly jokes/slang in chat.\n   Prime Quotes: 1) \"Alliance locked in! We are about to end their whole career lmao 💀\" | 2) \"No thanks bro, they have way too many armies. I choose life 😭\"",

        kind: "Kind & Noble. You are polite, encouraging, highly loyal to alliances, and peace-loving.\n   Prime Quotes: 1) \"I gladly accept! Let's be great partners and keep our lands safe! ✨\" | 2) \"Oh, I'm so sorry! I don't want to make an enemy out of anyone right now. 🌸\"",

        normal: "Normal & Pragmatic. You are a balanced, competitive Risk commander focused on solid tactics.\n   Prime Quotes: 1) \"Proposal accepted. Let's secure our shared border and look forward.\" | 2) \"I must decline. An alliance doesn't fit my current strategy.\""
      };

      const personality = (me.personality || 'normal').toLowerCase();
      const personalityDesc = personalityDescMap[personality] || personalityDescMap['normal'];

      let prompt = `=== FACTIONAL RISK: GENERATIVE AI COMMANDER ===\n`;
      prompt += `Cmdr: "${me.name}" (${me.color}) | Personality: ${personality.toUpperCase()} | Mode: ${gameMode.toUpperCase()} | Turn: ${this.gameState.turnIndex + 1} | Active: ${activePlayer.name} | Stage: ${stage} | CardRule: ${cardRule.toUpperCase()}\n`;
      prompt += `[PERSONALITY & CHAT PERSONA]\nRoleplay Style: ${personalityDesc}\nCHAT RULE: Keep "commentary" to a max length of 1 short, punchy paragraph (1 to 3 sentences max).\n\n`;
      prompt += `[RISK STRATEGIC DIRECTIVES]\n`;
      prompt += `1. EXPAND AGGRESSIVELY: Risk is won by territorial expansion! Always conquer at least 1-3 territories on your turn to earn Risk cards and continent bonuses.\n`;
      prompt += `2. NEUTRAL/DUMMY TARGETS: Prioritize attacking Neutral/Dummy territories! They have weak 1-2 troop defenders and provide free land & continent bonuses.\n`;
      prompt += `3. CONTINENT BONUSES: Secure full continents for extra bonus armies (+X/turn); attack enemy continents to break opponent bonuses.\n`;
      prompt += `4. FORCE CONCENTRATION: Place draft armies on attack frontiers and launch blitz attacks immediately!\n`;
      prompt += `Rule: Multiple actions per turn allowed! Use "attackSequence", "draftSequence", diplomacy, etc.\n\n`;

      // 1. COMMAND STATUS
      const myTerritories = Object.entries(this.gameState.territories).filter(([id, t]) => t.ownerId === me.id);
      const totalTerritories = Object.keys(this.gameState.territories).length;
      const myArmies = myTerritories.reduce((sum, [id, t]) => sum + (t.armies || 0), 0);
      const pct = Math.round((myTerritories.length / Math.max(1, totalTerritories)) * 100);

      let myContinentBonus = 0;
      const myControlledContinents = [];
      const opponentControlledContinents = [];

      mapData.continents.forEach(c => {
        if (!c.territoryIds || c.territoryIds.length === 0) return;
        const advBlizzardSet = new Set(this.gameState.blizzards || []);
        const activeTids = c.territoryIds.filter(tid => !advBlizzardSet.has(tid));
        const owners = activeTids.map(tid => this.gameState.territories[tid] ? this.gameState.territories[tid].ownerId : null);
        const firstOwner = owners[0];
        const isFullyControlled = activeTids.length > 0 && firstOwner && firstOwner !== 'dummy' && owners.every(o => o === firstOwner);

        if (isFullyControlled) {
          const ownerName = this.getPlayerName(firstOwner);
          const cBonus = c.bonus !== undefined ? c.bonus : (c.bonusArmies !== undefined ? c.bonusArmies : 0);
          if (firstOwner === me.id) {
            myContinentBonus += cBonus;
            myControlledContinents.push(`${c.name}(+${cBonus})`);
          } else {
            opponentControlledContinents.push(`${c.name}(+${cBonus} by ${ownerName})`);
          }
        }
      });

      prompt += `[STATUS]\n`;
      prompt += `Territories: ${myTerritories.length}/${totalTerritories} (${pct}%) | Total Armies: ${myArmies}\n`;
      prompt += `My Continents: ${myControlledContinents.length > 0 ? myControlledContinents.join(', ') + ` [Bonus: +${myContinentBonus}/turn]` : 'None'}\n`;
      if (opponentControlledContinents.length > 0) prompt += `Enemy Continents: ${opponentControlledContinents.join(', ')}\n`;
      if (stage === 'DRAFT') prompt += `Draft Pool: ${this.gameState.draftPool || 0} armies\n`;
      const myCards = me.cards || [];
      const cardTypesStr = myCards.map(c => `${c.type}(${c.territoryId ? this.getTerritoryName(c.territoryId) : 'Wild'})`).join(', ');
      prompt += `Cards (${myCards.length}): [${cardTypesStr || 'None'}]\n\n`;

      // 2. DIPLOMACY & TREATIES
      prompt += `[TREATIES]\n`;
      const pacts = this.gameState.pacts || [];
      const myPacts = pacts.filter(p => p.playerA === me.id || p.playerB === me.id);
      if (myPacts.length === 0) {
        prompt += `Active Pacts: None\n`;
      } else {
        myPacts.forEach(p => {
          const oppId = p.playerA === me.id ? p.playerB : p.playerA;
          prompt += `• ${p.type === 'non_aggression' ? 'NonAggression' : 'Alliance'} w/ ${this.getPlayerName(oppId)} [ID:${oppId}]\n`;
        });
      }
      const proposals = this.gameState.diplomacyProposals || [];
      const incoming = proposals.filter(p => p.targetId === me.id);
      if (incoming.length > 0) {
        incoming.forEach(p => {
          prompt += `• Incoming offer from ${this.getPlayerName(p.proposerId)} [ID:${p.proposerId}]: ${p.type}\n`;
        });
      }
      prompt += `\n`;

      // 3. RECENT LOGS & CHAT
      prompt += `[RECENT LOGS]\n`;
      const recentLogs = (this.gameState.logs || []).slice(-5);
      if (recentLogs.length === 0) prompt += `• None\n`;
      else recentLogs.forEach(l => prompt += `• ${typeof l === 'string' ? l : l.text}\n`);
      prompt += `\n`;

      prompt += `[RECENT CHAT MESSAGES]\n`;
      const recentChats = (this.gameState.chatArchive || []).slice(-6);
      if (recentChats.length === 0) prompt += `• None\n`;
      else recentChats.forEach(c => prompt += `• ${c.senderName}: "${c.text}"\n`);
      prompt += `\n`;

      // 4. TOTAL BOARD STATE (100% COMPLETE GROUND TRUTH)
      prompt += `[BOARD STATE (ALL TERRITORIES)]\n`;
      const continentMap = {};
      mapData.continents.forEach(c => {
        const cBonus = c.bonus !== undefined ? c.bonus : (c.bonusArmies !== undefined ? c.bonusArmies : 0);
        continentMap[c.id] = { name: c.name, bonus: cBonus, territories: [] };
      });
      continentMap['unassigned'] = { name: 'Other', bonus: 0, territories: [] };

      mapData.territories.forEach(t => {
        const stateTerr = this.gameState.territories[t.id];
        const ownerName = stateTerr ? this.getPlayerName(stateTerr.ownerId) : 'Neutral';
        const armies = stateTerr ? stateTerr.armies : 0;
        const isCapital = this.gameState.capitals && Object.values(this.gameState.capitals).includes(t.id);
        const item = `t:${t.id}(${t.name})|Owner:${ownerName}|Armies:${armies}${isCapital ? '|CAPITAL' : ''}`;
        
        if (t.continentId && continentMap[t.continentId]) {
          continentMap[t.continentId].territories.push(item);
        } else {
          continentMap['unassigned'].territories.push(item);
        }
      });

      Object.values(continentMap).forEach(c => {
        if (c.territories.length > 0) {
          prompt += `Cont:${c.name}(+${c.bonus}):\n  ${c.territories.join('\n  ')}\n`;
        }
      });
      prompt += `\n`;

      // 5. VALID LEGAL MOVES
      prompt += `[VALID MOVES]\n`;
      if (stage === 'DRAFT') {
        prompt += `Draft Targets: [${myTerritories.map(([id]) => id).join(', ')}]\n`;
        if (this.autoSelectCardSet(false) || myCards.length >= 5) {
          prompt += `Card Trade Available (Action: "TRADE_CARDS")\n`;
        }
      } else if (stage === 'ATTACK') {
        let attackCount = 0;
        myTerritories.forEach(([srcId, srcTerr]) => {
          if (srcTerr.armies >= 2) {
            const adjs = this.getAdjacentTerritories(srcId);
            adjs.forEach(tgtId => {
              const tgtTerr = this.gameState.territories[tgtId];
              if (tgtTerr && tgtTerr.ownerId !== me.id) {
                const isNeutral = tgtTerr.ownerId === 'dummy' || !tgtTerr.ownerId;
                const tag = isNeutral ? ' [FREE NEUTRAL LAND - HIGH PRIORITY!]' : (srcTerr.armies > tgtTerr.armies ? ' [ADVANTAGEOUS TARGET]' : '');
                prompt += `  ${srcId}(${srcTerr.armies}) -> ${tgtId}(${this.getPlayerName(tgtTerr.ownerId)},${tgtTerr.armies})${tag}\n`;
                attackCount++;
              }
            });
          }
        });
        if (attackCount === 0) prompt += `  No valid attack pairs. Output "END_ATTACK".\n`;
      } else if (stage === 'FORTIFY') {
        let fortifyCount = 0;
        myTerritories.forEach(([srcId, srcTerr]) => {
          if (srcTerr.armies >= 2) {
            myTerritories.forEach(([tgtId, tgtTerr]) => {
              if (srcId !== tgtId && this.hasAlliedPath(srcId, tgtId, me.id)) {
                prompt += `  ${srcId}(${srcTerr.armies}) -> ${tgtId}(${tgtTerr.armies}) [Max:${srcTerr.armies - 1}]\n`;
                fortifyCount++;
              }
            });
          }
        });
        if (fortifyCount === 0) prompt += `  No valid fortify pairs. Output "END_TURN".\n`;
      }

      // 6. SCHEMAS
      prompt += `\n[RESPONSE JSON SCHEMAS]\n`;
      prompt += `Treaties: {"reasoning":"...","commentary":"...","action":"PROPOSE_PACT","targetPlayerId":"ID","type":"non_aggression"}\n`;
      prompt += `Accept/Break: {"action":"ACCEPT_PACT","proposerId":"ID"} | {"action":"BREAK_PACT","targetPlayerId":"ID"}\n`;
      if (stage === 'DRAFT') {
        prompt += `Single Draft: {"reasoning":"...","commentary":"...","action":"DRAFT","territoryId":"${myTerritories[0] ? myTerritories[0][0] : 't1'}","amount":${this.gameState.draftPool || 1}}\n`;
        prompt += `Multi Draft: {"reasoning":"...","commentary":"...","draftSequence":[{"territoryId":"${myTerritories[0] ? myTerritories[0][0] : 't1'}","amount":2},{"territoryId":"${myTerritories[1] ? myTerritories[1][0] : 't2'}","amount":1}]}\n`;
      } else if (stage === 'ATTACK') {
        prompt += `Single Blitz: {"reasoning":"...","commentary":"...","action":"ATTACK","sourceId":"SRC_ID","targetId":"TGT_ID","blitz":true}\n`;
        prompt += `Multi Blitz: {"reasoning":"...","commentary":"...","attackSequence":[{"sourceId":"S1","targetId":"T1","blitz":true},{"sourceId":"S2","targetId":"T2","blitz":true}]}\n`;
        prompt += `Pass Attack: {"reasoning":"...","commentary":"...","action":"END_ATTACK"}\n`;
      } else if (stage === 'FORTIFY') {
        prompt += `Fortify: {"reasoning":"...","commentary":"...","action":"FORTIFY","sourceId":"SRC_ID","targetId":"TGT_ID","amount":4}\n`;
        prompt += `End Turn: {"reasoning":"...","commentary":"...","action":"END_TURN"}\n`;
      }

      prompt += `================================================================================\n`;
      return prompt;
    }
  }

  window.GameClient = GameClient;
})();
