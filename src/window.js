import {
    window as flexWindow, viewport, button, dropdown, label,
    colourPicker, groupbox, horizontal, vertical, compute, twoway
} from "openrct2-flexui";
import { spawnOrFindUmbrellaMan, nextStall, prevStall, locateCurrentStall, makeItRain } from "./logic.js";
import { createStatsWindow } from "./stats-window.js";

var COLOUR_MODE_LABELS = ["Fixed", "Random"];
var _statsWin = null;

export function createWindow(model) {
    return flexWindow({
        title: "Umbrella Man",
        width: 220,
        height: 362,
        content: [
            groupbox({
                text: "Umbrella Man",
                content: [
                    horizontal([
                        viewport({
                            target: model.viewportTarget,
                            height: "136px"
                        }),
                        vertical({
                            width: "24px",
                            content: [
                                button({
                                    image: "locate",
                                    width: "24px",
                                    height: "24px",
                                    tooltip: "Locate Umbrella Man",
                                    disabled: model.noUmbrellaMan,
                                    onClick: function () {
                                        var id = model.umbrellaManId.get();
                                        if (id === null) return;
                                        var entity = map.getEntity(id);
                                        if (!entity) return;
                                        // If on a ride, scroll to the car he's in
                                        if (entity.x === -32768 || entity.y === -32768) {
                                            try {
                                                var cars = map.getAllEntities("car");
                                                for (var ci = 0; ci < cars.length; ci++) {
                                                    var guests = cars[ci].guests;
                                                    for (var gi = 0; gi < guests.length; gi++) {
                                                        if (guests[gi] === id) {
                                                            ui.mainViewport.scrollTo({ x: cars[ci].x, y: cars[ci].y });
                                                            return;
                                                        }
                                                    }
                                                }
                                            } catch (e) {}
                                            return;
                                        }
                                        ui.mainViewport.scrollTo({ x: entity.x, y: entity.y });
                                    }
                                }),
                                button({
                                    image: 29448,
                                    width: "24px",
                                    height: "24px",
                                    tooltip: "Respawn Umbrella Man",
                                    onClick: function () {
                                        spawnOrFindUmbrellaMan();
                                    }
                                }),
                                button({
                                    image: 5187,
                                    width: "24px",
                                    height: "24px",
                                    tooltip: "Locate target stall",
                                    onClick: function () {
                                        locateCurrentStall();
                                    }
                                }),

                                button({
                                    image: 29443,
                                    width: "24px",
                                    height: "24px",
                                    tooltip: "Next stall",
                                    onClick: function () {
                                        nextStall();
                                    }
                                }),
                                button({
                                    image: 29444,
                                    width: "24px",
                                    height: "24px",
                                    tooltip: "Previous stall",
                                    onClick: function () {
                                        prevStall();                                        
                                    }
                                }),
                            ]
                        })
                    ]),
                    label({
                        text: model.statusText,
                        alignment: "centred"
                    })
                ]
            }),
            groupbox({
                text: "Status",
                content: [
                    horizontal([
                        vertical([
                            label({
                                text: compute(model.guestHappiness, function (h) {
                                    return "Happiness: " + Math.round(h / 255 * 100) + "%";
                                })
                            }),
                            label({
                                text: compute(model.guestEnergy, function (e) {
                                    return "Energy:    " + Math.round(e / 128 * 100) + "%";
                                })
                            }),
                            label({
                                text: compute(model.guestCash, function (c) {
                                    return "Cash:      $" + c;
                                })
                            })
                        ]),

                        button({
                            image: 23193,
                            width: "24px",
                            height: "24px",
                            tooltip: "Make it rain",
                            disabled: compute(model.makeItRainReady, function (r) { return !r; }),
                            onClick: function () { makeItRain(); }
                        }),
                    ]),
                    horizontal([

                        button({
                            text: "View Stats",
                            width: "1w",
                            height: "24px",
                            onClick: function () {
                                if (!_statsWin) {
                                    _statsWin = createStatsWindow(model);
                                }
                                _statsWin.open();
                            }
                        })
                    ])
                ]
            }),
            groupbox({
                text: "Settings",
                content: [

                    horizontal([
                        label({ text: "Colour:", width: "50px" }),
                        dropdown({
                            width: "80px",
                            items: COLOUR_MODE_LABELS,
                            selectedIndex: twoway(model.colourMode)
                        }),
                        colourPicker({
                            colour: twoway(model.fixedColour),
                            visibility: compute(model.colourMode, function (m) {
                                return m === 0 ? "visible" : "none";
                            })
                        })
                    ]),
                    label({
                        text: compute(model.visitedCount, model.totalStalls, function (v, t) {
                            return "Visited: " + v + " / " + t + " stalls";
                        })
                    })
                ]
            })
        ]
    });
}
