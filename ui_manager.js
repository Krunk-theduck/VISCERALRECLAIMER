// --- ui_manager.js ---
// Handles DOM manipulation, UI updates, events, modals, logging

GAME.ui = {
    setupUI: function() {
        // Ensure elements exist before adding listeners
        const raidButton = document.getElementById('raid-button');
        const modalCloseButton = document.getElementById('modal-close-button');
        const healButton = document.getElementById('heal-button');
        const mutateButton = document.getElementById('mutate-button');
        const repairCoreButton = document.getElementById('repair-core-button');

        if (raidButton) raidButton.addEventListener('click', () => GAME.actors.initiateRaidZoneSelection()); else console.error("Missing UI element: raid-button");
        if (modalCloseButton) modalCloseButton.addEventListener('click', () => this.hideModal()); else console.error("Missing UI element: modal-close-button");
        if (healButton) healButton.addEventListener('click', () => GAME.actors.tryHealSurvivor()); else console.error("Missing UI element: heal-button");
        if (mutateButton) mutateButton.addEventListener('click', () => GAME.actors.tryMutateSurvivor()); else console.error("Missing UI element: mutate-button");
        if (repairCoreButton) repairCoreButton.addEventListener('click', () => GAME.buildings.tryRepairCore()); else console.error("Missing UI element: repair-core-button");

        this.populateBuildOptions(); // Populate build options on initial setup
    },

     updateUI: function() {
         // Prevent updates if critical data is missing or game over
         if (GAME.state.gameOver || !GAME.data || !GAME.config) return;

         // --- Update Resources ---
         const resScrap = document.getElementById('res-scrap');
         const resBiomass = document.getElementById('res-biomass');
         const resTech = document.getElementById('res-tech');
         if (resScrap) resScrap.textContent = GAME.state.resources.scrap;
         if (resBiomass) resBiomass.textContent = Math.floor(GAME.state.resources.biomass); // Show whole numbers
         if (resTech) resTech.textContent = GAME.state.resources.tech;


         // --- Update Survivor List & Details/Actions ---
         const survivorList = document.getElementById('survivor-list');
         const survivorDetailsDiv = document.getElementById('survivor-details');
         const healButton = document.getElementById('heal-button');
         const mutateButton = document.getElementById('mutate-button');
         const raidButton = document.getElementById('raid-button');

         if (!survivorList || !survivorDetailsDiv || !healButton || !mutateButton || !raidButton) {
              console.error("Survivor UI elements missing!"); return;
         }

         survivorList.innerHTML = ''; // Clear previous list
         survivorDetailsDiv.textContent = 'Select a survivor.'; // Default text
         healButton.disabled = true; healButton.title = '';
         mutateButton.disabled = true; mutateButton.title = '';
         raidButton.disabled = true; raidButton.textContent = "SELECT RAID ZONE"; raidButton.title = 'Select an IDLE survivor first';

         const selectedSurvivor = GAME.actors.getSurvivorById(GAME.state.selectedSurvivorId);

         GAME.state.survivors.forEach(s => {
             const li = document.createElement('li');
             li.dataset.survivorId = s.id;
             let statusClass = `survivor-status-${s.status}`;
             li.className = statusClass;
             if (s.id === GAME.state.selectedSurvivorId) li.classList.add('selected');

             let statusText = s.status.toUpperCase();
             let hpText = `(${s.hp}/${s.maxHp} HP)`;
             let raidProgressText = '';
             let mutationText = '';

             if (s.mutations.length > 0) {
                 mutationText = ` [Mut: ${s.mutations.length}]`;
             }

             if (s.status === 'raiding' || s.status === 'paused') {
                 if (s.currentRaid && GAME.data.raidZones) {
                     const progress = Math.floor(s.currentRaid.progress * 100);
                     const zoneData = GAME.data.raidZones[s.currentRaid.zoneId];
                     const zoneName = zoneData ? zoneData.name : 'Unknown Zone';
                     raidProgressText = ` [${zoneName}: ${progress}%]`;
                     if (s.status === 'paused') raidProgressText += ` [ENCOUNTER!]`;
                 }
                 hpText = ''; // Hide HP during raid for clarity
             } else if (s.status === 'dead') {
                 statusText += ' (KIA)';
                 hpText = '';
                 mutationText = ''; // Don't show mutation count if dead
             }

             li.innerHTML = `<span>${s.name} [${statusText}]${hpText}${mutationText}${raidProgressText}</span>`;

             if (s.status !== 'dead') {
                 li.addEventListener('click', () => {
                    GAME.state.selectedSurvivorId = s.id;
                    GAME.audio.playSound('click');
                    this.updateUI(); // Re-render UI with selection
                 });
             } else {
                 li.style.cursor = 'default';
             }
             survivorList.appendChild(li);
         });

         // Update Survivor Action Buttons based on selection
         if (selectedSurvivor) {
             let details = `${selectedSurvivor.name} | ${selectedSurvivor.status.toUpperCase()} | HP: ${selectedSurvivor.hp}/${selectedSurvivor.maxHp}`;
             if (selectedSurvivor.mutations.length > 0) {
                 const mutationNames = selectedSurvivor.mutations
                     .map(mutId => GAME.data.mutations?.find(m => m.id === mutId)?.name || mutId) // Add safe navigation
                     .join(', ');
                 details += ` | Mutations: ${mutationNames || 'Unknown'}`;
             }
             survivorDetailsDiv.textContent = details;

             // Heal button logic
             const canHeal = (['injured', 'idle', 'mutated'].includes(selectedSurvivor.status)) && selectedSurvivor.hp < selectedSurvivor.maxHp;
             const hasEnoughBiomassHeal = GAME.state.resources.biomass >= GAME.config.biomassHealCost;
             healButton.disabled = !(canHeal && hasEnoughBiomassHeal);
             healButton.title = canHeal ? (hasEnoughBiomassHeal ? `Heal ${GAME.config.biomassHealAmount} HP (Cost: ${GAME.config.biomassHealCost} Biomass)` : `Need ${GAME.config.biomassHealCost} Biomass`) : (selectedSurvivor.hp >= selectedSurvivor.maxHp ? 'HP Full' : `Invalid Status: ${selectedSurvivor.status}`);

             // Mutate button logic
             const canMutate = ['idle', 'mutated'].includes(selectedSurvivor.status);
             const hasEnoughBiomassMutate = GAME.state.resources.biomass >= GAME.config.biomassMutateCost;
             mutateButton.disabled = !(canMutate && hasEnoughBiomassMutate);
             mutateButton.title = canMutate ? (hasEnoughBiomassMutate ? `Attempt Mutation (Cost: ${GAME.config.biomassMutateCost} Biomass)` : `Need ${GAME.config.biomassMutateCost} Biomass`) : `Cannot mutate (Invalid status: ${selectedSurvivor.status})`;

             // Raid button logic
             if (selectedSurvivor.status === 'idle') {
                 raidButton.disabled = false;
                 raidButton.textContent = "SELECT RAID ZONE";
                 raidButton.title = 'Dispatch survivor on a raid';
             } else {
                 raidButton.disabled = true;
                 raidButton.textContent = `CANNOT RAID (${selectedSurvivor.status.toUpperCase()})`;
                 raidButton.title = `Survivor must be IDLE (Currently ${selectedSurvivor.status})`;
             }
         }

         // --- Update Build Options Affordability & Selection ---
         this.updateBuildOptionsAffordability();

         // --- Update Selected Tile Info & Building Active State visual ---
         const tileInfoDiv = document.getElementById('selected-tile-info');
         let tileText = 'Select a tile on the grid.'; // Default

         if (GAME.state.selectedTile && tileInfoDiv) {
              const {x, y} = GAME.state.selectedTile;
              const buildingId = GAME.state.grid[y]?.[x];
              if (buildingId) {
                  const building = GAME.buildings.getBuildingById(buildingId); // Use building manager getter
                  if (building && GAME.data.buildings[building.typeId]) {
                     const buildingData = GAME.data.buildings[building.typeId];
                     let activeStatus = '';
                     if (buildingData.biomassUpkeep > 0) {
                         activeStatus = (building.isActive === false) ? ' [INACTIVE]' : ' [ACTIVE]';
                     }
                     tileText = `Tile [${x},${y}]: ${buildingData.name} (HP: ${building.hp}/${buildingData.hp})${activeStatus}`;
                  } else {
                     tileText = `Tile [${x},${y}]: OCCUPIED (ERR: Data mismatch)`;
                     console.warn(`Building data mismatch for ID ${buildingId} at [${x},${y}]`);
                  }
              } else {
                 tileText = `Tile [${x},${y}]: Empty`;
              }
              tileInfoDiv.textContent = tileText;
         } else if (tileInfoDiv) {
             tileInfoDiv.textContent = tileText; // Set default if no tile selected
         }

         // Update building graphic tints for active state
         this.updateBuildingActiveVisuals();

         // --- Update Wave Info ---
         const waveNum = document.getElementById('wave-number');
         const waveTimer = document.getElementById('wave-timer');
         if(waveNum) waveNum.textContent = GAME.state.wave;
         if(waveTimer) waveTimer.textContent = Math.max(0, Math.ceil(GAME.state.waveTimer));

         // --- Update Core HP & Repair Button ---
         const coreBuilding = GAME.buildings.getBuildingById(GAME.state.coreBuildingId); // Use building manager getter
         const repairCoreButton = document.getElementById('repair-core-button');
         const coreHpDisplay = document.getElementById('core-hp');

         if (!repairCoreButton || !coreHpDisplay) {
             console.error("Core UI elements missing!"); return;
         }

         repairCoreButton.disabled = true; // Default disabled
         repairCoreButton.title = '';

         if(coreBuilding && GAME.data.buildings[coreBuilding.typeId]){
             const coreData = GAME.data.buildings[coreBuilding.typeId];
             const coreHpPercent = coreData.hp > 0 ? Math.ceil((coreBuilding.hp / coreData.hp) * 100) : 0;
             coreHpDisplay.textContent = `${Math.max(0, coreHpPercent)}`; // Ensure non-negative display

             // Enable repair button if core damaged and enough biomass
             const coreDamaged = coreBuilding.hp < coreData.hp;
             const hasEnoughBiomassRepair = GAME.state.resources.biomass >= GAME.config.biomassCoreRepairCost;
             repairCoreButton.disabled = !(coreDamaged && hasEnoughBiomassRepair);
             repairCoreButton.title = coreDamaged ? (hasEnoughBiomassRepair ? `Repair ${GAME.config.biomassCoreRepairAmount} HP (Cost: ${GAME.config.biomassCoreRepairCost} Biomass)` : `Need ${GAME.config.biomassCoreRepairCost} Biomass`) : `Core at full health`;

         } else {
             coreHpDisplay.textContent = 'ERR';
             console.warn("Core building not found or data missing for UI update.");
         }
     },

    populateBuildOptions: function() {
        const buildOptionsDiv = document.getElementById('build-options');
        if (!buildOptionsDiv) { console.error("Build options container not found!"); return; }
        buildOptionsDiv.innerHTML = ''; // Clear existing

        if (!GAME.data || !GAME.data.buildings) {
            console.error("Building data not available for populating build options.");
            buildOptionsDiv.innerHTML = 'Error loading build options.';
            return;
        }

        Object.values(GAME.data.buildings).forEach(bData => {
            if (bData.type === 'core') return; // Skip core

            const optionDiv = document.createElement('div');
            optionDiv.classList.add('build-option');
            optionDiv.dataset.buildType = bData.id; // Use the building ID (e.g., 'WALL', 'TURRET')

            let costString = 'Free';
            if (bData.cost && Object.keys(bData.cost).length > 0) {
                costString = Object.entries(bData.cost).map(([res, amount]) => `${amount} ${res}`).join(', ');
            }

            let upkeepString = '';
            if (bData.biomassUpkeep > 0) {
                 // Using toFixed(1) or similar if upkeep can be fractional
                upkeepString = `<br>Upkeep: ${bData.biomassUpkeep.toFixed(1)} Biomass/s`;
            }

            optionDiv.innerHTML = `<span>${bData.name}</span><small>Cost: ${costString}${upkeepString}</small><small>${bData.description || ''}</small>`;

            optionDiv.addEventListener('click', () => {
                 // Toggle selection
                 const currentlySelected = GAME.state.selectedBuildType === bData.id;
                 GAME.state.selectedBuildType = currentlySelected ? null : bData.id;

                 if (GAME.state.selectedBuildType) {
                     this.addLog(`Build mode: ${bData.name}. Click grid to place.`, "log-info");
                     // Check affordability immediately upon selection
                     if (!GAME.utils.canAfford(bData.cost)) {
                         this.addLog(`WARNING: Insufficient resources for ${bData.name}.`, "log-warning");
                     }
                 } else {
                     this.addLog("Build mode deactivated.", "log-info");
                 }

                 GAME.audio.playSound('click');
                 this.updateUI(); // Update UI to reflect selection and affordability highlights
            });
            buildOptionsDiv.appendChild(optionDiv);
        });
    },

    updateBuildOptionsAffordability: function() {
         document.querySelectorAll('.build-option').forEach(el => {
             const buildType = el.dataset.buildType;
             if (!buildType || !GAME.data || !GAME.data.buildings) return; // Safety checks

             const buildingData = GAME.data.buildings[buildType];
             el.classList.remove('selected', 'unaffordable'); // Reset classes

             if (buildingData){
                 // Check affordability using the utility function
                 if (!GAME.utils.canAfford(buildingData.cost)) {
                     el.classList.add('unaffordable');
                 }
                 // Highlight if selected
                 if (GAME.state.selectedBuildType === buildType) {
                      el.classList.add('selected');
                 }
            } else {
                 console.warn(`Data missing for build option type: ${buildType}`);
                 el.classList.add('unaffordable'); // Treat missing data as unaffordable/unbuildable
            }
         });
    },

    // Updates building graphic tints based on isActive state
    updateBuildingActiveVisuals: function() {
         GAME.state.buildings.forEach(building => {
             const bData = GAME.data.buildings[building.typeId];
             // Check graphic exists and has a parent (is on stage)
             if (bData && building.graphic && building.graphic.parent) {
                 const originalColor = bData.spriteColor || 0xFFFFFF;
                 const inactiveColor = 0x777777; // Dim grey for inactive

                 let targetTint = originalColor; // Default to original color

                 // Apply inactive tint only if it has upkeep and is specifically set to false
                 if (bData.biomassUpkeep > 0 && building.isActive === false) {
                     targetTint = inactiveColor;
                 }

                 // Apply tint only if it's different from the current tint
                 if (building.graphic.tint !== targetTint) {
                      building.graphic.tint = targetTint;
                 }
             }
         });
    },


    addLog: function(message, type = 'log-info') {
        const logDiv = document.getElementById('game-log');
        if (!logDiv) { console.error("Game log element not found!"); return; }

        const messageDiv = document.createElement('div');
        messageDiv.className = `log-message ${type}`;

        // Basic sanitization to prevent accidental HTML injection
        const safeMessage = String(message).replace(/</g, '<').replace(/>/g, '>');
        messageDiv.textContent = `> ${safeMessage}`; // Use textContent for safety

        logDiv.appendChild(messageDiv);

        // Auto-scroll to bottom
        // Use setTimeout to allow the browser to render the new element first
        setTimeout(() => { logDiv.scrollTop = logDiv.scrollHeight; }, 0);

        // Optional: Limit log length
        const maxLogMessages = 100;
        if (logDiv.children.length > maxLogMessages) {
            logDiv.removeChild(logDiv.children[0]);
        }
    },

    // Updated showModal for different content types
    showModal: function(title, content, type = 'message') {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalCloseButton = document.getElementById('modal-close-button');

        if (!modalOverlay || !modalTitle || !modalMessage || !modalCloseButton) {
             console.error("Modal elements missing!"); return;
        }


        modalTitle.textContent = title;
        modalMessage.innerHTML = ''; // Clear previous content
        modalMessage.style.textAlign = 'center'; // Default alignment

        if (type === 'zone-selection') {
            modalMessage.style.textAlign = 'left'; // Align buttons left
            if (Array.isArray(content) && GAME.data.raidZones) {
                 content.forEach(zoneData => { // Expects array of zone data objects
                    const zoneButton = document.createElement('button');
                    zoneButton.classList.add('modal-zone-button'); // Add class for styling

                    const duration = `${zoneData.baseDuration[0]}-${zoneData.baseDuration[1]}s`;
                    let lootInfo = 'Unknown';
                    if (zoneData.lootModifiers) {
                        lootInfo = Object.entries(zoneData.lootModifiers)
                                       .map(([res, mod]) => `${res} x${mod.toFixed(1)}`)
                                       .join(', ');
                    }

                    zoneButton.innerHTML = `${zoneData.name} (${duration})<br><small class="zone-details">${zoneData.description || ''}<br>Modifiers: ${lootInfo}</small>`;

                    zoneButton.onclick = () => {
                        // Call actor manager to handle confirmation
                        GAME.actors.confirmRaidZone(zoneData.id);
                        // confirmRaidZone should handle hiding the modal
                    };
                    modalMessage.appendChild(zoneButton);
                });
                 // Add a cancel button specifically for zone selection
                const cancelButton = document.createElement('button');
                cancelButton.textContent = "CANCEL SELECTION";
                cancelButton.classList.add('modal-cancel-button'); // Style differently
                cancelButton.onclick = () => { this.hideModal(); }; // Simply hide modal
                modalMessage.appendChild(cancelButton);

                // Hide the default close button for zone selection as we have specific buttons
                modalCloseButton.style.display = 'none';

            } else {
                 modalMessage.textContent = "Error: No raid zones available or invalid data.";
                 modalCloseButton.style.display = 'inline-block'; // Show default close button
                 modalCloseButton.textContent = "ACKNOWLEDGE";
            }
        }
        // TODO: Add 'encounter' type handling here
        // else if (type === 'encounter') { ... }
        else { // Default: 'message'
            // Replace newlines in the message content with <br> for display
            modalMessage.innerHTML = String(content).replace(/\n/g, '<br>');
            modalCloseButton.style.display = 'inline-block'; // Ensure default button is visible
            modalCloseButton.textContent = "ACKNOWLEDGE";
        }

        modalOverlay.style.display = 'flex'; // Show the modal
        // Play sound based on type - avoid error sound for info/selection
        const sound = (type === 'message' && content.toLowerCase().includes('error')) || type === 'error' ? 'error' : 'click';
        GAME.audio.playSound(sound);
    },

    hideModal: function() {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalCloseButton = document.getElementById('modal-close-button');
        if (modalOverlay) modalOverlay.style.display = 'none';
        if (modalCloseButton) {
             modalCloseButton.textContent = "ACKNOWLEDGE"; // Reset button text
             modalCloseButton.style.display = 'inline-block'; // Ensure it's visible for next time
        }


        // Clear selection state if modal was for zone selection and was cancelled
        // This is handled better within the cancel process in actor_manager now
        // if (GAME.state.selectingRaidZoneForSurvivorId) {
        //     GAME.ui.addLog("Raid zone selection cancelled.", "log-info");
        //      GAME.state.selectingRaidZoneForSurvivorId = null;
        // }
    },

     // --- UI Specific Helper for Game Over ---
     disableUI: function() {
        const uiPanel = document.getElementById('ui-panel');
        if (uiPanel) {
            uiPanel.style.pointerEvents = 'none';
            uiPanel.style.filter = 'grayscale(1) brightness(0.5)';
        }
         // Optionally disable canvas interaction directly if needed
         if (GAME.graphics.gridContainer) {
             GAME.graphics.gridContainer.interactive = false;
             GAME.graphics.gridContainer.alpha = 0.5;
         }
    }
};