# Umbrella Man

`umbrella-man` is an OpenRCT2 plugin that turns one guest into a roaming umbrella salesman. He wanders the park, walks from umbrella stall to umbrella stall, recolours umbrellas as he goes, and hands out fresh umbrellas to nearby guests.

It is part mascot, part money printer, and part strange little simulation toy. A lot of it is still rough around the edges, but it is already fun to watch in motion.

## The Story So Far

Umbrella Man wanders the park going from stall to stall, updating umbrella colours and passing out umbrellas to peeps as he passes them. Guests he reaches can pay him for an umbrella, and both the chance of a sale and the amount earned scale with his level.

You can level him up to increase income and soften the downsides of constantly handing out umbrellas. Rain is his power spike: while it is raining he gets bonus XP, double cash, no umbrella-handout penalties, and his happiness and energy are kept maxed out. Once his ultimate is ready, you can press a button to make it rain on command.

Every time he visits an umbrella stall, he effectively sells 25 umbrellas at once, restores momentum, and keeps the route moving.

## What He Does

- Spawns or reuses a guest named `Umbrella Man`.
- Keeps an umbrella equipped at all times.
- Wears a bright yellow hat so he stands out in the crowd.
- Matches his shirt colour to his umbrella colour.
- Walks park paths toward umbrella stalls using tile-based pathfinding.
- Tracks which umbrella stalls have been visited and loops the route again when all stalls are done.
- Recolours nearby guests' umbrellas to match his current colour.
- Gives umbrellas to guests in the nearby 3x3 tile area.
- Can earn money directly from nearby guests when they accept an umbrella.
- Triggers floating money effects, so if park cash display is on you can see payments happen in-game.

## Progression

Umbrella Man has a full leveling system with a cap of level 100.

- Giving a brand-new umbrella grants XP.
- Recolouring an existing umbrella grants a smaller amount of XP.
- Visiting an umbrella stall grants a large chunk of XP.
- Rain doubles XP gain.

As he levels up:

- Sale chance improves.
- Umbrella price increases.
- Happiness drains more slowly.
- Energy-loss chance from handing out umbrellas drops.
- `Make it Rain` comes off cooldown faster.
- `Make it Rain` lasts longer.

## Rain Mode

Rain is his strongest state.

- Sales are worth double.
- XP gain is doubled.
- Happiness is forced to max.
- Energy is forced to max.
- The normal energy penalty for handing out umbrellas is disabled.

The plugin also includes an ultimate ability:

- `Make it Rain` forces rain through the cheat action.
- The weather is frozen for the duration so the rain sticks.
- Cooldown scales from long at low level to short at high level.
- Duration scales from short at low level to long at high level.

## Stall Visits

Umbrella stalls are the backbone of the route.

- Umbrella Man searches for rides that sell umbrellas.
- He chooses unvisited stalls and walks to them.
- When all known stalls have been visited, he resets the route and starts again.
- On arrival, he updates the stall colour scheme to match his active umbrella colour.
- Each stall visit counts as selling 25 umbrellas.
- Each stall visit adds money, XP, umbrellas distributed, and a happiness bump.

## Controls And UI

The plugin registers a menu item named `Umbrella Man`.

The main window includes:

- A live viewport that follows Umbrella Man.
- A locate button to center the main viewport on him.
- A respawn button.
- A button to locate the current target stall.
- `Next stall` and `Previous stall` route controls.
- A `Make it Rain` button when the ultimate is ready.
- A status readout.
- Guest stat readouts for happiness, energy, and cash.
- A `View Stats` window for level, XP, bonuses, and economy stats.

The stats window shows:

- Current level and XP to next level.
- Total XP earned.
- Rain bonus state.
- Happiness drain rate.
- Energy cost chance per umbrella.
- Sale chance.
- Current umbrella price.
- Total umbrellas given.
- Total money earned.

## Colour Settings

Umbrella colour can be controlled in two ways:

- `Fixed` mode uses a chosen colour from the picker.
- `Random` mode picks colours dynamically.

The selected colour mode and fixed colour are saved in park storage, so they persist with the park.

## Built-In Safeguards

The plugin actively manages Umbrella Man so he keeps doing his job:

- It respawns or reacquires him if needed.
- It restores core needs like hunger, thirst, nausea, and lost state so peep AI does not constantly interrupt the route.
- It handles the case where he is riding a ride and keeps the viewport pointed at the ride car when possible.
- It retries pathing if he gets stuck near a stall.

## Current State

This is still very much a toy-in-progress.

- Lots of stuff is broken at the moment.
- Some behaviors are intentionally over-the-top because the fun part is watching him run around and print money.
- If you enable park cash feedback, you can see guests visibly spending money when they pay him.

## Development

Project details visible in the codebase:

- Plugin name: `umbrella-man`
- Version: `1.0.0`
- Target API version: `77`
- Licence: `GPL v3.0`
- Built with `esbuild`
- UI built with `openrct2-flexui`

Available npm scripts:

- `npm run build`
- `npm run build-release`

The build script:

- Bundles from [src/umbrella-man.flexui.js](/c:/Users/rjsmi/.vscode/umbrella-man/src/umbrella-man.flexui.js)
- Writes timestamped history builds into `builds/`
- Copies the latest plugin to `Documents/OpenRCT2/plugin/umbrella-man.js`

## Repository Notes

This repository ignores local and generated files such as:

- `node_modules/`
- `builds/`
- `.vscode/`
- `.git_ignore/`
