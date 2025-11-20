/**
 * PerlinNoise - Improved Perlin Noise implementation
 * Based on Ken Perlin's improved noise algorithm
 *
 * This is used by Minecraft for terrain generation since 1.18+
 */
class PerlinNoise {
    constructor(random) {
        // Initialize permutation table using JavaRandom for deterministic seeding
        this.p = new Array(512);
        const perm = new Array(256);

        // Fill with 0-255
        for (let i = 0; i < 256; i++) {
            perm[i] = i;
        }

        // Shuffle using Fisher-Yates with JavaRandom
        for (let i = 255; i > 0; i--) {
            const j = random.nextInt(i + 1);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }

        // Duplicate for overflow handling
        for (let i = 0; i < 512; i++) {
            this.p[i] = perm[i & 255];
        }
    }

    // Fade function: 6t^5 - 15t^4 + 10t^3
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    // Linear interpolation
    lerp(t, a, b) {
        return a + t * (b - a);
    }

    // Gradient function
    grad(hash, x, y, z) {
        // Convert low 4 bits of hash into 12 gradient directions
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    // 3D Perlin noise
    noise(x, y, z) {
        // Find unit cube containing point
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        // Find relative position in cube
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        // Hash coordinates of cube corners
        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        // Add blended results from 8 corners of cube
        return this.lerp(w,
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x - 1, y, z)
                ),
                this.lerp(u,
                    this.grad(this.p[AB], x, y - 1, z),
                    this.grad(this.p[BB], x - 1, y - 1, z)
                )
            ),
            this.lerp(v,
                this.lerp(u,
                    this.grad(this.p[AA + 1], x, y, z - 1),
                    this.grad(this.p[BA + 1], x - 1, y, z - 1)
                ),
                this.lerp(u,
                    this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1)
                )
            )
        );
    }

    // 2D Perlin noise (z = 0)
    noise2D(x, z) {
        return this.noise(x, 0, z);
    }
}

/**
 * OctaveNoise - Multi-octave noise generator
 * Implements fractional Brownian motion (fBm) by layering multiple octaves
 *
 * This is how Minecraft generates its climate parameters
 */
class OctaveNoise {
    constructor(random, octaves, amplitudes = null) {
        this.octaves = [];
        this.amplitudes = amplitudes || new Array(octaves).fill(1.0);

        // Create multiple PerlinNoise instances, each with different random state
        for (let i = 0; i < octaves; i++) {
            this.octaves.push(new PerlinNoise(random));
        }
    }

    // Sample noise at (x, y, z) combining all octaves
    sample(x, y, z) {
        let result = 0;
        let scale = 1;

        for (let i = 0; i < this.octaves.length; i++) {
            // Each octave samples at double the frequency
            result += this.octaves[i].noise(x * scale, y * scale, z * scale) * this.amplitudes[i];
            scale *= 2;
        }

        return result;
    }

    // 2D sampling
    sample2D(x, z) {
        return this.sample(x, 0, z);
    }
}
