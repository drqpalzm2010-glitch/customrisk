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
                path.setAttribute("class", "connection-line sea-route");
                this.transformGroup.appendChild(path);
              } else {
                // Standard straight line connection
                const line = document.createElementNS(svgNamespace, "line");
                line.setAttribute("x1", x1);
                line.setAttribute("y1", y1);
                line.setAttribute("x2", x2);
                line.setAttribute("y2", y2);
                line.setAttribute("class", "connection-line");
                this.transformGroup.appendChild(line);
              }
            }
          }
        });
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

        // Check Frontline Danger: If an adjacent hostile territory has >= 2x our armies
        if (gameState && gameState.territories && gameState.territories[terr.id]) {
          const myArmies = gameState.territories[terr.id].armies || 1;
          const myOwner = gameState.territories[terr.id].ownerId;
          const adjacents = this.getAdjacentTerritories(terr.id);
          let isThreatened = false;

          for (const adjId of adjacents) {
            const adjTerr = gameState.territories[adjId];
            if (adjTerr && adjTerr.ownerId !== myOwner && adjTerr.ownerId !== 'dummy') {
              // Check if formal alliance exists
              let isAllied = false;
              if (gameState.pacts) {
                isAllied = gameState.pacts.some(p => p.type === 'alliance' && ((p.playerA === myOwner && p.playerB === adjTerr.ownerId) || (p.playerA === adjTerr.ownerId && p.playerB === myOwner)));
              }
              if (!isAllied && adjTerr.armies >= myArmies * 2 && adjTerr.armies >= 4) {
                isThreatened = true;
                break;
              }
            }
          }

          if (isThreatened) {
            polygon.classList.add('danger-frontline');
          }
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

    // Artillery / Cannon Shelling Visual Effect on Target
    triggerCombatArtillery(sourceCenter, targetCenter, isConquest = false) {
      if (!this.transformGroup || !targetCenter) return;
      const [tx, ty] = targetCenter;

      // Create animated burst ripple
      const burstGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      burstGroup.setAttribute("class", "artillery-burst-effect");
      burstGroup.style.pointerEvents = "none";

      const circle1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle1.setAttribute("cx", tx);
      circle1.setAttribute("cy", ty);
      circle1.setAttribute("r", "10");
      circle1.setAttribute("fill", "none");
      circle1.setAttribute("stroke", "#ff7700");
      circle1.setAttribute("stroke-width", "3");
      circle1.setAttribute("class", "cannon-shockwave");
      burstGroup.appendChild(circle1);

      const flash = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      flash.setAttribute("cx", tx);
      flash.setAttribute("cy", ty);
      flash.setAttribute("r", isConquest ? "35" : "22");
      flash.setAttribute("fill", isConquest ? "#00ffcc" : "#ff3b30");
      flash.setAttribute("fill-opacity", "0.6");
      flash.setAttribute("class", "cannon-flash");
      burstGroup.appendChild(flash);

      this.transformGroup.appendChild(burstGroup);

      setTimeout(() => {
        burstGroup.remove();
      }, 1200);
    }

    // Brief Conquest Flash Ripple
    triggerConquestShockwave(targetCenter, conquerorColor = '#00e5ff') {
      if (!this.transformGroup || !targetCenter) return;
      const [tx, ty] = targetCenter;

      const conquestGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
      conquestGroup.style.pointerEvents = "none";

      const ripple = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ripple.setAttribute("cx", tx);
      ripple.setAttribute("cy", ty);
      ripple.setAttribute("r", "15");
      ripple.setAttribute("fill", "none");
      ripple.setAttribute("stroke", conquerorColor);
      ripple.setAttribute("stroke-width", "4");
      ripple.setAttribute("class", "conquest-ripple");
      conquestGroup.appendChild(ripple);

      this.transformGroup.appendChild(conquestGroup);

      setTimeout(() => {
        conquestGroup.remove();
      }, 1400);
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
            // Create a glowing clone on the overlay group
            if (t.points && t.points.length > 0) {
              const highlightClone = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
              highlightClone.setAttribute("points", t.points.map(p => p.join(',')).join(' '));
              highlightClone.setAttribute("fill", contColor);
              highlightClone.setAttribute("fill-opacity", "0.4");
              highlightClone.setAttribute("stroke", "#ffffff");
              highlightClone.setAttribute("stroke-width", "4.5");
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
