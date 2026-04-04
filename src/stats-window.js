import {
    window as flexWindow, label, groupbox, compute
} from "openrct2-flexui";
import { xpToNextLevel } from "./logic.js";

export function createStatsWindow(model) {
    return flexWindow({
        title: "Umbrella Man \u2014 Stats",
        width: 220,
        height: 270,
        content: [
            groupbox({
                text: "Level",
                content: [
                    label({
                        text: compute(model.level, function(lvl) {
                            return lvl >= 100 ? "Level: 100 / 100  MAX" : "Level: " + lvl + " / 100";
                        })
                    }),
                    label({
                        text: compute(model.currentXP, model.level, function(xp, lvl) {
                            if (lvl >= 100) return "XP: MAX";
                            return "XP: " + xp + " / " + xpToNextLevel(lvl);
                        })
                    }),
                    label({
                        text: compute(model.totalXP, function(txp) {
                            return "Total XP: " + txp;
                        })
                    })
                ]
            }),
            groupbox({
                text: "Bonuses",
                content: [
                    label({
                        text: compute(model.raining, function(r) {
                            return "Rain bonus: " + (r ? "ACTIVE (2x XP)" : "Inactive");
                        })
                    }),
                    label({
                        text: compute(model.level, function(lvl) {
                            var seconds = (Math.max(1, lvl) * 0.2).toFixed(1);
                            return "Happiness drain: every " + seconds + "s";
                        })
                    }),
                    label({
                        text: compute(model.level, function(lvl) {
                            var chance = Math.max(1, Math.ceil(10 * (101 - lvl) / 100));
                            return "Energy cost: " + chance + "% per umbrella";
                        })
                    })
                ]
            }),
            groupbox({
                text: "Economy",
                content: [
                    label({
                        text: compute(model.level, function(lvl) {
                            return "Sale chance: " + Math.max(15, lvl) + "%";
                        })
                    }),
                    label({
                        text: compute(model.level, model.raining, function(lvl, r) {
                            var base = Math.floor(lvl / 10) + 1;
                            var price = r ? base * 2 : base;
                            return "Price: $" + price + (r ? " (2x rain)" : "");
                        })
                    }),
                    label({
                        text: compute(model.umbrellasDistributed, function(u) {
                            return "Umbrellas given: " + u;
                        })
                    }),
                    label({
                        text: compute(model.moneyEarned, function(m) {
                            return "Total earned: $" + m;
                        })
                    })
                ]
            })
        ]
    });
}
