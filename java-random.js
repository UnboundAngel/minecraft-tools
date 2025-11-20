/**
 * JavaRandom - JavaScript implementation of java.util.Random
 * Based on the Linear Congruential Generator used by Java
 *
 * This produces the same random sequences as Java when given the same seed.
 * Required for accurate Minecraft worldgen that matches the game.
 */
class JavaRandom {
    constructor(seed = Date.now()) {
        this.setSeed(seed);
    }

    setSeed(seed) {
        // Java's LCG constants
        const MULTIPLIER = 0x5DEECE66Dn;
        const ADDEND = 0xBn;
        const MASK = (1n << 48n) - 1n;

        // Convert seed to BigInt and XOR with multiplier
        const seedBigInt = BigInt(seed);
        this.seed = (seedBigInt ^ MULTIPLIER) & MASK;
    }

    // Generate next 32 bits
    next(bits) {
        const MULTIPLIER = 0x5DEECE66Dn;
        const ADDEND = 0xBn;
        const MASK = (1n << 48n) - 1n;

        this.seed = (this.seed * MULTIPLIER + ADDEND) & MASK;
        return Number(this.seed >> BigInt(48 - bits));
    }

    nextInt(bound) {
        if (!bound) {
            return this.next(32);
        }

        // Special case for powers of 2
        if ((bound & -bound) === bound) {
            return Number((BigInt(bound) * BigInt(this.next(31))) >> 31n);
        }

        let bits, val;
        do {
            bits = this.next(31);
            val = bits % bound;
        } while (bits - val + (bound - 1) < 0);

        return val;
    }

    nextLong() {
        return (BigInt(this.next(32)) << 32n) + BigInt(this.next(32));
    }

    nextFloat() {
        return this.next(24) / (1 << 24);
    }

    nextDouble() {
        return ((this.next(26) << 27) + this.next(27)) / (1 << 53);
    }

    nextBoolean() {
        return this.next(1) !== 0;
    }

    nextGaussian() {
        if (this.hasNextGaussian) {
            this.hasNextGaussian = false;
            return this.nextGaussianValue;
        }

        let v1, v2, s;
        do {
            v1 = 2 * this.nextDouble() - 1;
            v2 = 2 * this.nextDouble() - 1;
            s = v1 * v1 + v2 * v2;
        } while (s >= 1 || s === 0);

        const multiplier = Math.sqrt(-2 * Math.log(s) / s);
        this.nextGaussianValue = v2 * multiplier;
        this.hasNextGaussian = true;
        return v1 * multiplier;
    }
}
