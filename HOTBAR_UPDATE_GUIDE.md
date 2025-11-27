# Hotbar Update Guide

## Overview
This guide documents the new EXPLORER-style collapsible hotbar implementation for all Minecraft Tools Hub pages.

## What's Been Updated
✅ `minecraft-tools-hub/index.html` - Fully updated with new hotbar, All Tools section, and fixed Nether links

## What Needs Updating

### Minecraft Tools Hub Pages
All pages in `minecraft-tools-hub/` directory need the hotbar updated:
- `enchantment_calculator.html`
- `ore_guide_page.html`
- `world_seeds_page.html`
- `build_ideas_gallery.html`
- `farm_efficiency_page.html`
- `minecraft_worlds.html`

### Root-Level Pages
- `seed_explorer.html` (already has EXPLORER style, just needs toggle added)
- `minecraft_journal.html`
- `potion_brewing_guide.html`
- `nether_hub_calculator.html`

## Implementation Steps

### 1. Update CSS (in `<style>` section)

Replace the old hotbar CSS with:

```css
/* Hotbar Navigation - EXPLORER Style */
.hotbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(11, 13, 18, 0.98);
    border-top: 2px solid #A066FF;
    padding: 8px;
    display: flex;
    justify-content: center;
    gap: 4px;
    z-index: 1000;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.7);
    transition: transform 0.3s ease;
}

.hotbar.collapsed {
    transform: translateY(100%);
}

.hotbar-toggle {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(11, 13, 18, 0.98);
    border: 2px solid #A066FF;
    border-bottom: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    padding: 4px 20px;
    cursor: pointer;
    z-index: 1001;
    font-size: 1.2rem;
    transition: all 0.3s ease;
}

.hotbar-toggle:hover {
    background: rgba(160, 102, 255, 0.2);
    box-shadow: 0 0 12px rgba(160, 102, 255, 0.5);
}

.hotbar-slot {
    width: 60px;
    height: 60px;
    background: #0b0d12;
    border: 2px solid #1f2937;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: #9ca3af;
    transition: all 0.2s;
    font-size: 0.65rem;
    font-weight: 600;
}

.hotbar-slot:hover {
    border-color: #A066FF;
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(160, 102, 255, 0.4);
}

.hotbar-slot.active {
    border-color: #06b6d4;
    background: rgba(160, 102, 255, 0.15);
    color: #e8e8f0;
    box-shadow: 0 0 16px rgba(6, 182, 212, 0.4);
}

.hotbar-icon {
    font-size: 1.5rem;
    margin-bottom: 2px;
}

.hotbar-label {
    font-size: 0.65rem;
    color: inherit;
}

@media (max-width: 968px) {
    .hotbar {
        flex-wrap: wrap;
        padding: 6px;
    }
    .hotbar-slot {
        width: 50px;
        height: 50px;
        font-size: 0.6rem;
    }
    .hotbar-icon {
        font-size: 1.3rem;
    }
}
```

### 2. Replace Hotbar HTML

Replace the old `<div class="hotbar">` section with:

```html
    <!-- Hotbar Toggle Button -->
    <div class="hotbar-toggle" id="hotbarToggle" onclick="toggleHotbar()">▼</div>

    <!-- Hotbar Navigation -->
    <div class="hotbar" id="hotbar">
        <a href="index.html" class="hotbar-slot">
            <div class="hotbar-icon">🏠</div>
            HOME
        </a>
        <a href="../minecraft_journal.html" class="hotbar-slot">
            <div class="hotbar-icon">📖</div>
            JOURNAL
        </a>
        <a href="enchantment_calculator.html" class="hotbar-slot">
            <div class="hotbar-icon">📘</div>
            ENCHANT
        </a>
        <a href="ore_guide_page.html" class="hotbar-slot">
            <div class="hotbar-icon">💎</div>
            ORES
        </a>
        <a href="world_seeds_page.html" class="hotbar-slot">
            <div class="hotbar-icon">🗺️</div>
            SEEDS
        </a>
        <a href="../seed_explorer.html" class="hotbar-slot">
            <div class="hotbar-icon">🧭</div>
            EXPLORER
        </a>
        <a href="build_ideas_gallery.html" class="hotbar-slot">
            <div class="hotbar-icon">🗝️</div>
            BUILDS
        </a>
        <a href="minecraft_worlds.html" class="hotbar-slot">
            <div class="hotbar-icon">🌍</div>
            WORLDS
        </a>
        <a href="farm_efficiency_page.html" class="hotbar-slot">
            <div class="hotbar-icon">🌾</div>
            FARMS
        </a>
        <a href="../potion_brewing_guide.html" class="hotbar-slot">
            <div class="hotbar-icon">🧪</div>
            POTIONS
        </a>
        <a href="../nether_hub_calculator.html" class="hotbar-slot">
            <div class="hotbar-icon">🚇</div>
            NETHER
        </a>
    </div>
```

**Note:** Set the appropriate slot to `class="hotbar-slot active"` for the current page.

### 3. Add JavaScript (before closing `</body>` tag)

Add this JavaScript function (if not already present):

```javascript
    <script>
        // Toggle hotbar
        function toggleHotbar() {
            const hotbar = document.getElementById('hotbar');
            const toggle = document.getElementById('hotbarToggle');
            hotbar.classList.toggle('collapsed');
            toggle.textContent = hotbar.classList.contains('collapsed') ? '▲' : '▼';
        }
    </script>
```

### 4. Path Adjustments for Root-Level Pages

For pages in the root directory (not in minecraft-tools-hub/), adjust paths:

```html
<a href="minecraft-tools-hub/index.html" class="hotbar-slot">
<a href="minecraft_journal.html" class="hotbar-slot">
<a href="minecraft-tools-hub/enchantment_calculator.html" class="hotbar-slot">
<!-- etc. -->
```

## All 11 Tools in Hotbar

1. 🏠 HOME - Main hub index
2. 📖 JOURNAL - Minecraft journal
3. 📘 ENCHANT - Enchantment calculator
4. 💎 ORES - Ore coordinate guide
5. 🗺️ SEEDS - Seed finder
6. 🧭 EXPLORER - Seed explorer (interactive map)
7. 🗝️ BUILDS - Build ideas gallery
8. 🌍 WORLDS - Minecraft worlds manager (NEW!)
9. 🌾 FARMS - Farm efficiency hub
10. 🧪 POTIONS - Potion brewing guide
11. 🚇 NETHER - Nether hub calculator

## Testing Checklist

After updating each page:
- [ ] Hotbar displays at bottom of page
- [ ] Toggle button appears and functions correctly
- [ ] All 11 tools are visible in hotbar
- [ ] Active page is highlighted with cyan border
- [ ] Hover effects work (purple glow)
- [ ] Collapsing/expanding animation is smooth
- [ ] Mobile responsive (tools wrap on small screens)
- [ ] All links navigate correctly

## Quick Update Script

You can use the `update_hotbars.sh` script in the root directory as a reference for the hotbar HTML structure.
