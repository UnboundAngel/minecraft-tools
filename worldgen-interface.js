/**
 * Worldgen Interface - Base class for all worldgen implementations
 * All worldgen backends must implement this interface
 */
class WorldgenInterface {
    /**
     * Initialize the worldgen backend
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async init() {
        throw new Error("Must implement init()");
    }

    /**
     * Get biome at block coordinates
     * @param {number|string} seed - World seed
     * @param {"Java"|"Bedrock"} edition - Edition
     * @param {string} version - Version string (e.g. "1.20")
     * @param {"overworld"|"nether"|"end"} dimension
     * @param {number} blockX - Block X coordinate
     * @param {number} blockZ - Block Z coordinate
     * @returns {string} Biome ID
     */
    getBiomeAt(seed, edition, version, dimension, blockX, blockZ) {
        throw new Error("Must implement getBiomeAt");
    }

    /**
     * Get all structures in block coordinate area
     * @param {number|string} seed
     * @param {"Java"|"Bedrock"} edition
     * @param {string} version
     * @param {"overworld"|"nether"|"end"} dimension
     * @param {number} minBlockX
     * @param {number} minBlockZ
     * @param {number} maxBlockX
     * @param {number} maxBlockZ
     * @returns {Array<{type: string, blockX: number, blockZ: number}>}
     */
    getStructuresInArea(seed, edition, version, dimension, minBlockX, minBlockZ, maxBlockX, maxBlockZ) {
        throw new Error("Must implement getStructuresInArea");
    }

    /**
     * Check if chunk is a slime chunk (Java Edition)
     * @param {number|string} seed
     * @param {"Java"|"Bedrock"} edition
     * @param {string} version
     * @param {number} chunkX - Chunk X coordinate
     * @param {number} chunkZ - Chunk Z coordinate
     * @returns {boolean}
     */
    isSlimeChunk(seed, edition, version, chunkX, chunkZ) {
        throw new Error("Must implement isSlimeChunk");
    }

    /**
     * Get available biomes for dimension
     * @param {"overworld"|"nether"|"end"} dimension
     * @returns {Object<string, {name: string, color: string}>}
     */
    getAvailableBiomes(dimension) {
        throw new Error("Must implement getAvailableBiomes");
    }

    /**
     * Get human-readable name for this backend
     * @returns {string}
     */
    getName() {
        throw new Error("Must implement getName");
    }

    /**
     * Check if this backend is ready to use
     * @returns {boolean}
     */
    isReady() {
        throw new Error("Must implement isReady");
    }
}

/**
 * Real Minecraft Java Edition slime chunk algorithm
 * This matches the decompiled game code exactly
 */
function isJavaSlimeChunk(seed, chunkX, chunkZ) {
    const BIG_48 = 1n << 48n;
    const JAVA_MULT = 0x5deece66dn;
    const JAVA_ADD = 0xbn;

    const worldSeed = typeof seed === 'bigint' ? seed : BigInt(seed);

    const n1 = BigInt(chunkX) * BigInt(chunkX) * 0x4c1906n;
    const n2 = BigInt(chunkX) * 0x5ac0dbn;
    const n3 = BigInt(chunkZ) * BigInt(chunkZ) * 0x4307a7n;
    const n4 = BigInt(chunkZ) * 0x5f24fn;

    let rndSeed = (worldSeed + n1 + n2 + n3 + n4) ^ 0x3ad8025fn;
    rndSeed = (rndSeed ^ JAVA_MULT) & (BIG_48 - 1n);

    rndSeed = (rndSeed * JAVA_MULT + JAVA_ADD) & (BIG_48 - 1n);
    const result = Number((rndSeed >> 17n) % 10n);

    return result === 0;
}

/**
 * Coordinate utilities
 */
const Coords = {
    blockToChunk(b) {
        return Math.floor(b / 16);
    },

    chunkToBlock(c) {
        return c * 16 + 8;
    },

    blockToScreen(blockX, blockZ, camera, canvasWidth, canvasHeight) {
        const screenX = (blockX - camera.centerBlockX) * camera.pixelsPerBlock + canvasWidth / 2;
        const screenY = (blockZ - camera.centerBlockZ) * camera.pixelsPerBlock + canvasHeight / 2;
        return { x: screenX, y: screenY };
    },

    screenToBlock(screenX, screenY, camera, canvasWidth, canvasHeight) {
        const blockX = (screenX - canvasWidth / 2) / camera.pixelsPerBlock + camera.centerBlockX;
        const blockZ = (screenY - canvasHeight / 2) / camera.pixelsPerBlock + camera.centerBlockZ;
        return { blockX, blockZ };
    }
};
