var UMBRELLA_SHOP_ITEM = 4; // ShopItem::umbrella (ordinal 4 in OpenRCT2 enum)
// (waypoint advance is now done by tile-presence check, not a distance threshold)
var ARRIVE_THRESHOLD_SQ = 48 * 48;   // close enough to the stall entrance to "visit"
var MAX_BFS_NODES = 2000;             // safety cap on path search

var XP_UMBRELLA_GIVE    = 10;  // giving a brand-new umbrella
var XP_STALL_VISIT      = 250; // visiting a stall (25x umbrella)
var XP_UMBRELLA_RECOLOR = 5;   // recolouring an existing umbrella (half of give)
var MIN_ENERGY = 20;           // floor to prevent sitting behaviour

var _model = null;
var _visitedStalls = {};
var _visitHistory = [];   // ordered stall ids used for prevStall backtracking
var _currentTargetId = null;
var _currentPath = null;   // array of {x,y} world-coord waypoints from BFS
var _currentPathIdx = 0;
var _forcedTargetId = null; // optional manual target (used by prevStall)
var _respawnCounter = 0;
var _drainCounter = 0;     // ticks since last happiness drain
var _rainCooldownTicks = 0;  // ticks remaining before Make it Rain is available
var _rainDurationTicks = 0;  // ticks remaining before forced rain ends
var _ridingCarId = null;   // entity ID of the car umbrella man is currently riding
var _stuckAtEndCounter = 0; // ticks spent at end of BFS path without arriving

export function initLogic(model) {
    _model = model;
}

// ── Stall helpers ────────────────────────────────────────────────────────────

export function getUmbrellaStalls() {
    var stalls = [];
    try {
        var rides = map.rides;
        for (var i = 0; i < rides.length; i++) {
            var ride = rides[i];
            try {
                var obj = ride.object;
                if (obj && (obj.shopItem === UMBRELLA_SHOP_ITEM || obj.shopItemSecondary === UMBRELLA_SHOP_ITEM)) {
                    stalls.push(ride);
                }
            } catch (e) { /* skip rides with inaccessible objects */ }
        }
    } catch (e) { /* map not ready */ }
    return stalls;
}

function getStallTile(ride) {
    try {
        if (!ride.stations || ride.stations.length === 0) return null;
        var entrance = ride.stations[0].entrance;
        if (entrance && entrance.x >= 0) {
            return { tileX: Math.floor(entrance.x / 32), tileY: Math.floor(entrance.y / 32) };
        }
        var start = ride.stations[0].start;
        if (!start || start.x < 0) return null;
        return { tileX: Math.floor(start.x / 32), tileY: Math.floor(start.y / 32) };
    } catch (e) {
        return null;
    }
}

function getStallWorldPos(ride) {
    var tile = getStallTile(ride);
    if (!tile) return null;
    return { x: tile.tileX * 32 + 16, y: tile.tileY * 32 + 16 };
}

function getNearest(guest, stalls) {
    var nearest = null;
    var nearestDistSq = Infinity;
    for (var i = 0; i < stalls.length; i++) {
        var pos = getStallWorldPos(stalls[i]);
        if (!pos) continue;
        var dx = guest.x - pos.x;
        var dy = guest.y - pos.y;
        var dSq = dx * dx + dy * dy;
        if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearest = stalls[i];
        }
    }
    return nearest;
}

// ── BFS pathfinding ──────────────────────────────────────────────────────────

// Returns the footpath element on this tile whose baseZ is within 4 units of
// currentZ (one slope step).  Returns null if none qualifies.
function getFootpathElement(tileX, tileY, currentZ) {
    try {
        var tile = map.getTile(tileX, tileY);
        for (var i = 0; i < tile.elements.length; i++) {
            var el = tile.elements[i];
            if (el.type !== "footpath") continue;
            if (Math.abs(el.baseZ - currentZ) <= 4) return el;
        }
    } catch (e) {}
    return null;
}

// Returns the footpath element on this tile whose baseZ is closest to targetZ.
// Used to seed the starting level from the guest's actual world-z, where
// targetZ may not align exactly with any path's baseZ.
function getClosestFootpathElement(tileX, tileY, targetZ) {
    var best = null;
    var bestDiff = Infinity;
    try {
        var tile = map.getTile(tileX, tileY);
        for (var i = 0; i < tile.elements.length; i++) {
            var el = tile.elements[i];
            if (el.type !== "footpath") continue;
            if (targetZ === null) return el;
            var diff = Math.abs(el.baseZ - targetZ);
            if (diff < bestDiff) { bestDiff = diff; best = el; }
        }
    } catch (e) {}
    return best;
}

// BFS_DIRS and matching edge-bit for each direction.
// OpenRCT2 CoordsDirectionDelta: dir0={-1,0}, dir1={0,+1}, dir2={+1,0}, dir3={0,-1}
// So edge bits: {x:+1}=dir2=bit2, {x:-1}=dir0=bit0, {y:+1}=dir1=bit1, {y:-1}=dir3=bit3
var BFS_DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

// Returns array of world-coord {x,y} waypoints from current pos to target tile,
// or null if no path found within MAX_BFS_NODES.
function bfsPath(fromTileX, fromTileY, toTileX, toTileY, fromZ) {
    if (fromTileX === toTileX && fromTileY === toTileY) return [];

    // Use getClosestFootpathElement so guest.z (which may sit a few units above
    // path.baseZ) still latches onto the correct level even when it doesn't fall
    // within the strict 4-unit traversal tolerance.
    var startEl = getClosestFootpathElement(fromTileX, fromTileY, fromZ !== undefined ? fromZ : null);
    var startZ = startEl ? startEl.baseZ : null;
    var start = { x: fromTileX, y: fromTileY, z: startZ, prev: null };
    var queue = [start];
    var visited = {};
    visited[fromTileX + "_" + fromTileY + "_" + startZ] = true;
    var count = 0;

    while (queue.length > 0) {
        if (count++ > MAX_BFS_NODES) return null;
        var cur = queue.shift();

        if (cur.x === toTileX && cur.y === toTileY) {
            // Reconstruct — skip the starting tile, include the target
            var path = [];
            var node = cur;
            while (node.prev !== null) {
                path.unshift({ x: node.x * 32 + 16, y: node.y * 32 + 16 });
                node = node.prev;
            }
            return path;
        }

        for (var d = 0; d < BFS_DIRS.length; d++) {
            var nx = cur.x + BFS_DIRS[d].x;
            var ny = cur.y + BFS_DIRS[d].y;
            var isTarget = (nx === toTileX && ny === toTileY);

            var nEl = getFootpathElement(nx, ny, cur.z);

            if (isTarget) {
                if (nEl) {
                    // Target has a footpath at the right level — include it normally.
                } else if (getClosestFootpathElement(nx, ny, null) !== null) {
                    // Target has a footpath but at the wrong level — stall is on a
                    // different floor, don't route there.
                    continue;
                } else {
                    // Target has no footpath at all (stall body tile).  The guest
                    // can never physically enter it, so end the path HERE at the
                    // adjacent tile rather than including the unreachable stall tile.
                    // The arrival check (ARRIVE_THRESHOLD_SQ) will fire from here.
                    var path = [];
                    var node = cur;
                    while (node.prev !== null) {
                        path.unshift({ x: node.x * 32 + 16, y: node.y * 32 + 16 });
                        node = node.prev;
                    }
                    return path;
                }
            } else if (!nEl) {
                continue; // non-target with no compatible path: skip
            }

            var nz = nEl ? nEl.baseZ : cur.z;
            var key = nx + "_" + ny + "_" + nz;
            if (!visited[key]) {
                visited[key] = true;
                queue.push({ x: nx, y: ny, z: nz, prev: cur });
            }
        }
    }

    return null; // no path found
}

// ── Colour / umbrella ────────────────────────────────────────────────────────

function getActiveColour() {
    if (_model.colourMode.get() === 1) {
        return Math.floor(Math.random() * 32);
    }
    return _model.fixedColour.get();
}

function ensureUmbrella(guest) {
    if (!guest.hasItem({ type: "umbrella" })) {
        guest.giveItem({ type: "umbrella" });
    }
    guest.umbrellaColour = getActiveColour();
}

function markVisited(stallId) {
    if (stallId === null || stallId === undefined) return;
    _visitedStalls[stallId] = true;
    if (_visitHistory.length === 0 || _visitHistory[_visitHistory.length - 1] !== stallId) {
        _visitHistory.push(stallId);
    }
    _model.visitedCount.set(Object.keys(_visitedStalls).length);
}

function visitStall(stallId, guest, raining) {
    try {
        gainXP(XP_STALL_VISIT, raining);
        var ride = map.getRide(stallId);
        if (!ride) return;

        var colour = getActiveColour();

        // Set stall colour scheme index 0 — controls umbrella colour sold when randomShopColours is off
        var schemes = ride.colourSchemes;
        if (schemes && schemes.length > 0) {
            var updated = [];
            for (var i = 0; i < schemes.length; i++) {
                updated.push({
                    main: i === 0 ? colour : schemes[i].main,
                    additional: schemes[i].additional,
                    supports: schemes[i].supports
                });
            }
            ride.colourSchemes = updated;
        }

        guest.umbrellaColour = colour;

        // Sell 25 umbrellas at the stall
        var lvl = _model.level.get();
        var price = umbrellaPrice(lvl, raining);
        var priceUnits = price * 10;
        var totalEarned = 0;
        for (var s = 0; s < 25; s++) {
            park.cash += priceUnits;
            totalEarned += price;
            guest.happiness = Math.min(255, Math.floor(guest.happiness * 1.05) + 1);
        }
        _model.moneyEarned.set(_model.moneyEarned.get() + totalEarned);
        _model.umbrellasDistributed.set(_model.umbrellasDistributed.get() + 25);
        try {
            map.createEntity("money_effect", { x: guest.x, y: guest.y, z: guest.z }).value = priceUnits * 25;
        } catch (e) {}

        markVisited(stallId);
        _model.statusText.set("Visited: " + ride.name);
    } catch (e) {
        console.log("[umbrella-man] visitStall error: " + e);
    }
}

// ── XP / leveling ────────────────────────────────────────────────────────────

export function xpToNextLevel(level) {
    return Math.floor(50 * Math.pow(level, 1.5));
}

function happinessDrainInterval(level) {
    // Level 1: drain every 1 tick; Level 100: drain every 100 ticks (every 20s)
    return Math.max(1, level);
}

function gainXP(base, raining) {
    var amount = raining ? base * 2 : base;
    var lvl = _model.level.get();
    if (lvl >= 100) return;
    _model.totalXP.set(_model.totalXP.get() + amount);
    var cur = _model.currentXP.get() + amount;
    while (lvl < 100) {
        var needed = xpToNextLevel(lvl);
        if (cur >= needed) { cur -= needed; lvl++; }
        else { break; }
    }
    _model.level.set(lvl);
    _model.currentXP.set(lvl >= 100 ? 0 : cur);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function spawnOrFindUmbrellaMan() {
    try {
        var guests = map.getAllEntities("guest");
        for (var i = 0; i < guests.length; i++) {
            if (guests[i].name === "Umbrella Man") {
                var found = guests[i];
                if (found.x === -32768 || found.y === -32768) continue; // on a ride or left the map
                _model.umbrellaManId.set(found.id);
                ensureUmbrella(found);
                startWalking();
                return;
            }
        }
        var spawned = park.generateGuest();
        if (!spawned) return;
        var guestId = spawned.id;
        context.executeAction("guestsetname", { peep: guestId, name: "Umbrella Man" }, function() {});
        var guest = map.getEntity(guestId);
        if (guest && guest.type === "guest") {
            ensureUmbrella(guest);
        }
        _model.umbrellaManId.set(guestId);
        startWalking();
    } catch (e) {
        console.log("[umbrella-man] spawnOrFind error: " + e);
    }
}

export function startWalking() {
    _visitedStalls = {};
    _visitHistory = [];
    _currentTargetId = null;
    _currentPath = null;
    _currentPathIdx = 0;
    _forcedTargetId = null;
    _stuckAtEndCounter = 0;
    _drainCounter = 0;
    _model.visitedCount.set(0);
    _model.totalStalls.set(getUmbrellaStalls().length);
    _model.statusText.set("Walking...");
}

export function locateCurrentStall() {
    if (_currentTargetId === null) return;
    try {
        var ride = map.getRide(_currentTargetId);
        if (!ride) return;
        var pos = getStallWorldPos(ride);
        if (pos) ui.mainViewport.scrollTo({ x: pos.x, y: pos.y });
    } catch (e) {}
}

export function nextStall() {
    if (_currentTargetId !== null) {
        markVisited(_currentTargetId);
    }
    _currentTargetId = null;
    _currentPath = null;
    _currentPathIdx = 0;
    _forcedTargetId = null;
    _model.statusText.set("Skipping to next stall...");
}
export function prevStall() {
    if (_currentTargetId !== null) {
        delete _visitedStalls[_currentTargetId];
    }

    var previousId = null;
    if (_visitHistory.length > 0) {
        previousId = _visitHistory.pop();
        delete _visitedStalls[previousId];
    } else {
        var stalls = getUmbrellaStalls();
        if (stalls.length > 0) {
            previousId = stalls[stalls.length - 1].id;
            delete _visitedStalls[previousId];
        }
    }

    _model.visitedCount.set(Object.keys(_visitedStalls).length);
    _currentTargetId = null;
    _currentPath = null;
    _currentPathIdx = 0;
    _forcedTargetId = previousId;

    if (_forcedTargetId !== null) {
        _model.statusText.set("Going back to previous stall...");
    } else {
        _model.statusText.set("No umbrella stalls found");
    }
}
function isRaining() {
    try {
        var w = climate.current.weather;
        return w === "rain" || w === "heavyRain" || w === "thunder";
    } catch (e) { return false; }
}

function umbrellaPrice(level, raining) {
    // Base price scales with level: 1 at L1, up to 11 at L100 (in park currency units)
    var base = Math.floor(level / 10) + 1;
    return raining ? base * 2 : base;
}

function handOutUmbrellas(umbrellaMan, raining) {
    // Use umbrella man's current colour so guests always match him exactly
    var colour = umbrellaMan.umbrellaColour;
    var umX = umbrellaMan.x;
    var umY = umbrellaMan.y;
    var lvl = _model.level.get();

    // Check the 3x3 grid of tiles around umbrella man
    for (var tx = -1; tx <= 1; tx++) {
        for (var ty = -1; ty <= 1; ty++) {
            var tilePos = {
                x: (Math.floor(umX / 32) + tx) * 32,
                y: (Math.floor(umY / 32) + ty) * 32
            };
            try {
                var nearby = map.getAllEntitiesOnTile("guest", tilePos);
                for (var i = 0; i < nearby.length; i++) {
                    var g = nearby[i];
                    if (g.id === umbrellaMan.id) continue;
                    var hadUmbrella = g.hasItem({ type: "umbrella" });
                    if (!hadUmbrella) {
                        g.giveItem({ type: "umbrella" });
                        _model.umbrellasDistributed.set(_model.umbrellasDistributed.get() + 1);
                        gainXP(XP_UMBRELLA_GIVE, raining);
                        if (!raining) {
                            // 10% chance at level 1, scales down to 1% at level 100
                            var energyLossChance = Math.max(1, Math.ceil(10 * (101 - lvl) / 100));
                            if (Math.random() * 100 < energyLossChance) {
                                umbrellaMan.energy = Math.max(MIN_ENERGY, umbrellaMan.energy - 1);
                            }
                        }
                        // Chance to charge for the umbrella — 5% floor, scales to 100% at level 100
                        if (Math.random() * 100 < Math.max(15, lvl)) {
                            var price = umbrellaPrice(lvl, raining);
                            // money64 is stored as tenths of a dollar ($1 = 10 units)
                            var priceUnits = price * 10;
                            if (g.cash >= priceUnits) {
                                g.cash -= priceUnits;
                                park.cash += priceUnits;
                                _model.moneyEarned.set(_model.moneyEarned.get() + price);
                                umbrellaMan.happiness = Math.min(255, Math.floor(umbrellaMan.happiness * 1.05) + 1);
                                try {
                                    var effect = map.createEntity("money_effect", { x: g.x, y: g.y, z: g.z });
                                    effect.value = priceUnits;
                                } catch (e) {}
                            }
                        }
                    } else if (g.umbrellaColour !== colour) {
                        gainXP(XP_UMBRELLA_RECOLOR, raining);
                    }
                    // Always sync colour — existing umbrella holders update too
                    g.umbrellaColour = colour;
                }
            } catch (e) { /* skip inaccessible tile */ }
        }
    }
}

export function makeItRain() {
    var lvl = _model ? _model.level.get() : 1;
    // Cooldown: 10 min at level 1, 1 min at level 100 (300 ticks = 1 min at 200ms/tick)
    var cooldownMinutes = Math.max(1, Math.ceil(10 * (101 - lvl) / 100));
    _rainCooldownTicks = cooldownMinutes * 300;
    // Duration: 1 min at level 1, 10 min at level 100
    var durationMinutes = Math.max(1, Math.ceil(10 * lvl / 100));
    _rainDurationTicks = durationMinutes * 300;
    _model.makeItRainReady.set(false);
    // forceWeather only takes param1 (WeatherType); Rain = 3. param2 must be 0.
    context.executeAction("cheatset", { type: 35, param1: 3, param2: 0 }, function() {});
    // Freeze weather so it stays until we manually unfreeze it
    context.executeAction("cheatset", { type: 36, param1: 1, param2: 0 }, function() {});
}

export function onTick() {
    if (!_model) return;

    // Cooldown countdown for Make it Rain
    if (_rainCooldownTicks > 0) {
        _rainCooldownTicks--;
        if (_rainCooldownTicks === 0) {
            _model.makeItRainReady.set(true);
        }
    }

    // Duration countdown — unfreeze weather when forced rain expires
    if (_rainDurationTicks > 0) {
        _rainDurationTicks--;
        if (_rainDurationTicks === 0) {
            context.executeAction("cheatset", { type: 36, param1: 0, param2: 0 }, function() {});
        }
    }

    var id = _model.umbrellaManId.get();
    if (id === null) {
        _respawnCounter++;
        if (_respawnCounter >= 15) {
            _respawnCounter = 0;
            spawnOrFindUmbrellaMan();
        }
        return;
    }
    _respawnCounter = 0;

    var entity = null;
    try { entity = map.getEntity(id); } catch (e) {}

    if (!entity || entity.type !== "guest") {
        _model.umbrellaManId.set(null);
        _model.isRunning.set(false);
        _model.statusText.set("Umbrella Man not found");
        return;
    }

    var guest = entity;

    _model.guestHappiness.set(guest.happiness);
    _model.guestEnergy.set(guest.energy);
    _model.guestCash.set(guest.cash);

    // x=-32768 (LOCATION_NULL) means on a ride OR left the park
    if (guest.x === -32768 || guest.y === -32768) {
        if (guest.isInPark) {
            // Restore stats while riding
            guest.happiness = 255;
            guest.happinessTarget = 255;
            guest.energy = 128;
            guest.energyTarget = 255;
            _drainCounter = 0;
            _model.guestHappiness.set(255);
            _model.guestEnergy.set(128);
            _model.statusText.set("Umbrella Man is on a ride...");
            // Find the car he's in and point the viewport at it.
            // Cache _ridingCarId so the viewport doesn't jump on ticks before the car registers him.
            try {
                var cars = map.getAllEntities("car");
                for (var ci = 0; ci < cars.length; ci++) {
                    var carGuests = cars[ci].guests;
                    for (var gi = 0; gi < carGuests.length; gi++) {
                        if (carGuests[gi] === id) {
                            _ridingCarId = cars[ci].id;
                            break;
                        }
                    }
                    if (_ridingCarId !== null) break;
                }
            } catch (e) {}
            if (_ridingCarId !== null) {
                _model.viewportTarget.set(_ridingCarId);
            }
        } else {
            _ridingCarId = null;
            _model.umbrellaManId.set(null);
            _model.viewportTarget.set(null);
            _model.statusText.set("Umbrella Man left the park — respawning...");
        }
        return;
    }

    // On-map: viewport follows the guest directly
    _ridingCarId = null;
    _model.viewportTarget.set(id);

    // Always enforce umbrella
    if (!guest.hasItem({ type: "umbrella" })) {
        guest.giveItem({ type: "umbrella" });
        guest.umbrellaColour = getActiveColour();
    }
    // In fixed mode, keep his colour in sync with the picker immediately
    if (_model.colourMode.get() === 0) {
        guest.umbrellaColour = _model.fixedColour.get();
    }

    // Shirt matches umbrella
    guest.tshirtColour = guest.umbrellaColour;

    // Big bright yellow hat so he stands out in the crowd
    if (!guest.hasItem({ type: "hat" })) {
        guest.giveItem({ type: "hat" });
    }
    guest.hatColour = 17; // brightYellow

    // Hand out umbrellas to nearby guests
    var raining = isRaining();
    _model.raining.set(raining);
    handOutUmbrellas(guest, raining);

    // Rain-responsive stats
    if (raining) {
        guest.happiness = 255;
        guest.happinessTarget = 255;
        guest.energy = 255;
        guest.energyTarget = 255;
        _drainCounter = 0;
    } else {
        // Level-based happiness drain: slower at higher levels
        _drainCounter++;
        if (_drainCounter >= happinessDrainInterval(_model.level.get())) {
            _drainCounter = 0;
            if (guest.happiness > 0) guest.happiness = guest.happiness - 1;
            if (guest.happinessTarget > 0) guest.happinessTarget = guest.happinessTarget - 1;
        }
        // Energy only drains via umbrella handouts (handled in handOutUmbrellas)
        guest.energyTarget = Math.max(MIN_ENERGY, guest.energy);
    }
    // Always keep these managed
    guest.hunger = 255;
    guest.thirst = 255;
    guest.toilet = 0;
    guest.nausea = 0;
    guest.nauseaTarget = 0;
    guest.lostCountdown = 255;

    // Clear flags that cause the peep AI to break out of the walking state
    // (seeking food/toilet/bench, wandering when lost, leaving park, etc.)
    guest.setFlag("hunger", false);
    guest.setFlag("toilet", false);
    guest.setFlag("nausea", false);
    guest.setFlag("crowded", false);
    guest.setFlag("lost", false);
    guest.setFlag("leavingPark", false);

    // Keep total stall count current so new stalls show up in the UI immediately
    _model.totalStalls.set(getUmbrellaStalls().length);

    // ── Follow BFS path ──────────────────────────────────────────────────────

    if (_currentTargetId !== null && _currentPath !== null) {
        if (_currentPathIdx >= _currentPath.length) {
            // Reached end of path — check arrival at stall
            var ride = map.getRide(_currentTargetId);
            if (ride) {
                var stallPos = getStallWorldPos(ride);
                if (stallPos) {
                    var adx = guest.x - stallPos.x;
                    var ady = guest.y - stallPos.y;
                    if (adx * adx + ady * ady < ARRIVE_THRESHOLD_SQ) {
                        _stuckAtEndCounter = 0;
                        visitStall(_currentTargetId, guest, raining);
                        _currentTargetId = null;
                        _currentPath = null;
                        _currentPathIdx = 0;
                        return;
                    }
                }
            }
            // Not close enough yet — nudge to last waypoint, but give up after 50 ticks
            _stuckAtEndCounter++;
            if (_stuckAtEndCounter >= 50) {
                _stuckAtEndCounter = 0;
                _currentPath = null;
                _currentPathIdx = 0;
                // Leave _currentTargetId set so the next tick re-paths to the same stall
                return;
            }
            if (_currentPath.length > 0) {
                guest.destination = _currentPath[_currentPath.length - 1];
            }
            return;
        }

        // Walk toward current waypoint.
        // Advance to the next waypoint only once the guest has entered the
        // waypoint's tile — this prevents premature direction changes at corners
        // that caused back-and-forth wiggling.
        var wp = _currentPath[_currentPathIdx];
        var wpTileX = Math.floor(wp.x / 32);
        var wpTileY = Math.floor(wp.y / 32);
        if (Math.floor(guest.x / 32) === wpTileX && Math.floor(guest.y / 32) === wpTileY) {
            _currentPathIdx++;
            if (_currentPathIdx < _currentPath.length) {
                guest.destination = _currentPath[_currentPathIdx];
            }
        } else {
            guest.destination = wp;
        }
        return;
    }

    // ── Pick next stall ──────────────────────────────────────────────────────

    var stalls = getUmbrellaStalls();
    var unvisited = [];
    for (var i = 0; i < stalls.length; i++) {
        if (!_visitedStalls[stalls[i].id]) unvisited.push(stalls[i]);
    }

    if (unvisited.length === 0) {
        if (stalls.length > 0) {
            _visitedStalls = {};
            _visitHistory = [];
            _model.visitedCount.set(0);
            unvisited = stalls.slice();
            _model.statusText.set("Restarting route...");
        } else {
            _model.statusText.set("No umbrella stalls found");
            return;
        }
    }

    var target = null;
    if (_forcedTargetId !== null) {
        for (var u = 0; u < unvisited.length; u++) {
            if (unvisited[u].id === _forcedTargetId) {
                target = unvisited[u];
                break;
            }
        }
        _forcedTargetId = null;
    }

    if (!target) {
        target = getNearest(guest, unvisited);
    }
    if (!target) return;

    var targetTile = getStallTile(target);
    if (!targetTile) return;

    var fromTileX = Math.floor(guest.x / 32);
    var fromTileY = Math.floor(guest.y / 32);

    var path = bfsPath(fromTileX, fromTileY, targetTile.tileX, targetTile.tileY, guest.z);

    _currentTargetId = target.id;
    _currentPath = path || []; // null = no path found, walk empty and re-pick next tick
    _currentPathIdx = 0;
    _stuckAtEndCounter = 0;
    _model.statusText.set("Walking to: " + target.name);
}
