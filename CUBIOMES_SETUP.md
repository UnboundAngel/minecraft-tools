# Cubiomes WASM Setup Guide

This guide explains how to add **pixel-perfect Minecraft worldgen** to the Seed Explorer using the cubiomes library.

## Overview

The Seed Explorer currently uses a JavaScript implementation with real Perlin noise algorithms (see `minecraft-worldgen.js`). This is accurate but not pixel-perfect to Minecraft.

For **100% accurate biome generation** that matches Minecraft exactly, you can add cubiomes WASM compiled from the official cubiomes C library.

## Current State

- ✅ **WorldgenInterface** abstraction layer (all worldgen goes through this)
- ✅ **MinecraftWorldgen** - JavaScript implementation with real Perlin noise
- ✅ **CubiomesWorldgen** - Ready to load cubiomes WASM (just needs the files)
- ✅ **FallbackWorldgen** - Simple fallback (not recommended)

The `app.js` will automatically try loading cubiomes WASM first, then fall back to MinecraftWorldgen.

## Option 1: Use Pre-Compiled WASM (Easiest)

Several projects have already compiled cubiomes to WASM:

### A. From TrinTragula/seeder

[seeder](https://github.com/TrinTragula/seeder) is a React app that uses cubiomes WASM.

```bash
git clone https://github.com/TrinTragula/seeder
cd seeder
# Look for compiled WASM files in build/ or dist/ directories
find . -name "*.wasm" -o -name "cubiomes.js"
```

Copy `cubiomes.wasm` and `cubiomes.js` to your project root.

### B. From lspgn/worker-biomes

[worker-biomes](https://github.com/lspgn/worker-biomes) uses cubiomes with Cloudflare Workers.

```bash
git clone https://github.com/lspgn/worker-biomes
cd worker-biomes
npm install
npm run build
# Check dist/ for compiled files
```

## Option 2: Compile Cubiomes Yourself

### Requirements

- **Emscripten SDK** (for compiling C to WASM)
- **cubiomes source code**

### Step 1: Install Emscripten

```bash
# Clone Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install latest version
./emsdk install latest
./emsdk activate latest

# Add to PATH
source ./emsdk_env.sh
```

### Step 2: Clone Cubiomes

```bash
git clone https://github.com/Cubitect/cubiomes.git
cd cubiomes
```

### Step 3: Compile to WASM

Create a file `build_wasm.sh`:

```bash
#!/bin/bash

# Cubiomes source files
SOURCES="biomes.c generator.c layers.c noise.c util.c finders.c"

# Exported functions (must include underscore prefix for C functions)
EXPORTED_FUNCTIONS='[
  "_malloc",
  "_free",
  "_setupGenerator",
  "_applySeed",
  "_getBiomeAt",
  "_getStructurePos",
  "_isViableStructurePos"
]'

# Exported runtime methods
EXPORTED_RUNTIME_METHODS='[
  "ccall",
  "cwrap",
  "getValue",
  "setValue"
]'

# Compile with Emscripten
emcc $SOURCES \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="'CubiomesModule'" \
  -s EXPORTED_FUNCTIONS="$EXPORTED_FUNCTIONS" \
  -s EXPORTED_RUNTIME_METHODS="$EXPORTED_RUNTIME_METHODS" \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=16777216 \
  -o cubiomes.js

echo "✓ Compiled cubiomes.wasm and cubiomes.js"
```

Make executable and run:

```bash
chmod +x build_wasm.sh
./build_wasm.sh
```

This will generate:
- `cubiomes.wasm` - The WebAssembly binary
- `cubiomes.js` - JavaScript glue code

### Step 4: Copy Files

```bash
cp cubiomes.wasm /path/to/minecraft-tools/
cp cubiomes.js /path/to/minecraft-tools/
```

## Option 3: Load from CDN (Not Recommended)

If someone hosts cubiomes WASM on a CDN, you could load it dynamically. However, **no official CDN exists** for cubiomes WASM as of 2024.

## Verifying Setup

### Check Files Exist

```bash
ls -lh cubiomes.wasm cubiomes.js
```

You should see:
- `cubiomes.wasm` (~100-200 KB)
- `cubiomes.js` (~50-100 KB)

### Test in Browser

1. Open `seed_explorer.html` in a browser
2. Open browser console (F12)
3. Look for log message:

```
[App] Cubiomes WASM loaded successfully
[Cubiomes] Loaded cubiomes WASM module
```

If successful, the banner will say:
> ✓ REAL MINECRAFT WORLDGEN – Using cubiomes WASM library for pixel-perfect accuracy

### If Cubiomes Fails to Load

The app will automatically fall back to `MinecraftWorldgen` (JavaScript implementation with real Perlin noise):

```
[App] Cubiomes WASM not available, using JavaScript implementation with real algorithms
[MinecraftWorldgen] Initializing real Minecraft worldgen
```

Banner will say:
> ✓ REAL MINECRAFT WORLDGEN – Using proper Perlin noise and multi-noise algorithms (JavaScript implementation)

This is still **real Minecraft worldgen**, just not pixel-perfect.

## API Reference

### Functions Exported from Cubiomes

The `CubiomesWorldgen` class expects these C functions to be exported:

#### `setupGenerator(Generator *g, int mcversion, uint flags)`
Initialize a generator for a specific Minecraft version.

- `g`: Pointer to Generator struct
- `mcversion`: MC version enum (18 = 1.18, 20 = 1.20, etc.)
- `flags`: Generation flags (usually 0)

#### `applySeed(Generator *g, int dim, uint64_t seed)`
Apply a seed to the generator for a specific dimension.

- `g`: Pointer to Generator struct
- `dim`: Dimension (0 = Overworld, -1 = Nether, 1 = End)
- `seed`: World seed (uint64_t)

#### `getBiomeAt(Generator *g, int scale, int x, int y, int z)`
Get biome ID at specific coordinates.

- `g`: Pointer to Generator struct
- `scale`: 1 for block coords, 4 for biome coords
- `x, y, z`: Coordinates
- Returns: Biome ID (int)

#### `getStructurePos(int structType, int mcversion, uint64_t seed, int regX, int regZ, Pos *pos)`
Find structure position in a region.

- `structType`: Structure type enum
- `mcversion`: MC version
- `seed`: World seed
- `regX, regZ`: Region coordinates
- `pos`: Output position struct

#### `isViableStructurePos(int structType, Generator *g, int x, int z)`
Check if a structure can spawn at position.

- `structType`: Structure type
- `g`: Generator
- `x, z`: Chunk coordinates
- Returns: 1 if viable, 0 otherwise

## Troubleshooting

### "Failed to load cubiomes.js"

- Check that `cubiomes.js` and `cubiomes.wasm` are in the same directory as `seed_explorer.html`
- Check browser console for CORS errors
- Make sure files are served over HTTP/HTTPS (file:// protocol may not work)

### "setupGenerator is not a function"

- The WASM wasn't compiled with proper exports
- Recompile with `EXPORTED_FUNCTIONS` including `"_setupGenerator"`
- Note the underscore prefix for C function names

### "Out of memory" errors

- Increase `TOTAL_MEMORY` in Emscripten compile flags
- Use `ALLOW_MEMORY_GROWTH=1` for dynamic allocation

### Biomes don't match Minecraft

- Verify you're using the correct MC version enum
- Check that the cubiomes library version matches your target Minecraft version
- Ensure seed is being passed correctly (uint64_t, not string)

## Performance Notes

- **cubiomes WASM**: Fastest, pixel-perfect, ~5-10ms per tile
- **MinecraftWorldgen (JS)**: Fast, real algorithms, ~10-20ms per tile
- **FallbackWorldgen**: Fastest but inaccurate, ~5ms per tile (not recommended)

## Further Reading

- [Cubiomes GitHub](https://github.com/Cubitect/cubiomes) - Official C library
- [Emscripten Documentation](https://emscripten.org/docs/getting_started/index.html) - WASM compilation
- [WebAssembly](https://webassembly.org/) - WASM specification
- [Minecraft Wiki: World Generation](https://minecraft.wiki/w/World_generation) - Algorithm documentation

## Support

If you successfully compile cubiomes to WASM, please consider:
- Sharing the compiled files with the community
- Submitting a PR with the compilation script
- Documenting your process for others

## License

Cubiomes is released under the MIT License by Cubitect.
