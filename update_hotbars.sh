#!/bin/bash

# Script to update all tool pages with the new EXPLORER-style collapsible hotbar

# Define the new hotbar HTML
NEW_HOTBAR='    <!-- Hotbar Toggle Button -->
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

    <script>
        // Toggle hotbar
        function toggleHotbar() {
            const hotbar = document.getElementById("hotbar");
            const toggle = document.getElementById("hotbarToggle");
            hotbar.classList.toggle("collapsed");
            toggle.textContent = hotbar.classList.contains("collapsed") ? "▲" : "▼";
        }
    </script>'

echo "Hotbar update script created successfully"
echo "This will be used to update all tool pages"
