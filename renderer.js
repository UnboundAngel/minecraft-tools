/**
 * Renderer - Handles all canvas drawing for the seed explorer
 *
 * Responsibilities:
 * - Drawing biomes
 * - Drawing overlays (structures, slime chunks, spawn, grid)
 * - Drawing markers
 * - Hover detection for structures
 * - Camera management
 */
class Renderer {
    constructor(canvas, worldgen) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.worldgen = worldgen;

        // Camera state
        this.camera = {
            centerBlockX: 0,
            centerBlockZ: 0,
            zoom: 1.0,
            pixelsPerBlock: 1.0
        };

        // World state
        this.seed = 0;
        this.edition = 'Java';
        this.version = '1.20';
        this.dimension = 'overworld';

        // Overlay flags
        this.showStructures = true;
        this.showSlime = true;
        this.showSpawn = true;
        this.showGrid = false;

        // Cached data
        this.cachedStructures = [];
        this.markers = [];

        // Hover state
        this.hoveredStructure = null;

        this.resizeCanvas();
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.cssWidth = rect.width;
        this.cssHeight = rect.height;
    }

    setCamera(centerBlockX, centerBlockZ, zoom) {
        this.camera.centerBlockX = centerBlockX;
        this.camera.centerBlockZ = centerBlockZ;
        this.camera.zoom = Math.max(0.1, Math.min(20, zoom));
        this.camera.pixelsPerBlock = this.camera.zoom;
    }

    render() {
        const w = this.cssWidth;
        const h = this.cssHeight;
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Calculate visible area
        const topLeft = Coords.screenToBlock(0, 0, this.camera, w, h);
        const bottomRight = Coords.screenToBlock(w, h, this.camera, w, h);

        // Draw biomes with adaptive sampling
        this.drawBiomes(topLeft, bottomRight, w, h);

        // Draw overlays
        if (this.showGrid && this.camera.zoom >= 0.5) {
            this.drawChunkGrid(topLeft, bottomRight, w, h);
        }

        if (this.showSlime && this.edition === 'Java' && this.dimension === 'overworld') {
            this.drawSlimeChunks(topLeft, bottomRight, w, h);
        }

        if (this.showSpawn) {
            this.drawSpawn(w, h);
        }

        if (this.showStructures) {
            this.drawStructures(topLeft, bottomRight, w, h);
        }

        // Draw markers
        this.drawMarkers(w, h);
    }

    drawBiomes(topLeft, bottomRight, w, h) {
        const ctx = this.ctx;

        // Adaptive sampling: don't sample every block at low zoom
        const sampleSpacing = Math.max(1, Math.floor(20 / this.camera.pixelsPerBlock));

        for (let blockZ = Math.floor(topLeft.blockZ / sampleSpacing) * sampleSpacing;
             blockZ <= bottomRight.blockZ;
             blockZ += sampleSpacing) {
            for (let blockX = Math.floor(topLeft.blockX / sampleSpacing) * sampleSpacing;
                 blockX <= bottomRight.blockX;
                 blockX += sampleSpacing) {

                const biomeId = this.worldgen.getBiomeAt(
                    this.seed, this.edition, this.version, this.dimension,
                    blockX, blockZ
                );

                const biomes = this.worldgen.getAvailableBiomes(this.dimension);
                const biome = biomes[biomeId];
                const color = biome ? biome.color : '#333';

                const screen = Coords.blockToScreen(blockX, blockZ, this.camera, w, h);
                const size = sampleSpacing * this.camera.pixelsPerBlock;

                // Fill base color
                ctx.fillStyle = color;
                ctx.fillRect(screen.x, screen.y, size + 1, size + 1); // +1 to avoid gaps

                // Add texture pattern at high zoom (>= 4x)
                if (this.camera.zoom >= 4 && size >= 8) {
                    this.drawBiomeTexture(ctx, biomeId, screen.x, screen.y, size, blockX, blockZ);
                }
            }
        }

        // Draw subtle borders between biomes at high zoom
        if (this.camera.zoom >= 2) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;

            const borderSpacing = Math.max(8, sampleSpacing);
            for (let blockZ = Math.floor(topLeft.blockZ / borderSpacing) * borderSpacing;
                 blockZ <= bottomRight.blockZ;
                 blockZ += borderSpacing) {
                for (let blockX = Math.floor(topLeft.blockX / borderSpacing) * borderSpacing;
                     blockX <= bottomRight.blockX;
                     blockX += borderSpacing) {

                    const biomeId = this.worldgen.getBiomeAt(this.seed, this.edition, this.version, this.dimension, blockX, blockZ);
                    const rightBiome = this.worldgen.getBiomeAt(this.seed, this.edition, this.version, this.dimension, blockX + borderSpacing, blockZ);
                    const downBiome = this.worldgen.getBiomeAt(this.seed, this.edition, this.version, this.dimension, blockX, blockZ + borderSpacing);

                    if (biomeId !== rightBiome) {
                        const screen = Coords.blockToScreen(blockX + borderSpacing, blockZ, this.camera, w, h);
                        ctx.beginPath();
                        ctx.moveTo(screen.x, screen.y);
                        ctx.lineTo(screen.x, screen.y + borderSpacing * this.camera.pixelsPerBlock);
                        ctx.stroke();
                    }

                    if (biomeId !== downBiome) {
                        const screen = Coords.blockToScreen(blockX, blockZ + borderSpacing, this.camera, w, h);
                        ctx.beginPath();
                        ctx.moveTo(screen.x, screen.y);
                        ctx.lineTo(screen.x + borderSpacing * this.camera.pixelsPerBlock, screen.y);
                        ctx.stroke();
                    }
                }
            }
        }
    }

    drawBiomeTexture(ctx, biomeId, x, y, size, blockX, blockZ) {
        // Use block coordinates for deterministic pseudo-random positioning
        const hash = (blockX * 374761393 + blockZ * 668265263) & 0x7FFFFFFF;
        const random = () => {
            const x = Math.sin(hash + blockX + blockZ) * 10000;
            return x - Math.floor(x);
        };

        ctx.save();

        switch (biomeId) {
            case 'desert':
                // Sandy dune pattern - light dots
                ctx.fillStyle = 'rgba(255, 255, 230, 0.15)';
                for (let i = 0; i < 3; i++) {
                    const dx = (hash * (i + 1) * 7) % size;
                    const dy = (hash * (i + 2) * 11) % size;
                    ctx.fillRect(x + dx, y + dy, 2, 2);
                }
                // Darker sand patches
                ctx.fillStyle = 'rgba(139, 90, 43, 0.1)';
                const patchX = (hash * 13) % size;
                const patchY = (hash * 17) % size;
                ctx.fillRect(x + patchX, y + patchY, size / 3, size / 3);
                break;

            case 'cherry_grove':
            case 'cherry_blossom':
                // Pink cherry petals
                ctx.fillStyle = 'rgba(255, 182, 193, 0.4)';
                for (let i = 0; i < 4; i++) {
                    const dx = (hash * (i + 3) * 5) % size;
                    const dy = (hash * (i + 4) * 7) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'snowy_tundra':
            case 'snowy_taiga':
            case 'snowy_plains':
            case 'snowy_slopes':
            case 'snowy_beach':
                // Snow sparkles - white dots
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                for (let i = 0; i < 5; i++) {
                    const dx = (hash * (i + 5) * 9) % size;
                    const dy = (hash * (i + 6) * 13) % size;
                    ctx.fillRect(x + dx, y + dy, 1, 1);
                }
                break;

            case 'swamp':
            case 'mangrove_swamp':
                // Murky water pattern - dark ripples
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 1;
                const rippleY = (hash * 19) % size;
                ctx.beginPath();
                ctx.moveTo(x, y + rippleY);
                ctx.lineTo(x + size, y + rippleY);
                ctx.stroke();
                break;

            case 'mushroom_fields':
            case 'mushroom_field_shore':
                // Mushroom dots - red and brown spots
                ctx.fillStyle = 'rgba(139, 0, 0, 0.2)';
                const mushX1 = (hash * 23) % size;
                const mushY1 = (hash * 29) % size;
                ctx.beginPath();
                ctx.arc(x + mushX1, y + mushY1, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(139, 69, 19, 0.2)';
                const mushX2 = (hash * 31) % size;
                const mushY2 = (hash * 37) % size;
                ctx.beginPath();
                ctx.arc(x + mushX2, y + mushY2, 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'jungle':
            case 'bamboo_jungle':
            case 'sparse_jungle':
                // Dense foliage - dark green patches
                ctx.fillStyle = 'rgba(0, 50, 0, 0.15)';
                for (let i = 0; i < 3; i++) {
                    const dx = (hash * (i + 7) * 11) % size;
                    const dy = (hash * (i + 8) * 13) % size;
                    ctx.fillRect(x + dx, y + dy, 4, 4);
                }
                break;

            case 'badlands':
            case 'wooded_badlands':
            case 'eroded_badlands':
                // Layered rock pattern - horizontal stripes
                ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
                ctx.fillRect(x, y + size * 0.3, size, 2);
                ctx.fillStyle = 'rgba(205, 92, 92, 0.1)';
                ctx.fillRect(x, y + size * 0.6, size, 2);
                break;

            case 'ocean':
            case 'deep_ocean':
            case 'warm_ocean':
            case 'frozen_ocean':
                // Wave pattern - light horizontal lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                ctx.lineWidth = 1;
                const wave1 = (blockZ * 3) % 8;
                const wave2 = (blockZ * 5) % 12;
                ctx.beginPath();
                ctx.moveTo(x, y + wave1);
                ctx.lineTo(x + size, y + wave1);
                ctx.moveTo(x, y + wave2);
                ctx.lineTo(x + size, y + wave2);
                ctx.stroke();
                break;

            case 'beach':
            case 'stone_shore':
                // Pebbles - small circles
                ctx.fillStyle = 'rgba(128, 128, 128, 0.15)';
                for (let i = 0; i < 2; i++) {
                    const dx = (hash * (i + 9) * 7) % size;
                    const dy = (hash * (i + 10) * 11) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'meadow':
                // Flower dots - various colors
                const flowerColors = [
                    'rgba(255, 0, 0, 0.3)',    // Red
                    'rgba(255, 255, 0, 0.3)',  // Yellow
                    'rgba(255, 192, 203, 0.3)' // Pink
                ];
                for (let i = 0; i < 3; i++) {
                    ctx.fillStyle = flowerColors[i];
                    const dx = (hash * (i + 11) * 9) % size;
                    const dy = (hash * (i + 12) * 13) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'sunflower_plains':
                // Sunflower heads - yellow dots
                ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
                for (let i = 0; i < 2; i++) {
                    const dx = (hash * (i + 13) * 11) % size;
                    const dy = (hash * (i + 14) * 7) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'ice_spikes':
            case 'frozen_peaks':
                // Ice crystals - light blue triangular shapes
                ctx.strokeStyle = 'rgba(173, 216, 230, 0.3)';
                ctx.lineWidth = 1;
                const spikeX = (hash * 41) % size;
                const spikeY = (hash * 43) % size;
                ctx.beginPath();
                ctx.moveTo(x + spikeX, y + spikeY);
                ctx.lineTo(x + spikeX + 3, y + spikeY + 5);
                ctx.lineTo(x + spikeX - 3, y + spikeY + 5);
                ctx.closePath();
                ctx.stroke();
                break;

            case 'nether_wastes':
                // Netherrack texture - dark red patches
                ctx.fillStyle = 'rgba(80, 20, 20, 0.15)';
                for (let i = 0; i < 4; i++) {
                    const dx = (hash * (i + 15) * 7) % size;
                    const dy = (hash * (i + 16) * 9) % size;
                    ctx.fillRect(x + dx, y + dy, 2, 2);
                }
                break;

            case 'warped_forest':
                // Warped vegetation - cyan dots
                ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                for (let i = 0; i < 3; i++) {
                    const dx = (hash * (i + 17) * 11) % size;
                    const dy = (hash * (i + 18) * 13) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'crimson_forest':
                // Crimson vegetation - red dots
                ctx.fillStyle = 'rgba(220, 20, 60, 0.2)';
                for (let i = 0; i < 3; i++) {
                    const dx = (hash * (i + 19) * 13) % size;
                    const dy = (hash * (i + 20) * 7) % size;
                    ctx.beginPath();
                    ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'soul_sand_valley':
                // Soul fire - blue flame-like marks
                ctx.fillStyle = 'rgba(100, 149, 237, 0.15)';
                const flameX = (hash * 47) % size;
                const flameY = (hash * 53) % size;
                ctx.fillRect(x + flameX, y + flameY, 2, 4);
                break;

            case 'basalt_deltas':
                // Basalt columns - vertical dark lines
                ctx.strokeStyle = 'rgba(20, 20, 20, 0.2)';
                ctx.lineWidth = 1;
                const colX = (hash * 59) % size;
                ctx.beginPath();
                ctx.moveTo(x + colX, y);
                ctx.lineTo(x + colX, y + size);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    drawChunkGrid(topLeft, bottomRight, w, h) {
        const ctx = this.ctx;
        const minChunkX = Coords.blockToChunk(Math.floor(topLeft.blockX));
        const maxChunkX = Coords.blockToChunk(Math.ceil(bottomRight.blockX));
        const minChunkZ = Coords.blockToChunk(Math.floor(topLeft.blockZ));
        const maxChunkZ = Coords.blockToChunk(Math.ceil(bottomRight.blockZ));

        ctx.strokeStyle = 'rgba(160, 102, 255, 0.2)';
        ctx.lineWidth = 1;

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            const blockX = cx * 16;
            const screen = Coords.blockToScreen(blockX, 0, this.camera, w, h);
            ctx.beginPath();
            ctx.moveTo(screen.x, 0);
            ctx.lineTo(screen.x, h);
            ctx.stroke();
        }

        for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
            const blockZ = cz * 16;
            const screen = Coords.blockToScreen(0, blockZ, this.camera, w, h);
            ctx.beginPath();
            ctx.moveTo(0, screen.y);
            ctx.lineTo(w, screen.y);
            ctx.stroke();
        }
    }

    drawSlimeChunks(topLeft, bottomRight, w, h) {
        const ctx = this.ctx;
        const minChunkX = Coords.blockToChunk(Math.floor(topLeft.blockX));
        const maxChunkX = Coords.blockToChunk(Math.ceil(bottomRight.blockX));
        const minChunkZ = Coords.blockToChunk(Math.floor(topLeft.blockZ));
        const maxChunkZ = Coords.blockToChunk(Math.ceil(bottomRight.blockZ));

        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                if (this.worldgen.isSlimeChunk(this.seed, this.edition, this.version, cx, cz)) {
                    const blockX = cx * 16;
                    const blockZ = cz * 16;
                    const screen = Coords.blockToScreen(blockX, blockZ, this.camera, w, h);
                    const size = 16 * this.camera.pixelsPerBlock;
                    ctx.fillRect(screen.x, screen.y, size, size);
                }
            }
        }
    }

    drawSpawn(w, h) {
        const screen = Coords.blockToScreen(0, 0, this.camera, w, h);
        const ctx = this.ctx;

        // Draw spawn marker
        ctx.fillStyle = '#10b981';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(screen.x - 12, screen.y);
        ctx.lineTo(screen.x + 12, screen.y);
        ctx.moveTo(screen.x, screen.y - 12);
        ctx.lineTo(screen.x, screen.y + 12);
        ctx.stroke();

        if (this.camera.zoom >= 2) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText('Spawn', screen.x, screen.y - 16);
            ctx.fillText('Spawn', screen.x, screen.y - 16);
        }
    }

    drawStructures(topLeft, bottomRight, w, h) {
        // Get structures in visible area
        this.cachedStructures = this.worldgen.getStructuresInArea(
            this.seed, this.edition, this.version, this.dimension,
            Math.floor(topLeft.blockX),
            Math.floor(topLeft.blockZ),
            Math.ceil(bottomRight.blockX),
            Math.ceil(bottomRight.blockZ)
        );

        const ctx = this.ctx;
        const colors = {
            village: '#fbbf24',
            desert_pyramid: '#f59e0b',
            jungle_temple: '#84cc16',
            swamp_hut: '#6b7280',
            igloo: '#60a5fa',
            ocean_monument: '#0ea5e9',
            mansion: '#a855f7',
            outpost: '#ef4444',
            shipwreck: '#94a3b8',
            fortress: '#dc2626',
            bastion: '#f97316',
            end_city: '#c084fc',
        };

        this.cachedStructures.forEach(s => {
            const screen = Coords.blockToScreen(s.blockX, s.blockZ, this.camera, w, h);
            const color = colors[s.type] || '#ff0000';

            // Check if mouse is hovering over this structure
            const isHovered = this.hoveredStructure &&
                             this.hoveredStructure.blockX === s.blockX &&
                             this.hoveredStructure.blockZ === s.blockZ;

            // Draw structure icon
            const size = isHovered ? 8 : 6;
            ctx.fillStyle = color;
            ctx.strokeStyle = isHovered ? '#fff' : '#fff';
            ctx.lineWidth = isHovered ? 3 : 2;

            ctx.beginPath();
            ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Draw label at medium-high zoom or when hovered
            if (this.camera.zoom >= 3 || isHovered) {
                ctx.fillStyle = '#fff';
                ctx.font = isHovered ? 'bold 12px Inter' : 'bold 10px Inter';
                ctx.textAlign = 'center';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                const label = s.type.replace('_', ' ');
                ctx.strokeText(label, screen.x, screen.y - (isHovered ? 14 : 10));
                ctx.fillText(label, screen.x, screen.y - (isHovered ? 14 : 10));
            }
        });
    }

    drawMarkers(w, h) {
        const ctx = this.ctx;

        this.markers.forEach((marker, idx) => {
            const screen = Coords.blockToScreen(marker.blockX, marker.blockZ, this.camera, w, h);

            // Draw marker pin
            ctx.fillStyle = '#f43f5e';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;

            // Pin shape
            ctx.beginPath();
            ctx.arc(screen.x, screen.y - 10, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y - 4);
            ctx.lineTo(screen.x, screen.y + 6);
            ctx.stroke();

            // Draw label at high zoom
            if (this.camera.zoom >= 1.5) {
                ctx.fillStyle = '#fff';
                ctx.font = '11px Inter';
                ctx.textAlign = 'center';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(marker.name, screen.x, screen.y - 18);
                ctx.fillText(marker.name, screen.x, screen.y - 18);
            }
        });
    }

    getBiomeAt(blockX, blockZ) {
        const biomeId = this.worldgen.getBiomeAt(
            this.seed, this.edition, this.version, this.dimension,
            blockX, blockZ
        );
        const biomes = this.worldgen.getAvailableBiomes(this.dimension);
        return biomes[biomeId] || { name: 'Unknown', color: '#333' };
    }

    findStructureAtScreenPos(screenX, screenY) {
        const block = Coords.screenToBlock(screenX, screenY, this.camera, this.cssWidth, this.cssHeight);

        // Find structure within hover radius (depends on zoom)
        const hoverRadius = Math.max(10, 20 / this.camera.pixelsPerBlock);

        for (const structure of this.cachedStructures) {
            const dx = structure.blockX - block.blockX;
            const dz = structure.blockZ - block.blockZ;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < hoverRadius) {
                return structure;
            }
        }

        return null;
    }

    setHoveredStructure(structure) {
        this.hoveredStructure = structure;
    }
}
