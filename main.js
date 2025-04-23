// --- main.js ---
// Core Game Object, Initialization, State Management, Game Loop Triggers

// --- Game Namespace ---
// Define the main GAME object and its primary sub-modules namespaces
const GAME = {
    config: null, // Loaded from JSON
    data: null,   // Loaded from JSON
    soundData: null, // Loaded from JSON

    // Core Game State
    state: {
        resources: {
            scrap: 100,
            biomass: 50,
            tech: 0
        },
        survivors: [],          // Managed by actors.js
        buildings: [],          // Managed by buildings.js
        grid: [],               // 2D array [y][x], managed by buildings.js for placement
        enemies: [],            // Managed by actors.js
        selectedSurvivorId: null, // Managed by ui.js / actors.js
        selectedBuildType: null,  // Managed by ui.js / buildings.js
        selectedTile: null,     // {x, y}, Managed by ui.js / graphics.js interaction
        wave: 0,
        waveTimer: 0,           // Seconds until next wave
        gameOver: false,
        nextInstanceId: 0,      // Simple unique ID generator
        coreBuildingId: null,   // Set by buildings.js during init
        audioUnlocked: false,   // Managed by audio.js
        selectingRaidZoneForSurvivorId: null, // Managed by actors.js / ui.js (modal state)
    },

    // Sub-module placeholders (will be populated by other files)
    utils: {},
    audio: {},
    graphics: {},
    ui: {},
    actors: {},
    buildings: {},

    // Timers (references managed here)
    timers: {
        baseUpdate: null,
        wave: null,
        enemyMove: null,
        turretFire: null,
        raidChecks: null
    },

    // --- Initialization ---
    async init() {
        console.log("VISCERAL RECLAIMER INITIALIZING...");
        document.title = "Visceral Reclaimer - Loading..."; // Update title
        try {
            // 1. Load Static Data
            await this.loadGameData(); // Loads config, game data, sound data

            // Check essential data loaded
            if (!this.config || !this.data || !this.soundData) {
                 throw new Error("Essential game data failed to load.");
            }

            // 2. Setup Core Systems (Order can matter)
            this.audio.setupAudioUnlocker(); // Needs to run early for user interaction
            this.graphics.setupPixi();       // Needs config for grid size etc.
            this.audio.setupAudio();         // Needs soundData

            // 3. Initialize Game State
            this.setupInitialState();        // Needs config (grid size), data (survivors), buildings manager

            // 4. Setup UI and Event Listeners (Needs data for population)
            this.ui.setupUI();               // Needs data (buildings), adds listeners

            // 5. Setup Game Loop Timers
            this.setupTimers();              // Needs config for intervals

            // 6. Initial UI Update & Log
            document.title = "Visceral Reclaimer"; // Set final title
            this.ui.addLog("System online. Welcome, Reclaimer.", "log-success");
            this.audio.playSound('click'); // Initial click sound?
            // Log audio prompt *after* UI is ready
            this.ui.addLog("Click or press key to enable audio.", "log-warning");
            this.ui.updateUI(); // First full UI render

            console.log("VISCERAL RECLAIMER INITIALIZATION COMPLETE.");

        } catch (error) {
             console.error("FATAL INITIALIZATION FAILED:", error);
             document.title = "Visceral Reclaimer - FATAL ERROR";
             // Display a more user-friendly error message
             document.body.innerHTML = `<div style="color: #ff4444; background-color: #1a0000; border: 2px solid #ff0000; font-family: 'Courier New', monospace; padding: 30px; margin: 50px auto; max-width: 600px; text-align: center;">
                <h1><span style="color: #ff0000;">&gt; FATAL SYSTEM ERROR &lt;</span></h1>
                <p style="font-size: 1.2em;">Could not initialize Visceral Reclaimer.</p>
                <p style="color: #ffaaaa;">Reason: ${error.message}</p>
                <hr style="border-color: #550000;">
                <p>Check browser console (Press F12) for detailed technical information.</p>
                <p>Ensure 'game-data.json' exists and is valid JSON.</p>
                <p>Try refreshing the page (Ctrl+R or Cmd+R).</p>
                </div>`;
             // Stop any potential partial timers
             this.clearTimers();
             // No further execution
        }
    },

    async loadGameData() {
        try {
            // Fetch all data concurrently
            const [gameDataResponse, soundDataResponse] = await Promise.all([
                 fetch('game-data.json'),
                 // Assuming sound data might be separate later, fetch it too
                 // If it's inside game-data.json, adjust this logic
                 fetch('game-data.json') // Fetch same file for now, adjust if split
            ]);


            if (!gameDataResponse.ok) throw new Error(`HTTP error loading game-data.json! status: ${gameDataResponse.status}`);
            // if (!soundDataResponse.ok) throw new Error(`HTTP error loading sound data! status: ${soundDataResponse.status}`); // If separate file

            const jsonData = await gameDataResponse.json();
            // const jsonSoundData = await soundDataResponse.json(); // If separate file

            // --- Assign Data ---
            this.config = jsonData.config;
            this.data = jsonData.data;
            // If soundData is nested:
            this.soundData = jsonData.soundData;
            // If soundData was separate:
            // this.soundData = jsonSoundData.soundData;

            // --- Validate Essential Data ---
            if (!this.config) throw new Error("Config object missing in game-data.json");
            if (!this.data) throw new Error("Data object missing in game-data.json");
            if (!this.soundData) throw new Error("SoundData object missing in game-data.json"); // Or adjust path if nested differently
            if (!this.data.buildings) throw new Error("data.buildings missing");
            if (!this.data.enemies) throw new Error("data.enemies missing");
            if (!this.data.survivorTemplates) throw new Error("data.survivorTemplates missing");
            if (!this.data.raidZones) throw new Error("data.raidZones missing");
            if (!this.data.raidOutcomes) throw new Error("data.raidOutcomes missing");
            if (!this.data.mutations) throw new Error("data.mutations missing");
            if (!this.config.coreCoords) throw new Error("config.coreCoords missing");


            // Convert spriteColor strings from JSON to numbers (hex) for Pixi
            // Perform this *after* confirming data exists
             this.preprocessDataColors();


            console.log("Game data loaded and validated successfully.");

        } catch (e) {
            console.error("Could not load or parse game-data.json:", e);
            // Clear potentially partially loaded data
            this.config = null; this.data = null; this.soundData = null;
            throw e; // Re-throw error to be caught by init()
        }
    },

    // Helper for color conversion
    preprocessDataColors: function() {
         try {
             Object.values(this.data.buildings).forEach(b => { if (b.spriteColor) b.spriteColor = parseInt(String(b.spriteColor), 16); });
             Object.values(this.data.enemies).forEach(e => { if (e.spriteColor) e.spriteColor = parseInt(String(e.spriteColor), 16); });
             // Add other color conversions if needed
         } catch (parseError) {
             console.error("Error parsing spriteColor hex values:", parseError);
             throw new Error("Invalid hex color format found in game-data.json.");
         }
    },


    // Initialize grid, place core, add starting survivors
    setupInitialState: function() {
        // Initialize Grid
        this.state.grid = Array(this.config.gridHeight).fill(null).map(() => Array(this.config.gridWidth).fill(null));

        // Setup Core Building (using building manager)
        this.buildings.setupInitialCore(); // Throws error if fails

        // Add Starting Survivors (using actor manager)
        this.actors.setupInitialSurvivors();

        // Set Initial Wave Timer
        this.state.waveTimer = this.config.waveInterval;

        // Note: Building 'isActive' state is handled within addBuilding based on upkeep
        // No need for explicit loop here anymore unless loading a saved game.
    },


    // --- Timers and Game Loop ---
    setupTimers: function() {
         this.clearTimers(); // Ensure no old timers are running

         // Base Tick (Resource generation, upkeep, passive effects)
         this.timers.baseUpdate = setInterval(() => this.baseTick(), this.config.baseUpdateInterval || 1000);

         // Wave Timer & Spawning
         this.timers.wave = setInterval(() => {
            if (this.state.gameOver) { clearInterval(this.timers.wave); return; }
            this.state.waveTimer -= 1;
            if (this.state.waveTimer <= 0) {
                 this.actors.spawnWave(); // Delegate spawning to actor manager
                 this.state.waveTimer = this.config.waveInterval || 60; // Reset timer
            }
             // Update UI Wave Timer display (consider moving this to baseTick update cycle for consistency)
             // this.ui.updateUI(); // Avoid calling full updateUI every second here
             // Update just the timer element if needed, or let baseTick handle it
             const waveTimerEl = document.getElementById('wave-timer');
             if (waveTimerEl) waveTimerEl.textContent = Math.max(0, Math.ceil(this.state.waveTimer));

        }, 1000); // Runs every second

        // Enemy Movement Logic
        this.timers.enemyMove = setInterval(() => {
            if (this.state.gameOver) { clearInterval(this.timers.enemyMove); return; }
            this.actors.moveEnemies(); // Delegate movement to actor manager
        }, this.config.enemyMoveInterval || 500);

        // Turret Firing Logic
        this.timers.turretFire = setInterval(() => {
            if (this.state.gameOver) { clearInterval(this.timers.turretFire); return; }
            this.actors.fireTurrets(); // Delegate turret firing to actor manager
        }, this.config.turretFireInterval || 300);

        // Raid Progression & Encounter Checks
        this.timers.raidChecks = setInterval(() => {
            if (this.state.gameOver) { clearInterval(this.timers.raidChecks); return; }
            this.actors.checkRaids(); // Delegate raid checks to actor manager
        }, this.config.raidEncounterCheckInterval || 5000); // Use configured interval
    },

    clearTimers: function() {
         clearInterval(this.timers.baseUpdate);
         clearInterval(this.timers.wave);
         clearInterval(this.timers.enemyMove);
         clearInterval(this.timers.turretFire);
         clearInterval(this.timers.raidChecks);
         // Reset timer references
         this.timers = { baseUpdate: null, wave: null, enemyMove: null, turretFire: null, raidChecks: null };
         console.log("Game timers cleared.");
    },

    // The core logic tick, happens less frequently than rendering
    baseTick: function() {
        if (this.state.gameOver) return;

        const tickDurationSeconds = (this.config.baseUpdateInterval || 1000) / 1000;
        let needsUIUpdate = false;

        // Update Building States (Upkeep, Production)
        if (this.buildings.updateBuildingStates(tickDurationSeconds)) {
            needsUIUpdate = true;
        }

        // Update Survivor Passive Effects (Regen, etc.)
        if (this.actors.updateSurvivorPassives(tickDurationSeconds)) {
            needsUIUpdate = true;
        }

        // Other periodic checks can go here (e.g., tech research progress)

        // Update the UI if any state relevant to it changed
        if (needsUIUpdate) {
            this.ui.updateUI();
        }
    },
    // Note: renderLoop is now handled within graphics.js via Pixi's ticker


    // --- Core Gameplay Actions / Event Handlers ---

    // Called by graphics.js tile interaction
    handleTileClick: function(x, y) {
         if (this.state.gameOver) return;

        this.state.selectedTile = { x, y }; // Update selected tile state
        GAME.audio.playSound('click');

        if (this.state.selectedBuildType) {
            // Attempt to build using building manager
            const buildSuccess = this.buildings.tryBuild(this.state.selectedBuildType, x, y);
            // Always deselect build type after an attempt (success or fail)
            this.state.selectedBuildType = null;
            // tryBuild handles logging and UI update on its own
        } else {
            // Just selecting a tile - log information about it
             const buildingId = this.state.grid[y]?.[x];
             if (buildingId) {
                 const building = this.buildings.getBuildingById(buildingId);
                 const buildingData = building ? this.data.buildings[building.typeId] : null;
                 if (buildingData) {
                     this.ui.addLog(`Selected ${buildingData.name} at [${x},${y}].`, 'log-info');
                 } else {
                     this.ui.addLog(`Selected occupied tile [${x},${y}] (Unknown Type).`, 'log-warning');
                 }
             } else {
                 this.ui.addLog(`Selected empty tile [${x}, ${y}].`, 'log-info');
             }
             // Update UI to show selected tile info
             this.ui.updateUI();
        }
        // No need for redundant updateUI call here, it's handled within branches
    },


    // --- Game Over ---
    gameOver: function(message) {
        if (this.state.gameOver) return; // Prevent multiple triggers
        this.state.gameOver = true;
        console.error("GAME OVER:", message);

        // 1. Log the final message
        this.ui.addLog(`=== SYSTEM OFFLINE: ${message} ===`, 'log-danger');

        // 2. Show Game Over Modal
        this.ui.showModal("TRANSMISSION LOST", message + "\n\nRefresh to attempt reclamation again.", 'error'); // Use 'error' type?

        // 3. Stop Game Logic Timers
        this.clearTimers();

        // 4. Stop Audio
        this.audio.stopAllSounds();
        this.audio.playSound('game_over'); // Play specific game over sound

        // 5. Disable UI Interaction
        this.ui.disableUI(); // Handles disabling buttons, greying out panel, disabling grid clicks

        // 6. Stop Rendering Updates (if Pixi ticker is running)
        if (this.graphics.pixiApp?.ticker) {
            this.graphics.pixiApp.ticker.stop();
            console.log("Pixi ticker stopped.");
        }

        // 7. Final log
        console.log("Game Over sequence complete. State frozen.");
    },
};

// --- Start the game ---
window.addEventListener('DOMContentLoaded', () => {
    // Make sure the GAME object is accessible globally or passed around if using modules
    GAME.init();
});