(function() {

  // SVG Renderer class
  class SVGRenderer {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      this.options = {
        isEditor: false,
        onTerritoryClick: null,
        onVertexDragStart: null,
        onLabelDragStart: null,
        ...options
      };
      this.svg = null;
      this.mapData = null;
      this.gameState = null;
      this.activeTool = 'draw-territory';

      // Bind tooltip
      this.tooltip = document.getElementById('game-tooltip');

      // Zoom & Pan states
      this.zoomScale = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.isPanning = false;
      this.hasDragged = false;
      this.activeProjectileCount = 0;
    }

    render(mapData, gameState = null) {
      this.mapData = mapData;
      this.gameState = gameState;
      this.container.innerHTML = '';

      if (!mapData) return;

      const width = mapData.width || 1200;
      const height = mapData.height || 800;

      // Create main SVG element
      const svgNamespace = "http://www.w3.org/2000/svg";
      this.svg = document.createElementNS(svgNamespace, "svg");
      this.svg.setAttribute("width", "100%");
      this.svg.setAttribute("height", "100%");
      this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      this.svg.setAttribute("class", this.options.isEditor ? "editor-canvas" : "game-map");
      this.container.appendChild(this.svg);

      // Create main transform group that will contain all map drawings for pan/zoom
      this.transformGroup = document.createElementNS(svgNamespace, "g");
      this.transformGroup.setAttribute("id", "map-transform-group");
      this.svg.appendChild(this.transformGroup);

      // 1. Reference Tracing Image (for editor)
      if (mapData.referenceImage) {
        const bgImg = document.createElementNS(svgNamespace, "image");
        bgImg.setAttributeNS("http://www.w3.org/1999/xlink", "href", mapData.referenceImage);
        bgImg.setAttribute("x", "0");
        bgImg.setAttribute("y", "0");
        bgImg.setAttribute("width", width);
        bgImg.setAttribute("height", height);
        bgImg.setAttribute("id", "editor-ref-image-layer");
        bgImg.setAttribute("opacity", mapData.imageOpacity !== undefined ? mapData.imageOpacity : "0.5");
        this.transformGroup.appendChild(bgImg);
      }

      // 2. Draw Connection Lines
      if (mapData.connections) {
        mapData.connections.forEach(conn => {
          let fromId, toId, isSea = false;
          if (Array.isArray(conn)) {
            fromId = conn[0];
            toId = conn[1];
          } else if (conn && typeof conn === 'object') {
            fromId = conn.from;
            toId = conn.to;
            isSea = conn.type === 'sea';
          }

          const fromTerr = mapData.territories.find(t => t.id === fromId);
          const toTerr = mapData.territories.find(t => t.id === toId);

          if (fromTerr && toTerr && fromTerr.center && toTerr.center) {
            const [x1, y1] = fromTerr.center;
            const [x2, y2] = toTerr.center;
            const dx = Math.abs(x1 - x2);
            
            // If distance is > 65% of map width, it's a wrap-around connection (like Kamchatka to Alaska)
            const isWrapAround = dx > (width * 0.65);

            if (isWrapAround) {
              const leftEdgeX = 0;
              const rightEdgeX = width;

              const dist1 = x1 < x2 ? x1 : (width - x1);
              const dist2 = x2 < x1 ? x2 : (width - x2);
              const totalX = dist1 + dist2 || 1;
              
              // Calculate matching vertical edge intercept
              const yEdge = y1 + (y2 - y1) * (dist1 / totalX);

              // FromTerr segment to closer edge
              const edgeX1 = x1 < x2 ? leftEdgeX : rightEdgeX;
              const line1 = document.createElementNS(svgNamespace, "line");
              line1.setAttribute("x1", x1);
              line1.setAttribute("y1", y1);
              line1.setAttribute("x2", edgeX1);
              line1.setAttribute("y2", yEdge);
              line1.setAttribute("class", isSea ? "connection-line sea-route wrap-around" : "connection-line wrap-around");
              this.transformGroup.appendChild(line1);

              // ToTerr segment to closer edge
              const edgeX2 = x2 < x1 ? leftEdgeX : rightEdgeX;
              const line2 = document.createElementNS(svgNamespace, "line");
              line2.setAttribute("x1", x2);
              line2.setAttribute("y1", y2);
              line2.setAttribute("x2", edgeX2);
              line2.setAttribute("y2", yEdge);
              line2.setAttribute("class", isSea ? "connection-line sea-route wrap-around" : "connection-line wrap-around");
              this.transformGroup.appendChild(line2);
            } else {
              // Check if connection is dangerous: connects to a territory owned by CURRENT USER threatened by >=2x enemy forces
              let isDangerConn = false;
              if (gameState && gameState.territories && window.SocketClient && window.SocketClient.socket) {
                const myId = window.SocketClient.socket.id;
                const t1 = gameState.territories[fromId];
                const t2 = gameState.territories[toId];
                if (t1 && t2) {
                  // Check case A: fromId is mine, toId is hostile
                  if (t1.ownerId === myId && t2.ownerId !== myId && t2.ownerId !== 'dummy') {
                    let isAllied = false;
                    if (gameState.pacts) {
                      isAllied = gameState.pacts.some(p => p.type === 'alliance' && ((p.playerA === myId && p.playerB === t2.ownerId) || (p.playerA === t2.ownerId && p.playerB === myId)));
                    }
                    if (!isAllied && t2.armies >= t1.armies * 2 && t2.armies >= 4) {
                      isDangerConn = true;
                    }
                  }
                  // Check case B: toId is mine, fromId is hostile
                  else if (t2.ownerId === myId && t1.ownerId !== myId && t1.ownerId !== 'dummy') {
                    let isAllied = false;
                    if (gameState.pacts) {
                      isAllied = gameState.pacts.some(p => p.type === 'alliance' && ((p.playerA === myId && p.playerB === t1.ownerId) || (p.playerA === t1.ownerId && p.playerB === myId)));
                    }
                    if (!isAllied && t1.armies >= t2.armies * 2 && t1.armies >= 4) {
                      isDangerConn = true;
                    }
                  }
                }
              }

              if (isSea) {
                // Draw curved dashed route for sea connections
                const path = document.createElementNS(svgNamespace, "path");
                const [x1, y1] = fromTerr.center;
                const [x2, y2] = toTerr.center;
                // Quadratic curve control point: midpoint shifted up/down
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dxSeg = x2 - x1;
                const dySeg = y2 - y1;
                const len = Math.sqrt(dxSeg*dxSeg + dySeg*dySeg);
                // Shift control point perpendicular
                const nx = -dySeg / len;
                const ny = dxSeg / len;
                const shift = Math.min(100, len * 0.2);
                const cx = mx + nx * shift;
                const cy = my + ny * shift;

                path.setAttribute("d", `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
                path.setAttribute("class", isDangerConn ? "connection-line sea-route danger-connection" : "connection-line sea-route");
                this.transformGroup.appendChild(path);
              } else {
                // Standard straight line connection
                const line = document.createElementNS(svgNamespace, "line");
                line.setAttribute("x1", x1);
                line.setAttribute("y1", y1);
                line.setAttribute("x2", x2);
                line.setAttribute("y2", y2);
                line.setAttribute("class", isDangerConn ? "connection-line danger-connection" : "connection-line");
                this.transformGroup.appendChild(line);
              }
            }
          }
        });
      }

      // Compute total global armies across map for dynamic fortress & battlescarred threshold
      let globalArmyCount = 0;
      if (gameState && gameState.territories) {
        Object.values(gameState.territories).forEach(t => {
          globalArmyCount += (t.armies || 0);
        });
      } else if (mapData && mapData.territories) {
        mapData.territories.forEach(t => {
          globalArmyCount += (t.startingArmies || 1);
        });
      }

      let fortressThreshold = 20;
      if (globalArmyCount <= 100) {
        fortressThreshold = 10;
      } else if (globalArmyCount <= 200) {
        fortressThreshold = 15;
      } else {
        fortressThreshold = 20;
      }

      // 3. Draw Territory Polygons
      mapData.territories.forEach(terr => {
        if (!terr.points || terr.points.length === 0) return;

        const polygon = document.createElementNS(svgNamespace, "polygon");
        const pointsString = terr.points.map(p => p.join(',')).join(' ');
        polygon.setAttribute("points", pointsString);
        polygon.setAttribute("class", "territory-poly");
        polygon.setAttribute("id", `poly-${terr.id}`);

        // Base styling or game styling
        let ownerColor = '#1f2937'; // default dark grey
        let ownerName = 'Neutral';

        if (gameState && gameState.territories[terr.id]) {
          const tState = gameState.territories[terr.id];
          if (tState.ownerId === 'dummy') {
            ownerColor = '#475569'; // neutral slate
            ownerName = 'Neutral Forces (Dummy)';
          } else {
            const owner = gameState.players.find(p => p.id === tState.ownerId || p.selectedNationId === tState.ownerId || p.nationId === tState.ownerId);
            if (owner) {
              ownerColor = owner.color;
              ownerName = owner.name;
            } else if (mapData.nations) {
              const nation = mapData.nations.find(n => n.id === tState.ownerId);
              if (nation) {
                ownerColor = nation.color;
                ownerName = nation.name;
              }
            }
          }
        } else if (mapData.isScenario || (mapData.nations && mapData.nations.length > 0)) {
          if (terr.startingOwnerId && terr.startingOwnerId !== 'dummy') {
            const nation = (mapData.nations || []).find(n => n.id === terr.startingOwnerId);
            if (nation) {
              ownerColor = nation.color;
              ownerName = nation.name;
            }
          } else {
            ownerColor = '#475569';
            ownerName = 'Dummy / Neutral Nation';
          }
        }

        // Continent border overlay styling
        let continentName = 'None';
        let continentColor = null;
        if (mapData.continents) {
          const cont = mapData.continents.find(c => c.territoryIds.includes(terr.id));
          if (cont) {
            continentColor = cont.color;
            continentName = cont.name;
            polygon.style.stroke = continentColor;
            polygon.style.strokeWidth = '2px';
          }
        }

        // Fill color combining owner color and transparency
        polygon.style.fill = ownerColor;
        polygon.style.fillOpacity = '0.55';

        // Check if territory is Battlescarred (SINGLE-TURN casualties >= fortressThreshold, within 2 turns)
        const polyRecentCas = (gameState && gameState.territories && gameState.territories[terr.id] && gameState.territories[terr.id].recentBattleCasualties) || 0;
        const polyCurrentCas = (gameState && gameState.territories && gameState.territories[terr.id] && gameState.territories[terr.id].currentTurnCasualties) || 0;
        if (Math.max(polyRecentCas, polyCurrentCas) >= fortressThreshold && !this.options.isEditor) {
          polygon.classList.add('battlescarred-poly');
        }

        // Mouse Events
        polygon.addEventListener('click', (e) => {
          if (this.hasDragged) return;
          if (this.options.onTerritoryClick) {
            this.options.onTerritoryClick(terr.id, e);
          }
        });

        // Hover Tooltip and Adjacency Highlight
        polygon.addEventListener('mousemove', (e) => {
          this.handleTerritoryHover(terr, e);
        });

        polygon.addEventListener('mouseleave', () => {
          this.handleTerritoryLeave(terr);
        });

        this.transformGroup.appendChild(polygon);
      });

      // 4. Draw labels and troop badges
      mapData.territories.forEach(terr => {
        if (!terr.center) return;

        const g = document.createElementNS(svgNamespace, "g");
        g.setAttribute("class", "army-badge-container");
        g.setAttribute("id", `badge-group-${terr.id}`);

        let isNeutral = true;
        let ownerColor = '#4b5563';
        let ownerName = 'Neutral';
        let troopCount = 0;

        if (gameState && gameState.territories[terr.id]) {
          const tState = gameState.territories[terr.id];
          troopCount = tState.armies;
          if (tState.ownerId === 'dummy') {
            ownerColor = '#475569';
            ownerName = 'Neutral Forces (Dummy)';
            isNeutral = true;
          } else {
            const owner = gameState.players.find(p => p.id === tState.ownerId || p.selectedNationId === tState.ownerId || p.nationId === tState.ownerId);
            if (owner) {
              ownerColor = owner.color;
              ownerName = owner.name;
              isNeutral = false;
            } else if (mapData.nations) {
              const nation = mapData.nations.find(n => n.id === tState.ownerId);
              if (nation) {
                ownerColor = nation.color;
                ownerName = nation.name;
                isNeutral = false;
              }
            }
          }
        } else if (mapData.isScenario || (mapData.nations && mapData.nations.length > 0)) {
          const defaultDummyArmies = (mapData.scenarioSettings && mapData.scenarioSettings.defaultDummyArmies) || 1;
          troopCount = terr.startingArmies !== undefined ? terr.startingArmies : defaultDummyArmies;
          if (terr.startingOwnerId && terr.startingOwnerId !== 'dummy') {
            const nation = (mapData.nations || []).find(n => n.id === terr.startingOwnerId);
            if (nation) {
              ownerColor = nation.color;
              ownerName = nation.name;
              isNeutral = false;
            }
          } else {
            ownerColor = '#475569';
            ownerName = 'Dummy / Neutral Nation';
            isNeutral = true;
          }
        }

        let continentName = 'None';
        let continentColor = null;
        if (mapData.continents) {
          const cont = mapData.continents.find(c => c.territoryIds.includes(terr.id));
          if (cont) {
            continentColor = cont.color;
            continentName = cont.name;
          }
        }

        // Army Badge background circle
        const circle = document.createElementNS(svgNamespace, "circle");
        circle.setAttribute("cx", terr.center[0]);
        circle.setAttribute("cy", terr.center[1]);
        circle.setAttribute("r", "16");
        circle.setAttribute("class", "army-badge-bg");
        circle.setAttribute("fill", isNeutral ? '#334155' : ownerColor);
        circle.setAttribute("stroke", '#ffffff');
        circle.setAttribute("stroke-width", '2');
        g.appendChild(circle);

        // Draw a glowing golden outer ring if it is designated as a Capital in Capital Rush mode!
        let isCapital = false;
        if (gameState) {
          if (gameState.gameMode === 'capital_rush' && gameState.capitals) {
            isCapital = Object.values(gameState.capitals).includes(terr.id);
          }
        } else if (this.options.isEditor || (mapData && mapData.scenarioSettings && mapData.scenarioSettings.capitalRush)) {
          if (mapData && mapData.nations) {
            isCapital = mapData.nations.some(n => n.capitalTerritoryId === terr.id);
          }
        }

        if (isCapital) {
          const glowRing = document.createElementNS(svgNamespace, "circle");
          glowRing.setAttribute("cx", terr.center[0]);
          glowRing.setAttribute("cy", terr.center[1]);
          glowRing.setAttribute("r", "22");
          glowRing.setAttribute("fill", "none");
          glowRing.setAttribute("stroke", "#fbbf24"); // Amber / Gold
          glowRing.setAttribute("stroke-width", "3.5");
          glowRing.setAttribute("class", "pulsing-glow"); // pulses
          glowRing.style.filter = "drop-shadow(0 0 6px rgba(251,191,36,0.9))";
          glowRing.style.pointerEvents = "none";
          g.appendChild(glowRing);
        }

        // Draw Fortress Citadel icon if troops >= fortress threshold
        if (troopCount >= fortressThreshold && !this.options.isEditor) {
          const fortressGroup = document.createElementNS(svgNamespace, "g");
          fortressGroup.setAttribute("class", "fortress-citadel-badge");
          // Shifted right and down to place on bottom-right of the badge
          fortressGroup.setAttribute("transform", `translate(${terr.center[0] + 17}, ${terr.center[1] + 17}) scale(1.15)`);
          fortressGroup.style.pointerEvents = "none";
          fortressGroup.style.filter = "drop-shadow(0 1px 3px rgba(0,0,0,0.8))";
          fortressGroup.innerHTML = `
            <rect x="-8" y="-4" width="16" height="12" rx="1.5" fill="#1e293b" stroke="#e2e8f0" stroke-width="1.5"/>
            <rect x="-8" y="-8" width="4" height="4" rx="0.5" fill="#334155" stroke="#e2e8f0" stroke-width="1"/>
            <rect x="-2" y="-8" width="4" height="4" rx="0.5" fill="#334155" stroke="#e2e8f0" stroke-width="1"/>
            <rect x="4" y="-8" width="4" height="4" rx="0.5" fill="#334155" stroke="#e2e8f0" stroke-width="1"/>
            <rect x="-5" y="1" width="4" height="7" rx="0.5" fill="#0f172a"/>
            <rect x="1" y="1" width="4" height="7" rx="0.5" fill="#0f172a"/>
            <line x1="0" y1="-8" x2="0" y2="-14" stroke="#f59e0b" stroke-width="1.8"/>
            <polygon points="0,-14 7,-12 0,-10" fill="#f59e0b"/>
          `;
          g.appendChild(fortressGroup);
        }

        // Draw Battlescarred animated smoke + craters if SINGLE-TURN casualties >= fortressThreshold (within 2 turns)
        // Uses recentBattleCasualties = casualties from the most recent turn on this territory
        const recentCasualties = (gameState && gameState.territories && gameState.territories[terr.id] && gameState.territories[terr.id].recentBattleCasualties) || 0;
        const currentTurnCasualties = (gameState && gameState.territories && gameState.territories[terr.id] && gameState.territories[terr.id].currentTurnCasualties) || 0;
        const battlescarredAmount = Math.max(recentCasualties, currentTurnCasualties);
        if (battlescarredAmount >= fortressThreshold && !this.options.isEditor) {
          const smokeGroup = document.createElementNS(svgNamespace, "g");
          smokeGroup.setAttribute("class", "battlescarred-smoke");
          smokeGroup.setAttribute("transform", `translate(${terr.center[0]}, ${terr.center[1]})`);
          smokeGroup.style.pointerEvents = "none";

          // Calculate time-based negative delays relative to animation loop durations
          // This keeps the animations continuous across rapid state-update redraws
          const delay1 = -((Date.now() % 3200) / 1000);
          const delay2 = -(((Date.now() - 400) % 2800) / 1000);
          const delay3 = -(((Date.now() - 900) % 3600) / 1000);
          const delay4 = -(((Date.now() - 1100) % 2900) / 1000);
          const delay5 = -(((Date.now() - 600) % 3400) / 1000);

          // Craters shifted outwards (from x=10/12 to x=16) to avoid badge overlap
          smokeGroup.innerHTML = `
            <ellipse cx="-16" cy="13" rx="6" ry="2.5" fill="#1c1917" opacity="0.75"/>
            <ellipse cx="-16" cy="13" rx="4" ry="1.5" fill="#292524" opacity="0.9"/>
            <ellipse cx="16" cy="11" rx="4.5" ry="2" fill="#1c1917" opacity="0.7"/>
            <ellipse cx="16" cy="11" rx="3" ry="1.2" fill="#292524" opacity="0.85"/>
            <circle class="smoke-puff smoke-puff-1" cx="-14" cy="5" r="4" fill="#57534e" opacity="0.55" style="animation-delay: ${delay1}s;"/>
            <circle class="smoke-puff smoke-puff-2" cx="-12" cy="0" r="3" fill="#78716c" opacity="0.45" style="animation-delay: ${delay2}s;"/>
            <circle class="smoke-puff smoke-puff-3" cx="-10" cy="-4" r="2.5" fill="#a8a29e" opacity="0.3" style="animation-delay: ${delay3}s;"/>
            <circle class="smoke-puff smoke-puff-4" cx="14" cy="5" r="3.5" fill="#57534e" opacity="0.5" style="animation-delay: ${delay4}s;"/>
            <circle class="smoke-puff smoke-puff-5" cx="12" cy="0" r="2.5" fill="#78716c" opacity="0.4" style="animation-delay: ${delay5}s;"/>
          `;
          g.appendChild(smokeGroup);
        }

        // Army Badge text (friendly troop numbers)
        const text = document.createElementNS(svgNamespace, "text");
        text.setAttribute("x", terr.center[0]);
        text.setAttribute("y", terr.center[1] + 5);
        text.setAttribute("class", "army-badge-text");
        text.setAttribute("text-anchor", "middle");
        // Dark text for white/bright backgrounds, white text for dark backgrounds
        const isBright = this.isColorLight(ownerColor);
        text.setAttribute("fill", isNeutral ? '#ffffff' : (isBright ? '#000000' : '#ffffff'));
        text.textContent = this.options.isEditor ? '•' : troopCount;
        g.appendChild(text);

        // Name text label above badge
        const nameText = document.createElementNS(svgNamespace, "text");
        nameText.setAttribute("x", terr.center[0]);
        nameText.setAttribute("y", terr.center[1] - 22);
        nameText.setAttribute("font-family", "Outfit");
        nameText.setAttribute("font-size", "11px");
        nameText.setAttribute("font-weight", "600");
        nameText.setAttribute("fill", "#9ca3af");
        nameText.setAttribute("text-anchor", "middle");
        nameText.textContent = terr.name;
        nameText.style.pointerEvents = 'none';
        nameText.style.textShadow = '0px 1px 3px rgba(0,0,0,0.8)';
        g.appendChild(nameText);

        // Render infantry, cavalry, artillery icons under the badge based on troop count
        if (troopCount > 0 && !this.options.isEditor) {
          const artilleryCount = Math.floor(troopCount / 10);
          const cavalryCount = Math.floor((troopCount % 10) / 5);
          const infantryCount = troopCount % 5;
          const totalIcons = artilleryCount + cavalryCount + infantryCount;

          if (totalIcons > 0) {
            const spacing = totalIcons > 6 ? 9 : 13;
            const startX = terr.center[0] - ((totalIcons - 1) * spacing) / 2;
            const iconY = terr.center[1] + 28; // 28px below badge center

            let iconIdx = 0;

            // 1. Draw Artillery (Cannons - worth 10)
            for (let i = 0; i < artilleryCount; i++) {
              const cx = startX + iconIdx * spacing;
              
              // Cannon Wheel
              const w = document.createElementNS(svgNamespace, "circle");
              w.setAttribute("cx", (cx - 1).toString());
              w.setAttribute("cy", (iconY + 1).toString());
              w.setAttribute("r", "1.8");
              w.setAttribute("fill", "#f59e0b");
              g.appendChild(w);

              // Cannon Barrel
              const b = document.createElementNS(svgNamespace, "path");
              b.setAttribute("d", `M ${cx - 3} ${iconY} L ${cx + 3} ${iconY - 3}`);
              b.setAttribute("stroke", "#f59e0b");
              b.setAttribute("stroke-width", "1.6");
              b.setAttribute("stroke-linecap", "round");
              g.appendChild(b);

              iconIdx++;
            }

            // 2. Draw Cavalry (Horses - worth 5)
            for (let i = 0; i < cavalryCount; i++) {
              const cx = startX + iconIdx * spacing;

              const h = document.createElementNS(svgNamespace, "path");
              h.setAttribute("d", `M ${cx - 2.5} ${iconY + 2.5} C ${cx - 3.5} ${iconY - 0.5} ${cx - 1.5} ${iconY - 3} ${cx + 1} ${iconY - 3} C ${cx + 2} ${iconY - 3} ${cx + 2.5} ${iconY - 2} ${cx + 1.5} ${iconY} C ${cx + 0.5} ${iconY + 1.5} ${cx + 2} ${iconY + 2.5} ${cx + 2} ${iconY + 2.5} Z`);
              h.setAttribute("fill", "#38bdf8");
              g.appendChild(h);

              iconIdx++;
            }

            // 3. Draw Infantry (Soldiers - worth 1)
            for (let i = 0; i < infantryCount; i++) {
              const cx = startX + iconIdx * spacing;

              // Head
              const hd = document.createElementNS(svgNamespace, "circle");
              hd.setAttribute("cx", cx.toString());
              hd.setAttribute("cy", (iconY - 2.5).toString());
              hd.setAttribute("r", "1.8");
              hd.setAttribute("fill", "#a7f3d0");
              g.appendChild(hd);

              // Body
              const bd = document.createElementNS(svgNamespace, "path");
              bd.setAttribute("d", `M ${cx - 2.5} ${iconY + 2.5} C ${cx - 2.5} ${iconY} ${cx + 2.5} ${iconY} ${cx + 2.5} ${iconY + 2.5} Z`);
              bd.setAttribute("fill", "#a7f3d0");
              g.appendChild(bd);

              iconIdx++;
            }
          }
        }

        g.addEventListener('click', (e) => {
          if (this.hasDragged) return;
          if (this.options.onTerritoryClick) {
            this.options.onTerritoryClick(terr.id, e);
          }
        });

        // Hover Tooltip and Adjacency Highlight when hovering troop circle badge
        g.addEventListener('mousemove', (e) => {
          this.handleTerritoryHover(terr, e);
        });

        g.addEventListener('mouseleave', () => {
          this.handleTerritoryLeave(terr);
        });

        // Dragging handles for editor labels
        if (this.options.isEditor) {
          g.style.cursor = 'move';
          g.addEventListener('mousedown', (e) => {
            if (this.options.onLabelDragStart) {
              this.options.onLabelDragStart(terr.id, e);
            }
          });
        }

        this.transformGroup.appendChild(g);
      });

      // 5. Draw Alliance Path overlays
      if (gameState && gameState.pacts) {
        gameState.pacts.forEach(pact => {
          if (pact.type === 'alliance') {
            // Draw alliance visualization between players if they have connected routes
            // Highlight player alliance borders or routes
          }
        });
      }

      // Initialize Zoom & Pan
      this.setupZoomAndPan();
      this.bindZoomButtons();
      this.applyTransform();
    }

    getAdjacentTerritories(territoryId) {
      if (!this.mapData || !this.mapData.connections) return [];
      const adjacent = [];
      for (const conn of this.mapData.connections) {
        if (Array.isArray(conn)) {
          if (conn[0] === territoryId) adjacent.push(conn[1]);
          else if (conn[1] === territoryId) adjacent.push(conn[0]);
        } else if (conn && typeof conn === 'object') {
          if (conn.from === territoryId) adjacent.push(conn.to);
          else if (conn.to === territoryId) adjacent.push(conn.from);
        }
      }
      return [...new Set(adjacent)];
    }

    // Helper for hovering territory (works for polygon and troop count badge)
    handleTerritoryHover(terr, event) {
      if (this.options.isEditor) return;
      this.showTooltip(terr, event);

      const poly = document.getElementById(`poly-${terr.id}`);
      if (poly) {
        poly.style.fillOpacity = '0.75';
      }

      const adjacents = this.getAdjacentTerritories(terr.id);
      adjacents.forEach(adjId => {
        const adjPoly = document.getElementById(`poly-${adjId}`);
        if (adjPoly) {
          adjPoly.style.stroke = '#ffffff';
          adjPoly.style.strokeWidth = '3px';
        }
      });
    }

    // Helper for leaving territory hover
    handleTerritoryLeave(terr) {
      if (this.options.isEditor) return;
      this.hideTooltip();

      const poly = document.getElementById(`poly-${terr.id}`);
      if (poly) {
        poly.style.fillOpacity = '0.55';
      }

      const adjacents = this.getAdjacentTerritories(terr.id);
      adjacents.forEach(adjId => {
        const adjPoly = document.getElementById(`poly-${adjId}`);
        if (adjPoly) {
          let origColor = '';
          let origWidth = '';
          if (this.mapData && this.mapData.continents) {
            const cont = this.mapData.continents.find(c => c.territoryIds.includes(adjId));
            if (cont) {
              origColor = cont.color;
              origWidth = '2px';
            }
          }
          adjPoly.style.fillOpacity = '0.55';
          adjPoly.style.stroke = origColor;
          adjPoly.style.strokeWidth = origWidth;
        }
      });

      if (window.MainController && window.MainController.gameClient && typeof window.MainController.gameClient.highlightSourceTarget === 'function') {
        window.MainController.gameClient.highlightSourceTarget();
      }
    }

    // Ballistic Artillery Cannon & Projectile Arc Animation
    fireBallisticArtillery(sourceCenter, targetCenter, options = {}) {
      if (!this.transformGroup || !sourceCenter || !targetCenter) return;
      
      const { shooterColor = '#ff4400', isConquest = false, onImpact = null } = options;
      const [x1, y1] = sourceCenter;
      let [x2, y2] = targetCenter;

      const mapWidth = (this.mapData && this.mapData.width) || 1200;
      const dx = x2 - x1;
      const isWrapAround = Math.abs(dx) > (mapWidth * 0.65);
      if (isWrapAround) {
        if (dx > 0) x2 -= mapWidth;
        else x2 += mapWidth;
      }

      // Blitz / Performance Limiter: if over 10 active projectiles, trigger impact immediately without lag
      if (this.activeProjectileCount >= 10) {
        this.triggerExplosionEffect([x2, y2], isConquest, onImpact);
        return;
      }

      this.activeProjectileCount++;

      // 1. Render Cannon on firing territory
      const cannonAngle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      const cannonGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      cannonGroup.style.pointerEvents = "none";
      cannonGroup.setAttribute("transform", `translate(${x1}, ${y1}) rotate(${cannonAngle})`);

      // Cannon Carriage, Wheels & Barrel
      cannonGroup.innerHTML = `
        <circle cx="-4" cy="-6" r="3.5" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
        <circle cx="-4" cy="6" r="3.5" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>
        <rect x="-8" y="-4" width="11" height="8" rx="2" fill="#334155" stroke="#0f172a" stroke-width="1"/>
        <rect x="-2" y="-3" width="16" height="6" rx="1.5" fill="${shooterColor}" stroke="#0f172a" stroke-width="1.2"/>
        <circle cx="16" cy="0" r="7" fill="#ffeedd" stroke="#ff6600" stroke-width="2" class="cannon-muzzle-flare"/>
      `;
      this.transformGroup.appendChild(cannonGroup);

      // Fade out cannon after shot
      setTimeout(() => {
        cannonGroup.style.transition = "opacity 0.4s ease-out";
        cannonGroup.style.opacity = "0";
        setTimeout(() => cannonGroup.remove(), 450);
      }, 350);

      // 2. Compute Ballistic Arc Trajectory
      const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
      const arcHeight = Math.min(130, Math.max(35, dist * 0.28));
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      // Perpendicular normal elevated for high parabolic arc
      const nx = -(y2 - y1) / dist;
      const ny = (x2 - x1) / dist;
      const cx = mx + nx * (arcHeight * 0.35);
      const cy = my + ny * (arcHeight * 0.35) - arcHeight;

      // Projectile Shell element
      const projectileGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      projectileGroup.style.pointerEvents = "none";

      const projectileGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      projectileGlow.setAttribute("r", "6");
      projectileGlow.setAttribute("fill", "#ff4400");
      projectileGlow.setAttribute("fill-opacity", "0.7");
      projectileGlow.setAttribute("filter", "drop-shadow(0 0 6px #ffcc00)");
      projectileGroup.appendChild(projectileGlow);

      const projectileCore = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      projectileCore.setAttribute("r", "3.5");
      projectileCore.setAttribute("fill", "#ffeedd");
      projectileCore.setAttribute("stroke", "#ffffff");
      projectileCore.setAttribute("stroke-width", "1");
      projectileGroup.appendChild(projectileCore);

      this.transformGroup.appendChild(projectileGroup);

      // Flight Animation
      const flightDuration = Math.min(480, Math.max(300, dist * 1.1));
      const startTime = performance.now();

      const animateFlight = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / flightDuration);

        // Quadratic Bezier interpolation
        const invT = 1 - t;
        const curX = invT * invT * x1 + 2 * invT * t * cx + t * t * x2;
        const curY = invT * invT * y1 + 2 * invT * t * cy + t * t * y2;

        projectileGroup.setAttribute("transform", `translate(${curX}, ${curY})`);

        if (t < 1) {
          requestAnimationFrame(animateFlight);
        } else {
          projectileGroup.remove();
          this.activeProjectileCount = Math.max(0, this.activeProjectileCount - 1);
          // 3. Impact & Explosion on landing
          this.triggerExplosionEffect([x2, y2], isConquest, onImpact);
        }
      };

      requestAnimationFrame(animateFlight);
    }

    // Impact Explosion Effect
    triggerExplosionEffect(targetCenter, isConquest = false, onImpact = null) {
      if (!this.transformGroup || !targetCenter) return;
      const [tx, ty] = targetCenter;

      const expGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      expGroup.style.pointerEvents = "none";
      expGroup.setAttribute("transform", `translate(${tx}, ${ty})`);

      // Fireball Flash
      const flash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      flash.setAttribute("r", "5");
      flash.setAttribute("fill", isConquest ? "#00ffcc" : "#ff3322");
      flash.setAttribute("fill-opacity", "0.9");
      flash.setAttribute("stroke", "#ffffff");
      flash.setAttribute("stroke-width", "3");
      expGroup.appendChild(flash);

      // Expanding Shockwave Ring
      const shockwave = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      shockwave.setAttribute("r", "8");
      shockwave.setAttribute("fill", "none");
      shockwave.setAttribute("stroke", isConquest ? "#00ffcc" : "#ff3322");
      shockwave.setAttribute("stroke-width", "3.5");
      expGroup.appendChild(shockwave);

      // Spark debris lines
      const sparkCount = 7;
      const sparks = [];
      for (let i = 0; i < sparkCount; i++) {
        const spark = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() * 0.4);
        const dist = 18 + Math.random() * 16;
        spark.setAttribute("x1", "0");
        spark.setAttribute("y1", "0");
        spark.setAttribute("x2", (Math.cos(angle) * dist).toFixed(1));
        spark.setAttribute("y2", (Math.sin(angle) * dist).toFixed(1));
        spark.setAttribute("stroke", i % 2 === 0 ? "#ffcc00" : "#ffffff");
        spark.setAttribute("stroke-width", "2");
        spark.setAttribute("stroke-linecap", "round");
        expGroup.appendChild(spark);
        sparks.push(spark);
      }

      this.transformGroup.appendChild(expGroup);

      if (typeof onImpact === 'function') {
        onImpact();
      }

      // Animate explosion
      const startTime = performance.now();
      const expDuration = 650;
      const maxFlashR = isConquest ? 36 : 26;
      const maxWaveR = isConquest ? 52 : 42;

      const animateExp = (now) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / expDuration);
        const invP = 1 - p;

        // Flash expands then contracts
        const flashR = p < 0.3 ? 5 + (maxFlashR - 5) * (p / 0.3) : maxFlashR * (1 - (p - 0.3) / 0.7);
        flash.setAttribute("r", Math.max(1, flashR).toString());
        flash.setAttribute("fill-opacity", (0.9 * invP).toString());
        flash.setAttribute("stroke-opacity", invP.toString());

        // Shockwave expands outwards
        const waveR = 8 + (maxWaveR - 8) * Math.sin((p * Math.PI) / 2);
        shockwave.setAttribute("r", waveR.toString());
        shockwave.setAttribute("stroke-opacity", (invP * 0.9).toString());

        // Sparks fade
        sparks.forEach(s => s.setAttribute("stroke-opacity", (invP * 0.85).toString()));

        if (p < 1) {
          requestAnimationFrame(animateExp);
        } else {
          expGroup.remove();
        }
      };
      requestAnimationFrame(animateExp);
    }

    // Alias for legacy triggerCombatArtillery
    triggerCombatArtillery(sourceCenter, targetCenter, isConquest = false) {
      this.fireBallisticArtillery(sourceCenter, targetCenter, {
        isConquest,
        onImpact: () => {
          if (isConquest) {
            this.triggerConquestShockwave(targetCenter);
          }
        }
      });
    }

    // Tanks Advance on Territory Conquest
    animateConquestTanks(sourceCenter, targetCenter, conquerorColor = '#00e5ff', onComplete = null) {
      if (!this.transformGroup || !sourceCenter || !targetCenter) {
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      const [x1, y1] = sourceCenter;
      let [x2, y2] = targetCenter;

      const mapWidth = (this.mapData && this.mapData.width) || 1200;
      const dx = x2 - x1;
      const isWrapAround = Math.abs(dx) > (mapWidth * 0.65);
      if (isWrapAround) {
        if (dx > 0) x2 -= mapWidth;
        else x2 += mapWidth;
      }

      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      const perpAngle = angle + 90;
      const perpRad = perpAngle * (Math.PI / 180);

      // Create 2 mini tanks in formation
      const tankOffsets = [
        { perp: 7, delay: 0 },
        { perp: -7, delay: 50 }
      ];

      const tankElements = tankOffsets.map((cfg) => {
        const tg = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tg.style.pointerEvents = "none";
        tg.innerHTML = `
          <rect x="-10" y="-7" width="20" height="3" rx="1" fill="#0f172a"/>
          <rect x="-10" y="4" width="20" height="3" rx="1" fill="#0f172a"/>
          <rect x="-9" y="-5" width="18" height="10" rx="2" fill="${conquerorColor}" stroke="#0f172a" stroke-width="1.2"/>
          <circle cx="-1" cy="0" r="3.5" fill="#0f172a" stroke="${conquerorColor}" stroke-width="1"/>
          <line x1="0" y1="0" x2="11" y2="0" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
        `;
        this.transformGroup.appendChild(tg);
        return { el: tg, cfg };
      });

      const moveDuration = 480;
      const startTime = performance.now();

      const animateTanks = (now) => {
        const elapsed = now - startTime;
        let allDone = true;

        tankElements.forEach(({ el, cfg }) => {
          const tElapsed = Math.max(0, elapsed - cfg.delay);
          const p = Math.min(1, tElapsed / moveDuration);

          if (p < 1) allDone = false;

          // Position along path with lateral formation offset
          const curX = x1 + (x2 - x1) * p + Math.cos(perpRad) * cfg.perp;
          const curY = y1 + (y2 - y1) * p + Math.sin(perpRad) * cfg.perp;
          const opacity = p > 0.85 ? (1 - (p - 0.85) / 0.15) : 1;

          el.setAttribute("transform", `translate(${curX}, ${curY}) rotate(${angle})`);
          el.style.opacity = opacity.toString();
        });

        if (!allDone) {
          requestAnimationFrame(animateTanks);
        } else {
          tankElements.forEach(({ el }) => el.remove());
          this.triggerConquestShockwave([x2, y2], conquerorColor);
          if (typeof onComplete === 'function') onComplete();
        }
      };

      requestAnimationFrame(animateTanks);
    }

    // Brief Conquest Flash Ripple with celebratory particles
    triggerConquestShockwave(targetCenter, conquerorColor = '#00e5ff') {
      if (!this.transformGroup || !targetCenter) return;
      const [tx, ty] = targetCenter;

      const conquestGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      conquestGroup.style.pointerEvents = "none";
      conquestGroup.setAttribute("transform", `translate(${tx}, ${ty})`);

      const ripple1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ripple1.setAttribute("r", "12");
      ripple1.setAttribute("fill", conquerorColor);
      ripple1.setAttribute("fill-opacity", "0.4");
      ripple1.setAttribute("stroke", "#ffffff");
      ripple1.setAttribute("stroke-width", "4");
      conquestGroup.appendChild(ripple1);

      const ripple2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ripple2.setAttribute("r", "6");
      ripple2.setAttribute("fill", "none");
      ripple2.setAttribute("stroke", conquerorColor);
      ripple2.setAttribute("stroke-width", "3");
      conquestGroup.appendChild(ripple2);

      this.transformGroup.appendChild(conquestGroup);

      const startTime = performance.now();
      const duration = 1100;
      const maxR = 80;

      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(1, elapsed / duration);
        const currentR1 = 12 + (maxR - 12) * (1 - Math.pow(1 - progress, 3));
        const currentR2 = 6 + (maxR * 0.7 - 6) * (1 - Math.pow(1 - progress, 2.5));
        const opacity = 1 - progress;

        ripple1.setAttribute("r", currentR1.toString());
        ripple1.setAttribute("fill-opacity", (0.45 * opacity).toString());
        ripple1.setAttribute("stroke-opacity", opacity.toString());

        ripple2.setAttribute("r", currentR2.toString());
        ripple2.setAttribute("stroke-opacity", (opacity * 0.8).toString());

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          conquestGroup.remove();
        }
      };
      requestAnimationFrame(animate);
    }

    // Floating Casualty Damage Popup (with Blitz batch aggregation)
    showFloatingCasualty(territoryId, amount) {
      if (!this.transformGroup || !amount || amount <= 0) return;
      const mapData = this.mapData || (window.SocketClient && window.SocketClient.mapData);
      const terr = (mapData && mapData.territories) ? mapData.territories.find(t => t.id === territoryId) : null;
      if (!terr || !terr.center) return;

      this.activeDamageFloats = this.activeDamageFloats || {};

      // If already active on this territory within rapid blitz window, aggregate numbers!
      if (this.activeDamageFloats[territoryId]) {
        const item = this.activeDamageFloats[territoryId];
        item.totalAmount += amount;
        item.textEl.textContent = `-${item.totalAmount}`;
        item.startTime = performance.now(); // reset timer for aggregated burst
        
        // Punch scale bounce
        item.textEl.setAttribute("font-size", item.totalAmount >= 10 ? "17px" : "15px");
        item.textEl.style.transform = `scale(1.25)`;
        setTimeout(() => {
          if (item.textEl) item.textEl.style.transform = `scale(1)`;
        }, 120);
        return;
      }

      const svgNamespace = "http://www.w3.org/2000/svg";
      const textEl = document.createElementNS(svgNamespace, "text");
      textEl.setAttribute("class", "floating-damage-number");
      textEl.setAttribute("text-anchor", "middle");
      textEl.setAttribute("fill", "#ff3344");
      textEl.setAttribute("stroke", "#000000");
      textEl.setAttribute("stroke-width", "3");
      textEl.setAttribute("paint-order", "stroke fill");
      textEl.setAttribute("font-family", "Outfit, sans-serif");
      textEl.setAttribute("font-size", amount >= 10 ? "17px" : "15px");
      textEl.setAttribute("font-weight", "900");
      textEl.style.pointerEvents = "none";
      textEl.style.filter = "drop-shadow(0 2px 5px rgba(0,0,0,0.9))";
      textEl.style.transition = "transform 0.12s ease-out";
      textEl.textContent = `-${amount}`;

      const [cx, cy] = terr.center;
      const startY = cy - 8;
      const endY = cy - 42;
      textEl.setAttribute("transform", `translate(${cx}, ${startY})`);
      this.transformGroup.appendChild(textEl);

      const record = {
        territoryId,
        totalAmount: amount,
        textEl,
        curY: startY,
        startTime: performance.now()
      };
      this.activeDamageFloats[territoryId] = record;

      const duration = 1100;

      const animateDamage = (now) => {
        const elapsed = now - record.startTime;
        const p = Math.min(1, elapsed / duration);

        const curY = startY + (endY - startY) * Math.sin((p * Math.PI) / 2);
        record.curY = curY;
        const opacity = p > 0.65 ? (1 - (p - 0.65) / 0.35) : 1;

        textEl.setAttribute("transform", `translate(${cx}, ${curY})`);
        textEl.style.opacity = opacity.toString();

        if (p < 1) {
          requestAnimationFrame(animateDamage);
        } else {
          textEl.remove();
          if (this.activeDamageFloats[territoryId] === record) {
            delete this.activeDamageFloats[territoryId];
          }
        }
      };

      requestAnimationFrame(animateDamage);
    }

    // Continent Spotlight Highlight
    highlightContinent(contRef) {
      const mapData = this.mapData || (window.SocketClient && window.SocketClient.mapData);
      if (!mapData || !this.transformGroup) return;

      let targetCont = null;
      if (contRef && typeof contRef === 'object') {
        targetCont = contRef;
      } else if (mapData.continents) {
        targetCont = mapData.continents.find(c => c.id === contRef || c.name === contRef);
      }
      if (!targetCont) return;

      const territoryIds = targetCont.territoryIds || [];
      if (territoryIds.length === 0) return;

      const memberIds = new Set(territoryIds);
      const contColor = targetCont.color || '#a855f7';

      // Remove any existing continent highlight overlays
      this.clearContinentHighlight();

      // Create an SVG group for highlight overlays on top of polygons
      const overlayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      overlayGroup.setAttribute("id", "continent-highlight-overlay-group");
      overlayGroup.style.pointerEvents = "none";

      (mapData.territories || []).forEach(t => {
        const poly = document.getElementById(`poly-${t.id}`);
        const badge = document.getElementById(`badge-group-${t.id}`);
        const isMember = memberIds.has(t.id);

        if (poly) {
          if (isMember) {
            poly.style.opacity = '1';
            // Create a glowing border outline clone on the overlay group without changing fill
            if (t.points && t.points.length > 0) {
              const highlightClone = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
              highlightClone.setAttribute("points", t.points.map(p => p.join(',')).join(' '));
              highlightClone.setAttribute("fill", "none");
              highlightClone.setAttribute("stroke", "#ffffff");
              highlightClone.setAttribute("stroke-width", "5");
              highlightClone.style.filter = "drop-shadow(0 0 10px " + contColor + ")";
              overlayGroup.appendChild(highlightClone);
            }
          } else {
            poly.style.opacity = '0.22';
          }
        }

        if (badge) {
          if (isMember) {
            badge.style.opacity = '1';
            badge.classList.add('highlight-continent-badge');
          } else {
            badge.style.opacity = '0.22';
          }
        }
      });

      // Insert overlay group before the badges so badges remain on top
      const firstBadge = this.transformGroup.querySelector('.army-badge-container');
      if (firstBadge) {
        this.transformGroup.insertBefore(overlayGroup, firstBadge);
      } else {
        this.transformGroup.appendChild(overlayGroup);
      }
    }

    clearContinentHighlight() {
      // Remove overlay group if present
      const overlayGroup = document.getElementById("continent-highlight-overlay-group");
      if (overlayGroup) overlayGroup.remove();

      const mapData = this.mapData || (window.SocketClient && window.SocketClient.mapData);
      if (!mapData) return;

      (mapData.territories || []).forEach(t => {
        const poly = document.getElementById(`poly-${t.id}`);
        const badge = document.getElementById(`badge-group-${t.id}`);

        if (poly) {
          poly.style.opacity = '1';
        }

        if (badge) {
          badge.style.opacity = '1';
          badge.classList.remove('highlight-continent-badge');
        }
      });
    }

    // Tooltip management
    showTooltip(terr, event) {
      if (!this.tooltip || !terr) return;

      let ownerName = 'Neutral';
      let continentName = 'None';
      let continentColor = null;
      let continentBonusText = '';

      if (this.mapData && this.mapData.continents) {
        const cont = this.mapData.continents.find(c => c.territoryIds.includes(terr.id));
        if (cont) {
          continentColor = cont.color;
          continentName = cont.name;
          const bonus = cont.bonus !== undefined ? cont.bonus : (cont.bonusArmies !== undefined ? cont.bonusArmies : 0);
          continentBonusText = ` (+${bonus})`;
        }
      }

      let troopText = '0';
      if (this.gameState && this.gameState.territories && this.gameState.territories[terr.id]) {
        const tState = this.gameState.territories[terr.id];
        troopText = tState.armies;
        if (tState.ownerId === 'dummy') {
          ownerName = 'Neutral Forces (Dummy)';
        } else {
          const owner = this.gameState.players ? this.gameState.players.find(p => p.id === tState.ownerId) : null;
          if (owner) {
            ownerName = owner.name;
          }
        }
      } else if (this.mapData && (this.mapData.isScenario || (this.mapData.nations && this.mapData.nations.length > 0))) {
        const defaultDummyArmies = (this.mapData.scenarioSettings && this.mapData.scenarioSettings.defaultDummyArmies) || 1;
        troopText = terr.startingArmies !== undefined ? terr.startingArmies : defaultDummyArmies;
        if (terr.startingOwnerId && terr.startingOwnerId !== 'dummy') {
          const nation = (this.mapData.nations || []).find(n => n.id === terr.startingOwnerId);
          if (nation) {
            ownerName = nation.name;
          }
        } else {
          ownerName = 'Dummy / Neutral Nation';
        }
      } else if (terr.startingArmies !== undefined) {
        troopText = terr.startingArmies;
      }

      const clientX = event.clientX;
      const clientY = event.clientY;

      this.tooltip.style.position = 'fixed'; 
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${clientX + 15}px`;
      this.tooltip.style.top = `${clientY + 15}px`;

      this.tooltip.innerHTML = `
        <div class="tooltip-title">${terr.name}</div>
        <div class="tooltip-continent" style="color: ${continentColor || '#9ca3af'}">
          Continent: ${continentName}${continentBonusText}
        </div>
        <div>Owner: <strong>${ownerName}</strong></div>
        <div>Troops: <strong>${troopText}</strong></div>
      `;
    }

    hideTooltip() {
      if (this.tooltip) {
        this.tooltip.style.display = 'none';
      }
    }

    // Color brightness helper
    isColorLight(color) {
      if (!color) return false;
      const hex = color.replace('#', '');
      if (hex.length < 6) return false;
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
    }

    applyTransform() {
      if (!this.transformGroup) return;
      // Guard against NaN/Infinity from degenerate layout state (zero-size SVG)
      const px = isFinite(this.panX) ? this.panX : 0;
      const py = isFinite(this.panY) ? this.panY : 0;
      const sc = isFinite(this.zoomScale) && this.zoomScale > 0 ? this.zoomScale : 1.0;
      this.panX = px;
      this.panY = py;
      this.zoomScale = sc;
      this.transformGroup.setAttribute("transform", `translate(${px}, ${py}) scale(${sc})`);
    }

    setupZoomAndPan() {
      const svg = this.svg;
      if (!svg) return;

      // Clean up previous window listeners to prevent memory leaks
      if (this._onMouseMoveBound) {
        window.removeEventListener('mousemove', this._onMouseMoveBound);
      }
      if (this._onMouseUpBound) {
        window.removeEventListener('mouseup', this._onMouseUpBound);
      }

      // Prevent context menu popup on the map for right-click panning
      svg.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      svg.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'button' || e.target.closest('button')) return;
        
        // Prevent default browser behaviors (middle-click autoscroll & right-click menu)
        if (e.button === 1 || e.button === 2) {
          e.preventDefault();
        }

        // Allow panning with Left (0), Middle (1), or Right (2) mouse clicks
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

        this.isPanning = true;
        this.hasDragged = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startPanX = this.panX;
        this.startPanY = this.panY;
      });

      this._onMouseMoveBound = (e) => {
        if (!this.isPanning) return;
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          this.hasDragged = true;
        }

        const ctm = svg.getScreenCTM();
        if (!ctm || !isFinite(ctm.a) || ctm.a === 0) return;

        this.panX = this.startPanX + (dx / ctm.a);
        this.panY = this.startPanY + (dy / (ctm.d || ctm.a));
        this.applyTransform();
      };

      this._onMouseUpBound = () => {
        this.isPanning = false;
        setTimeout(() => {
          this.hasDragged = false;
        }, 0);
      };

      window.addEventListener('mousemove', this._onMouseMoveBound);
      window.addEventListener('mouseup', this._onMouseUpBound);

      svg.addEventListener('wheel', (e) => {
        e.preventDefault();

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;

        // Convert cursor screen position to SVG viewBox coordinates
        const viewBoxPoint = pt.matrixTransform(ctm.inverse());
        if (!isFinite(viewBoxPoint.x) || !isFinite(viewBoxPoint.y)) return;

        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newScale = Math.min(20.0, Math.max(0.4, this.zoomScale * zoomFactor));

        // Keep the exact SVG point under the mouse cursor stationary
        const newPanX = viewBoxPoint.x - (viewBoxPoint.x - this.panX) * (newScale / this.zoomScale);
        const newPanY = viewBoxPoint.y - (viewBoxPoint.y - this.panY) * (newScale / this.zoomScale);

        if (!isFinite(newPanX) || !isFinite(newPanY)) return;

        this.panX = newPanX;
        this.panY = newPanY;
        this.zoomScale = newScale;
        this.applyTransform();
      }, { passive: false });
    }

    bindZoomButtons() {
      const prefix = this.options.isEditor ? 'btn-editor-' : 'btn-';
      const btnIn = document.getElementById(`${prefix}zoom-in`);
      const btnOut = document.getElementById(`${prefix}zoom-out`);
      const btnReset = document.getElementById(`${prefix}zoom-reset`);

      const getViewportCenter = () => {
        const rect = this.svg.getBoundingClientRect();
        const pt = this.svg.createSVGPoint();
        pt.x = rect.left + rect.width / 2;
        pt.y = rect.top + rect.height / 2;
        const ctm = this.svg.getScreenCTM();
        if (!ctm) return null;
        return pt.matrixTransform(ctm.inverse());
      };

      if (btnIn) {
        btnIn.onclick = (e) => {
          e.stopPropagation();
          const center = getViewportCenter();
          if (!center || !isFinite(center.x) || !isFinite(center.y)) return;

          const oldScale = this.zoomScale;
          this.zoomScale = Math.min(20.0, this.zoomScale * 1.3);
          const newPanX = center.x - (center.x - this.panX) * (this.zoomScale / oldScale);
          const newPanY = center.y - (center.y - this.panY) * (this.zoomScale / oldScale);
          if (isFinite(newPanX) && isFinite(newPanY)) {
            this.panX = newPanX;
            this.panY = newPanY;
          }
          this.applyTransform();
        };
      }

      if (btnOut) {
        btnOut.onclick = (e) => {
          e.stopPropagation();
          const center = getViewportCenter();
          if (!center || !isFinite(center.x) || !isFinite(center.y)) return;

          const oldScale = this.zoomScale;
          this.zoomScale = Math.max(0.4, this.zoomScale / 1.3);
          const newPanX = center.x - (center.x - this.panX) * (this.zoomScale / oldScale);
          const newPanY = center.y - (center.y - this.panY) * (this.zoomScale / oldScale);
          if (isFinite(newPanX) && isFinite(newPanY)) {
            this.panX = newPanX;
            this.panY = newPanY;
          }
          this.applyTransform();
        };
      }

      if (btnReset) {
        btnReset.onclick = (e) => {
          e.stopPropagation();
          this.zoomScale = 1.0;
          this.panX = 0;
          this.panY = 0;
          this.applyTransform();
        };
      }
    }
  }

  window.SVGRenderer = SVGRenderer;
})();
