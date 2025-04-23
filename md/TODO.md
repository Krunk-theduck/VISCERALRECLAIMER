# VISCERAL RECLAIMER - TODO List

This list tracks planned features, improvements, and balancing tasks.

## Raid System Enhancements

*   [ ] **Define Encounters:** Create specific encounter data in `game-data.json` (text, choices, outcomes).
*   [ ] **Encounter Selection:** Implement logic in `checkRaids` to randomly select an appropriate encounter for the current zone.
*   [ ] **Interactive Modal:** Update `showModal` to handle an 'encounter' type, displaying text and choice buttons.
*   [ ] **Encounter Resolution:** Fully implement `resolveRaidEncounter` to process choice outcomes (apply damage, grant loot, change status, etc.). Remove placeholder `setTimeout`.
*   [ ] **Zone Outcome Influence:** Refine how `raidZones` affect the *probability* of final raid outcomes (injury, death, etc.), not just loot amounts.
*   [ ] **Survivor Influence:** Consider adding checks based on survivor stats or mutations affecting encounter success/choices.
*   [ ] **Raid Log Polish:** Improve formatting and detail in the raid log displayed in the completion modal.

## Biomass & Mutations

*   [ ] **Implement Mutation Effects:** Code the actual stat calculations (HP, damage, speed, regen) for survivor mutations.
*   [ ] **`recalculateSurvivorStats` Function:** Create a helper function to apply all active mutation effects to a survivor's base stats.
*   [ ] **More Mutations:** Design and add more diverse mutations (positive and negative).
*   [ ] **Mutation Display:** Improve UI display of active mutations and their effects on the survivor details panel.
*   [ ] **(Maybe) Mutation Curing/Removal:** Consider adding a late-game way to remove unwanted mutations (costly?).

## UI/UX Improvements

*   [ ] **Sliding Notification System:** Implement a non-blocking notification area (e.g., corner of the screen) for less critical events (resource gains, minor raid loot, building complete).
*   [ ] **Event Queue/Log:** For major events (wave start, core hit, raid completion, encounter needing action), consider an event queue UI element that alerts the player without *immediately* pausing/blocking via modal unless direct interaction is required. Allow viewing recent major events.
*   [ ] **Improved Power State Feedback:** Add more distinct visual cues for buildings that are inactive due to lack of biomass (e.g., subtle animation change, different overlay?).
*   [ ] **Clearer Build Mode Indication:** Make it more obvious when build mode is active and what building is selected. Highlight valid build tiles on hover?
*   [ ] **Tooltip Enhancements:** Add more tooltips for UI elements explaining costs, effects, etc.

## New Content

*   [ ] **New Turret Types:** Design and implement advanced turrets (e.g., AoE, slowing, high-damage/slow-fire, tech-based). Define costs (Scrap, Tech?) and potentially Biomass upkeep.
*   [ ] **Power System:**
    *   [ ] Design concept (Generators using Biomass? Power grid/range? Different building power needs?).
    *   [ ] Implement Power Generator building(s).
    *   [ ] Modify buildings to require power (in addition to/instead of direct upkeep for some?).
    *   [ ] Add UI elements to visualize power generation/consumption/grid.
*   [ ] **More Building Types:** Research Lab (uses Tech?), advanced walls, storage upgrades, specialized survivor facilities?
*   [ ] **More Enemy Types:** Introduce enemies with different behaviours (flying, armoured, healing, spawning smaller units?).

## Balancing & Core Gameplay

*   [ ] **Scrap Income:** Adjust scrap gained from enemy kills vs. building/repair costs, especially early game. Ensure viable progression per wave.
*   [ ] **Biomass Economy:** Tune Biomass generation (farms), upkeep costs, and spending costs (heal, mutate, repair, power?).
*   [ ] **Wave Scaling:** Fine-tune enemy count, types, speed, and spawn timing as waves progress.
*   [ ] **Raid Balance:** Adjust zone durations, loot tables, modifier values, and encounter frequency/difficulty.
*   [ ] **Mutation Balance:** Tune mutation costs, success chances, and the impact of their effects. Ensure they feel worthwhile but risky.
*   [ ] **Early Game Pacing:** Ensure the first few waves are manageable and introduce core concepts smoothly.

## Technical & Refactoring

*   [ ] **Code Organization:** Consider splitting `main.js` into modules (e.g., `ui.js`, `raid.js`, `building.js`, `enemy.js`) as it grows.
*   [ ] **Save/Load Game:** Implement functionality to save and load game state (using `localStorage` or `IndexedDB`).
*   [ ] **Pathfinding Optimization:** If performance becomes an issue with many enemies/obstacles, consider implementing A* pathfinding.
*   [ ] **Error Handling:** Add more robust error checking and user-friendly messages.
*   [ ] **Performance Profiling:** Periodically check for performance bottlenecks, especially in rendering and game logic loops.
