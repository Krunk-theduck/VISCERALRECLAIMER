// --- graphics.js ---
// Handles PixiJS setup, drawing, and rendering loop updates

GAME.graphics = {
    pixiApp: null,
    gridContainer: null,
    // inactiveBuildingOverlays: {}, // DEPRECATED: Using Tint now

    setupPixi: function() {
        if (typeof PIXI === 'undefined') throw new Error("PixiJS library failed to load.");

        const view = document.getElementById('base-view');
        if (!view) throw new Error("HTML element with id 'base-view' not found.");
        const canvas = document.getElementById('base-canvas');
        if (!canvas) throw new Error("HTML canvas element with id 'base-canvas' not found.");

        this.pixiApp = new PIXI.Application({
            width: view.clientWidth, height: view.clientHeight,
            backgroundColor: 0x0a0a0a,
            antialias: false, // Keep false for pixelated look
            view: canvas,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        // Ensure renderer exists before resizing
        if (this.pixiApp.renderer) {
            this.pixiApp.renderer.resize(view.clientWidth, view.clientHeight);
        } else {
             throw new Error("PixiJS renderer failed to initialize.");
        }


        this.gridContainer = new PIXI.Container();
        this.gridContainer.interactive = true;
        // Ensure config is loaded before accessing tileSize
        if (!GAME.config) throw new Error("GAME.config not loaded before Pixi setup.");
        this.gridContainer.hitArea = new PIXI.Rectangle(0, 0, GAME.config.gridWidth * GAME.config.tileSize, GAME.config.gridHeight * GAME.config.tileSize);
        this.pixiApp.stage.addChild(this.gridContainer);

        this.drawGridLines();
        this.addTileInteraction();

        // Start the Pixi ticker
        if (this.pixiApp.ticker) {
            this.pixiApp.ticker.add(delta => this.renderLoop(delta));
        } else {
             throw new Error("PixiJS ticker failed to initialize.");
        }


        // Debounced resize handler
        window.addEventListener('resize', GAME.utils.debounce(() => {
             const view = document.getElementById('base-view');
             if (this.pixiApp && this.pixiApp.renderer && view) {
                this.pixiApp.renderer.resize(view.clientWidth, view.clientHeight);
                 if (GAME.config && this.gridContainer) {
                    this.gridContainer.hitArea = new PIXI.Rectangle(0, 0, GAME.config.gridWidth * GAME.config.tileSize, GAME.config.gridHeight * GAME.config.tileSize);
                 }
             }
         }, 250));
    },

    drawGridLines: function() {
         const graphics = new PIXI.Graphics();
         graphics.lineStyle(1, 0x333333, 0.3); // Thin, dark grey lines
         const width = GAME.config.gridWidth * GAME.config.tileSize;
         const height = GAME.config.gridHeight * GAME.config.tileSize;

         for (let x = 0; x <= GAME.config.gridWidth; x++) {
             const currentX = x * GAME.config.tileSize;
             graphics.moveTo(currentX, 0);
             graphics.lineTo(currentX, height);
         }
         for (let y = 0; y <= GAME.config.gridHeight; y++) {
             const currentY = y * GAME.config.tileSize;
             graphics.moveTo(0, currentY);
             graphics.lineTo(width, currentY);
         }
         graphics.name = "gridLines";
         this.gridContainer.addChild(graphics);
     },

     addTileInteraction: function() {
         if (!this.gridContainer) return;
         this.gridContainer.on('pointerdown', (event) => {
             // Check if game over prevents interaction
             if (GAME.state.gameOver) return;

             const pos = event.data.getLocalPosition(this.gridContainer);
             const tileX = Math.floor(pos.x / GAME.config.tileSize);
             const tileY = Math.floor(pos.y / GAME.config.tileSize);

             if (GAME.utils.isValidTile(tileX, tileY)) {
                 // Delegate the logic to a handler in the main game or building manager
                 GAME.handleTileClick(tileX, tileY);
             } else {
                 // Clicked outside the grid area within the container
                 GAME.state.selectedTile = null;
                 if(GAME.state.selectedBuildType) {
                     GAME.state.selectedBuildType = null;
                     GAME.ui.addLog("Build mode deactivated.", "log-info");
                 }
                 GAME.ui.updateUI(); // Update UI to reflect deselection
             }
         });
     },

     // Handles visual interpolation and potentially other per-frame updates
     renderLoop: function(delta) {
         if (GAME.state.gameOver || !this.pixiApp) return;

         // --- Enemy Movement Interpolation ---
         const msPerMoveInterval = GAME.config.enemyMoveInterval; // Defined in config
         GAME.state.enemies.forEach(enemy => {
              if (enemy.graphic && enemy.graphic.parent) { // Check if graphic exists and is added
                  const targetPixelX = enemy.x * GAME.config.tileSize + GAME.config.tileSize / 2;
                  const targetPixelY = enemy.y * GAME.config.tileSize + GAME.config.tileSize / 2;
                  // Use prevX/prevY stored on the enemy object
                  const prevPixelX = enemy.prevX * GAME.config.tileSize + GAME.config.tileSize / 2;
                  const prevPixelY = enemy.prevY * GAME.config.tileSize + GAME.config.tileSize / 2;

                  // Calculate interpolation factor based on time elapsed since last move
                  // This assumes enemy.lastMoveTime is updated in moveEnemies
                  // const timeSinceLastMove = Date.now() - enemy.lastMoveTime;
                  // let progress = Math.min(1, timeSinceLastMove / msPerMoveInterval);
                  // enemy.moveProgress = progress; // Store for potential use

                  // Alternative: Using Pixi's delta ticker for smoother feel independent of move interval
                   const progressIncrement = (delta / (PIXI.settings.TARGET_FP || 60)) * (1000 / msPerMoveInterval);
                   enemy.moveProgress = Math.min(1, enemy.moveProgress + progressIncrement);


                  // Linear interpolation (lerp)
                  enemy.graphic.x = prevPixelX + (targetPixelX - prevPixelX) * enemy.moveProgress;
                  enemy.graphic.y = prevPixelY + (targetPixelY - prevPixelY) * enemy.moveProgress;
              }
         });

         // Add other per-frame visual updates here if needed (e.g., particle effects)
     },

     // Helper to create a simple graphic (used by buildings/enemies)
     // Returns the PIXI.Graphics object, doesn't add to stage here
     createRectGraphic: function(color, size) {
         const graphics = new PIXI.Graphics();
         graphics.lineStyle(1, 0xAAAAAA, 0.8); // Standard border?
         graphics.beginFill(color || 0x888888);
         const padding = 2;
         graphics.drawRect(padding, padding, size - padding * 2, size - padding * 2);
         graphics.endFill();
         return graphics;
     },

    createCircleGraphic: function(color, radius) {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(color || 0xFF00FF);
        graphics.drawCircle(0, 0, radius);
        graphics.endFill();
        return graphics;
    },

    // Helper to draw laser effect (used by turrets)
    drawLaser: function(startX, startY, endX, endY, color = 0xFFFFFF, duration = 80) {
        if (!this.pixiApp || !this.pixiApp.stage) return; // Safety check
        const fx = new PIXI.Graphics();
        fx.lineStyle(1, color, 0.6);
        fx.moveTo(startX, startY);
        fx.lineTo(endX, endY);
        this.pixiApp.stage.addChild(fx); // Add to main stage
        setTimeout(() => {
            if (fx && fx.parent) {
                 fx.destroy();
            }
        }, duration);
    }
};