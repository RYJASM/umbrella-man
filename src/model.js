import { store, compute } from "openrct2-flexui";

export function createModel() {
    var umbrellaManId = store(null);
    var colourMode = store(0); // 0=fixed, 1=random
    var fixedColour = store(5);
    var visitedCount = store(0);
    var totalStalls = store(0);
    var statusText = store("Loading...");
    var hasUmbrellaMan = compute(umbrellaManId, function(id) { return id !== null; });
    var noUmbrellaMan = compute(umbrellaManId, function(id) { return id === null; });
    var level = store(1);
    var currentXP = store(0);
    var totalXP = store(0);
    var raining = store(false);
    var moneyEarned = store(0);
    var umbrellasDistributed = store(0);
    var guestHappiness = store(0);
    var guestEnergy = store(0);
    var guestCash = store(0);
    var viewportTarget = store(null);
    var makeItRainReady = store(true);

    return {
        umbrellaManId: umbrellaManId,
        colourMode: colourMode,
        fixedColour: fixedColour,
        visitedCount: visitedCount,
        totalStalls: totalStalls,
        statusText: statusText,
        hasUmbrellaMan: hasUmbrellaMan,
        noUmbrellaMan: noUmbrellaMan,
        level: level,
        currentXP: currentXP,
        totalXP: totalXP,
        raining: raining,
        moneyEarned: moneyEarned,
        umbrellasDistributed: umbrellasDistributed,
        guestHappiness: guestHappiness,
        guestEnergy: guestEnergy,
        guestCash: guestCash,
        viewportTarget: viewportTarget,
        makeItRainReady: makeItRainReady,
    };
}
