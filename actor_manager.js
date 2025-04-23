// --- actor_manager.js ---
// Manages Survivors (including Raids, Mutations) and Enemies (Spawning, Movement, Combat Actions)

GAME.actors = {

    // --- Actor Getters ---
    getSurvivorById: function(id) {
        return GAME.state.survivors.find(s => s.id === id);
    },

    getEnemyById: function(id) {
        return GAME.state.enemies.find(e => e.id === id);
    },

    // --- Survivor Management ---
    setupInitialSurvivors: function() {
         GAME.data.survivorTemplates.forEach(template => {
             this.addSurvivor(template.name, template.baseHp);
         });
    },

    addSurvivor: function(name, hp) {
         const id = `surv_${GAME.state.nextInstanceId++}`;
         // Add mutations array and currentRaid placeholder
         GAME.state.survivors.push({
             id: id,
             name: name,
             hp: hp,
             maxHp: hp,
             status: 'idle', // idle, raiding, injured, mutated, paused, dead
             raidReturnTime: null, // DEPRECATED - use currentRaid.endTime
             mutations: [], // Array of mutation IDs
             currentRaid: null // Object containing raid state when active
            });
        // No UI update here, should be called after batch additions or by caller
    },

    // --- Survivor Actions (Heal, Mutate) ---
    tryHealSurvivor: function() {
        const survivor = this.getSurvivorById(GAME.state.selectedSurvivorId);
        if (!survivor) {
             GAME.ui.addLog("No survivor selected to heal.", "log-warning"); return;
        }


        const cost = GAME.config.biomassHealCost;
        const healAmount = GAME.config.biomassHealAmount;

        if (survivor.hp >= survivor.maxHp) {
            GAME.ui.addLog(`${survivor.name} is already at full health.`, 'log-info');
            return;
        }
        if (!['idle', 'injured', 'mutated'].includes(survivor.status)) {
             GAME.ui.addLog(`Cannot heal ${survivor.name} (Status: ${survivor.status.toUpperCase()}).`, 'log-warning');
             GAME.audio.playSound('error');
             return;
        }
        if (!GAME.utils.canAfford({ biomass: cost })) {
             GAME.ui.addLog(`Insufficient Biomass. Need ${cost}.`, 'log-warning');
             GAME.audio.playSound('error');
             return;
        }

        GAME.utils.spendResources({ biomass: cost });
        const oldHp = survivor.hp;
        survivor.hp = Math.min(survivor.maxHp, survivor.hp + healAmount);
        const healedAmount = survivor.hp - oldHp;

        let logMsg = `${survivor.name} healed for ${healedAmount} HP. (-${cost} Biomass)`;
        let logType = 'log-success';

        // Check if fully healed and change status IF they were injured
        if (survivor.hp >= survivor.maxHp && survivor.status === 'injured') {
            // Return to 'mutated' status if they have mutations, otherwise 'idle'
            survivor.status = survivor.mutations.length > 0 ? 'mutated' : 'idle';
            logMsg = `${survivor.name} healed for ${healedAmount} HP and fully recovered! (-${cost} Biomass)`;
        } else if (survivor.hp >= survivor.maxHp) {
             // If they reached max HP but weren't 'injured', just note it. Status unchanged unless injured.
             logMsg = `${survivor.name} healed to full HP (${healedAmount} HP). (-${cost} Biomass)`;
        }


        GAME.ui.addLog(logMsg, logType);
        GAME.audio.playSound('heal');
        GAME.ui.updateUI(); // Update UI immediately after action
    },

    tryMutateSurvivor: function() {
        const survivor = this.getSurvivorById(GAME.state.selectedSurvivorId);
        if (!survivor) {
             GAME.ui.addLog("No survivor selected to mutate.", "log-warning"); return;
        }

        const cost = GAME.config.biomassMutateCost;

        if (!['idle', 'mutated'].includes(survivor.status)) {
             GAME.ui.addLog(`Can only mutate IDLE or MUTATED survivors. ${survivor.name} is ${survivor.status}.`, 'log-warning');
             GAME.audio.playSound('error'); return;
        }
        if (!GAME.utils.canAfford({ biomass: cost })) {
            GAME.ui.addLog(`Insufficient Biomass. Need ${cost}.`, 'log-warning');
            GAME.audio.playSound('error'); return;
        }

        GAME.utils.spendResources({ biomass: cost });
        GAME.audio.playSound('mutate');

        // Mutation Logic
        const availableMutations = GAME.data.mutations?.filter(m => !survivor.mutations.includes(m.id)) || [];
        const mutationSuccessChance = 0.8; // Example: 80% chance

        if (availableMutations.length > 0 && Math.random() < mutationSuccessChance) {
            // Successful Mutation
            const mutation = availableMutations[Math.floor(Math.random() * availableMutations.length)];
            survivor.mutations.push(mutation.id);
            survivor.status = 'mutated'; // Ensure status is mutated

            // --- Apply Mutation Effects (Placeholder/Basic Example) ---
            // TODO: Implement a proper recalculateSurvivorStats function based on TODO
            let effectLog = [];
            // Example simple effects - replace with real calculation logic later
            if (mutation.id === 'MUT_SPEED') { survivor.maxHp = Math.max(10, Math.floor(survivor.maxHp * 0.9)); effectLog.push("-10% Max HP"); }
            if (mutation.id === 'MUT_REGEN') { survivor.maxHp = Math.max(10, Math.floor(survivor.maxHp * 0.85)); effectLog.push("-15% Max HP"); }
            if (mutation.id === 'MUT_THICK_HIDE') { survivor.maxHp = Math.max(10, Math.floor(survivor.maxHp * 1.2)); effectLog.push("+20% Max HP"); }
             // Ensure current HP doesn't exceed new max HP
            survivor.hp = Math.min(survivor.maxHp, survivor.hp);
            effectLog = effectLog.length > 0 ? ` (${effectLog.join(', ')})` : '';
            // --- End Placeholder Effects ---

            GAME.ui.addLog(`${survivor.name} subjected to biomass infusion... Mutation acquired: ${mutation.name}!${effectLog} (-${cost} Biomass)`, 'log-danger'); // Use danger for mutation

        } else if (availableMutations.length === 0) {
            // No more mutations available
            GAME.ui.addLog(`${survivor.name} has acquired all known mutations. Biomass wasted. (-${cost} Biomass)`, 'log-warning');
        } else {
            // Failed mutation attempt
            const hpLossPercent = 0.05; // Lose 5% max HP on failure
            const hpLoss = Math.max(1, Math.floor(survivor.maxHp * hpLossPercent)); // Lose at least 1 HP
            survivor.hp = Math.max(1, survivor.hp - hpLoss); // Ensure HP doesn't go below 1
            GAME.ui.addLog(`${survivor.name} subjected to biomass infusion... unstable reaction! (Lost ${hpLoss} HP) (-${cost} Biomass)`, 'log-warning');
            // Don't change status to injured on fail unless HP drops very low? Or maybe always set to injured? TBD.
             if (survivor.hp <= 0) {
                 // This shouldn't happen if hpLoss is small, but handle edge case
                 survivor.status = 'dead';
                 GAME.ui.addLog(`${survivor.name} succumbed to the failed mutation!`, 'log-danger');
             }
        }
        GAME.ui.updateUI(); // Update UI immediately
    },

    // --- Survivor Passive Updates (Called from baseTick) ---
    updateSurvivorPassives: function(tickDurationSeconds) {
        let stateChanged = false;
         GAME.state.survivors.forEach(s => {
            if (s.status === 'dead') return; // Skip dead survivors

            let needsRecoveryCheck = false;

             // Passive regen from mutations (Example: MUT_REGEN)
             // TODO: Get regen rate from mutation data
             if (s.mutations.includes('MUT_REGEN') && s.hp < s.maxHp) {
                 const regenPerSecond = 0.1; // Placeholder value
                 s.hp = Math.min(s.maxHp, s.hp + regenPerSecond * tickDurationSeconds);
                 needsRecoveryCheck = true; // Check if they became fully healed
                 stateChanged = true; // HP changed
             }

             // Check if fully healed and update status (from passive/active heal)
             if ((s.status === 'injured' || needsRecoveryCheck) && s.hp >= s.maxHp) {
                  s.hp = s.maxHp; // Clamp HP
                 if (s.status === 'injured') { // Only log/change status if they were injured
                     s.status = s.mutations.length > 0 ? 'mutated' : 'idle'; // Recover to appropriate status
                     GAME.ui.addLog(`${s.name} fully recovered.`, 'log-success');
                     stateChanged = true; // Status changed
                 }
             }
         });
         return stateChanged; // Return true if any survivor state potentially changed HP/status
    },


    // --- Raiding Logic ---

    // Step 1: Player clicks "Select Raid Zone" button (Called from UI listener)
    initiateRaidZoneSelection: function() {
        const survivor = this.getSurvivorById(GAME.state.selectedSurvivorId);
        if (!survivor) {
            GAME.ui.addLog("Select an IDLE survivor first.", 'log-warning');
            GAME.audio.playSound('error');
            return;
        }
        if (survivor.status !== 'idle') {
            GAME.ui.addLog(`${survivor.name} is not IDLE (${survivor.status.toUpperCase()}).`, 'log-warning');
            GAME.audio.playSound('error');
            return;
        }

        // Check if raid zone data exists
        if (!GAME.data || !GAME.data.raidZones || Object.keys(GAME.data.raidZones).length === 0) {
             GAME.ui.addLog("No raid zone data loaded. Cannot initiate raid.", 'log-danger');
             GAME.audio.playSound('error');
             return;
        }

        GAME.state.selectingRaidZoneForSurvivorId = survivor.id; // Remember selection context
        const availableZones = Object.values(GAME.data.raidZones); // Pass zone data to modal
        GAME.ui.showModal(`Select Raid Zone for ${survivor.name}`, availableZones, 'zone-selection');
    },

    // Step 2: Player clicks a zone button in the modal (Called from UI modal button)
    confirmRaidZone: function(zoneId) {
        const survivorId = GAME.state.selectingRaidZoneForSurvivorId;
        // Clear selection state immediately, regardless of success/failure below
        GAME.state.selectingRaidZoneForSurvivorId = null;

        const survivor = this.getSurvivorById(survivorId);
        const zoneData = GAME.data.raidZones ? GAME.data.raidZones[zoneId] : null;

        // Close the selection modal *after* processing
        GAME.ui.hideModal();

        if (!survivor || !zoneData) {
            console.error("Error starting raid: Missing survivor or zone data after selection.", { survivorId, zoneId });
            GAME.ui.addLog("Error initiating raid (data missing).", 'log-danger');
            GAME.audio.playSound('error');
            return;
        }
        // Double-check status *after* modal interaction
        if (survivor.status !== 'idle') {
             GAME.ui.addLog(`Cannot start raid: ${survivor.name} is no longer IDLE.`, 'log-warning');
             GAME.audio.playSound('error');
             GAME.ui.updateUI(); // Refresh UI as status might have changed
             return;
        }

        // Now call the actual raid start function
        this.tryStartRaid(survivor, zoneData);
    },

    // Step 3: Start the raid (Internal call)
    tryStartRaid: function(survivor, zoneData) {
         survivor.status = 'raiding';
         const [minDuration, maxDuration] = zoneData.baseDuration || [30, 60]; // Default duration if missing
         const raidDurationSec = minDuration + Math.random() * (maxDuration - minDuration);
         const now = Date.now();
         const raidEndTime = now + raidDurationSec * 1000;
         const raidDurationMs = raidDurationSec * 1000;

         // Schedule first encounter check (e.g., 10-25% into raid duration)
         const firstCheckDelay = raidDurationMs * (0.1 + Math.random() * 0.15);
         const nextEncounterCheckTime = now + firstCheckDelay;

         survivor.currentRaid = {
             zoneId: zoneData.id,
             startTime: now,
             endTime: raidEndTime,
             duration: raidDurationMs, // Store duration in MS
             progress: 0, // 0 to 1
             log: [`[0s] Dispatched to ${zoneData.name}.`], // Start raid log
             paused: false,
             pauseStartTime: null, // Track when pause began
             currentEncounter: null,
             nextEncounterCheck: nextEncounterCheckTime // When to next check for an encounter
         };

         // Clear the deprecated timer field if it exists
         if (survivor.hasOwnProperty('raidReturnTime')) {
              survivor.raidReturnTime = null;
         }

         GAME.ui.addLog(`${survivor.name} dispatched to ${zoneData.name}. ETA: ${Math.ceil(raidDurationSec)}s.`, 'log-info');
         GAME.audio.playSound('raid_start');
         GAME.state.selectedSurvivorId = null; // Deselect survivor after dispatch
         GAME.ui.updateUI();
    },

    // Step 4: Check ongoing raids (Called periodically by a timer in main.js)
    checkRaids: function() {
        if (GAME.state.gameOver) return;
        const now = Date.now();
        let raidStateChanged = false; // Flag to update UI if progress/status changes

        GAME.state.survivors.forEach(s => {
            if (s.currentRaid && s.status !== 'dead') { // Process if raid object exists and survivor not dead

                 if (s.currentRaid.paused) {
                     // If paused, ensure UI reflects this (e.g., timer stops)
                     // Progress calculation might need adjustment if pause affects duration visually
                     raidStateChanged = true;
                     return; // Skip active checks if paused
                 }

                // --- Update Progress ---
                const elapsedTime = now - s.currentRaid.startTime;
                const newProgress = Math.min(1, elapsedTime / s.currentRaid.duration);
                // Only mark changed if progress actually changed significantly
                if (Math.abs(newProgress - s.currentRaid.progress) > 0.001) {
                     s.currentRaid.progress = newProgress;
                     raidStateChanged = true;
                }


                // --- Check for Encounters ---
                 // Only check if actively raiding and check time is reached
                if (s.status === 'raiding' && now >= s.currentRaid.nextEncounterCheck) {
                     const zoneData = GAME.data.raidZones[s.currentRaid.zoneId];
                     const baseEncounterChance = zoneData?.encounterChance || 0.1; // Default 10% chance if not specified

                     // TODO: Add modifiers based on survivor mutations/stats?
                     const finalEncounterChance = baseEncounterChance;

                     if (zoneData && Math.random() < finalEncounterChance) {
                         // --- TRIGGER ENCOUNTER ---
                         s.status = 'paused';
                         s.currentRaid.paused = true;
                         s.currentRaid.pauseStartTime = now; // Record pause time
                         const timeIntoRaid = Math.floor((now - s.currentRaid.startTime)/1000);
                         s.currentRaid.log.push(`[${timeIntoRaid}s] Encounter detected!`);

                         GAME.ui.addLog(`Raid Event for ${s.name} in ${zoneData.name}!`, 'log-raid');
                         GAME.audio.playSound('raid_event');
                         raidStateChanged = true; // Status changed

                         // --- Placeholder Encounter ---
                         // TODO: Replace with actual encounter selection and interactive modal (Phase 2)
                         s.currentRaid.currentEncounter = { type: "placeholder", message: "Anomaly detected! Stand by..." };
                         GAME.ui.showModal(
                             `Raid Event: ${s.name}`,
                             `Encounter in ${zoneData.name}!\n\n${s.currentRaid.currentEncounter.message}\n\n(Interactive choices coming soon. Resolving automatically...)`,
                             'message' // Use 'message' type for now
                         );

                         // Auto-resolve placeholder after a delay
                         setTimeout(() => {
                             // Check if survivor is *still* paused before resolving automatically
                             const currentSurvivorState = this.getSurvivorById(s.id);
                             if (currentSurvivorState && currentSurvivorState.status === 'paused' && currentSurvivorState.currentRaid?.paused) {
                                this.resolveRaidEncounter(s.id, { outcome: "CONTINUE_PLACEHOLDER" }); // Auto-continue
                             }
                         }, 4000); // Pause for 4 seconds

                         // Don't schedule next check yet, it happens after resolution

                     } else {
                         // No encounter this time, schedule next check
                         // Schedule next check relative to NOW, using the configured interval
                         const checkInterval = GAME.config.raidEncounterCheckInterval || 15000; // Default 15s
                         // Add some randomness to the interval?
                         const randomFactor = 0.8 + Math.random() * 0.4; // +/- 20% randomness
                         s.currentRaid.nextEncounterCheck = now + (checkInterval * randomFactor);
                     }
                 }

                // --- Check for Raid Completion ---
                // Only complete if actively raiding (not paused) and time is up
                if (s.status === 'raiding' && now >= s.currentRaid.endTime) {
                    this.resolveRaidCompletion(s); // Resolve the completed raid
                    raidStateChanged = true; // Status will change
                }
            }
        });

        if (raidStateChanged) {
            GAME.ui.updateUI(); // Update progress timers, status etc.
        }
    },

    // Step 5: Resolve Encounter (Called by modal choice OR placeholder timeout)
    resolveRaidEncounter: function(survivorId, choice) {
        const survivor = this.getSurvivorById(survivorId);
        if (!survivor || survivor.status !== 'paused' || !survivor.currentRaid?.paused) {
            console.warn("Attempted to resolve encounter for invalid state:", { survivorId, status: survivor?.status, raid: survivor?.currentRaid });
             // Try to recover if possible, hide modal if it's stuck open
            if (survivor && survivor.currentRaid) {
                 survivor.status = 'raiding'; // Force back to raiding
                 survivor.currentRaid.paused = false;
                 survivor.currentRaid.currentEncounter = null;
                 survivor.currentRaid.pauseStartTime = null;
            }
             GAME.ui.hideModal();
             GAME.ui.updateUI();
            return;
        }

        const encounter = survivor.currentRaid.currentEncounter; // TODO: Get real encounter data
        const outcome = choice.outcome || "Unknown"; // TODO: Get outcome from actual choice made

        // --- Log Resolution ---
        const resolutionMsg = `Encounter resolved. Outcome: ${outcome}`;
        GAME.ui.addLog(`Encounter resolved for ${survivor.name}. Outcome: ${outcome}`, 'log-info');
        survivor.currentRaid.log.push(resolutionMsg);

        // --- Apply Encounter Outcome Effects ---
        // TODO: Implement based on actual encounter data and choice outcome
        // Example: if (outcome === 'INJURY_MINOR') { survivor.hp = Math.max(1, survivor.hp - 10); }
        // Example: if (outcome === 'LOOT_SMALL') { GAME.state.resources.scrap += 5; GAME.ui.addLog("+5 Scrap (Encounter)", "log-success"); }
        // Example: if (outcome === 'ESCAPE') { /* Maybe slightly shorter raid duration? */ }

        // --- Unpause the Raid ---
        survivor.status = 'raiding'; // Set status back
        survivor.currentRaid.paused = false;

        // Adjust end time and next encounter check by the duration of the pause
        const pauseEndTime = Date.now();
        const pauseDuration = pauseEndTime - (survivor.currentRaid.pauseStartTime || pauseEndTime); // Safety check for pauseStartTime
        if (pauseDuration > 0) {
             survivor.currentRaid.endTime += pauseDuration; // Extend total raid time by pause duration
             // Also reschedule the *next* check relative to the pause end time
             const checkInterval = GAME.config.raidEncounterCheckInterval || 15000;
             const randomFactor = 0.8 + Math.random() * 0.4;
             survivor.currentRaid.nextEncounterCheck = pauseEndTime + (checkInterval * randomFactor);
        }

        // Clean up encounter state
        survivor.currentRaid.currentEncounter = null;
        survivor.currentRaid.pauseStartTime = null;

        GAME.ui.hideModal(); // Ensure modal is hidden
        GAME.ui.updateUI(); // Update UI to reflect unpaused state
    },

    // Step 6: Resolve Raid Completion (Called by checkRaids when timer ends)
    resolveRaidCompletion: function(survivor) {
        if (!survivor || !survivor.currentRaid) {
            console.error("Trying to resolve completion for survivor with invalid raid state:", survivor?.id);
            if (survivor) { // Attempt recovery
                survivor.status = survivor.mutations?.length > 0 ? 'mutated' : 'idle'; // Reset status
                survivor.currentRaid = null;
                 GAME.ui.updateUI();
            }
            return;
        }

        const zoneId = survivor.currentRaid.zoneId;
        const raidLog = survivor.currentRaid.log || [];
        const zoneData = GAME.data.raidZones ? GAME.data.raidZones[zoneId] : null;
        const lootModifiers = zoneData?.lootModifiers || { scrap: 1, biomass: 1, tech: 1 };
        const raidDurationSec = Math.ceil(survivor.currentRaid.duration / 1000);

        // --- Determine Final Outcome (e.g., injury, death, nothing, base loot) ---
        // Uses the utility function to get a random outcome based on configured chances
        let finalOutcome = GAME.utils.getRandomRaidOutcome();

        // --- Apply Zone Modifiers & Calculate Loot ---
        let finalLootGained = [];
        let lootReport = "No loot recovered.";
        if (finalOutcome.type === 'loot' && finalOutcome.items) {
            finalOutcome.items.forEach(item => {
                const modifier = lootModifiers[item.type] || 1; // Get zone modifier or default to 1
                // Apply modifier, ensure min <= max, round amounts
                const baseMin = item.min || 0;
                const baseMax = item.max || 0;
                const modMin = Math.floor(baseMin * modifier);
                const modMax = Math.ceil(baseMax * modifier);
                const finalMin = Math.max(0, modMin); // Ensure non-negative
                const finalMax = Math.max(finalMin, modMax); // Ensure max >= min

                if (finalMax > 0) { // Only calculate if potential loot exists
                     const amount = finalMin + Math.floor(Math.random() * (finalMax - finalMin + 1));
                     if (amount > 0 && GAME.state.resources.hasOwnProperty(item.type)) {
                         GAME.state.resources[item.type] += amount;
                         finalLootGained.push(`${amount} ${item.type}`);
                     }
                }
            });
            if (finalLootGained.length > 0) {
                 lootReport = `Recovered: ${finalLootGained.join(', ')}.`;
                 // Update the message in the outcome object itself for clarity
                 finalOutcome.message = `${finalOutcome.message} ${lootReport}`;
            } else {
                finalOutcome.message = `${finalOutcome.message} Recovered nothing.`;
            }

        }
        // --- End Loot Calculation ---

        // --- Prepare Modal Report ---
        const modalTitle = `Raid Complete: ${survivor.name} (${zoneData?.name || 'Unknown Zone'})`;
        let modalMessage = `Report from ${zoneData?.name || 'raid'} [${raidDurationSec}s]:\n---------------\n`;
        modalMessage += raidLog.join('\n') + '\n---------------\n'; // Add accumulated raid log
        modalMessage += `Final Outcome: ${finalOutcome.message}`; // Add the final outcome message

        let logType = 'log-info'; // Default log type
        let soundToPlay = 'click'; // Default sound

        // --- Process Final Outcome (Injury, Death, Status Change) ---
        switch(finalOutcome.type) {
            case 'loot':
            case 'nothing':
                survivor.status = survivor.mutations.length > 0 ? 'mutated' : 'idle'; // Return to appropriate status
                GAME.ui.addLog(`${survivor.name} returned from ${zoneData?.name || 'raid'}. ${lootReport}`, 'log-success');
                logType = 'log-success';
                soundToPlay = finalLootGained.length > 0 ? 'raid_success' : 'click';
                break;
            case 'injury':
                 let hpLost = 0;
                 const severity = finalOutcome.severity || 'minor'; // Default to minor if missing
                 // Calculate HP loss based on severity and max HP
                 if (severity === 'major') { hpLost = Math.ceil(survivor.maxHp * (0.5 + Math.random() * 0.3)); } // 50-80% HP loss
                 else { hpLost = Math.ceil(survivor.maxHp * (0.15 + Math.random() * 0.2)); } // 15-35% HP loss
                 survivor.hp = Math.max(1, survivor.hp - hpLost); // Ensure HP is at least 1
                 modalMessage += `\nSuffered ${severity} injuries. HP reduced by ${hpLost}. (${survivor.hp}/${survivor.maxHp})`;
                 GAME.ui.addLog(`${survivor.name} returned from ${zoneData?.name || 'raid'} injured (${severity}), lost ${hpLost} HP.`, 'log-warning');
                 survivor.status = 'injured'; // Set status
                 logType = 'log-warning'; soundToPlay = 'raid_fail';
                 break;
            case 'mutation': // Handle mutation gained at end of raid (if defined in outcomes)
                 // TODO: Add logic to actually grant a mutation from the outcome if specified
                 survivor.status = 'mutated'; // Ensure status is mutated
                 // Optional: Add small HP change as part of mutation outcome?
                 let hpChange = Math.floor((Math.random() - 0.4) * 20); // +/- HP effect example
                 survivor.hp = Math.max(1, Math.min(survivor.maxHp, survivor.hp + hpChange));
                 modalMessage += `\nFinal Status: MUTATED! (${survivor.hp}/${survivor.maxHp} HP).`; // Update modal msg
                 GAME.ui.addLog(`${survivor.name} mutated upon return from ${zoneData?.name || 'raid'}!`, 'log-danger');
                 logType = 'log-danger'; soundToPlay = 'mutate';
                 break;
            case 'death':
                 survivor.status = 'dead'; survivor.hp = 0;
                 modalMessage += `\nFATAL ERROR: Unit lost.`;
                 GAME.ui.addLog(`${survivor.name} KIA in ${zoneData?.name || 'raid'}.`, 'log-danger');
                 logType = 'log-danger'; soundToPlay = 'raid_fail';
                 break;
             default:
                 console.warn(`Unhandled raid outcome type: ${finalOutcome.type}`);
                 survivor.status = survivor.mutations.length > 0 ? 'mutated' : 'idle'; // Default to safe status
        }

        // --- Crucially: Clear raid state from survivor ---
        survivor.currentRaid = null;

        GAME.ui.showModal(modalTitle, modalMessage, 'message'); // Show results modal
        GAME.audio.playSound(soundToPlay);

        // Update UI AFTER state changes and clearing raid data
        GAME.ui.updateUI();
    },

    // --- Enemy Management ---
    spawnWave: function() {
        if (GAME.state.gameOver) return;
        GAME.state.wave++;
        GAME.ui.addLog(`DEFCON ${GAME.state.wave} INCOMING!`, 'log-warning');
        GAME.audio.playSound('wave_announce');

        // Calculate number of enemies based on wave
        const baseEnemies = GAME.config.waveBaseEnemies || 2;
        const enemiesPerWave = GAME.config.waveEnemyIncrement || 1.5;
        const numEnemies = baseEnemies + Math.floor(GAME.state.wave * enemiesPerWave);

        // Determine available enemy types based on wave number
        let availableEnemyTypes = ['SCRAPPER']; // Always available?
        // Use wave thresholds from config if available
        if (GAME.config.enemyUnlockWaves) {
            if (GAME.state.wave >= (GAME.config.enemyUnlockWaves.MUTANT_RAT || 3)) availableEnemyTypes.push('MUTANT_RAT');
            if (GAME.state.wave >= (GAME.config.enemyUnlockWaves.GLITCH_WISP || 5)) availableEnemyTypes.push('GLITCH_WISP');
             // Add more enemy types here based on config
        } else { // Fallback if config missing
             if (GAME.state.wave >= 3) availableEnemyTypes.push('MUTANT_RAT');
             if (GAME.state.wave >= 5) availableEnemyTypes.push('GLITCH_WISP');
        }


        for (let i = 0; i < numEnemies; i++) {
            const enemyType = availableEnemyTypes[Math.floor(Math.random() * availableEnemyTypes.length)];
            // Spawn slightly off-screen to the right, random Y
             const spawnX = GAME.config.gridWidth; // Start just off the right edge
             const spawnY = Math.floor(Math.random() * GAME.config.gridHeight); // Random row
             // Stagger spawn using setTimeout
             setTimeout(() => {
                 if (!GAME.state.gameOver) { // Check game over again before spawning
                    this.spawnEnemy(enemyType, spawnX, spawnY);
                 }
            }, i * (GAME.config.enemySpawnDelay || 250)); // Use delay from config or default
        }

        // Update UI to show new wave number immediately
        GAME.ui.updateUI();
    },

    spawnEnemy: function(typeId, x, y) {
        const enemyData = GAME.data.enemies[typeId];
        if (!enemyData) { console.warn(`Unknown enemy type requested: ${typeId}`); return; }

        const id = `enemy_${GAME.state.nextInstanceId++}`;
        // Ensure start coords are numbers
        const startX = Number(x);
        const startY = Number(y);
        if (isNaN(startX) || isNaN(startY)) {
             console.error(`Invalid spawn coordinates for enemy ${typeId}: [${x}, ${y}]`);
             return; // Don't spawn if coords are bad
        }

        const enemy = {
            id: id,
            typeId: typeId,
            x: startX, // Grid X (can be off-grid initially)
            y: startY, // Grid Y
            hp: enemyData.hp,
            maxHp: enemyData.hp, // Store max HP
            speed: enemyData.speed, // Tiles per interval (though movement logic uses path steps)
            damage: enemyData.damage,
            path: null, // Path array [ {x, y}, ... ]
            graphic: null, // Pixi graphic object
            moveProgress: 0, // For interpolation (0 to 1)
            prevX: startX, // Previous grid X for interpolation
            prevY: startY, // Previous grid Y for interpolation
            lastMoveTime: Date.now() // Track when the last move command was issued
        };

        try {
            // Use graphics manager to create the graphic
            const radius = GAME.config.tileSize * 0.4; // Example size
            enemy.graphic = GAME.graphics.createCircleGraphic(enemyData.spriteColor, radius);
            // Set initial *rendered* position based on grid coords
            enemy.graphic.x = startX * GAME.config.tileSize + GAME.config.tileSize / 2;
            enemy.graphic.y = startY * GAME.config.tileSize + GAME.config.tileSize / 2;
            // Add graphic to the container
             if (GAME.graphics.gridContainer) {
                GAME.graphics.gridContainer.addChild(enemy.graphic);
             } else {
                 console.error("Grid container not ready for enemy graphic.");
             }

        } catch(error) {
            console.error(`Error creating PIXI graphic for enemy ${typeId}:`, error);
            return; // Don't add enemy if graphic fails
        }

        GAME.state.enemies.push(enemy);

        // Calculate initial path immediately after adding
        this.recalculateEnemyPath(enemy);
        if (!enemy.path || enemy.path.length === 0) {
             // Log if pathing fails right at spawn (might be normal if blocked)
            const gridX = Math.floor(startX);
            const gridY = Math.floor(startY);
            GAME.ui.addLog(`WARN: Enemy ${enemy.id} (${enemyData.name}) at [${gridX}, ${gridY}] failed initial pathfinding.`, 'log-warning');
        }
    },

    moveEnemies: function() {
         if (GAME.state.gameOver) return;
         const now = Date.now();
         const coreCoords = GAME.config.coreCoords;

         GAME.state.enemies.forEach(enemy => {
              // Skip if already at core (will be handled by damageCore next tick or removed)
              if (enemy.x === coreCoords.x && enemy.y === coreCoords.y) {
                    this.damageCore(enemy.damage); // Apply damage
                    this.removeEnemy(enemy.id, false); // Remove enemy immediately after damaging core
                    return; // Stop processing this enemy
              }

              // --- Pathing ---
              // Ensure path exists, recalculate if needed
              if (!enemy.path || enemy.path.length === 0) {
                  this.recalculateEnemyPath(enemy);
                  // If still no path after recalc, enemy is stuck, do nothing this tick
                  if (!enemy.path || enemy.path.length === 0) {
                       // Maybe add a log here if an enemy is stuck for too long?
                       return;
                  }
              }

              // --- Get Next Step ---
              const nextStep = enemy.path[0]; // {x, y}

               // --- Check if Next Step is Blocked ---
              const isNextStepCore = nextStep.x === coreCoords.x && nextStep.y === coreCoords.y;
              const isNextStepOccupied = GAME.utils.isTileOccupied(nextStep.x, nextStep.y);

              // Recalculate path if the *planned* next step is blocked by something *other than* the core
              if (isNextStepOccupied && !isNextStepCore) {
                  // console.log(`Enemy ${enemy.id} rerouting, path blocked at [${nextStep.x},${nextStep.y}]`);
                  this.recalculateEnemyPath(enemy);
                  // If pathing fails after reroute, skip move this tick
                  if (!enemy.path || enemy.path.length === 0) {
                      // console.log(`Enemy ${enemy.id} failed to reroute.`);
                      return;
                  }
                  // Use the *new* first step from the recalculated path
                  const newNextStep = enemy.path[0];
                  // Proceed with the move using the new path
                  enemy.prevX = enemy.x; enemy.prevY = enemy.y;
                  enemy.x = newNextStep.x; enemy.y = newNextStep.y;
                  enemy.path.shift(); // Consume the step from the *new* path
                  enemy.moveProgress = 0; enemy.lastMoveTime = now;

              } else {
                   // Path is clear, or the next step is the core (which is allowed)
                  enemy.prevX = enemy.x; enemy.prevY = enemy.y;
                  enemy.x = nextStep.x; enemy.y = nextStep.y;
                  enemy.path.shift(); // Consume the step
                  enemy.moveProgress = 0; // Reset progress for interpolation
                  enemy.lastMoveTime = now; // Update time for interpolation calculation
              }
         });
     },

     // Helper to recalculate path, centralizing the logic
     recalculateEnemyPath: function(enemy) {
         let startX = Math.floor(enemy.x); // Use current integer grid position
         let startY = Math.floor(enemy.y);

          // Clamp start position to be within grid boundaries if somehow outside
          startX = Math.max(0, Math.min(GAME.config.gridWidth - 1, startX));
          startY = Math.max(0, Math.min(GAME.config.gridHeight - 1, startY));

          // If current tile is occupied (and not core), try pathing from an adjacent free tile? (More complex)
          // For now, just attempt pathing from current clamped position.

         const targetX = GAME.config.coreCoords.x;
         const targetY = GAME.config.coreCoords.y;

         enemy.path = GAME.utils.pathfinding.findPath(startX, startY, targetX, targetY);

         // Reset move progress if path recalculates to avoid visual jumps if interpolation was partway
         enemy.moveProgress = 0;
         enemy.lastMoveTime = Date.now(); // Treat path recalc as a "move" start time
         enemy.prevX = startX; // Update previous position to current for interpolation start
         enemy.prevY = startY;
     },

    removeEnemy: function(enemyId, playSound = true) {
         const index = GAME.state.enemies.findIndex(e => e.id === enemyId);
         if (index > -1) {
              const enemy = GAME.state.enemies[index];
              // Destroy graphic using the graphics manager reference
              if (enemy.graphic) {
                  if (enemy.graphic.parent) { // Check if it's added to a container
                    // Use the container reference from graphics manager
                    GAME.graphics.gridContainer?.removeChild(enemy.graphic);
                  }
                  enemy.graphic.destroy({ children: true }); // Clean up Pixi object
              }
              // Remove enemy from state array
              GAME.state.enemies.splice(index, 1);

              if (playSound) { GAME.audio.playSound('enemy_death'); }
         } else {
             console.warn(`Attempted to remove non-existent enemy: ${enemyId}`);
         }
    },

    // --- Combat Actions ---

    // Called by turrets to damage enemies
    damageEnemy: function(enemyId, amount) {
         const enemy = this.getEnemyById(enemyId);
         // Only process if enemy exists and has HP > 0
         if (enemy && enemy.hp > 0) {
             enemy.hp -= amount;
             GAME.audio.playSound('hit'); // Generic hit sound

              // Flash effect on the graphic
              if (enemy.graphic && enemy.graphic.parent) {
                  // Get original tint from data, default to white if missing
                  const originalTint = GAME.data.enemies[enemy.typeId]?.spriteColor || 0xFFFFFF;
                  enemy.graphic.tint = 0xFFFFFF; // Flash white
                  setTimeout(() => {
                       // Check if graphic still exists before resetting tint
                       if(enemy.graphic) {
                           enemy.graphic.tint = originalTint;
                       }
                   }, 60); // Short flash duration
              }

             // Check for death
             if (enemy.hp <= 0) {
                 const enemyData = GAME.data.enemies[enemy.typeId];
                 GAME.ui.addLog(`${enemyData?.name || 'Enemy'} destroyed.`, 'log-success');

                 // Grant resources on kill
                 let scrapDrop = 0;
                 let biomassDrop = 0;
                 if (enemyData?.drops) {
                     scrapDrop = enemyData.drops.scrap || 0;
                     biomassDrop = enemyData.drops.biomass || 0;
                     // Add tech drop if applicable
                 } else { // Fallback basic drop
                     scrapDrop = 1 + Math.floor(Math.random() * 3);
                 }

                 if (scrapDrop > 0) {
                     GAME.state.resources.scrap += scrapDrop;
                     GAME.ui.addLog(`+${scrapDrop} Scrap.`, 'log-resource'); // Use specific class?
                 }
                 if (biomassDrop > 0) {
                      GAME.state.resources.biomass += biomassDrop;
                      GAME.ui.addLog(`+${biomassDrop} Biomass.`, 'log-resource');
                 }

                 this.removeEnemy(enemy.id, true); // Remove enemy from game, play death sound
                 GAME.ui.updateUI(); // Update UI to reflect resource changes
             }
         }
    },

    // Called by enemies when they reach the core
    damageCore: function(amount) {
          if (GAME.state.gameOver) return;

          const coreBuilding = GAME.buildings.getBuildingById(GAME.state.coreBuildingId); // Use building manager getter
          if (coreBuilding) {
              coreBuilding.hp -= amount;
              const coreData = GAME.data.buildings['CORE']; // Assuming 'CORE' is the ID
              const currentHp = Math.max(0, coreBuilding.hp); // Ensure HP doesn't display below 0
              const maxHp = coreData?.hp || '???';

              GAME.ui.addLog(`CORE INTEGRITY COMPROMISED! HP: ${currentHp}/${maxHp}`, 'log-danger');
              GAME.audio.playSound('core_hit');

              // Screen shake effect - target the main view or body
              const viewElement = document.getElementById('base-view') || document.body;
              viewElement.style.animation = 'shake 0.3s ease-in-out';
              setTimeout(() => { viewElement.style.animation = ''; }, 300);

              // Check for game over AFTER applying damage
              if (coreBuilding.hp <= 0) {
                  GAME.gameOver("CORE DESTROYED."); // Trigger game over from main
              } else {
                  GAME.ui.updateUI(); // Update UI including core HP display and repair button state
              }
          } else {
              console.error("Attempted to damage core, but core building not found!");
              GAME.ui.addLog("CRITICAL ERROR: Core reference lost!", "log-danger");
          }
     },

     // Called periodically by timer - Turrets find and shoot targets
     fireTurrets: function() {
         if (GAME.state.gameOver) return;

         GAME.state.buildings.forEach(building => {
             const buildingData = GAME.data.buildings[building.typeId];
             // Check if it's a turret and is active (isActive !== false, includes undefined/true)
             if (buildingData?.type === 'turret' && building.isActive !== false) {
                 let target = null;
                 // Use range squared for efficient distance check
                 let minDistanceSq = (buildingData.range * buildingData.range) + 0.01; // Add epsilon to handle exact range

                 // Find the closest valid enemy within range
                 GAME.state.enemies.forEach(enemy => {
                     if (enemy.hp > 0 && enemy.graphic) { // Check enemy is alive and has a graphic
                         // Calculate distance from building center to enemy center
                         const dx = (enemy.x + 0.5) - (building.x + 0.5);
                         const dy = (enemy.y + 0.5) - (building.y + 0.5);
                         const distanceSq = dx*dx + dy*dy;

                         if (distanceSq <= minDistanceSq) {
                             minDistanceSq = distanceSq;
                             target = enemy;
                         }
                     }
                 });

                 // If a target was found, fire!
                 if (target) {
                     this.damageEnemy(target.id, buildingData.damage); // Damage the target
                     GAME.audio.playSound('turret_fire');

                      // Draw laser effect using graphics manager
                      if (building.graphic?.parent && target.graphic?.parent && GAME.graphics.pixiApp) {
                          // Calculate pixel coordinates for laser start/end
                          const startX = building.graphic.x + (GAME.config.tileSize / 2);
                          const startY = building.graphic.y + (GAME.config.tileSize / 2);
                          // Use target's current *rendered* position for the laser endpoint
                          const endX = target.graphic.x;
                          const endY = target.graphic.y;
                          GAME.graphics.drawLaser(startX, startY, endX, endY, 0xFFFFFF, 80);
                      }
                 }
             } else if (buildingData?.type === 'turret' && building.isActive === false) {
                 // Optional: Visual/audio cue for inactive turret trying to fire? Fizzle?
             }
         });
    }
};