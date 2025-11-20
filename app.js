/**
 * Main Application Controller
 *
 * Handles:
 * - UI interactions
 * - Marker management (Shift+Click, Ctrl+Click)
 * - Structure hover tooltips
 * - URL state management
 * - localStorage persistence
 */
class SeedExplorerApp {
    constructor() {
        this.worldgen = null;
        this.renderer = null;

        // Interaction state
        this.isDragging = false;
        this.dragStarted = false; // Track if actual drag movement occurred
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastClickX = 0;
        this.lastClickY = 0;

        // Markers
        this.markers = [];

        this.init();
    }

    async init() {
        // Try to load cubiomes WASM first, then use JavaScript implementation with real algorithms
        this.worldgen = new CubiomesWorldgen();
        const cubiomesReady = await this.worldgen.init();

        if (!cubiomesReady) {
            console.log('[App] Cubiomes WASM not available, using JavaScript implementation with real algorithms');
            this.worldgen = new MinecraftWorldgen();
            await this.worldgen.init();

            // Show success banner for real worldgen
            document.getElementById('warningBanner').textContent =
                '✓ REAL MINECRAFT WORLDGEN – Using proper Perlin noise and multi-noise algorithms (JavaScript implementation)';
            document.getElementById('warningBanner').className = 'warning-banner success';
        } else {
            // Update banner for cubiomes WASM
            console.log('[App] Cubiomes WASM loaded successfully');
            document.getElementById('warningBanner').textContent =
                '✓ REAL MINECRAFT WORLDGEN – Using cubiomes WASM library for pixel-perfect accuracy';
            document.getElementById('warningBanner').className = 'warning-banner success';
        }

        // Initialize renderer
        const canvas = document.getElementById('canvas');
        this.renderer = new Renderer(canvas, this.worldgen);

        // Setup events
        this.setupEvents();

        // Load state from URL or localStorage
        this.loadState();

        // Generate initial world
        this.generate();

        console.log('[App] Initialized with worldgen backend:', this.worldgen.getName());
    }

    setupEvents() {
        const canvas = this.renderer.canvas;

        // Seed controls
        document.getElementById('randomBtn').onclick = () => {
            document.getElementById('seedInput').value = Math.floor(Math.random() * 2147483647);
        };

        document.getElementById('generateBtn').onclick = () => this.generate();

        // Edition/Version/Dimension
        document.getElementById('editionSelect').onchange = () => {
            this.renderer.edition = document.getElementById('editionSelect').value;
            this.updateBiomeLegend();
            this.renderer.render();
            this.updateStructureList();
        };

        document.getElementById('versionSelect').onchange = () => {
            this.renderer.version = document.getElementById('versionSelect').value;
            this.renderer.render();
            this.updateStructureList();
        };

        // Dimension tabs
        document.querySelectorAll('.dimension-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.dimension-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderer.dimension = tab.dataset.dimension;
                this.updateBiomeLegend();
                this.renderer.render();
                this.updateStructureList();
            };
        });

        // Jump to coords
        document.getElementById('jumpBtn').onclick = () => {
            const x = parseInt(document.getElementById('jumpX').value) || 0;
            const z = parseInt(document.getElementById('jumpZ').value) || 0;
            this.renderer.setCamera(x, z, this.renderer.camera.zoom);
            this.renderer.render();
            this.updateInfo();
            this.updateStructureList();
        };

        // Overlays
        document.getElementById('showStructures').onchange = (e) => {
            this.renderer.showStructures = e.target.checked;
            this.renderer.render();
            this.updateStructureList();
        };

        document.getElementById('showSlime').onchange = (e) => {
            this.renderer.showSlime = e.target.checked;
            this.renderer.render();
        };

        document.getElementById('showSpawn').onchange = (e) => {
            this.renderer.showSpawn = e.target.checked;
            this.renderer.render();
        };

        document.getElementById('showGrid').onchange = (e) => {
            this.renderer.showGrid = e.target.checked;
            this.renderer.render();
        };

        // Share button
        document.getElementById('shareBtn').onclick = () => this.shareView();

        // Markers
        document.getElementById('clearMarkersBtn').onclick = () => {
            this.markers = [];
            this.renderer.markers = [];
            this.updateMarkerList();
            this.renderer.render();
            this.saveState();
        };

        // Map controls
        document.getElementById('zoomInBtn').onclick = () => this.zoomBy(1.5);
        document.getElementById('zoomOutBtn').onclick = () => this.zoomBy(1 / 1.5);
        document.getElementById('resetBtn').onclick = () => this.resetView();

        // Canvas mouse events
        canvas.onmousedown = (e) => {
            this.isDragging = true;
            this.dragStarted = false;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.lastClickX = e.clientX;
            this.lastClickY = e.clientY;
        };

        canvas.onmousemove = (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;

                // If movement is significant, mark as actual drag
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    this.dragStarted = true;

                    this.renderer.camera.centerBlockX -= dx / this.renderer.camera.pixelsPerBlock;
                    this.renderer.camera.centerBlockZ -= dy / this.renderer.camera.pixelsPerBlock;

                    this.lastMouseX = e.clientX;
                    this.lastMouseY = e.clientY;

                    this.renderer.render();
                    this.updateInfo();
                    this.updateStructureList();
                }
            } else {
                // Update tooltip and structure hover
                this.updateTooltip(e);
                this.updateStructureHover(e);
            }
        };

        canvas.onmouseup = (e) => {
            const wasDragging = this.isDragging;
            this.isDragging = false;

            // Handle marker placement on Shift+Click or Ctrl+Click
            // Only if this wasn't an actual drag operation
            if (wasDragging && !this.dragStarted && (e.shiftKey || e.ctrlKey)) {
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const block = Coords.screenToBlock(
                    mouseX, mouseY,
                    this.renderer.camera,
                    this.renderer.cssWidth,
                    this.renderer.cssHeight
                );
                this.addMarker(Math.round(block.blockX), Math.round(block.blockZ));
            }

            this.dragStarted = false;
        };

        canvas.onmouseleave = () => {
            this.isDragging = false;
            this.dragStarted = false;
            document.getElementById('tooltip').classList.remove('visible');
            document.getElementById('structureTooltip').classList.remove('visible');
            this.renderer.setHoveredStructure(null);
            this.renderer.render();
        };

        canvas.onwheel = (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const beforeBlock = Coords.screenToBlock(
                mouseX, mouseY,
                this.renderer.camera,
                this.renderer.cssWidth,
                this.renderer.cssHeight
            );

            this.renderer.camera.zoom *= zoomFactor;
            this.renderer.camera.zoom = Math.max(0.1, Math.min(20, this.renderer.camera.zoom));
            this.renderer.camera.pixelsPerBlock = this.renderer.camera.zoom;

            const afterBlock = Coords.screenToBlock(
                mouseX, mouseY,
                this.renderer.camera,
                this.renderer.cssWidth,
                this.renderer.cssHeight
            );

            this.renderer.camera.centerBlockX += beforeBlock.blockX - afterBlock.blockX;
            this.renderer.camera.centerBlockZ += beforeBlock.blockZ - afterBlock.blockZ;

            this.renderer.render();
            this.updateInfo();
            this.updateStructureList();
        };

        // Keyboard shortcuts
        document.onkeydown = (e) => {
            // Don't handle keys if user is typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            const moveSpeed = 32 / this.renderer.camera.pixelsPerBlock;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    this.renderer.camera.centerBlockZ -= moveSpeed;
                    this.renderer.render();
                    this.updateInfo();
                    this.updateStructureList();
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    this.renderer.camera.centerBlockZ += moveSpeed;
                    this.renderer.render();
                    this.updateInfo();
                    this.updateStructureList();
                    e.preventDefault();
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    this.renderer.camera.centerBlockX -= moveSpeed;
                    this.renderer.render();
                    this.updateInfo();
                    this.updateStructureList();
                    e.preventDefault();
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    this.renderer.camera.centerBlockX += moveSpeed;
                    this.renderer.render();
                    this.updateInfo();
                    this.updateStructureList();
                    e.preventDefault();
                    break;
                case '+':
                case '=':
                    this.zoomBy(1.5);
                    e.preventDefault();
                    break;
                case '-':
                case '_':
                    this.zoomBy(1 / 1.5);
                    e.preventDefault();
                    break;
                case 'Home':
                    this.resetView();
                    e.preventDefault();
                    break;
            }
        };

        // Resize
        window.onresize = () => {
            this.renderer.resizeCanvas();
            this.renderer.render();
        };
    }

    generate() {
        const seedInput = document.getElementById('seedInput').value.trim();

        if (seedInput === '') {
            this.renderer.seed = Math.floor(Math.random() * 2147483647);
            document.getElementById('seedInput').value = this.renderer.seed;
        } else if (isNaN(seedInput)) {
            // Hash string seed
            let hash = 0;
            for (let i = 0; i < seedInput.length; i++) {
                hash = ((hash << 5) - hash) + seedInput.charCodeAt(i);
                hash = hash & hash;
            }
            this.renderer.seed = hash;
        } else {
            this.renderer.seed = parseInt(seedInput);
        }

        this.renderer.edition = document.getElementById('editionSelect').value;
        this.renderer.version = document.getElementById('versionSelect').value;

        document.getElementById('displaySeed').textContent = seedInput || this.renderer.seed;

        this.updateBiomeLegend();
        this.renderer.render();
        this.updateInfo();
        this.updateStructureList();
        this.saveState();
    }

    updateBiomeLegend() {
        const legendDiv = document.getElementById('biomeLegend');
        const biomes = this.worldgen.getAvailableBiomes(this.renderer.dimension);

        legendDiv.innerHTML = '';

        Object.entries(biomes).forEach(([id, biome]) => {
            const item = document.createElement('div');
            item.className = 'biome-item';
            item.innerHTML = `
                <div class="biome-color" style="background: ${biome.color}"></div>
                <span>${biome.name}</span>
            `;
            legendDiv.appendChild(item);
        });
    }

    updateStructureList() {
        if (!this.renderer.showStructures) {
            document.getElementById('structureList').innerHTML = '<div class="empty-state">Structures disabled</div>';
            return;
        }

        const structures = this.renderer.cachedStructures || [];
        const listDiv = document.getElementById('structureList');

        if (structures.length === 0) {
            listDiv.innerHTML = '<div class="empty-state">No structures in view</div>';
            return;
        }

        const centerX = this.renderer.camera.centerBlockX;
        const centerZ = this.renderer.camera.centerBlockZ;

        structures.sort((a, b) => {
            const distA = Math.sqrt((a.blockX - centerX) ** 2 + (a.blockZ - centerZ) ** 2);
            const distB = Math.sqrt((b.blockX - centerX) ** 2 + (b.blockZ - centerZ) ** 2);
            return distA - distB;
        });

        listDiv.innerHTML = '';

        structures.slice(0, 20).forEach(s => {
            const dist = Math.sqrt((s.blockX - centerX) ** 2 + (s.blockZ - centerZ) ** 2);
            const item = document.createElement('div');
            item.className = 'structure-item';
            const displayName = s.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            item.innerHTML = `
                <div class="structure-info">
                    <div class="structure-type">${displayName}</div>
                    <div class="structure-coords">X: ${s.blockX}, Z: ${s.blockZ}</div>
                </div>
                <div class="structure-distance">${Math.round(dist)}m</div>
            `;
            item.onclick = () => {
                this.renderer.setCamera(s.blockX, s.blockZ, this.renderer.camera.zoom);
                this.renderer.render();
                this.updateInfo();
                this.updateStructureList();
            };
            listDiv.appendChild(item);
        });
    }

    updateTooltip(e) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const block = Coords.screenToBlock(
            mouseX, mouseY,
            this.renderer.camera,
            this.renderer.cssWidth,
            this.renderer.cssHeight
        );

        const blockX = Math.floor(block.blockX);
        const blockZ = Math.floor(block.blockZ);
        const chunkX = Coords.blockToChunk(blockX);
        const chunkZ = Coords.blockToChunk(blockZ);

        const biome = this.renderer.getBiomeAt(blockX, blockZ);

        document.getElementById('tooltipBlock').textContent = `X: ${blockX}, Z: ${blockZ}`;
        document.getElementById('tooltipChunk').textContent = `(${chunkX}, ${chunkZ})`;
        document.getElementById('tooltipBiome').textContent = biome.name;

        const tooltip = document.getElementById('tooltip');
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        tooltip.classList.add('visible');
    }

    updateStructureHover(e) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const structure = this.renderer.findStructureAtScreenPos(mouseX, mouseY);

        if (structure) {
            this.renderer.setHoveredStructure(structure);
            this.showStructureTooltip(structure, e);
            this.renderer.render();
        } else {
            this.renderer.setHoveredStructure(null);
            document.getElementById('structureTooltip').classList.remove('visible');
        }
    }

    showStructureTooltip(structure, e) {
        const tooltip = document.getElementById('structureTooltip');
        const displayName = structure.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const biome = this.renderer.getBiomeAt(structure.blockX, structure.blockZ);

        const centerX = this.renderer.camera.centerBlockX;
        const centerZ = this.renderer.camera.centerBlockZ;
        const dist = Math.sqrt((structure.blockX - centerX) ** 2 + (structure.blockZ - centerZ) ** 2);

        tooltip.innerHTML = `
            <div class="tooltip-line">
                <span class="tooltip-label">Structure:</span>
                <span class="tooltip-value">${displayName}</span>
            </div>
            <div class="tooltip-line">
                <span class="tooltip-label">Location:</span>
                <span class="tooltip-value">X: ${structure.blockX}, Z: ${structure.blockZ}</span>
            </div>
            <div class="tooltip-line">
                <span class="tooltip-label">Biome:</span>
                <span class="tooltip-value">${biome.name}</span>
            </div>
            <div class="tooltip-line">
                <span class="tooltip-label">Distance:</span>
                <span class="tooltip-value">${Math.round(dist)}m</span>
            </div>
        `;

        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
        tooltip.classList.add('visible');
    }

    updateInfo() {
        const cam = this.renderer.camera;
        document.getElementById('displayPos').textContent =
            `X: ${Math.round(cam.centerBlockX)}, Z: ${Math.round(cam.centerBlockZ)}`;
        document.getElementById('displayZoom').textContent =
            cam.zoom.toFixed(2) + 'x';
    }

    addMarker(blockX, blockZ) {
        const markerNum = this.markers.length + 1;
        this.markers.push({
            name: `Marker ${markerNum}`,
            blockX,
            blockZ
        });
        this.renderer.markers = this.markers;
        this.updateMarkerList();
        this.renderer.render();
        this.saveState();
    }

    updateMarkerList() {
        const listDiv = document.getElementById('markerList');

        if (this.markers.length === 0) {
            listDiv.innerHTML = '<div class="empty-state">No markers</div>';
            return;
        }

        listDiv.innerHTML = '';

        this.markers.forEach((marker, idx) => {
            const item = document.createElement('div');
            item.className = 'marker-item';
            item.innerHTML = `
                <div>
                    <div class="marker-name">${marker.name}</div>
                    <div class="marker-coords">X: ${marker.blockX}, Z: ${marker.blockZ}</div>
                </div>
                <div class="marker-actions">
                    <button class="marker-btn goto-btn">Go</button>
                    <button class="marker-btn remove-btn">×</button>
                </div>
            `;

            item.querySelector('.goto-btn').onclick = () => {
                this.renderer.setCamera(marker.blockX, marker.blockZ, this.renderer.camera.zoom);
                this.renderer.render();
                this.updateInfo();
                this.updateStructureList();
            };

            item.querySelector('.remove-btn').onclick = () => {
                this.markers.splice(idx, 1);
                this.renderer.markers = this.markers;
                this.updateMarkerList();
                this.renderer.render();
                this.saveState();
            };

            listDiv.appendChild(item);
        });
    }

    zoomBy(factor) {
        const newZoom = this.renderer.camera.zoom * factor;
        this.renderer.setCamera(
            this.renderer.camera.centerBlockX,
            this.renderer.camera.centerBlockZ,
            newZoom
        );
        this.renderer.render();
        this.updateInfo();
        this.updateStructureList();
    }

    resetView() {
        this.renderer.setCamera(0, 0, 1.0);
        this.renderer.render();
        this.updateInfo();
        this.updateStructureList();
    }

    shareView() {
        const state = {
            seed: document.getElementById('seedInput').value || this.renderer.seed,
            edition: this.renderer.edition,
            version: this.renderer.version,
            dimension: this.renderer.dimension,
            x: Math.round(this.renderer.camera.centerBlockX),
            z: Math.round(this.renderer.camera.centerBlockZ),
            zoom: this.renderer.camera.zoom.toFixed(2)
        };

        const params = new URLSearchParams(state);
        const url = window.location.origin + window.location.pathname + '?' + params.toString();

        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById('shareBtn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '✓ Copied!';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }).catch(err => {
            console.error('[App] Failed to copy URL:', err);
            alert('URL copied to clipboard (fallback):\n' + url);
        });
    }

    loadState() {
        // Load from URL first
        const params = new URLSearchParams(window.location.search);

        if (params.has('seed')) {
            document.getElementById('seedInput').value = params.get('seed');
        }

        if (params.has('edition')) {
            document.getElementById('editionSelect').value = params.get('edition');
        }

        if (params.has('version')) {
            document.getElementById('versionSelect').value = params.get('version');
        }

        if (params.has('dimension')) {
            const dimension = params.get('dimension');
            document.querySelectorAll('.dimension-tab').forEach(tab => {
                if (tab.dataset.dimension === dimension) {
                    tab.click();
                }
            });
        }

        if (params.has('x') && params.has('z')) {
            const x = parseFloat(params.get('x'));
            const z = parseFloat(params.get('z'));
            const zoom = params.has('zoom') ? parseFloat(params.get('zoom')) : 1.0;
            this.renderer.setCamera(x, z, zoom);
        }

        // Load markers from localStorage
        try {
            const saved = localStorage.getItem('seedExplorerState_v2');
            if (saved && !params.has('seed')) {
                const state = JSON.parse(saved);
                this.markers = state.markers || [];
                this.renderer.markers = this.markers;
                this.updateMarkerList();
            }
        } catch (e) {
            console.warn('[App] Failed to load state from localStorage:', e);
        }
    }

    saveState() {
        try {
            const state = {
                markers: this.markers
            };
            localStorage.setItem('seedExplorerState_v2', JSON.stringify(state));
        } catch (e) {
            console.warn('[App] Failed to save state to localStorage:', e);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new SeedExplorerApp();
    });
} else {
    window.app = new SeedExplorerApp();
}
