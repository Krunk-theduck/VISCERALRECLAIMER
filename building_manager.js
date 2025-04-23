// --- building_manager.js ---
// Manages Buildings: Creation, Removal, Placement, Upkeep, Production, Core Repair

GAME.buildings = {

    // --- Building Getters ---
    getBuildingById: function(id) {
        return GAME.state.buildings.find(b => b.id === id);
    },

    // --- Initial Building Setup ---
    setupInitialCore: function() {
         const coreData = GAME.data.buildings['CORE'];
         if (!coreData) throw new Error("Core building data ('CORE') not found in game-data.json");

         const coreX = GAME.config.coreCoords.x;
         const coreY = GAME.config.coreCoords.y;

         if (GAME.utils.isValidTile(coreX, coreY)) {
            // addBuilding now handles isActive initialization implicitly (no upkeep for CORE usually)
            const coreId = this.addBuilding('CORE', coreX, coreY, true); // Pass 'true' for free/initial build
            if (coreId) {
                GAME.state.coreBuildingId = coreId;
            } else {
                 // This should be fatal if the core can't be placed
                 throw new Error(`Failed to create Core building instance at [${coreX}, ${coreY}].`);
            }
         } else {
             throw new Error(`Invalid core coordinates specified in config: [${coreX}, ${coreY}]`);
         }
    },

     // --- Building Lifecycle ---
    addBuilding: function(typeId, x, y, free = false) { // 'free' flag mainly for initial setup
         const buildingData = GAME.data.buildings[typeId];
         if (!buildingData) {
             console.error(`Invalid build type requested: ${typeId}`);
             GAME.ui.addLog(`ERR: Unknown build type ${typeId}`, 'log-danger');
             return null;
         }

         const id = `bldg_${GAME.state.nextInstanceId++}`;
         const hp = buildingData.hp;
         let graphics;

         try {
             // Use graphics manager to create graphic
             graphics = GAME.graphics.createRectGraphic(buildingData.spriteColor, GAME.config.tileSize);
             // Set position based on grid coords
             graphics.x = x * GAME.config.tileSize;
             graphics.y = y * GAME.config.tileSize;
         } catch (error) {
             console.error(`Error creating PIXI graphic for building ${typeId}:`, error);
             GAME.ui.addLog(`ERR: Failed to create visual for ${buildingData.name}.`, 'log-danger');
             return null; // Don't add building if graphic fails
         }

         // --- Create Building State Object ---
         const newBuilding = {
             id: id,
             typeId: typeId,
             x: x,
             y: y,
             hp: hp,
             graphic: graphics
             // isActive is added dynamically below if needed
         };

         // Initialize 'isActive' state ONLY if the building has upkeep > 0
         // Default to true if upkeep exists, otherwise the property doesn't exist
         if (buildingData.biomassUpkeep > 0) {
             newBuilding.isActive = true;
         }

         // --- Add to Game State ---
         GAME.state.buildings.push(newBuilding);
         GAME.state.grid[y][x] = id; // Mark grid tile as occupied by this building ID

         // Add graphic to the container via graphics manager
         if (GAME.graphics.gridContainer) {
              GAME.graphics.gridContainer.addChild(graphics);
         } else {
             console.error("Grid container not ready for building graphic.");
             // Should we remove the building state if graphic fails to add? Probably.
             GAME.state.buildings.pop();
             GAME.state.grid[y][x] = null;
             graphics.destroy(); // Clean up the created graphic
             return null;
         }

         return id; // Return the new building's ID on success
    },

    removeBuilding: function(buildingId) {
        const index = GAME.state.buildings.findIndex(b => b.id === buildingId);
        if (index === -1) {
            console.warn(`Attempted to remove non-existent building: ${buildingId}`);
            return;
        }

        const building = GAME.state.buildings[index];

        // Clear grid reference
        if (GAME.utils.isValidTile(building.x, building.y)) {
             if (GAME.state.grid[building.y]?.[building.x] === buildingId) {
                GAME.state.grid[building.y][building.x] = null;
             } else {
                 console.warn(`Grid mismatch when removing building ${buildingId} at [${building.x}, ${building.y}]`);
             }
        }

        // Remove and destroy graphic
        if (building.graphic) {
            if (building.graphic.parent) {
                GAME.graphics.gridContainer?.removeChild(building.graphic);
            }
            building.graphic.destroy({ children: true }); // Clean up Pixi object
        }

        // Remove from state array
        GAME.state.buildings.splice(index, 1);

        // TODO: Add refund logic here? (e.g., give back some resources)
        // const buildingData = GAME.data.buildings[building.typeId];
        // if(buildingData && buildingData.cost) { ... refund logic ... }

        GAME.ui.addLog(`Deconstructed ${GAME.data.buildings[building.typeId]?.name || 'building'}.`, 'log-info');
        GAME.ui.updateUI(); // Update UI as grid/selection might change
    },

    // --- Building Placement Logic ---
    tryBuild: function(typeId, x, y) {
        const buildingData = GAME.data.buildings[typeId];

        // --- Validation Checks ---
        if (!buildingData) {
            GAME.ui.addLog(`ERR: Unknown build type ${typeId}`, 'log-danger');
            GAME.audio.playSound('error');
            return false;
        }
        if (!GAME.utils.isValidTile(x, y)) {
            GAME.ui.addLog(`ERR: Cannot build outside grid at [${x},${y}]`, 'log-warning');
            GAME.audio.playSound('error');
            return false;
        }
        if (GAME.utils.isTileOccupied(x, y)) {
            GAME.ui.addLog(`ERR: Tile [${x},${y}] is already occupied`, 'log-warning');
            GAME.audio.playSound('error');
            return false;
        }
        // Prevent building on the exact core tile (unless it's the core itself during init)
        if (x === GAME.config.coreCoords.x && y === GAME.config.coreCoords.y && typeId !== 'CORE') {
            GAME.ui.addLog(`ERR: Cannot build on CORE tile [${x},${y}]`, 'log-warning');
            GAME.audio.playSound('error');
            return false;
        }

        // --- Pathfinding Check (Ensure Core remains reachable) ---
        // Temporarily mark the tile as blocked for the check
        GAME.state.grid[y][x] = 'TEMP_BLOCK';
        // Check path from a typical enemy spawn point (e.g., right edge middle) to core
        const pathCheckStartX = GAME.config.gridWidth - 1;
        const pathCheckStartY = Math.floor(GAME.config.gridHeight / 2);
        const coreX = GAME.config.coreCoords.x;
        const coreY = GAME.config.coreCoords.y;
        let coreReachable = GAME.utils.pathfinding.isTargetReachable(pathCheckStartX, pathCheckStartY, coreX, coreY);
        // Immediately remove the temporary block
        GAME.state.grid[y][x] = null;

        if (!coreReachable) {
            GAME.ui.addLog(`ERR: Building at [${x},${y}] would block path to CORE`, 'log-warning');
            GAME.audio.playSound('error');
            return false;
        }

        // --- Affordability Check ---
        if (!GAME.utils.canAfford(buildingData.cost)) {
            GAME.ui.addLog(`ERR: Insufficient resources for ${buildingData.name}`, 'log-warning');
            GAME.audio.playSound('error');
            return false;
        }

        // --- Build It! ---
        GAME.utils.spendResources(buildingData.cost); // Spend resources first
        const newBuildingId = this.addBuilding(typeId, x, y); // Attempt to add the building

        if (newBuildingId) {
            // Success
            GAME.ui.addLog(`Constructed ${buildingData.name} at [${x},${y}].`, 'log-success');
            GAME.audio.playSound('build');
            GAME.ui.updateUI(); // Update UI to reflect resource change and new building
            return true;
        } else {
            // Failure during addBuilding (e.g., graphic error) - Refund resources
            GAME.ui.addLog(`ERR: Failed to instance ${buildingData.name} at [${x},${y}]. Construction aborted.`, 'log-danger');
            // Refund by adding resources back
            if (buildingData.cost) {
                 Object.entries(buildingData.cost).forEach(([res, amount]) => {
                    if (GAME.state.resources.hasOwnProperty(res)) {
                        GAME.state.resources[res] += amount;
                    }
                 });
            }
             GAME.audio.playSound('error');
             GAME.ui.updateUI(); // Update UI to reflect refunded resources
            return false;
        }
    },


    // --- Building Updates (Called from baseTick) ---
    updateBuildingStates: function(tickDurationSeconds) {
        let stateChanged = false; // Tracks if resources or isActive states changed

        GAME.state.buildings.forEach(b => {
            const bData = GAME.data.buildings[b.typeId];
            if (!bData) return; // Skip if data is missing

            let wasActive = b.isActive; // Store initial state for comparison

            // 1. Handle Biomass Upkeep (Only if upkeep > 0)
            if (bData.biomassUpkeep > 0) {
                const upkeepCostThisTick = bData.biomassUpkeep * tickDurationSeconds;

                if (GAME.state.resources.biomass >= upkeepCostThisTick) {
                    // Sufficient Biomass: Pay upkeep and ensure active
                    GAME.state.resources.biomass -= upkeepCostThisTick;
                    stateChanged = true; // Resources changed
                    // If it was inactive, reactivate it
                    if (b.isActive === false) {
                        b.isActive = true;
                        GAME.ui.addLog(`${bData.name} at [${b.x},${b.y}] reactivated.`, 'log-success');
                        GAME.audio.playSound('power_up'); // Optional sound
                        stateChanged = true; // isActive state changed
                    } else if (b.isActive === undefined) {
                         // If isActive was somehow undefined but has upkeep, set it to true
                         b.isActive = true;
                         stateChanged = true; // State changed
                    }

                } else {
                    // Insufficient Biomass: Deactivate if it was active
                    if (b.isActive !== false) { // Check if currently active or undefined
                        b.isActive = false;
                        GAME.ui.addLog(`${bData.name} at [${b.x},${b.y}] powered down (No Biomass).`, 'log-warning');
                        GAME.audio.playSound('power_down'); // Optional sound
                        stateChanged = true; // isActive state changed
                    }
                     // Note: Resources didn't change here, but isActive might have
                }
            } else {
                 // If building has no upkeep, it's always considered active for production
                 // Remove isActive property if it somehow exists without upkeep? Or just ignore it.
                 // Let's ensure isActive is removed if upkeep is zero or less.
                 if (b.hasOwnProperty('isActive')) {
                    delete b.isActive;
                     // No state change log needed here, just internal cleanup
                 }
            }


            // 2. Handle Production (Only if active or doesn't require upkeep)
            // isActive !== false covers true and undefined (for buildings without upkeep)
            const canProduce = b.isActive !== false;

            if (bData.production && canProduce) {
                Object.entries(bData.production).forEach(([res, amountPerSecond]) => {
                    if (GAME.state.resources.hasOwnProperty(res)) {
                         GAME.state.resources[res] += amountPerSecond * tickDurationSeconds;
                         stateChanged = true; // Resources changed
                    } else {
                        console.warn(`Building ${bData.name} trying to produce unknown resource: ${res}`);
                    }
                });
            }
        });

        return stateChanged; // Return true if resources or building active states changed
    },

     // --- Core Specific Actions ---
     tryRepairCore: function() {
        const coreBuilding = this.getBuildingById(GAME.state.coreBuildingId);
        if (!coreBuilding) {
             GAME.ui.addLog("ERR: Core building not found for repair.", "log-danger"); return;
        }


        const coreData = GAME.data.buildings['CORE'];
        if (!coreData) {
             GAME.ui.addLog("ERR: Core building data missing.", "log-danger"); return;
        }

        const cost = GAME.config.biomassCoreRepairCost;
        const repairAmount = GAME.config.biomassCoreRepairAmount;

        if (coreBuilding.hp >= coreData.hp) {
            GAME.ui.addLog(`Core integrity already at maximum.`, 'log-info');
            return;
        }
        if (!GAME.utils.canAfford({ biomass: cost })) {
            GAME.ui.addLog(`Insufficient Biomass for core repair. Need ${cost}.`, 'log-warning');
            GAME.audio.playSound('error');
            return;
        }

        GAME.utils.spendResources({ biomass: cost });
        const oldHp = coreBuilding.hp;
        coreBuilding.hp = Math.min(coreData.hp, coreBuilding.hp + repairAmount);
        const repairedAmount = coreBuilding.hp - oldHp;

        GAME.ui.addLog(`Core integrity reinforced by ${repairedAmount} HP. (-${cost} Biomass)`, 'log-success');
        GAME.audio.playSound('build'); // Use build/repair sound
        GAME.ui.updateUI(); // Update UI immediately
    },
};