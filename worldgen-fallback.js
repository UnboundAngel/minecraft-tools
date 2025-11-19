/**
 * Fallback Worldgen - Approximate worldgen for when cubiomes is not available
 *
 * ⚠️ IMPORTANT: This is NOT real Minecraft worldgen!
 * This uses simplified multi-octave noise to generate plausible-looking biomes,
 * but positions will NOT match real Minecraft worlds.
 *
 * Structures are placed using a deterministic grid system, not real Minecraft logic.
 *
 * Use CubiomesWorldgen for accurate results.
 */
class FallbackWorldgen extends WorldgenInterface {
    constructor() {
        super();
        this.ready = true;
        this.biomeData = this.initBiomeData();
    }

    async init() {
        console.log('[Fallback] Using approximate worldgen (NOT real Minecraft)');
        return true;
    }

    getName() {
        return "Fallback (Approximate - NOT Real Minecraft)";
    }

    isReady() {
        return this.ready;
    }

    // Deterministic hash function
    hash(seed, x, z, n = 0) {
        let h = (seed | 0);
        h = Math.imul(h ^ x, 374761393);
        h = Math.imul(h ^ z, 668265263);
        h = Math.imul(h ^ n, 1274126177);
        h ^= h >>> 13;
        h = Math.imul(h, 1274126177);
        h ^= h >>> 16;
        return h;
    }

    // Multi-octave noise
    noise(seed, x, z, scale, octaves = 4) {
        let total = 0;
        let frequency = 1 / scale;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            const fx = x * frequency;
            const fz = z * frequency;
            const ix = Math.floor(fx);
            const iz = Math.floor(fz);
            const dx = fx - ix;
            const dz = fz - iz;

            // Sample corners
            const h00 = this.hash(seed, ix, iz, i);
            const h10 = this.hash(seed, ix + 1, iz, i);
            const h01 = this.hash(seed, ix, iz + 1, i);
            const h11 = this.hash(seed, ix + 1, iz + 1, i);

            // Convert to -1..1
            const v00 = ((h00 >>> 0) / 4294967296) * 2 - 1;
            const v10 = ((h10 >>> 0) / 4294967296) * 2 - 1;
            const v01 = ((h01 >>> 0) / 4294967296) * 2 - 1;
            const v11 = ((h11 >>> 0) / 4294967296) * 2 - 1;

            // Smooth interpolation
            const sx = dx * dx * (3 - 2 * dx);
            const sz = dz * dz * (3 - 2 * dz);

            const v0 = v00 * (1 - sx) + v10 * sx;
            const v1 = v01 * (1 - sx) + v11 * sx;
            const value = v0 * (1 - sz) + v1 * sz;

            total += value * amplitude;
            maxValue += amplitude;

            amplitude *= 0.5;
            frequency *= 2;
        }

        return total / maxValue;
    }

    getBiomeAt(seed, edition, version, dimension, blockX, blockZ) {
        const numSeed = typeof seed === 'string' ? this.hashString(seed) : Number(seed);

        // Generate terrain parameters using multi-octave noise
        const temperature = this.noise(numSeed, blockX, blockZ, 600, 4);
        const humidity = this.noise(numSeed + 1000, blockX, blockZ, 600, 4);
        const continentalness = this.noise(numSeed + 2000, blockX, blockZ, 1200, 3);
        const erosion = this.noise(numSeed + 3000, blockX, blockZ, 300, 2);
        const weirdness = this.noise(numSeed + 4000, blockX, blockZ, 400, 3);

        if (dimension === 'nether') {
            return this.getNetherBiome(temperature, humidity, erosion);
        } else if (dimension === 'end') {
            return this.getEndBiome(blockX, blockZ, erosion, weirdness);
        }

        // Overworld biomes
        return this.getOverworldBiome(temperature, humidity, continentalness, erosion, weirdness, blockX, blockZ, numSeed);
    }

    getOverworldBiome(temp, humid, continent, erosion, weird, blockX, blockZ, seed) {
        // Oceans at low continentalness
        if (continent < -0.35) {
            if (temp < -0.4) return 'frozen_ocean';
            if (continent < -0.55) return 'deep_ocean';
            return 'ocean';
        }

        // Beaches at ocean edges
        if (continent < -0.25) {
            return temp < -0.3 ? 'snowy_beach' : 'beach';
        }

        // Rivers as thin noise lines
        const riverNoise = this.noise(seed + 5000, blockX, blockZ, 450, 2);
        if (Math.abs(riverNoise) < 0.04 && continent > -0.2 && continent < 0.6) {
            return temp < -0.3 ? 'frozen_river' : 'river';
        }

        // Mushroom fields (rare)
        if (continent > 0.75 && humid > 0.7 && Math.abs(weird) < 0.2) {
            return 'mushroom_fields';
        }

        // Temperature-based biomes
        if (temp < -0.45) {
            // Very cold
            if (erosion > 0.6) return 'snowy_mountains';
            if (humid > 0.3) return 'snowy_taiga';
            return 'snowy_tundra';
        } else if (temp < -0.15) {
            // Cold
            if (erosion > 0.5) return 'mountains';
            if (humid > 0.4) return 'taiga';
            if (humid > 0.0) return 'birch_forest';
            return 'plains';
        } else if (temp < 0.25) {
            // Temperate
            if (humid < -0.35) return 'plains';
            if (humid > 0.45) return 'dark_forest';
            if (humid > 0.25) return 'swamp';
            if (humid > 0.0) return 'forest';
            return 'birch_forest';
        } else if (temp < 0.55) {
            // Warm
            if (humid < -0.2) {
                if (erosion > 0.4) return 'badlands';
                return 'desert';
            }
            if (humid > 0.4) return 'jungle';
            return 'savanna';
        } else {
            // Hot
            if (erosion > 0.5) return 'badlands';
            return 'desert';
        }
    }

    getNetherBiome(temp, humid, erosion) {
        if (temp < -0.3) return 'soul_sand_valley';
        if (temp > 0.4) return 'crimson_forest';
        if (humid > 0.3) return 'warped_forest';
        if (erosion > 0.5) return 'basalt_deltas';
        return 'nether_wastes';
    }

    getEndBiome(blockX, blockZ, erosion, weird) {
        const distFromCenter = Math.sqrt(blockX * blockX + blockZ * blockZ);
        if (distFromCenter < 1000) return 'the_end';
        if (distFromCenter > 2000 && erosion > 0.3) return 'end_highlands';
        if (distFromCenter > 2000) return 'end_midlands';
        if (weird < -0.3) return 'small_end_islands';
        return 'end_barrens';
    }

    getStructuresInArea(seed, edition, version, dimension, minBlockX, minBlockZ, maxBlockX, maxBlockZ) {
        const structures = [];
        const numSeed = typeof seed === 'string' ? this.hashString(seed) : Number(seed);

        // Use region-based structure placement (approximate)
        const regionSize = 640; // Larger regions = fewer structures
        const structureTypes = this.getStructureTypesForDimension(dimension);

        const minRegionX = Math.floor(minBlockX / regionSize);
        const maxRegionX = Math.floor(maxBlockX / regionSize);
        const minRegionZ = Math.floor(minBlockZ / regionSize);
        const maxRegionZ = Math.floor(maxBlockZ / regionSize);

        for (let rx = minRegionX; rx <= maxRegionX; rx++) {
            for (let rz = minRegionZ; rz <= maxRegionZ; rz++) {
                for (let typeIdx = 0; typeIdx < structureTypes.length; typeIdx++) {
                    const h = this.hash(numSeed, rx, rz, typeIdx);
                    const chance = ((h >>> 0) / 4294967296);

                    // 20% chance per structure type per region
                    if (chance < 0.2) {
                        const offsetX = ((h >>> 8) & 0xFF) * 2;
                        const offsetZ = ((h >>> 16) & 0xFF) * 2;
                        const blockX = rx * regionSize + offsetX;
                        const blockZ = rz * regionSize + offsetZ;

                        if (blockX >= minBlockX && blockX <= maxBlockX &&
                            blockZ >= minBlockZ && blockZ <= maxBlockZ) {

                            // Biome filtering (approximate)
                            const biome = this.getBiomeAt(seed, edition, version, dimension, blockX, blockZ);
                            if (this.canStructureSpawnInBiome(structureTypes[typeIdx], biome)) {
                                structures.push({
                                    type: structureTypes[typeIdx],
                                    blockX: blockX,
                                    blockZ: blockZ
                                });
                            }
                        }
                    }
                }
            }
        }

        return structures;
    }

    getStructureTypesForDimension(dimension) {
        const types = {
            overworld: ['village', 'desert_pyramid', 'jungle_temple', 'swamp_hut',
                       'ocean_monument', 'mansion', 'outpost', 'shipwreck'],
            nether: ['fortress', 'bastion'],
            end: ['end_city']
        };
        return types[dimension] || types.overworld;
    }

    canStructureSpawnInBiome(structureType, biome) {
        const rules = {
            village: !biome.includes('ocean') && !biome.includes('mountains'),
            desert_pyramid: biome.includes('desert'),
            jungle_temple: biome.includes('jungle'),
            swamp_hut: biome.includes('swamp'),
            ocean_monument: biome.includes('ocean'),
            mansion: biome.includes('forest'),
            outpost: !biome.includes('ocean'),
            shipwreck: true, // Can spawn anywhere
            fortress: true, // Nether
            bastion: true, // Nether
            end_city: true, // End
        };
        return rules[structureType] !== false;
    }

    isSlimeChunk(seed, edition, version, chunkX, chunkZ) {
        if (edition !== 'Java') return false;

        // Use the REAL Java algorithm
        const numSeed = typeof seed === 'string' ? this.hashString(seed) : seed;
        return isJavaSlimeChunk(numSeed, chunkX, chunkZ);
    }

    getAvailableBiomes(dimension) {
        return this.biomeData[dimension] || this.biomeData.overworld;
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
                river: { name: 'River', color: '#3a5f8c' },
                frozen_river: { name: 'Frozen River', color: '#6c7c9c' },
                beach: { name: 'Beach', color: '#d4c888' },
                snowy_beach: { name: 'Snowy Beach', color: '#d4d4c0' },
                plains: { name: 'Plains', color: '#8db360' },
                forest: { name: 'Forest', color: '#3a7030' },
                birch_forest: { name: 'Birch Forest', color: '#4a7848' },
                dark_forest: { name: 'Dark Forest', color: '#344020' },
                taiga: { name: 'Taiga', color: '#2d6b5f' },
                snowy_taiga: { name: 'Snowy Taiga', color: '#3a545a' },
                swamp: { name: 'Swamp', color: '#4c6952' },
                jungle: { name: 'Jungle', color: '#4a7018' },
                desert: { name: 'Desert', color: '#d4a574' },
                savanna: { name: 'Savanna', color: '#a09050' },
                badlands: { name: 'Badlands', color: '#b86040' },
                mushroom_fields: { name: 'Mushroom Fields', color: '#8c4c8c' },
                snowy_tundra: { name: 'Snowy Tundra', color: '#d4d4d4' },
                snowy_mountains: { name: 'Snowy Mountains', color: '#a0a0a0' },
                mountains: { name: 'Mountains', color: '#7a7a7a' },
            },
            nether: {
                nether_wastes: { name: 'Nether Wastes', color: '#603838' },
                crimson_forest: { name: 'Crimson Forest', color: '#9c2828' },
                warped_forest: { name: 'Warped Forest', color: '#287070' },
                soul_sand_valley: { name: 'Soul Sand Valley', color: '#5c4838' },
                basalt_deltas: { name: 'Basalt Deltas', color: '#404040' },
            },
            end: {
                the_end: { name: 'The End', color: '#707090' },
                end_highlands: { name: 'End Highlands', color: '#9090a8' },
                end_midlands: { name: 'End Midlands', color: '#8080a0' },
                small_end_islands: { name: 'Small Islands', color: '#7878a0' },
                end_barrens: { name: 'End Barrens', color: '#606088' },
            }
        };
    }
}
