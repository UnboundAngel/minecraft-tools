/**
 * Cubiomes Worldgen - Real Minecraft Java Edition worldgen using cubiomes library
 *
 * This implementation uses the cubiomes C library compiled to WASM.
 * Cubiomes by Cubitect: https://github.com/Cubitect/cubiomes
 *
 * To use this, you need cubiomes.wasm and cubiomes.js in the same directory.
 * You can build these from the cubiomes repository or use pre-built versions
 * from cubiomes-viewer or other projects.
 */
class CubiomesWorldgen extends WorldgenInterface {
    constructor() {
        super();
        this.ready = false;
        this.cubiomes = null;
        this.biomeColors = this.initBiomeColors();
    }

    async init() {
        try {
            // Try to load cubiomes WASM module
            // This expects cubiomes.js and cubiomes.wasm to be available
            if (typeof Module !== 'undefined' && Module.ccall) {
                this.cubiomes = Module;
                console.log('[Cubiomes] Loaded cubiomes WASM module');
                this.ready = true;
                return true;
            }

            // Try dynamic import if available
            const script = document.createElement('script');
            script.src = 'cubiomes.js';

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load cubiomes.js'));
                document.head.appendChild(script);
            });

            // Wait for Module to initialize
            if (typeof Module !== 'undefined') {
                await Module.ready;
                this.cubiomes = Module;
                console.log('[Cubiomes] Successfully initialized cubiomes');
                this.ready = true;
                return true;
            }

            throw new Error('Cubiomes module not available');
        } catch (error) {
            console.warn('[Cubiomes] Failed to initialize:', error.message);
            this.ready = false;
            return false;
        }
    }

    getName() {
        return "Cubiomes (Real Minecraft Worldgen)";
    }

    isReady() {
        return this.ready;
    }

    getBiomeAt(seed, edition, version, dimension, blockX, blockZ) {
        if (!this.ready || edition !== 'Java') {
            return 'plains'; // Fallback
        }

        try {
            // Convert version to MC version code
            const mcVersion = this.versionToMC(version);

            // Call cubiomes C function via WASM
            // int getBiomeAt(int mcVersion, uint64_t seed, int x, int y, int z);
            const biomeId = this.cubiomes.ccall(
                'getBiomeAt',
                'number',
                ['number', 'number', 'number', 'number', 'number'],
                [mcVersion, Number(seed), blockX, 64, blockZ]
            );

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
            const mcVersion = this.versionToMC(version);
            const structures = [];

            // Structure types to check
            const structureTypes = this.getStructureTypesForDimension(dimension);

            for (const structType of structureTypes) {
                // Call cubiomes structure finder
                // This is a simplified example - real implementation would need proper C bindings
                const found = this.findStructuresOfType(seed, mcVersion, structType, minBlockX, minBlockZ, maxBlockX, maxBlockZ);
                structures.push(...found);
            }

            return structures;
        } catch (error) {
            console.error('[Cubiomes] getStructuresInArea error:', error);
            return [];
        }
    }

    findStructuresOfType(seed, mcVersion, structType, minX, minZ, maxX, maxZ) {
        // This would call cubiomes C functions to find structures
        // For now, return empty array as this requires proper C bindings
        // Real implementation would use functions like:
        // - getStructurePos() for various structure types
        // - isViableStructurePos() to check if structure can generate
        return [];
    }

    isSlimeChunk(seed, edition, version, chunkX, chunkZ) {
        if (edition !== 'Java') return false;

        // Use the correct Java algorithm
        return isJavaSlimeChunk(seed, chunkX, chunkZ);
    }

    getAvailableBiomes(dimension) {
        const biomes = {};
        const biomeList = this.getBiomeListForDimension(dimension);

        for (const biomeId of biomeList) {
            const name = this.biomeIdToName(biomeId);
            const color = this.biomeColors[biomeId] || '#666666';
            biomes[biomeId] = { name, color };
        }

        return biomes;
    }

    // Helper methods

    versionToMC(version) {
        const versionMap = {
            '1.21': 21, // MC_1_21
            '1.20': 20, // MC_1_20
            '1.19': 19, // MC_1_19
            '1.18': 18, // MC_1_18
            '1.17': 17, // MC_1_17
            '1.16': 16, // MC_1_16
        };
        return versionMap[version] || 20;
    }

    getStructureTypesForDimension(dimension) {
        const types = {
            overworld: ['village', 'desert_pyramid', 'jungle_temple', 'swamp_hut',
                       'igloo', 'ocean_monument', 'mansion', 'outpost', 'shipwreck'],
            nether: ['fortress', 'bastion'],
            end: ['end_city']
        };
        return types[dimension] || types.overworld;
    }

    getBiomeListForDimension(dimension) {
        if (dimension === 'overworld') {
            return ['ocean', 'plains', 'desert', 'mountains', 'forest', 'taiga',
                   'swamp', 'river', 'frozen_ocean', 'frozen_river', 'snowy_tundra',
                   'snowy_mountains', 'mushroom_fields', 'beach', 'jungle', 'jungle_hills',
                   'jungle_edge', 'deep_ocean', 'stone_shore', 'snowy_beach', 'birch_forest',
                   'dark_forest', 'snowy_taiga', 'savanna', 'badlands'];
        } else if (dimension === 'nether') {
            return ['nether_wastes', 'crimson_forest', 'warped_forest', 'soul_sand_valley', 'basalt_deltas'];
        } else {
            return ['the_end', 'end_highlands', 'end_midlands', 'small_end_islands', 'end_barrens'];
        }
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
            10: 'frozen_ocean',
            11: 'frozen_river',
            12: 'snowy_tundra',
            14: 'mushroom_fields',
            16: 'beach',
            21: 'jungle',
            24: 'deep_ocean',
            27: 'birch_forest',
            29: 'dark_forest',
            30: 'snowy_taiga',
            35: 'savanna',
            37: 'badlands',
            // Nether
            8: 'nether_wastes',
            170: 'crimson_forest',
            171: 'warped_forest',
            172: 'soul_sand_valley',
            173: 'basalt_deltas',
            // End
            9: 'the_end',
            40: 'end_highlands',
            41: 'end_midlands',
            42: 'small_end_islands',
            43: 'end_barrens',
        };
        return biomeMap[id] || 'plains';
    }

    biomeIdToName(biomeId) {
        const names = {
            ocean: 'Ocean',
            plains: 'Plains',
            desert: 'Desert',
            mountains: 'Mountains',
            forest: 'Forest',
            taiga: 'Taiga',
            swamp: 'Swamp',
            river: 'River',
            frozen_ocean: 'Frozen Ocean',
            frozen_river: 'Frozen River',
            snowy_tundra: 'Snowy Tundra',
            mushroom_fields: 'Mushroom Fields',
            beach: 'Beach',
            jungle: 'Jungle',
            deep_ocean: 'Deep Ocean',
            birch_forest: 'Birch Forest',
            dark_forest: 'Dark Forest',
            snowy_taiga: 'Snowy Taiga',
            savanna: 'Savanna',
            badlands: 'Badlands',
            nether_wastes: 'Nether Wastes',
            crimson_forest: 'Crimson Forest',
            warped_forest: 'Warped Forest',
            soul_sand_valley: 'Soul Sand Valley',
            basalt_deltas: 'Basalt Deltas',
            the_end: 'The End',
            end_highlands: 'End Highlands',
            end_midlands: 'End Midlands',
            small_end_islands: 'Small End Islands',
            end_barrens: 'End Barrens',
        };
        return names[biomeId] || biomeId;
    }

    initBiomeColors() {
        // Readable, slightly desaturated biome colors
        return {
            ocean: '#2c4a7c',
            plains: '#8db360',
            desert: '#d4a574',
            mountains: '#7a7a7a',
            forest: '#3a7030',
            taiga: '#2d6b5f',
            swamp: '#4c6952',
            river: '#3a5f8c',
            frozen_ocean: '#5c6c8c',
            frozen_river: '#6c7c9c',
            snowy_tundra: '#d4d4d4',
            mushroom_fields: '#8c4c8c',
            beach: '#d4c888',
            jungle: '#4a7018',
            deep_ocean: '#1a3a6c',
            birch_forest: '#4a7848',
            dark_forest: '#344020',
            snowy_taiga: '#3a545a',
            savanna: '#a09050',
            badlands: '#b86040',
            nether_wastes: '#603838',
            crimson_forest: '#9c2828',
            warped_forest: '#287070',
            soul_sand_valley: '#5c4838',
            basalt_deltas: '#404040',
            the_end: '#707090',
            end_highlands: '#9090a8',
            end_midlands: '#8080a0',
            small_end_islands: '#7878a0',
            end_barrens: '#606088',
        };
    }
}
