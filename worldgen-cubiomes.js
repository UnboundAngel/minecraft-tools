/**
 * Cubiomes Worldgen - Real Minecraft Java Edition worldgen using cubiomes library
 * Uses cubiomes C library compiled to WASM (cubiomes.js / cubiomes.wasm).
 *
 * Requires:
 *   - cubiomes.wasm and cubiomes.js in the same directory as seed_explorer.html
 *   - build_wasm.sh compiled with:
 *       -s MODULARIZE=1
 *       -s EXPORT_NAME="CubiomesModule"
 *       -s EXPORTED_FUNCTIONS="[...]"
 */

class CubiomesWorldgen extends WorldgenInterface {
    constructor() {
        super();
        this.ready = false;
        this.cubiomes = null;          // Emscripten Module instance
        this.generators = new Map();   // key: seed_version_dim -> {ptr, seed, version, dimension}
        this.biomeData = this.initBiomeData();

        // Auto-detected enum for "latest supported MC version" inside cubiomes
        this.latestMcEnum = 0;
    }

    async init() {
        try {
            if (this.ready && this.cubiomes) return true;

            // 1) Already-loaded modular build: CubiomesModule() factory
            if (typeof CubiomesModule === "function") {
                this.cubiomes = await CubiomesModule();
                console.log("[Cubiomes] Loaded cubiomes WASM (CubiomesModule factory)");
            }
            // 2) Global Module object (non-modular build)
            else if (typeof Module === "object" && Module._setupGenerator) {
                this.cubiomes = Module;
                console.log("[Cubiomes] Loaded cubiomes WASM (global Module)");
            }
            // 3) Dynamically inject script then retry 1/2
            else {
                await new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "cubiomes.js";
                    script.onload = resolve;
                    script.onerror = () => reject(new Error("Failed to load cubiomes.js"));
                    document.head.appendChild(script);
                });

                if (typeof CubiomesModule === "function") {
                    this.cubiomes = await CubiomesModule();
                    console.log("[Cubiomes] Loaded cubiomes WASM after dynamic script (CubiomesModule)");
                } else if (typeof Module === "object" && Module._setupGenerator) {
                    this.cubiomes = Module;
                    console.log("[Cubiomes] Loaded cubiomes WASM after dynamic script (Module)");
                } else {
                    throw new Error("cubiomes.js loaded but Module/CubiomesModule not found");
                }
            }

            // Sanity check for required symbols
            if (!this.cubiomes._setupGenerator ||
                !this.cubiomes._applySeed ||
                !this.cubiomes._getBiomeAt ||
                !this.cubiomes._malloc ||
                !this.cubiomes._free) {
                throw new Error("cubiomes Module missing required exports (_setupGenerator/_applySeed/_getBiomeAt/_malloc/_free)");
            }

            // Auto-detect the highest valid MC version enum inside cubiomes
            this.detectLatestMcEnum();

            this.ready = true;
            return true;
        } catch (err) {
            console.warn("[Cubiomes] Failed to initialize:", err);
            this.ready = false;
            this.cubiomes = null;
            return false;
        }
    }

    /**
     * Probe cubiomes._setupGenerator with candidate version enums and keep
     * the highest value that returns 0 (success).
     * This avoids hard-coding internal enum values.
     */
    detectLatestMcEnum() {
        // cubiomes Generator struct is LARGE - needs ~128KB
        const genSize = 131072; // 128KB should be plenty
        const ptr = this.cubiomes._malloc(genSize);
        if (!ptr) {
            console.warn("[Cubiomes] Could not allocate probe generator; defaulting mc enum to 0");
            this.latestMcEnum = 0;
            return;
        }

        let lastGood = 0;
        // Reasonable scan range – cubiomes does not use huge enums
        for (let v = 0; v < 64; v++) {
            const r = this.cubiomes._setupGenerator(ptr, v, 0);
            if (r === 0) {
                lastGood = v;
            }
        }

        this.cubiomes._free(ptr);
        this.latestMcEnum = lastGood;
        console.log("[Cubiomes] Auto-detected latest MC version enum:", this.latestMcEnum);
    }

    getName() {
        return "Cubiomes (Pixel-Perfect Minecraft Worldgen)";
    }

    isReady() {
        return this.ready;
    }

    /**
     * Map UI version string to cubiomes internal enum.
     * For now, all 1.18+ versions share the latest enum value we probed.
     */
    versionToMC(version) {
        if (!this.cubiomes) return 0;

        // If you later want finer control, you can branch here:
        // e.g. if (version.startsWith("1.16")) return someEnumFor116;
        // For now: use the highest working enum for everything.
        return this.latestMcEnum;
    }

    dimensionToValue(dimension) {
        // These are the usual cubiomes values; they match upstream defaults.
        const dimMap = {
            overworld: 0,   // DIM_OVERWORLD
            nether:   -1,   // DIM_NETHER
            end:       1,   // DIM_END
        };
        return dimMap[dimension] ?? 0;
    }

    /**
     * Get or create a generator for a specific seed/version/dimension combination.
     */
    getGenerator(seed, version, dimension) {
        const key = `${seed}_${version}_${dimension}`;
        if (this.generators.has(key)) return this.generators.get(key);

        try {
            // cubiomes Generator struct is LARGE - needs ~128KB
            const genSize = 131072; // 128KB
            const ptr = this.cubiomes._malloc(genSize);
            if (!ptr) throw new Error("malloc failed for Generator");

            const mcVersionEnum = this.versionToMC(version);
            const dimEnum = this.dimensionToValue(dimension);

            const r = this.cubiomes._setupGenerator(ptr, mcVersionEnum, 0);
            if (r !== 0) {
                this.cubiomes._free(ptr);
                throw new Error("setupGenerator failed");
            }

            const seedValue = typeof seed === "string" ? this.hashString(seed) : Number(seed);
            this.cubiomes._applySeed(ptr, dimEnum, seedValue);

            const gen = { ptr, seed, version, dimension };
            this.generators.set(key, gen);
            return gen;
        } catch (err) {
            console.error("[Cubiomes] Failed to create generator:", err);
            return null;
        }
    }

    getBiomeAt(seed, edition, version, dimension, blockX, blockZ) {
        if (!this.ready || edition !== "Java") return "plains";

        try {
            const gen = this.getGenerator(seed, version, dimension);
            if (!gen) return "plains";

            const scale = 1;
            const y = 64;
            const biomeId = this.cubiomes._getBiomeAt(gen.ptr, scale, blockX | 0, y, blockZ | 0);
            return this.biomeIdToString(biomeId | 0);
        } catch (err) {
            console.error("[Cubiomes] getBiomeAt error:", err);
            return "plains";
        }
    }

    getStructuresInArea(seed, edition, version, dimension,
                        minBlockX, minBlockZ, maxBlockX, maxBlockZ) {
        if (!this.ready || edition !== "Java") return [];

        try {
            const gen = this.getGenerator(seed, version, dimension);
            if (!gen) return [];

            const structures = [];
            // TODO: wire to cubiomes getStructurePos / isViableStructurePos
            // For now, leave structure search empty but non-crashing.
            return structures;
        } catch (err) {
            console.error("[Cubiomes] getStructuresInArea error:", err);
            return [];
        }
    }

    isSlimeChunk(seed, edition, version, chunkX, chunkZ) {
        if (edition !== "Java") return false;
        const seedValue = typeof seed === "string" ? this.hashString(seed) : seed;
        return isJavaSlimeChunk(seedValue, chunkX, chunkZ);
    }

    getAvailableBiomes(dimension) {
        return this.biomeData[dimension] || this.biomeData.overworld;
    }

    destroy() {
        if (!this.cubiomes) return;
        for (const [, gen] of this.generators.entries()) {
            if (gen.ptr) this.cubiomes._free(gen.ptr);
        }
        this.generators.clear();
    }

    biomeIdToString(id) {
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
            170: 'soul_sand_valley',
            171: 'crimson_forest',
            172: 'warped_forest',
            173: 'basalt_deltas',
            40: 'small_end_islands',
            41: 'end_midlands',
            42: 'end_highlands',
            43: 'end_barrens',
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
            hash |= 0;
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
