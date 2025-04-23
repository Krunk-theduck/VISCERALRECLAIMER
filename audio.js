// --- audio.js ---
// Manages Howler.js setup and playback

GAME.audio = {
    sounds: {}, // Holds the initialized Howl objects

    setupAudioUnlocker: function() {
        const unlockAudio = () => {
            if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state !== 'running') {
                Howler.ctx.resume().then(() => {
                    GAME.state.audioUnlocked = true;
                    console.log("AudioContext resumed.");
                    GAME.ui.addLog("Audio systems nominal.", "log-info");
                    // You could start ambient sound here if you add one
                }).catch(e => console.error("AudioContext resume failed:", e));
            } else if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'running'){
                GAME.state.audioUnlocked = true; // Already running
            }
            // Remove listeners after first interaction
            document.removeEventListener('click', unlockAudio, true);
            document.removeEventListener('keydown', unlockAudio, true);
        };
        document.addEventListener('click', unlockAudio, true);
        document.addEventListener('keydown', unlockAudio, true);
        // Defer log add until UI manager is initialized
        // GAME.ui.addLog("Click or press key to enable audio.", "log-warning");
        // Let main.js call this after UI is ready
    },

    setupAudio: function() {
         if (typeof Howl === 'undefined') {
             console.error("Howler.js library not found. Audio disabled.");
             GAME.ui.addLog("Audio ERR: Howler.js missing.", "log-danger");
             return;
         }
         if (!GAME.soundData) {
             console.error("Sound data not loaded. Audio disabled.");
             GAME.ui.addLog("Audio ERR: Sound data missing.", "log-danger");
             return;
         }
         this.sounds = {};
         try {
             for (const soundId in GAME.soundData) {
                 if (GAME.soundData.hasOwnProperty(soundId)) {
                     const soundInfo = GAME.soundData[soundId];
                     if (soundInfo.src) {
                        this.sounds[soundId] = new Howl({
                            src: [soundInfo.src],
                            volume: soundInfo.volume !== undefined ? soundInfo.volume : 0.5,
                            loop: soundInfo.loop || false,
                            pool: soundInfo.pool || 5 // Increased pool size slightly
                        });
                     } else {
                         console.warn(`Sound data for '${soundId}' is missing 'src'.`);
                     }
                 }
             }
             console.log("Audio assets configured. Waiting for interaction to enable.");
             // Add log message after UI setup in main.js
         } catch (error) {
             console.error("Error initializing Howler sounds:", error);
             GAME.ui.addLog("Audio system critical failure.", "log-danger");
         }
    },

    // --- Audio Playback Interface ---
    playSound: function(soundId, loop = false) {
         // Allow basic UI sounds even before explicit unlock
         const allowBeforeUnlock = ['click', 'error', 'build', 'wave_announce', 'core_hit'];
         if (!GAME.state.audioUnlocked && !allowBeforeUnlock.includes(soundId)) {
             // console.log(`Audio locked, prevented playing: ${soundId}`);
             return;
         }

         if (this.sounds && this.sounds[soundId]) {
            try {
                this.sounds[soundId].loop(loop);
                this.sounds[soundId].play();
            } catch (error) {
                 console.error(`Error playing sound '${soundId}':`, error);
            }
         } else {
             console.warn(`Attempted to play unknown sound: ${soundId}`);
         }
     },

     stopSound: function(soundId) {
         if (this.sounds && this.sounds[soundId]) {
            try {
                 this.sounds[soundId].stop();
            } catch (error) {
                 console.error(`Error stopping sound '${soundId}':`, error);
            }
         }
     },

     stopAllSounds: function() {
         if (typeof Howler !== 'undefined') {
             Howler.stop();
         }
     }
};