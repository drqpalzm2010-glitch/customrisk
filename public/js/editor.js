(function() {

  class MapEditor {
    constructor() {
      this.mapData = {
        mapName: 'Custom Map',
        width: 1200,
        height: 800,
        referenceImage: '',
        imageOpacity: 0.5,
        territories: [],
        connections: [],
        continents: [],
        isScenario: false,
        scenarioSettings: {
          capitalRush: false,
          defaultDummyArmies: 1
        },
        nations: []
      };

      this.editorMode = 'geography'; // 'geography' | 'scenario'
      this.activeTool = 'draw-territory'; // 'draw-territory' | 'draw-connection' | 'draw-sea' | 'edit-nodes'
      this.currentPolygonPoints = [];
      this.selectedTerritoryId = null;
      this.selectedFirstConnectionId = null;
      this.snapEnabled = true;

      // Label dragging states
      this.draggedLabelTerritoryId = null;

      // DOM Elements
      this.canvasContainer = document.getElementById('editor-canvas-container');
      this.sidebarRight = document.getElementById('editor-territory-sidebar');
      this.txtTerritoryName = document.getElementById('edit-territory-name');
      this.selectTerritoryContinent = document.getElementById('edit-territory-continent');
      this.btnDeleteTerritory = document.getElementById('btn-delete-territory');
      this.btnCloseRightSidebar = document.getElementById('btn-close-territory-sidebar');

      // Bind events
      this.initUI();
    }

    initUI() {
      // Editor Mode Tab Switcher
      const tabGeo = document.getElementById('tab-editor-geography');
      const tabScen = document.getElementById('tab-editor-scenario');
      const panelGeo = document.getElementById('panel-editor-geography');
      const panelScen = document.getElementById('panel-editor-scenario');

      if (tabGeo && tabScen) {
        tabGeo.addEventListener('click', () => {
          tabGeo.classList.add('active', 'primary-btn');
          tabGeo.classList.remove('outline-btn');
          tabScen.classList.remove('active', 'primary-btn');
          tabScen.classList.add('outline-btn');
          panelGeo.style.display = 'block';
          panelScen.style.display = 'none';
          this.editorMode = 'geography';
          this.closeRightSidebar();
          this.redraw();
        });

        tabScen.addEventListener('click', () => {
          tabScen.classList.add('active', 'primary-btn');
          tabScen.classList.remove('outline-btn');
          tabGeo.classList.remove('active', 'primary-btn');
          tabGeo.classList.add('outline-btn');
          panelGeo.style.display = 'none';
          panelScen.style.display = 'block';
          this.editorMode = 'scenario';
          this.closeRightSidebar();
          this.renderNationsList();
          this.redraw();
        });
      }

      // Scenario Settings inputs
      const chkIsScenario = document.getElementById('chk-editor-is-scenario');
      if (chkIsScenario) {
        chkIsScenario.addEventListener('change', (e) => {
          this.mapData.isScenario = e.target.checked;
          this.redraw();
        });
      }

      const chkCapitalRush = document.getElementById('chk-editor-capital-rush');
      if (chkCapitalRush) {
        chkCapitalRush.addEventListener('change', (e) => {
          this.mapData.scenarioSettings = this.mapData.scenarioSettings || {};
          this.mapData.scenarioSettings.capitalRush = e.target.checked;
          this.redraw();
        });
      }

      const inputDummyArmies = document.getElementById('input-editor-dummy-armies');
      if (inputDummyArmies) {
        inputDummyArmies.addEventListener('change', (e) => {
          this.mapData.scenarioSettings = this.mapData.scenarioSettings || {};
          this.mapData.scenarioSettings.defaultDummyArmies = parseInt(e.target.value) || 1;
        });
      }

      // Add Nation button
      const btnAddNation = document.getElementById('btn-editor-add-nation');
      if (btnAddNation) {
        btnAddNation.addEventListener('click', () => {
          this.addNation();
        });
      }

      // Add Alliance button
      const btnAddAlliance = document.getElementById('btn-editor-add-alliance');
      if (btnAddAlliance) {
        btnAddAlliance.addEventListener('click', () => {
          this.addAlliance();
        });
      }

      // Dimensions
      document.getElementById('editor-map-name').addEventListener('input', (e) => {
        this.mapData.mapName = e.target.value;
      });
      document.getElementById('editor-map-width').addEventListener('change', (e) => {
        this.mapData.width = parseInt(e.target.value) || 1200;
        this.redraw();
      });
      document.getElementById('editor-map-height').addEventListener('change', (e) => {
        this.mapData.height = parseInt(e.target.value) || 800;
        this.redraw();
      });

      // Snap checkbox
      document.getElementById('editor-snap-checkbox').addEventListener('change', (e) => {
        this.snapEnabled = e.target.checked;
      });

      // Tool selection
      const tools = ['draw-territory', 'draw-connection', 'draw-sea', 'edit-nodes'];
      tools.forEach(tool => {
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) {
          btn.addEventListener('click', () => {
            tools.forEach(t => document.getElementById(`tool-${t}`).classList.remove('active'));
            btn.classList.add('active');
            this.activeTool = tool;
            document.getElementById('editor-active-tool-label').textContent = btn.textContent.trim();
            this.updateHelperText();
            this.cancelCurrentDrawing();
            this.selectedFirstConnectionId = null;
            this.redraw();
          });
        }
      });

      // Continents Add button
      document.getElementById('btn-editor-add-continent').addEventListener('click', () => {
        this.addContinent();
      });

      // Image upload
      document.getElementById('editor-image-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.mapData.referenceImage = event.target.result;
            document.getElementById('opacity-slider-container').style.display = 'block';
            this.redraw();
          };
          reader.readAsDataURL(file);
        }
      });

      // Opacity
      document.getElementById('editor-image-opacity').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        this.mapData.imageOpacity = val;
        document.getElementById('ref-opacity-val').textContent = `${e.target.value}%`;
        const layer = document.getElementById('editor-ref-image-layer');
        if (layer) {
          layer.setAttribute('opacity', val.toString());
        }
      });

      // Remove ref image
      document.getElementById('btn-remove-ref-image').addEventListener('click', () => {
        this.mapData.referenceImage = '';
        document.getElementById('opacity-slider-container').style.display = 'none';
        this.redraw();
      });

      // Delete Territory
      this.btnDeleteTerritory.addEventListener('click', () => {
        if (this.selectedTerritoryId) {
          this.deleteTerritory(this.selectedTerritoryId);
          this.closeRightSidebar();
        }
      });

      // Close territory sidebar
      this.btnCloseRightSidebar.addEventListener('click', () => {
        this.closeRightSidebar();
      });

      this.txtTerritoryName.addEventListener('input', (e) => {
        if (this.selectedTerritoryId) {
          const terr = this.mapData.territories.find(t => t.id === this.selectedTerritoryId);
          if (terr) {
            terr.name = e.target.value;
            this.redraw();
          }
        }
      });

      this.selectTerritoryContinent.addEventListener('change', (e) => {
        if (this.selectedTerritoryId) {
          const terrId = this.selectedTerritoryId;
          const contId = e.target.value;
          
          this.mapData.continents.forEach(c => {
            c.territoryIds = c.territoryIds.filter(tid => tid !== terrId);
          });

          if (contId) {
            const cont = this.mapData.continents.find(c => c.id === contId);
            if (cont) {
              cont.territoryIds.push(terrId);
            }
          }
          this.redraw();
        }
      });

      // Territory Scenario Inspector Inputs
      const selectOwner = document.getElementById('edit-territory-owner');
      if (selectOwner) {
        selectOwner.addEventListener('change', (e) => {
          if (this.selectedTerritoryId) {
            const terr = this.mapData.territories.find(t => t.id === this.selectedTerritoryId);
            if (terr) {
              terr.startingOwnerId = e.target.value;
              this.renderNationsList();
              this.redraw();
            }
          }
        });
      }

      const inputArmies = document.getElementById('edit-territory-armies');
      if (inputArmies) {
        inputArmies.addEventListener('change', (e) => {
          if (this.selectedTerritoryId) {
            const terr = this.mapData.territories.find(t => t.id === this.selectedTerritoryId);
            if (terr) {
              terr.startingArmies = parseInt(e.target.value) || 1;
              this.renderNationsList();
              this.redraw();
            }
          }
        });
      }

      const chkIsCapital = document.getElementById('edit-territory-is-capital');
      if (chkIsCapital) {
        chkIsCapital.addEventListener('change', (e) => {
          if (this.selectedTerritoryId) {
            const terr = this.mapData.territories.find(t => t.id === this.selectedTerritoryId);
            if (!terr) return;
            const ownerId = terr.startingOwnerId;
            if (!ownerId || ownerId === 'dummy') {
              alert('Please assign this territory to a custom Scenario Nation before marking it as a capital.');
              chkIsCapital.checked = false;
              return;
            }
            const nation = this.mapData.nations.find(n => n.id === ownerId);
            if (nation) {
              if (e.target.checked) {
                nation.capitalTerritoryId = terr.id;
              } else if (nation.capitalTerritoryId === terr.id) {
                nation.capitalTerritoryId = null;
              }
              this.redraw();
            }
          }
        });
      }

      // Export
      document.getElementById('btn-editor-export').addEventListener('click', () => {
        this.exportMapJSON();
      });

      // Export Stats to Clipboard
      const btnExportStats = document.getElementById('btn-editor-export-stats');
      if (btnExportStats) {
        btnExportStats.addEventListener('click', () => {
          this.exportMapStatsToClipboard();
        });
      }

      // Import
      document.getElementById('editor-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result);
              this.loadMapData(data);
            } catch (err) {
              alert('Invalid JSON map data.');
            }
          };
          reader.readAsText(file);
        }
      });

      // Exit
      document.getElementById('btn-editor-exit').addEventListener('click', () => {
        if (confirm('Are you sure you want to exit the editor? Any unsaved progress will be lost.')) {
          window.MainController.showScreen('menu');
        }
      });
    }

    startEditor() {
      // Clear and draw initial canvas
      this.renderer = null;
      this.mapData = {
        mapName: 'Custom Map',
        width: 1200,
        height: 800,
        referenceImage: '',
        imageOpacity: 0.5,
        territories: [],
        connections: [],
        continents: [],
        isScenario: false,
        scenarioSettings: {
          capitalRush: false,
          defaultDummyArmies: 1
        },
        nations: []
      };
      
      // Update DOM values
      document.getElementById('editor-map-name').value = this.mapData.mapName;
      document.getElementById('editor-map-width').value = this.mapData.width;
      document.getElementById('editor-map-height').value = this.mapData.height;
      document.getElementById('opacity-slider-container').style.display = 'none';
      
      const chkIsScen = document.getElementById('chk-editor-is-scenario');
      if (chkIsScen) chkIsScen.checked = false;

      const chkCap = document.getElementById('chk-editor-capital-rush');
      if (chkCap) chkCap.checked = false;

      const inputDummy = document.getElementById('input-editor-dummy-armies');
      if (inputDummy) inputDummy.value = 1;

      this.currentPolygonPoints = [];
      this.selectedTerritoryId = null;
      this.selectedFirstConnectionId = null;
      this.closeRightSidebar();
      this.renderContinentsList();
      this.renderNationsList();
      this.redraw();
    }

    redraw() {
      // Initialize SVGRenderer for Editor if not already active
      if (!this.renderer) {
        this.renderer = new window.SVGRenderer('editor-canvas-container', {
          isEditor: true,
          onTerritoryClick: (tid, e) => this.handleTerritoryClick(tid, e),
          onLabelDragStart: (tid, e) => this.handleLabelDragStart(tid, e)
        });
      }
      this.renderer.activeTool = this.activeTool;
      this.renderer.render(this.mapData);

      // Save reference to renderer on SVG element for click suppression during panning
      if (this.renderer.svg) {
        this.renderer.svg.__renderer = this.renderer;
      }

      // Draw custom visual overlays on top of SVG (like active drawing lines or vertices)
      this.drawEditorOverlays(this.renderer.svg);
    }

    drawEditorOverlays(svgElement) {
      const svgNamespace = "http://www.w3.org/2000/svg";
      const groupElement = svgElement.querySelector('#map-transform-group') || svgElement;

      // 1. Draw points for the current polygon being drawn
      if (this.currentPolygonPoints.length > 0) {
        // Draw lines connecting points
        for (let i = 0; i < this.currentPolygonPoints.length - 1; i++) {
          const line = document.createElementNS(svgNamespace, "line");
          line.setAttribute("x1", this.currentPolygonPoints[i][0]);
          line.setAttribute("y1", this.currentPolygonPoints[i][1]);
          line.setAttribute("x2", this.currentPolygonPoints[i+1][0]);
          line.setAttribute("y2", this.currentPolygonPoints[i+1][1]);
          line.setAttribute("stroke", "#00e5ff");
          line.setAttribute("stroke-width", "2");
          groupElement.appendChild(line);
        }

        // Draw vertices
        this.currentPolygonPoints.forEach((p, idx) => {
          const circle = document.createElementNS(svgNamespace, "circle");
          circle.setAttribute("cx", p[0]);
          circle.setAttribute("cy", p[1]);
          circle.setAttribute("r", idx === 0 ? "7" : "5"); // Highlight first vertex to close
          circle.setAttribute("fill", idx === 0 ? "#ffcc00" : "#00e5ff");
          circle.setAttribute("stroke", "#000");
          circle.setAttribute("stroke-width", "1");
          circle.style.cursor = idx === 0 ? 'pointer' : 'default';
          groupElement.appendChild(circle);
        });
      }

      // 2. Highlight selected first node in connection mode
      if (this.selectedFirstConnectionId) {
        const terr = this.mapData.territories.find(t => t.id === this.selectedFirstConnectionId);
        if (terr && terr.center) {
          const glow = document.createElementNS(svgNamespace, "circle");
          glow.setAttribute("cx", terr.center[0]);
          glow.setAttribute("cy", terr.center[1]);
          glow.setAttribute("r", "20");
          glow.setAttribute("fill", "none");
          glow.setAttribute("stroke", this.activeTool === 'draw-sea' ? "#00bcd4" : "#a855f7");
          glow.setAttribute("stroke-width", "3");
          glow.setAttribute("stroke-dasharray", "4 4");
          groupElement.appendChild(glow);
        }
      }

      // Add mouse click listener to SVG container for drawing
      svgElement.addEventListener('click', (e) => {
        // If we dragged/panned the map, do not add a vertex
        if (svgElement.__renderer && svgElement.__renderer.hasDragged) return;

        if (this.activeTool === 'draw-territory') {
          // Get click location relative to SVG transformed group element using SVG matrix transform
          const pt = svgElement.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const localPt = pt.matrixTransform(groupElement.getScreenCTM().inverse());
          let clickX = localPt.x;
          let clickY = localPt.y;

          // Check snapping
          if (this.snapEnabled) {
            const snapped = this.getSnappedCoordinate(clickX, clickY);
            clickX = snapped.x;
            clickY = snapped.y;
          }

          this.handleDrawingClick(clickX, clickY);
        }
      });

      // Hook dragging events on SVG
      if (this.activeTool === 'edit-nodes') {
        svgElement.addEventListener('mousemove', (e) => this.handleLabelDragMove(e, svgElement));
        svgElement.addEventListener('mouseup', () => this.handleLabelDragEnd());
        svgElement.addEventListener('mouseleave', () => this.handleLabelDragEnd());
      }
    }

    getSnappedCoordinate(x, y) {
      const snapRadius = 12;
      
      // 1. Try to snap to existing vertices first (highest priority)
      for (const terr of this.mapData.territories) {
        for (const p of terr.points) {
          const dx = p[0] - x;
          const dy = p[1] - y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= snapRadius) {
            return { x: p[0], y: p[1] }; // snap to point
          }
        }
      }

      // 2. Try to snap to the closest edge segment of any territory (failsafe edge snapping)
      let closestEdgePt = null;
      let minEdgeDist = Infinity;

      for (const terr of this.mapData.territories) {
        const pts = terr.points;
        if (pts.length < 2) continue;

        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];

          // Compute closest point on segment p1-p2 to (x, y)
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;

          // Projection parameter t
          let t = ((x - p1[0]) * dx + (y - p1[1]) * dy) / lenSq;
          t = Math.max(0, Math.min(1, t)); // Clamp to segment boundaries

          const cx = p1[0] + t * dx;
          const cy = p1[1] + t * dy;

          const distDx = cx - x;
          const distDy = cy - y;
          const dist = Math.sqrt(distDx * distDx + distDy * distDy);

          if (dist <= snapRadius && dist < minEdgeDist) {
            minEdgeDist = dist;
            closestEdgePt = { x: cx, y: cy };
          }
        }
      }

      if (closestEdgePt) {
        return closestEdgePt;
      }

      return { x, y };
    }

    handleDrawingClick(x, y) {
      // If click is close to first point, close polygon
      if (this.currentPolygonPoints.length >= 3) {
        const first = this.currentPolygonPoints[0];
        const dx = first[0] - x;
        const dy = first[1] - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= 15) {
          this.closePolygon();
          return;
        }
      }

      this.currentPolygonPoints.push([x, y]);
      this.redraw();
    }

    closePolygon() {
      if (this.currentPolygonPoints.length < 3) {
        alert('Polygons must have at least 3 vertices.');
        return;
      }

      const id = `terr_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate visual center of polygon (average coordinates)
      let sumX = 0, sumY = 0;
      this.currentPolygonPoints.forEach(p => {
        sumX += p[0];
        sumY += p[1];
      });
      const center = [
        Math.round(sumX / this.currentPolygonPoints.length),
        Math.round(sumY / this.currentPolygonPoints.length)
      ];

      const newTerritory = {
        id,
        name: `Territory ${this.mapData.territories.length + 1}`,
        points: [...this.currentPolygonPoints],
        center
      };

      this.mapData.territories.push(newTerritory);
      this.currentPolygonPoints = [];
      this.redraw();
    }

    cancelCurrentDrawing() {
      this.currentPolygonPoints = [];
    }

    handleTerritoryClick(territoryId, event) {
      event.stopPropagation();

      if (this.activeTool === 'draw-territory') {
        // Open right sidebar to edit details
        this.selectedTerritoryId = territoryId;
        this.openRightSidebar(territoryId);
      } else if (this.activeTool === 'draw-connection' || this.activeTool === 'draw-sea') {
        if (!this.selectedFirstConnectionId) {
          this.selectedFirstConnectionId = territoryId;
          this.redraw();
        } else {
          if (this.selectedFirstConnectionId !== territoryId) {
            this.toggleConnection(this.selectedFirstConnectionId, territoryId, this.activeTool === 'draw-sea');
          }
          this.selectedFirstConnectionId = null;
          this.redraw();
        }
      }
    }

    toggleConnection(idA, idB, isSea) {
      // Find if connection already exists
      const existingIndex = this.mapData.connections.findIndex(conn => {
        if (Array.isArray(conn)) {
          return (conn[0] === idA && conn[1] === idB) || (conn[0] === idB && conn[1] === idA);
        } else if (conn && typeof conn === 'object') {
          return (conn.from === idA && conn.to === idB) || (conn.from === idB && conn.to === idA);
        }
        return false;
      });

      if (existingIndex !== -1) {
        // Remove connection
        this.mapData.connections.splice(existingIndex, 1);
      } else {
        // Add connection
        if (isSea) {
          this.mapData.connections.push({
            from: idA,
            to: idB,
            type: 'sea'
          });
        } else {
          this.mapData.connections.push([idA, idB]);
        }
      }
    }

    // Label Dragging handlers
    handleLabelDragStart(territoryId, event) {
      if (this.activeTool !== 'edit-nodes') return;
      event.preventDefault();
      this.draggedLabelTerritoryId = territoryId;
    }

    handleLabelDragMove(event, svgElement) {
      if (!this.draggedLabelTerritoryId) return;

      const groupElement = svgElement.querySelector('#map-transform-group') || svgElement;
      const pt = svgElement.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const localPt = pt.matrixTransform(groupElement.getScreenCTM().inverse());
      const x = localPt.x;
      const y = localPt.y;

      const terr = this.mapData.territories.find(t => t.id === this.draggedLabelTerritoryId);
      if (terr) {
        terr.center = [Math.round(x), Math.round(y)];
        // Draw live update
        const g = document.getElementById(`badge-group-${terr.id}`);
        if (g) {
          const circle = g.querySelector('.army-badge-bg');
          const text = g.querySelector('.army-badge-text');
          const nameText = g.querySelectorAll('text')[1];
          if (circle) {
            circle.setAttribute('cx', terr.center[0]);
            circle.setAttribute('cy', terr.center[1]);
          }
          if (text) {
            text.setAttribute('x', terr.center[0]);
            text.setAttribute('y', terr.center[1] + 5);
          }
          if (nameText) {
            nameText.setAttribute('x', terr.center[0]);
            nameText.setAttribute('y', terr.center[1] - 22);
          }
        }
      }
    }

    handleLabelDragEnd() {
      if (this.draggedLabelTerritoryId) {
        this.draggedLabelTerritoryId = null;
        this.redraw();
      }
    }

    // Right Sidebar methods
    openRightSidebar(territoryId) {
      const terr = this.mapData.territories.find(t => t.id === territoryId);
      if (!terr) return;

      this.sidebarRight.style.display = 'block';
      this.txtTerritoryName.value = terr.name;

      // Populate continents dropdown
      this.selectTerritoryContinent.innerHTML = '<option value="">-- None --</option>';
      this.mapData.continents.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        
        if (c.territoryIds.includes(territoryId)) {
          option.selected = true;
        }
        this.selectTerritoryContinent.appendChild(option);
      });

      // Scenario Inspector Panel in Right Sidebar
      const scenarioSection = document.getElementById('edit-territory-scenario-section');
      if (scenarioSection) {
        if (this.editorMode === 'scenario' || this.mapData.isScenario) {
          scenarioSection.style.display = 'block';
          
          // Populate owner dropdown
          const selectOwner = document.getElementById('edit-territory-owner');
          selectOwner.innerHTML = '<option value="dummy">Dummy / Neutral Nation</option>';
          (this.mapData.nations || []).forEach(n => {
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = n.name;
            if (terr.startingOwnerId === n.id) opt.selected = true;
            selectOwner.appendChild(opt);
          });
          if (!terr.startingOwnerId || terr.startingOwnerId === 'dummy') {
            selectOwner.value = 'dummy';
          }

          // Starting Armies
          const inputArmies = document.getElementById('edit-territory-armies');
          const defaultDummy = (this.mapData.scenarioSettings && this.mapData.scenarioSettings.defaultDummyArmies) || 1;
          inputArmies.value = terr.startingArmies !== undefined ? terr.startingArmies : defaultDummy;

          // Is Capital Checkbox
          const chkCapital = document.getElementById('edit-territory-is-capital');
          if (chkCapital) {
            const nation = (this.mapData.nations || []).find(n => n.id === terr.startingOwnerId);
            chkCapital.checked = nation && nation.capitalTerritoryId === terr.id;
          }
        } else {
          scenarioSection.style.display = 'none';
        }
      }

      // Highlight selected polygon on SVG
      document.querySelectorAll('.territory-poly').forEach(p => p.classList.remove('selected'));
      const poly = document.getElementById(`poly-${territoryId}`);
      if (poly) poly.classList.add('selected');
    }

    closeRightSidebar() {
      this.sidebarRight.style.display = 'none';
      this.selectedTerritoryId = null;
      document.querySelectorAll('.territory-poly').forEach(p => p.classList.remove('selected'));
    }

    deleteTerritory(territoryId) {
      // Remove territory
      this.mapData.territories = this.mapData.territories.filter(t => t.id !== territoryId);

      // Remove connections
      this.mapData.connections = this.mapData.connections.filter(conn => {
        if (Array.isArray(conn)) {
          return conn[0] !== territoryId && conn[1] !== territoryId;
        } else if (conn && typeof conn === 'object') {
          return conn.from !== territoryId && conn.to !== territoryId;
        }
        return true;
      });

      // Remove from continents
      this.mapData.continents.forEach(c => {
        c.territoryIds = c.territoryIds.filter(tid => tid !== territoryId);
      });

      // Remove capital reference if any
      (this.mapData.nations || []).forEach(n => {
        if (n.capitalTerritoryId === territoryId) n.capitalTerritoryId = null;
      });

      this.redraw();
    }

    // Continent Management
    addContinent() {
      const id = `cont_${Math.random().toString(36).substr(2, 9)}`;
      const newContinent = {
        id,
        name: `Continent ${this.mapData.continents.length + 1}`,
        bonus: 3,
        color: this.getRandomColor(),
        territoryIds: []
      };

      this.mapData.continents.push(newContinent);
      this.renderContinentsList();
      this.redraw();
    }

    renderContinentsList() {
      const container = document.getElementById('editor-continents-list');
      container.innerHTML = '';

      if (this.mapData.continents.length === 0) {
        container.innerHTML = '<p class="empty-state">No continents defined.</p>';
        return;
      }

      this.mapData.continents.forEach(c => {
        const item = document.createElement('div');
        item.setAttribute('class', 'continent-editor-item');

        item.innerHTML = `
          <input type="color" value="${c.color}" data-id="${c.id}">
          <input type="text" value="${c.name}" data-id="${c.id}" class="cont-name-input">
          <input type="number" value="${c.bonus}" data-id="${c.id}" class="cont-bonus-input" min="1" max="20" title="Reinforcement Bonus">
          <button class="btn-delete-cont" data-id="${c.id}" title="Delete Continent"><i class="fa-solid fa-trash-can"></i></button>
        `;

        item.querySelector('input[type="color"]').addEventListener('change', (e) => {
          c.color = e.target.value;
          this.redraw();
        });

        item.querySelector('.cont-name-input').addEventListener('input', (e) => {
          c.name = e.target.value;
        });

        item.querySelector('.cont-bonus-input').addEventListener('change', (e) => {
          c.bonus = parseInt(e.target.value) || 3;
        });

        item.querySelector('.btn-delete-cont').addEventListener('click', () => {
          this.deleteContinent(c.id);
        });

        container.appendChild(item);
      });
    }

    deleteContinent(continentId) {
      this.mapData.continents = this.mapData.continents.filter(c => c.id !== continentId);
      this.renderContinentsList();
      this.redraw();
    }

    // Scenario Nations Management
    addNation() {
      this.mapData.nations = this.mapData.nations || [];
      const id = `nation_${Math.random().toString(36).substr(2, 9)}`;
      const presetNames = ['Atheria', 'Solaria', 'Vesperia', 'Ironhold', 'Verdantia', 'Obsidia', 'Zephyria', 'Borealis'];
      const name = presetNames[this.mapData.nations.length % presetNames.length] || `Nation ${this.mapData.nations.length + 1}`;
      
      const newNation = {
        id,
        name,
        color: this.getRandomColor(),
        description: `The proud people of ${name}, defenders of the realm.`,
        capitalTerritoryId: null
      };

      this.mapData.nations.push(newNation);
      this.mapData.isScenario = true;
      const chkIsScen = document.getElementById('chk-editor-is-scenario');
      if (chkIsScen) chkIsScen.checked = true;

      this.renderNationsList();
      this.redraw();
    }

    renderNationsList() {
      const container = document.getElementById('editor-nations-list');
      if (!container) return;
      container.innerHTML = '';

      this.mapData.nations = this.mapData.nations || [];

      if (this.mapData.nations.length === 0) {
        container.innerHTML = '<p class="empty-state">No scenario nations added yet. Click "+ Add Nation" to create one.</p>';
        return;
      }

      // Render Neutral / Dummy Defenders summary header
      const defaultDummy = (this.mapData.scenarioSettings && this.mapData.scenarioSettings.defaultDummyArmies) || 1;
      const dummyTerritories = (this.mapData.territories || []).filter(t => !t.startingOwnerId || t.startingOwnerId === 'dummy');
      const dummyArmies = dummyTerritories.reduce((sum, t) => sum + (t.startingArmies !== undefined ? t.startingArmies : defaultDummy), 0);

      const summaryHeader = document.createElement('div');
      summaryHeader.style.cssText = "background: rgba(71, 85, 105, 0.25); border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 6px; padding: 8px 10px; margin-bottom: 12px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;";
      summaryHeader.innerHTML = `
        <span style="color: #cbd5e1; font-weight: 600;"><i class="fa-solid fa-shield-halved" style="color: #94a3b8; margin-right: 4px;"></i> Neutral Defenders</span>
        <span style="color: #94a3b8;">Territories: <strong style="color: #f8fafc;">${dummyTerritories.length}</strong> | Armies: <strong style="color: #f8fafc;">${dummyArmies}</strong></span>
      `;
      container.appendChild(summaryHeader);

      this.mapData.nations.forEach((n, idx) => {
        n.turnOrder = idx + 1;
        const item = document.createElement('div');
        item.style.cssText = "background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; margin-bottom: 10px;";

        const capitalTerr = (this.mapData.territories || []).find(t => t.id === n.capitalTerritoryId);
        const capitalLabel = capitalTerr ? capitalTerr.name : 'Not set';

        // Compute starting nation statistics
        const ownedTerritories = (this.mapData.territories || []).filter(t => t.startingOwnerId === n.id);
        const startingTerritoriesCount = ownedTerritories.length;
        const startingArmiesCount = ownedTerritories.reduce((sum, t) => sum + (t.startingArmies !== undefined ? t.startingArmies : 1), 0);

        // Compute continent bonuses
        let continentBonusCount = 0;
        const controlledContinents = [];
        (this.mapData.continents || []).forEach(c => {
          if (c.territoryIds && c.territoryIds.length > 0) {
            const ownsAll = c.territoryIds.every(tid => {
              const terr = (this.mapData.territories || []).find(t => t.id === tid);
              return terr && terr.startingOwnerId === n.id;
            });
            if (ownsAll) {
              const bonusVal = (c.bonus || 0);
              continentBonusCount += bonusVal;
              controlledContinents.push(`${c.name} (+${bonusVal})`);
            }
          }
        });

        const baseTerritoryIncome = Math.max(3, Math.floor(startingTerritoriesCount / 3));
        const totalTurnIncome = baseTerritoryIncome + continentBonusCount;

        item.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <select class="nation-turn-order-select" style="background: rgba(0, 229, 255, 0.15); border: 1px solid var(--primary); color: #fff; border-radius: 4px; padding: 3px 6px; font-size: 11px; font-weight: 700; cursor: pointer;" title="Set Turn Order Position">
                ${this.mapData.nations.map((_, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>Turn #${i + 1}</option>`).join('')}
              </select>
              <input type="color" value="${n.color}" class="nation-color-input" style="border: none; background: none; width: 24px; height: 24px; cursor: pointer; padding: 0;">
              <input type="text" value="${n.name}" class="nation-name-input" style="background: rgba(0,0,0,0.5); border: 1px solid var(--border-glass); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 13px; font-weight: 600; width: 125px;">
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm outline-btn btn-nation-up" ${idx === 0 ? 'disabled' : ''} title="Move Up in Turn Order"><i class="fa-solid fa-arrow-up"></i></button>
              <button class="btn btn-sm outline-btn btn-nation-down" ${idx === this.mapData.nations.length - 1 ? 'disabled' : ''} title="Move Down in Turn Order"><i class="fa-solid fa-arrow-down"></i></button>
              <button class="btn btn-sm danger-btn btn-nation-delete" title="Delete Nation"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
          <div style="margin-bottom: 6px;">
            <textarea class="nation-desc-input" style="width: 100%; height: 40px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-glass); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; resize: none;" placeholder="Enter nation backstory / description...">${n.description || ''}</textarea>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span><i class="fa-solid fa-crown" style="color: #fbbf24;"></i> Capital: <strong style="color: #fff;">${capitalLabel}</strong></span>
            <span style="color: rgba(255,255,255,0.7); font-size: 10px;"><i class="fa-solid fa-list-ol" style="color: var(--primary);"></i> Position: <strong>#${idx + 1}</strong></span>
          </div>

          <!-- Live Starting Statistics & Turn 1 Draft Income -->
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span style="color: #cbd5e1;"><i class="fa-solid fa-person-military-pointing" style="color: #38bdf8; margin-right: 4px;"></i> Armies: <strong style="color: #38bdf8; font-size: 12px;">${startingArmiesCount}</strong></span>
              <span style="color: #cbd5e1;"><i class="fa-solid fa-earth-americas" style="color: #4ade80; margin-right: 4px;"></i> Terrs: <strong style="color: #4ade80; font-size: 12px;">${startingTerritoriesCount}</strong></span>
              <span style="color: #facc15;"><i class="fa-solid fa-plus-circle" style="color: #facc15; margin-right: 4px;"></i> Draft/Turn: <strong style="color: #facc15; font-size: 12px;">+${totalTurnIncome}</strong></span>
            </div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.6); display: flex; justify-content: space-between; margin-top: 2px;">
              <span>Base Income: +${baseTerritoryIncome}</span>
              <span>Cont. Bonus: <strong style="color: ${continentBonusCount > 0 ? '#facc15' : 'rgba(255,255,255,0.6)'};">+${continentBonusCount}</strong> ${controlledContinents.length > 0 ? `<span style="font-size: 9px; color: #a3e635;">(${controlledContinents.join(', ')})</span>` : ''}</span>
            </div>
          </div>
        `;

        item.querySelector('.nation-turn-order-select').addEventListener('change', (e) => {
          const targetIndex = parseInt(e.target.value);
          this.moveNationToPosition(idx, targetIndex);
        });

        item.querySelector('.nation-color-input').addEventListener('change', (e) => {
          n.color = e.target.value;
          this.redraw();
        });

        item.querySelector('.nation-name-input').addEventListener('input', (e) => {
          n.name = e.target.value;
        });

        item.querySelector('.nation-desc-input').addEventListener('input', (e) => {
          n.description = e.target.value;
        });

        item.querySelector('.btn-nation-up').addEventListener('click', () => {
          this.moveNationOrder(idx, -1);
        });

        item.querySelector('.btn-nation-down').addEventListener('click', () => {
          this.moveNationOrder(idx, 1);
        });

        item.querySelector('.btn-nation-delete').addEventListener('click', () => {
          this.deleteNation(n.id);
        });

        container.appendChild(item);
      });

      this.renderAlliancesList();
    }

    moveNationOrder(index, direction) {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= this.mapData.nations.length) return;
      const temp = this.mapData.nations[index];
      this.mapData.nations[index] = this.mapData.nations[targetIndex];
      this.mapData.nations[targetIndex] = temp;
      this.renderNationsList();
      this.redraw();
    }

    moveNationToPosition(oldIndex, newIndex) {
      if (newIndex < 0 || newIndex >= this.mapData.nations.length) return;
      if (oldIndex === newIndex) return;
      const nation = this.mapData.nations.splice(oldIndex, 1)[0];
      this.mapData.nations.splice(newIndex, 0, nation);
      this.renderNationsList();
      this.redraw();
    }

    deleteNation(nationId) {
      this.mapData.nations = (this.mapData.nations || []).filter(n => n.id !== nationId);
      // Reset territories owned by this nation back to dummy
      (this.mapData.territories || []).forEach(t => {
        if (t.startingOwnerId === nationId) {
          t.startingOwnerId = 'dummy';
        }
      });
      this.renderNationsList();
      this.renderAlliancesList();
      this.redraw();
    }

    // Scenario Premade Alliances Management
    addAlliance() {
      this.mapData.premadeAlliances = this.mapData.premadeAlliances || [];
      const nations = this.mapData.nations || [];
      if (nations.length < 2) {
        alert('You need at least 2 scenario nations to create a premade alliance.');
        return;
      }
      
      const n1 = nations[0].id;
      const n2 = nations[1].id;

      const exists = this.mapData.premadeAlliances.some(a => 
        (a.nationAId === n1 && a.nationBId === n2) || (a.nationAId === n2 && a.nationBId === n1)
      );

      if (!exists) {
        this.mapData.premadeAlliances.push({
          id: `alliance_${Math.random().toString(36).substr(2, 9)}`,
          nationAId: n1,
          nationBId: n2
        });
      }

      this.renderAlliancesList();
    }

    renderAlliancesList() {
      const container = document.getElementById('editor-alliances-list');
      if (!container) return;
      container.innerHTML = '';

      this.mapData.premadeAlliances = this.mapData.premadeAlliances || [];
      const nations = this.mapData.nations || [];

      if (this.mapData.premadeAlliances.length === 0) {
        container.innerHTML = '<p class="empty-state">No premade alliances added. Click "+ Add Alliance" to link nations.</p>';
        return;
      }

      this.mapData.premadeAlliances.forEach((alliance, idx) => {
        const div = document.createElement('div');
        div.style.cssText = "background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px; margin-bottom: 8px;";
        div.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="font-size: 11px; color: #4ade80;">Alliance #${idx + 1} (+10 AI Trust)</strong>
            <button class="btn btn-sm outline-btn btn-delete-alliance" data-id="${alliance.id}" style="color:#ef4444; padding: 2px 6px; font-size: 10px;" title="Delete Alliance">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <select class="select-alliance-nation-a" data-id="${alliance.id}" style="font-size: 11px; padding: 2px 4px; background: rgba(0,0,0,0.5); color:#fff; border-radius: 4px; border: 1px solid var(--border-glass); flex: 1;">
              ${nations.map(n => `<option value="${n.id}" ${n.id === alliance.nationAId ? 'selected' : ''}>${n.name}</option>`).join('')}
            </select>
            <span style="font-weight: bold; color: var(--primary); font-size: 12px;">🤝</span>
            <select class="select-alliance-nation-b" data-id="${alliance.id}" style="font-size: 11px; padding: 2px 4px; background: rgba(0,0,0,0.5); color:#fff; border-radius: 4px; border: 1px solid var(--border-glass); flex: 1;">
              ${nations.map(n => `<option value="${n.id}" ${n.id === alliance.nationBId ? 'selected' : ''}>${n.name}</option>`).join('')}
            </select>
          </div>
        `;
        container.appendChild(div);
      });

      container.querySelectorAll('.select-alliance-nation-a').forEach(sel => {
        sel.onchange = (e) => {
          const id = e.target.getAttribute('data-id');
          const item = this.mapData.premadeAlliances.find(a => a.id === id);
          if (item) item.nationAId = e.target.value;
        };
      });

      container.querySelectorAll('.select-alliance-nation-b').forEach(sel => {
        sel.onchange = (e) => {
          const id = e.target.getAttribute('data-id');
          const item = this.mapData.premadeAlliances.find(a => a.id === id);
          if (item) item.nationBId = e.target.value;
        };
      });

      container.querySelectorAll('.btn-delete-alliance').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          this.mapData.premadeAlliances = this.mapData.premadeAlliances.filter(a => a.id !== id);
          this.renderAlliancesList();
        };
      });
    }

    getRandomColor() {
      const colors = ['#00e5ff', '#ff3366', '#33ff66', '#ffcc00', '#ff00ff', '#a855f7', '#ff9900', '#00ff99'];
      return colors[Math.floor(Math.random() * colors.length)];
    }

    updateHelperText() {
      const helper = document.getElementById('editor-helper-text');
      if (this.activeTool === 'draw-territory') {
        helper.textContent = 'Click to place vertices. Double-click or click first point to close polygon.';
      } else if (this.activeTool === 'draw-connection') {
        helper.textContent = 'Click first territory, then click second territory to create/remove land link.';
      } else if (this.activeTool === 'draw-sea') {
        helper.textContent = 'Click first territory, then click second territory to toggle dashed sea route.';
      } else if (this.activeTool === 'edit-nodes') {
        helper.textContent = 'Click and drag the label dots to position the troop count badges.';
      }
    }

    // Export JSON
    exportMapJSON() {
      if (this.mapData.territories.length === 0) {
        alert('Please draw at least one territory before exporting.');
        return;
      }

      // Convert to clean JSON schema
      const exportData = {
        mapName: this.mapData.mapName || 'Custom Battleground',
        width: this.mapData.width || 1200,
        height: this.mapData.height || 800,
        referenceImage: this.mapData.referenceImage,
        imageOpacity: this.mapData.imageOpacity,
        isScenario: !!this.mapData.isScenario,
        scenarioSettings: this.mapData.scenarioSettings || { capitalRush: false, defaultDummyArmies: 1 },
        nations: (this.mapData.nations || []).map((n, idx) => ({
          id: n.id,
          name: n.name,
          color: n.color,
          description: n.description,
          capitalTerritoryId: n.capitalTerritoryId,
          turnOrder: n.turnOrder !== undefined ? n.turnOrder : idx + 1
        })),
        premadeAlliances: (this.mapData.premadeAlliances || []).map(a => ({
          id: a.id,
          nationAId: a.nationAId,
          nationBId: a.nationBId
        })),
        territories: this.mapData.territories.map(t => ({
          id: t.id,
          name: t.name,
          points: t.points,
          center: t.center,
          startingOwnerId: t.startingOwnerId || 'dummy',
          startingArmies: t.startingArmies !== undefined ? t.startingArmies : ((this.mapData.scenarioSettings && this.mapData.scenarioSettings.defaultDummyArmies) || 1)
        })),
        connections: this.mapData.connections,
        continents: this.mapData.continents.map(c => ({
          id: c.id,
          name: c.name,
          bonus: c.bonus,
          color: c.color,
          territoryIds: c.territoryIds
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      
      const filename = `${exportData.mapName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_map.json`;
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }

    // Process map connections and stats, then copy clean JSON to clipboard
    exportMapStatsToClipboard() {
      if (this.mapData.territories.length === 0) {
        alert('Please draw at least one territory first.');
        return;
      }

      const getNationName = (nid) => {
        if (!nid || nid === 'dummy') return 'Neutral Defender';
        const n = (this.mapData.nations || []).find(nat => nat.id === nid);
        return n ? n.name : 'Unknown Nation';
      };

      const getTerritoryName = (tid) => {
        const t = (this.mapData.territories || []).find(terr => terr.id === tid);
        return t ? t.name : tid;
      };

      const getContinentOfTerritory = (tid) => {
        const cont = this.mapData.continents.find(c => c.territoryIds.includes(tid));
        return cont ? { id: cont.id, name: cont.name } : null;
      };

      const territoriesMetadata = {};

      this.mapData.territories.forEach(t => {
        const contInfo = getContinentOfTerritory(t.id);
        const ownerName = getNationName(t.startingOwnerId);
        territoriesMetadata[t.id] = {
          name: t.name,
          continent: contInfo ? contInfo.name : 'None',
          startingOwnerId: t.startingOwnerId || 'dummy',
          startingOwnerName: ownerName,
          startingArmies: t.startingArmies !== undefined ? t.startingArmies : 1,
          adjacencies: []
        };
      });

      this.mapData.connections.forEach(conn => {
        let fromId, toId, type = 'land';
        if (Array.isArray(conn)) {
          fromId = conn[0];
          toId = conn[1];
        } else if (conn && typeof conn === 'object') {
          fromId = conn.from;
          toId = conn.to;
          if (conn.type === 'sea') type = 'sea';
        }

        const fromTerr = territoriesMetadata[fromId];
        const toTerr = territoriesMetadata[toId];

        if (fromTerr && toTerr) {
          fromTerr.adjacencies.push({ id: toId, name: toTerr.name, type });
          toTerr.adjacencies.push({ id: fromId, name: fromTerr.name, type });
        }
      });

      const continentsMetadata = {};
      this.mapData.continents.forEach(c => {
        let interContinentConnections = 0;

        this.mapData.connections.forEach(conn => {
          let fromId, toId;
          if (Array.isArray(conn)) {
            fromId = conn[0];
            toId = conn[1];
          } else if (conn && typeof conn === 'object') {
            fromId = conn.from;
            toId = conn.to;
          }

          const hasFrom = c.territoryIds.includes(fromId);
          const hasTo = c.territoryIds.includes(toId);

          if ((hasFrom && !hasTo) || (!hasFrom && hasTo)) {
            interContinentConnections++;
          }
        });

        continentsMetadata[c.id] = {
          name: c.name,
          bonus: c.bonus,
          territoriesCount: c.territoryIds.length,
          interContinentConnections
        };
      });

      // Build rich Nations Metadata summary ordered by turnOrder
      const nationsMetadata = (this.mapData.nations || [])
        .map((n, idx) => ({ ...n, turnOrder: n.turnOrder !== undefined ? n.turnOrder : idx + 1 }))
        .sort((a, b) => a.turnOrder - b.turnOrder)
        .map((n) => {
          const ownedTerrs = this.mapData.territories.filter(t => t.startingOwnerId === n.id);
          const startingArmiesTotal = ownedTerrs.reduce((sum, t) => sum + (t.startingArmies !== undefined ? t.startingArmies : 1), 0);
          const capitalName = n.capitalTerritoryId ? getTerritoryName(n.capitalTerritoryId) : 'None';

          // Find premade alliances involving this nation
          const alliedNationIds = [];
          (this.mapData.premadeAlliances || []).forEach(a => {
            if (a.nationAId === n.id) alliedNationIds.push(a.nationBId);
            else if (a.nationBId === n.id) alliedNationIds.push(a.nationAId);
          });
          const alliedNationNames = alliedNationIds.map(getNationName);

          return {
            turnOrder: n.turnOrder,
            id: n.id,
            name: n.name,
            color: n.color,
            description: n.description || 'No description provided.',
            capitalTerritoryId: n.capitalTerritoryId || null,
            capitalTerritoryName: capitalName,
            startingTerritoryCount: ownedTerrs.length,
            startingTerritoryNames: ownedTerrs.map(t => t.name),
            startingArmiesTotal,
            premadeAlliancesWith: alliedNationNames
          };
        });

      const turnOrderSequence = nationsMetadata.map(n => `Turn #${n.turnOrder}: ${n.name}`);

      // Format premade alliances summary
      const premadeAlliancesSummary = (this.mapData.premadeAlliances || []).map(a => {
        const nA = getNationName(a.nationAId);
        const nB = getNationName(a.nationBId);
        return {
          id: a.id,
          nationA: nA,
          nationB: nB,
          description: `${nA} <-> ${nB} (Premade Non-Aggression Pact)`
        };
      });

      const stats = {
        mapName: this.mapData.mapName,
        isScenario: !!this.mapData.isScenario,
        nationsCount: (this.mapData.nations || []).length,
        turnOrderSequence: turnOrderSequence,
        nations: nationsMetadata,
        premadeAlliances: premadeAlliancesSummary,
        continents: continentsMetadata,
        territories: territoriesMetadata
      };

      const formattedJSON = JSON.stringify(stats, null, 2);

      navigator.clipboard.writeText(formattedJSON)
        .then(() => {
          alert('Map statistics, nations metadata, and scenario structure successfully copied to clipboard!');
        })
        .catch(err => {
          console.error('Clipboard copy failed: ', err);
          alert('Failed to copy automatically. Please check your developer console.');
        });
    }

    loadMapData(data) {
      if (!data.territories || !Array.isArray(data.territories)) {
        alert('Invalid map format.');
        return;
      }

      this.mapData = {
        mapName: data.mapName || 'Custom Map',
        width: data.width || 1200,
        height: data.height || 800,
        referenceImage: data.referenceImage || '',
        imageOpacity: data.imageOpacity !== undefined ? data.imageOpacity : 0.5,
        territories: data.territories,
        connections: data.connections || [],
        continents: data.continents || [],
        isScenario: !!data.isScenario,
        scenarioSettings: data.scenarioSettings || { capitalRush: false, defaultDummyArmies: 1 },
        nations: (data.nations || []).map((n, idx) => ({ ...n, turnOrder: n.turnOrder !== undefined ? n.turnOrder : idx + 1 })).sort((a, b) => a.turnOrder - b.turnOrder),
        premadeAlliances: data.premadeAlliances || []
      };

      document.getElementById('editor-map-name').value = this.mapData.mapName;
      document.getElementById('editor-map-width').value = this.mapData.width;
      document.getElementById('editor-map-height').value = this.mapData.height;

      const chkIsScen = document.getElementById('chk-editor-is-scenario');
      if (chkIsScen) chkIsScen.checked = !!this.mapData.isScenario;

      const chkCap = document.getElementById('chk-editor-capital-rush');
      if (chkCap) chkCap.checked = !!(this.mapData.scenarioSettings && this.mapData.scenarioSettings.capitalRush);

      const inputDummy = document.getElementById('input-editor-dummy-armies');
      if (inputDummy) inputDummy.value = (this.mapData.scenarioSettings && this.mapData.scenarioSettings.defaultDummyArmies) || 1;

      if (this.mapData.referenceImage) {
        document.getElementById('opacity-slider-container').style.display = 'block';
        document.getElementById('editor-image-opacity').value = Math.round(this.mapData.imageOpacity * 100);
        document.getElementById('ref-opacity-val').textContent = `${Math.round(this.mapData.imageOpacity * 100)}%`;
      } else {
        document.getElementById('opacity-slider-container').style.display = 'none';
      }

      this.selectedTerritoryId = null;
      this.selectedFirstConnectionId = null;
      this.closeRightSidebar();
      this.renderContinentsList();
      this.renderNationsList();
      this.renderAlliancesList();
      this.redraw();
    }
  }

  window.MapEditor = MapEditor;
})();
