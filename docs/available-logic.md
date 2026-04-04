# Available Plugin Logic (OpenRCT2)

## Umbrella Stalls

### Price

- Each stall is a `Ride` object with `classification === "stall"`
- Price is readable and writable via `ride.price[0]` (integer, e.g. `500` = 5.00)
- Price is clamped by the engine to 0.00–20.00
- Can also be set via game action: `context.executeAction("ridesetprice", { ride: stallId, price: 500, isPrimaryPrice: true })`

### Colour

**Stall structure colour** — writable via plugin:
```js
stall.colourSchemes[0] = { main: 12, additional: 5, supports: 3 };
```

**Umbrella item colour** — how it works in-game:
- The stall has a "Random Colour" checkbox in its Colour tab
- If **random is off**: guests receive an umbrella coloured to `ride.trackColours[0].main` (the stall's main colour scheme)
- If **random is on**: each guest gets a random colour from the full palette (0–31)
- Source: `Guest.cpp`, `ShopItem::umbrella` case

**What the plugin API exposes:**
- `stall.colourSchemes[0].main` — controls the fixed umbrella colour when random is off (writable)
- `guest.umbrellaColour` — the colour of the umbrella a guest is carrying (writable, set after purchase)
- The `randomShopColours` flag is **not exposed** in the plugin API

**Plugin workaround for full colour control:**
- Set `stall.colourSchemes[0].main` to control the default sold colour
- Or hook into guest purchases and set `guest.umbrellaColour` directly to override both modes

### Relevant Source Files

| File | Purpose |
|---|---|
| `distribution/openrct2.d.ts` | Plugin API types: `Ride`, `Guest.umbrellaColour` |
| `src/openrct2/scripting/bindings/ride/ScRide.cpp` | Colour setter bindings |
| `src/openrct2/entity/Guest.cpp` | Umbrella colour assignment on purchase (~line 1687) |
| `src/openrct2/ride/ShopItem.cpp` | `SHOP_ITEM_FLAG_IS_RECOLOURABLE` for umbrella |
| `src/openrct2/ride/Ride.h` | `randomShopColours` flag (line 131) |
