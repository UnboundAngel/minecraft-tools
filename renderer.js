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

                ctx.fillStyle = color;
                ctx.fillRect(screen.x, screen.y, size + 1, size + 1); // +1 to avoid gaps
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
