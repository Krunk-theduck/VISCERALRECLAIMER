// --- utils.js ---
// Generic helper functions and algorithms

GAME.utils = {
    // --- Polyfill for requestAnimationFrame ---
    // Keep this at the top of your concatenated file or in index.html before other scripts
    // window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
    //     window.setTimeout(callback, 1000 / 60);
    // };
    // Moved polyfill recommendation to index.html

    debounce: function(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    },

    isValidTile: function(x, y) {
        return x >= 0 && x < GAME.config.gridWidth && y >= 0 && y < GAME.config.gridHeight;
    },

    isTileOccupied: function(x, y) {
        if (!this.isValidTile(x, y)) return true; // Outside grid is considered occupied
        return GAME.state.grid[y]?.[x] !== null;
    },

    canAfford: function(cost) {
        if (!cost || Object.keys(cost).length === 0) return true;
        return Object.entries(cost).every(([res, amount]) => GAME.state.resources[res] >= amount);
    },

    spendResources: function(cost) {
        if (!cost) return;
        Object.entries(cost).forEach(([res, amount]) => {
            if (GAME.state.resources.hasOwnProperty(res)) {
                GAME.state.resources[res] -= amount;
            } else {
                console.warn(`Attempted to spend non-existent resource: ${res}`);
            }
        });
        // UI update should be triggered by the caller function if needed
    },

    getRandomRaidOutcome: function() { // Gets the *end of raid* outcome
         // Ensure data is loaded before calling this
         if (!GAME.data || !GAME.data.raidOutcomes) {
             console.error("Cannot get raid outcome: GAME.data.raidOutcomes not loaded.");
             // Return a default 'nothing' structure to prevent crashes
             return { type: 'nothing', message: 'System error retrieving outcome.', chance: 1.0, items: [] };
         }
         let rand = Math.random(); let cumulativeChance = 0;
         for (const outcome of GAME.data.raidOutcomes) { // Use raidOutcomes array
            cumulativeChance += outcome.chance;
            if (rand < cumulativeChance) return {...outcome}; // Return a copy
         }
         // Fallback copy if chances don't sum to 1 or floating point issue
         const fallback = GAME.data.raidOutcomes.find(o => o.type === 'nothing');
         return fallback ? {...fallback} : {...GAME.data.raidOutcomes[0]};
    },

    // --- Pathfinding (Simple BFS) ---
    pathfinding: {
        // Main function to find the path array
        findPath: function(startX, startY, endX, endY) {
            const gridWidth = GAME.config.gridWidth;
            const gridHeight = GAME.config.gridHeight;
            const coreCoords = GAME.config.coreCoords;
            const startNode = { x: Math.floor(startX), y: Math.floor(startY) };

            // Use GAME.utils for checks
            if (!GAME.utils.isValidTile(startNode.x, startNode.y) || (GAME.utils.isTileOccupied(startNode.x, startNode.y) && !(startNode.x === coreCoords.x && startNode.y === coreCoords.y))) return null;
            if (!GAME.utils.isValidTile(endX, endY) || (GAME.utils.isTileOccupied(endX, endY) && !(endX === coreCoords.x && endY === coreCoords.y))) return null;

            const queue = [];
            const visited = new Set();
            const parent = new Map();
            const startKey = `${startNode.x},${startNode.y}`;

            queue.push(startNode);
            visited.add(startKey);
            let safetyBreak = gridWidth * gridHeight * 2; // Prevent infinite loops

            while (queue.length > 0 && safetyBreak-- > 0) {
                const current = queue.shift();

                // Found the target
                if (current.x === endX && current.y === endY) {
                    const path = [];
                    let node = current;
                    let pathSafety = gridWidth * gridHeight;
                    while (node && pathSafety-- > 0) {
                        path.push(node);
                        node = parent.get(`${node.x},${node.y}`);
                    }
                    if (pathSafety <= 0) console.error("Path reconstruction loop!");
                    return path.reverse().slice(1); // Return path excluding start node
                }

                // Explore neighbors (Prefer horizontal?) - Check N, E, S, W
                const neighbors = [
                     { x: current.x, y: current.y - 1 }, // N
                     { x: current.x + 1, y: current.y }, // E
                     { x: current.x, y: current.y + 1 }, // S
                     { x: current.x - 1, y: current.y }  // W
                    ];

                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    // Check bounds, visited, and occupied (allow core as destination)
                    // Use GAME.utils for checks
                    if (!GAME.utils.isValidTile(neighbor.x, neighbor.y) ||
                        visited.has(neighborKey) ||
                        (GAME.utils.isTileOccupied(neighbor.x, neighbor.y) && !(neighbor.x === coreCoords.x && neighbor.y === coreCoords.y))) {
                        continue;
                    }
                    visited.add(neighborKey);
                    parent.set(neighborKey, current);
                    queue.push(neighbor);
                }
            }
            if (safetyBreak <= 0) console.error("Pathfinding BFS loop!");
            return null; // No path found
        },

         // Helper to quickly check reachability (used in build check)
         isTargetReachable: function(startX, startY, endX, endY) {
            // Optimization: if start and end are the same, they are reachable if valid
             if (startX === endX && startY === endY && GAME.utils.isValidTile(startX, startY)) return true;
             // Uses the findPath defined just above
             return this.findPath(startX, startY, endX, endY) !== null;
        }
    }
};