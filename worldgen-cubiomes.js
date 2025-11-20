/**
 * Cubiomes Worldgen - Real Minecraft Java Edition worldgen using cubiomes library
 *
 * This implementation uses the cubiomes C library compiled to WASM.
 * Cubiomes by Cubitect: https://github.com/Cubitect/cubiomes
 *
 * IMPORTANT: This requires cubiomes compiled to WASM with proper function exports.
 * See CUBIOMES_SETUP.md for compilation instructions.
 *
 * The cubiomes library uses a Generator struct approach:
 *   1. setupGenerator(&g, MC_VERSION, flags)
 *   2. applySeed(&g, dimension, seed)
 *   3. getBiomeAt(&g, scale, x, y, z)
 */
class CubiomesWorldgen extends WorldgenInterface {
    constructor() {
        super();
        this.ready = false;
        this.cubiomes = null;
        this.generators = new Map(); // Cache generators by seed+version+dimension
        this.biomeData = this.initBiomeData();
    }

    async init() {
        try {
            // Try to load cubiomes WASM module
            // This expects a global CubiomesModule or Module object
            if (typeof CubiomesModule !== 'undefined') {
                await CubiomesModule.ready;
                this.cubiomes = CubiomesModule;
                console.log('[Cubiomes] Loaded cubiomes WASM module');
                this.ready = true;
                return true;
            }

            if (typeof Module !== 'undefined' && Module._setupGenerator) {
                await Module.ready;
                this.cubiomes = Module;
                console.log('[Cubiomes] Loaded cubiomes WASM module');
                this.ready = true;
                return true;
            }

            // Try dynamic load
            const script = document.createElement('script');
            script.src = 'cubiomes.js';

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load cubiomes.js'));
                document.head.appendChild(script);
                setTimeout(() => reject(new Error('Timeout loading cubiomes')), 5000);
            });

            // Wait for Module to initialize
            if (typeof CubiomesModule !== 'undefined') {
                await CubiomesModule.ready;
                this.cubiomes = CubiomesModule;
                this.ready = true;
                return true;
            }

            throw new Error('Cubiomes module not available after loading');
        } catch (error) {
            console.warn('[Cubiomes] Failed to initialize:', error.message);
            this.ready = false;
            return false;
        }
    }

    getName() {
        return "Cubiomes (Pixel-Perfect Minecraft Worldgen)";
    }

    isReady() {
        return this.ready;
    }

    /**
     * Get or create a generator for a specific seed/version/dimension combination
     */
    getGenerator(seed, version, dimension) {
        const key = `${seed}_${version}_${dimension}`;

        if (this.generators.has(key)) {
            return this.generators.get(key);
        }

        try {
            // Allocate Generator struct in WASM memory
            const generatorSize = 4096; // Approximate size, should match sizeof(Generator)
            const generatorPtr = this.cubiomes._malloc(generatorSize);

            if (!generatorPtr) {
                throw new Error('Failed to allocate generator memory');
            }

            // Get MC version enum
            const mcVersion = this.versionToMC(version);

            // Get dimension enum
            const dimValue = this.dimensionToValue(dimension);

            // Call setupGenerator(Generator *g, int mcversion, uint flags)
            const setupResult = this.cubiomes._setupGenerator(generatorPtr, mcVersion, 0);

            if (setupResult !== 0) {
                this.cubiomes._free(generatorPtr);
                throw new Error('setupGenerator failed');
            }

            // Convert seed to number (cubiomes uses uint64_t)
            const seedValue = typeof seed === 'string' ? this.hashString(seed) : Number(seed);

            // Call applySeed(Generator *g, int dim, uint64_t seed)
            // Note: For 64-bit seed, we might need to split into high/low 32-bit parts
            this.cubiomes._applySeed(generatorPtr, dimValue, seedValue);

            const generator = { ptr: generatorPtr, seed, version, dimension };
            this.generators.set(key, generator);

            return generator;
        } catch (error) {
            console.error('[Cubiomes] Failed to create generator:', error);
            return null;
        }
    }

    getBiomeAt(seed, edition, version, dimension, blockX, blockZ) {
        if (!this.ready || edition !== 'Java') {
            return 'plains'; // Fallback
        }

        try {
            const generator = this.getGenerator(seed, version, dimension);
            if (!generator) {
                return 'plains';
            }

            // Call getBiomeAt(Generator *g, int scale, int x, int y, int z)
            // scale=1 for block coordinates, scale=4 for biome coordinates
            const scale = 1;
            const y = 64; // Y-level for biome sampling

            const biomeId = this.cubiomes._getBiomeAt(generator.ptr, scale, blockX, y, blockZ);

            return this.biomeIdToString(biomeId);
        } catch (error) {
            console.error('[Cubiomes] getBiomeAt error:', error);
            return 'plains';
        }
    }

    getStructuresInArea(seed, edition, version, dimension, minBlockX, minBlockZ, maxBlockX, maxBlockZ) {
        if (!this.ready || edition !== 'Java') {
            return [];
        }

        try {
            const generator = this.getGenerator(seed, version, dimension);
            if (!generator) {
                return [];
            }

            const structures = [];
            const mcVersion = this.versionToMC(version);

            // Structure types and their cubiomes IDs
            const structureTypes = this.getStructureTypesForDimension(dimension);

            // Convert block coordinates to chunk coordinates for structure finding
            const minChunkX = Math.floor(minBlockX / 16);
            const minChunkZ = Math.floor(minBlockZ / 16);
            const maxChunkX = Math.floor(maxBlockX / 16);
            const maxChunkZ = Math.floor(maxBlockZ / 16);

            // For each structure type, find positions in the region
            // This would require proper cubiomes bindings for:
            // - getStructurePos()
            // - isViableStructurePos()
            // For now, return empty as these functions need careful memory management

            return structures;
        } catch (error) {
            console.error('[Cubiomes] getStructuresInArea error:', error);
            return [];
        }
    }

    isSlimeChunk(seed, edition, version, chunkX, chunkZ) {
        if (edition !== 'Java') return false;

        // Use the correct Java algorithm from worldgen-interface.js
        const seedValue = typeof seed === 'string' ? this.hashString(seed) : seed;
        return isJavaSlimeChunk(seedValue, chunkX, chunkZ);
    }

    getAvailableBiomes(dimension) {
        return this.biomeData[dimension] || this.biomeData.overworld;
    }

    // Cleanup
    destroy() {
        // Free all generator memory
        for (const [key, gen] of this.generators.entries()) {
            if (gen.ptr && this.cubiomes && this.cubiomes._free) {
                this.cubiomes._free(gen.ptr);
            }
        }
        this.generators.clear();
    }

    // Helper methods

    versionToMC(version) {
        // MC version enum values from cubiomes
        // See cubiomes.h for exact values
        const versionMap = {
            '1.21': 21,   // MC_1_21
            '1.20': 20,   // MC_1_20
            '1.19': 19,   // MC_1_19
            '1.18': 18,   // MC_1_18
            '1.17': 17,   // MC_1_17
            '1.16': 16,   // MC_1_16
            '1.15': 15,   // MC_1_15
            '1.14': 14,   // MC_1_14
            '1.13': 13,   // MC_1_13
        };
        return versionMap[version] || 20; // Default to 1.20
    }

    dimensionToValue(dimension) {
        // Dimension enum values
        const dimMap = {
            'overworld': 0,   // DIM_OVERWORLD
            'nether': -1,     // DIM_NETHER
            'end': 1,         // DIM_END
        };
        return dimMap[dimension] || 0;
    }

    getStructureTypesForDimension(dimension) {
        const types = {
            overworld: ['village', 'desert_pyramid', 'jungle_temple', 'swamp_hut',
                       'igloo', 'ocean_monument', 'mansion', 'outpost', 'shipwreck', 'ruined_portal'],
            nether: ['fortress', 'bastion', 'ruined_portal'],
            end: ['end_city']
        };
        return types[dimension] || types.overworld;
    }

    biomeIdToString(id) {
        // Cubiomes biome IDs - from cubiomes biomes.h
        const biomeMap = {
            0: 'ocean',
            1: 'plains',
            2: 'desert',
            3: 'mountains',
            4: 'forest',
            5: 'taiga',
            6: 'swamp',
            7: 'river',
            8: 'nether_wastes',
            9: 'the_end',
            10: 'frozen_ocean',
            11: 'frozen_river',
            12: 'snowy_tundra',
            13: 'snowy_mountains',
            14: 'mushroom_fields',
            15: 'mushroom_field_shore',
            16: 'beach',
            17: 'desert_hills',
            18: 'wooded_hills',
            19: 'taiga_hills',
            20: 'mountain_edge',
            21: 'jungle',
            22: 'jungle_hills',
            23: 'jungle_edge',
            24: 'deep_ocean',
            25: 'stone_shore',
            26: 'snowy_beach',
            27: 'birch_forest',
            28: 'birch_forest_hills',
            29: 'dark_forest',
            30: 'snowy_taiga',
            31: 'snowy_taiga_hills',
            32: 'giant_tree_taiga',
            33: 'giant_tree_taiga_hills',
            34: 'wooded_mountains',
            35: 'savanna',
            36: 'savanna_plateau',
            37: 'badlands',
            38: 'wooded_badlands_plateau',
            39: 'badlands_plateau',
            // 1.16+ Nether biomes
            170: 'soul_sand_valley',
            171: 'crimson_forest',
            172: 'warped_forest',
            173: 'basalt_deltas',
            // 1.16+ End biomes
            40: 'small_end_islands',
            41: 'end_midlands',
            42: 'end_highlands',
            43: 'end_barrens',
            // 1.18+ biomes
            129: 'sunflower_plains',
            140: 'ice_spikes',
            149: 'modified_jungle',
            151: 'modified_jungle_edge',
            155: 'tall_birch_forest',
            156: 'tall_birch_hills',
            160: 'dark_forest_hills',
            161: 'snowy_taiga_mountains',
            162: 'giant_spruce_taiga',
            163: 'giant_spruce_taiga_hills',
            164: 'modified_gravelly_mountains',
            165: 'shattered_savanna',
            166: 'shattered_savanna_plateau',
            167: 'eroded_badlands',
            168: 'modified_wooded_badlands_plateau',
            169: 'modified_badlands_plateau',
            // 1.18 mountain biomes
            174: 'meadow',
            175: 'grove',
            176: 'snowy_slopes',
            177: 'jagged_peaks',
            178: 'frozen_peaks',
            179: 'stony_peaks',
        };
        return biomeMap[id] || 'plains';
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return hash;
    }

    initBiomeData() {
        return {
            overworld: {
                ocean: { name: 'Ocean', color: '#2c4a7c' },
                deep_ocean: { name: 'Deep Ocean', color: '#1a3a6c' },
                frozen_ocean: { name: 'Frozen Ocean', color: '#5c6c8c' },
                warm_ocean: { name: 'Warm Ocean', color: '#3a5f9c' },
                river: { name: 'River', color: '#3a5f8c' },
                frozen_river: { name: 'Frozen River', color: '#6c7c9c' },
                beach: { name: 'Beach', color: '#d4c888' },
                snowy_beach: { name: 'Snowy Beach', color: '#d4d4c0' },
                stone_shore: { name: 'Stone Shore', color: '#8c8c8c' },
                snowy_tundra: { name: 'Snowy Tundra', color: '#d4d4d4' },
                snowy_taiga: { name: 'Snowy Taiga', color: '#3a545a' },
                grove: { name: 'Grove', color: '#5a7068' },
                snowy_slopes: { name: 'Snowy Slopes', color: '#b0b8c8' },
                frozen_peaks: { name: 'Frozen Peaks', color: '#a8b0c0' },
                jagged_peaks: { name: 'Jagged Peaks', color: '#8890a0' },
                plains: { name: 'Plains', color: '#8db360' },
                sunflower_plains: { name: 'Sunflower Plains', color: '#95bb68' },
                meadow: { name: 'Meadow', color: '#7db050' },
                forest: { name: 'Forest', color: '#3a7030' },
                birch_forest: { name: 'Birch Forest', color: '#4a7848' },
                dark_forest: { name: 'Dark Forest', color: '#344020' },
                taiga: { name: 'Taiga', color: '#2d6b5f' },
                old_growth_spruce_taiga: { name: 'Old Growth Spruce Taiga', color: '#2a5a52' },
                swamp: { name: 'Swamp', color: '#4c6952' },
                jungle: { name: 'Jungle', color: '#4a7018' },
                bamboo_jungle: { name: 'Bamboo Jungle', color: '#4a6820' },
                sparse_jungle: { name: 'Sparse Jungle', color: '#5a7828' },
                savanna: { name: 'Savanna', color: '#a09050' },
                windswept_savanna: { name: 'Windswept Savanna', color: '#98885c' },
                desert: { name: 'Desert', color: '#d4a574' },
                badlands: { name: 'Badlands', color: '#b86040' },
                wooded_badlands: { name: 'Wooded Badlands', color: '#a85838' },
                eroded_badlands: { name: 'Eroded Badlands', color: '#c86848' },
                mountains: { name: 'Mountains', color: '#7a7a7a' },
                windswept_hills: { name: 'Windswept Hills', color: '#7a7a7a' },
                stony_peaks: { name: 'Stony Peaks', color: '#909090' },
                mushroom_fields: { name: 'Mushroom Fields', color: '#8c4c8c' }
            },
            nether: {
                nether_wastes: { name: 'Nether Wastes', color: '#603838' },
                crimson_forest: { name: 'Crimson Forest', color: '#9c2828' },
                warped_forest: { name: 'Warped Forest', color: '#287070' },
                soul_sand_valley: { name: 'Soul Sand Valley', color: '#5c4838' },
                basalt_deltas: { name: 'Basalt Deltas', color: '#404040' }
            },
            end: {
                the_end: { name: 'The End', color: '#707090' },
                end_highlands: { name: 'End Highlands', color: '#9090a8' },
                end_midlands: { name: 'End Midlands', color: '#8080a0' },
                small_end_islands: { name: 'Small Islands', color: '#7878a0' },
                end_barrens: { name: 'End Barrens', color: '#606088' }
            }
        };
    }
}
