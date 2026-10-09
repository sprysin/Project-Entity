# Pack shop

Edit `src/shop/packs.ts` to change pack names, card ID lists, colors, icons, or appearance weights. Edit `src/shop/PackLogic.ts` to change pack size, pull weights, rarity reveal colors, or the five-minute rotation duration. Master Pack uses an explicit list too; update it when adding a playable card. Catalog regression coverage checks that it contains every playable card (excluding generated tokens).

The first visit shows all three packs. Later rotations keep Master Pack in slot zero and independently draw the other two slots using appearance weights (Fire 3, Graveyard 1). Repeated packs are allowed. Only the lineup and deadline are saved in local browser storage; openings do not change ownership, decks, currency, or native saves. Expired lineups refresh on return, and already-open packs can finish revealing.

Card pulls use per-card weights: Common 60, Uncommon 25, Rare 12, Epic 5, and the shared Legendary/Mythic/Relic tier 1.25. Each individual high-rarity card is harder to pull than each lower-rarity card. Selecting a pack shows its artwork, description, pool size, and options to open one or five packs; contents and pull odds are not displayed, keeping each reveal a mystery. Five independent draws allow duplicates; there is no guaranteed rare slot or pity counter.

Each pack defines exactly three distinct `chaseCardIds` in `src/shop/packs.ts`, all drawn from its card pool. The pack details showcase starts on the wrapper; chevrons, arrow keys, and diamond position controls browse the three hand-picked card previews and loop back to the wrapper. Clicking a preview opens the existing card inspector. Chase picks do not change pull odds. Returning to a pack resets the showcase to its wrapper.

The opening screen reuses CardDetail, existing audio settings, and shared page controls. Reduced-motion preferences disable opening, showcase, and reveal animations. The card inspector uses a native HTML dialog with keyboard focus containment and Escape dismissal.

The Debug pulls button opens DEBUG_PACK's fixed seven-card list in rarity order, bypassing random draws and rotation. Edit that fixture in src/shop/packs.ts to change the sample cards. It shares the normal reveal animations, inspection, and completion controls. Opening counters and wrapper labels use the actual card count; cards stay in one row and shrink to fit the available width and height. Mythic reveals use #30F0DD and Relic reveals use #D35400, while both retain the highest-tier glow and burst animations.

Five-pack sessions generate five independent packs when started. Continue advances to the next pack, preserving the session through shop rotations. After the fifth pack, all 25 pulls appear in descending rarity-tier order, with duplicates retained and inspection available. Single-pack sessions return to selection on Continue.
