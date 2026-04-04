import { createModel } from "./model.js";
import { initLogic, onTick, spawnOrFindUmbrellaMan } from "./logic.js";
import { createWindow } from "./window.js";

var _model = createModel();
initLogic(_model);

var _win = null;

var STORAGE_KEY_COLOUR_MODE  = "colourMode";
var STORAGE_KEY_FIXED_COLOUR = "fixedColour";

function loadColourSettings() {
    try {
        var s = context.getParkStorage();
        var mode   = s.get(STORAGE_KEY_COLOUR_MODE);
        var colour = s.get(STORAGE_KEY_FIXED_COLOUR);
        if (mode   !== undefined) _model.colourMode.set(mode);
        if (colour !== undefined) _model.fixedColour.set(colour);
    } catch (e) { /* no park loaded yet */ }
}

function setupColourStorageSync() {
    _model.colourMode.subscribe(function(v) {
        try { context.getParkStorage().set(STORAGE_KEY_COLOUR_MODE, v); } catch (e) {}
    });
    _model.fixedColour.subscribe(function(v) {
        try { context.getParkStorage().set(STORAGE_KEY_FIXED_COLOUR, v); } catch (e) {}
    });
}

function getOrCreateWindow() {
    if (!_win) {
        _win = createWindow(_model);
    }
    return _win;
}

function tryInitUmbrellaMan() {
    spawnOrFindUmbrellaMan();
}

function main() {
    if (typeof ui !== "undefined") {
        ui.registerMenuItem("Umbrella Man", function() {
            getOrCreateWindow().open();
        });
    }

    // Tick every 500ms for umbrella man logic
    context.setInterval(function() {
        onTick();
    }, 500);

    // Load saved colour settings and keep them in sync with park storage
    loadColourSettings();
    setupColourStorageSync();

    // Try to spawn/find on load (may fail if no park is loaded yet)
    tryInitUmbrellaMan();

    // Re-init when a new/loaded park becomes available
    // (onTick will retry spawning automatically once the map is ready)
    context.subscribe("map.changed", function() {
        _model.umbrellaManId.set(null);
        _model.visitedCount.set(0);
        _model.statusText.set("Loading...");
        loadColourSettings(); // reload from the newly loaded park's storage
    });

    console.log("[umbrella-man] loaded");
}

registerPlugin({
    name: "umbrella-man",
    version: "1.0.0",
    licence: "GPL v3.0",
    authors: [],
    type: "intransient",
    targetApiVersion: 77,
    main: main
});
