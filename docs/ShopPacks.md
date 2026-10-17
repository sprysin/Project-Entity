# Pack shop

Demonic Delights contains the food set and supporting Primal/Glass Pawns. Its chase
cards are Monstrous Oven (Legendary), Gluttonous Amalgamation (Epic), and Dragonion
(Epic); it participates in the normal featured-pack rotation.

Edit `src/shop/packs.ts` to change pack names, card ID lists, colors, icons, or appearance weights. Edit `src/shop/PackLogic.ts` to change pack size, cascading roll chances, rarity reveal colors, or the five-minute rotation duration. Master Pack uses an explicit list too; update it when adding a playable card. Catalog regression coverage checks that it contains every playable card (excluding generated tokens).

Every lineup keeps Collector Pack in slot zero and draws two distinct featured packs using appearance weights from `packs.ts`. After the first draw, that pack is removed from the pool for the second slot. Saved lineups with duplicate packs are replaced. Only the lineup and deadline are saved in local browser storage; openings do not change ownership, decks, currency, or native saves. Expired lineups refresh on return, and already-open packs can finish revealing.

Card pulls use cascading rarity rolls. Each draw checks Relic at 1.5%, then Mythic at 1.5%, Legendary at 3%, Epic at 6%, Rare at 14.5%, and Uncommon at 30%, stopping on the first success. Each percentage is conditional on reaching that tier, with a fresh independent roll after each failure. Empty tiers are skipped and the lowest available tier (normally Common) is guaranteed as the fallback. Pack composition does not scale or renormalize these chances. A card is selected uniformly within the winning tier. Selecting a pack shows its artwork, description, pool size, and options to open one or five packs; contents and pull odds are not displayed, keeping each reveal a mystery. Five independent draws allow duplicates; there is no guaranteed rare slot or pity counter.

Each pack defines exactly three distinct `chaseCardIds` in `src/shop/packs.ts`, all drawn from its card pool. The pack details showcase starts on the wrapper; chevrons, arrow keys, and diamond position controls browse the three hand-picked card previews and loop back to the wrapper. Clicking a preview opens the existing card inspector. Chase picks do not change pull odds. Returning to a pack resets the showcase to its wrapper.

The opening screen reuses CardDetail, existing audio settings, and shared page controls. Reduced-motion preferences disable opening, showcase, and reveal animations. The card inspector uses a native HTML dialog with keyboard focus containment and Escape dismissal.

The Debug pulls button opens DEBUG_PACK's fixed seven-card list in rarity order, bypassing random draws and rotation. Edit that fixture in src/shop/packs.ts to change the sample cards. It shares the normal reveal animations, inspection, and completion controls. Opening counters and wrapper labels use the actual card count; cards stay in one row and shrink to fit the available width and height. The adjacent temporary Debug reroll packs button immediately draws a fresh lineup and resets the rotation timer to five minutes, saving both through the normal rotation persistence.

Five-pack sessions generate five independent packs when started. Continue advances to the next pack, preserving the session through shop rotations. After the fifth pack, all 25 pulls appear in descending rarity-tier order, with duplicates retained and inspection available. Single-pack sessions return to selection on Continue.
