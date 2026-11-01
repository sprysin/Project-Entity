# Pack shop

Demonic Delights contains the food set and supporting Primal/Glass Pawns. Its chase
cards are Monstrous Oven (Legendary), Gluttonous Amalgamation (Epic), and Dragonion
(Epic); it participates in the normal featured-pack rotation.

Edit `src/shop/packs.ts` to change pack names, card ID lists, colors, icons, or appearance weights. Edit `src/shop/PackLogic.ts` to change pack size, cascading roll chances, rarity reveal colors, or the five-minute rotation duration. Master Pack uses an explicit list too; update it when adding a playable card. Catalog regression coverage checks that it contains every playable card (excluding generated tokens).

Every lineup keeps Collector Pack in slot zero and draws two distinct featured packs using appearance weights from `packs.ts`. After the first draw, that pack is removed from the pool for the second slot. Saved lineups with duplicate packs are replaced. Only the lineup and deadline are saved in local browser storage; openings do not change ownership, decks, currency, or native saves. Expired lineups refresh on return, and already-open packs can finish revealing.

Card pulls use cascading rarity rolls. Each draw checks Relic at 0.2%, then Mythic at 0.2%, Legendary at 0.75%, Epic at 4%, Rare at 15%, and Uncommon at 30%, stopping on the first success. Each percentage is conditional on reaching that tier, with a fresh independent roll after each failure. Empty tiers are skipped and the lowest available tier (normally Common) is guaranteed as the fallback. Pack composition does not scale or renormalize these chances. A card is selected uniformly within the winning tier. Selecting a pack shows its artwork, description, pool size, and options to open one or five packs; contents and pull odds are not displayed, keeping each reveal a mystery. Five independent draws allow duplicates; there is no guaranteed rare slot or pity counter.

Each pack defines exactly three distinct `chaseCardIds` in `src/shop/packs.ts`, all drawn from its card pool. The pack details showcase starts on the wrapper; chevrons, arrow keys, and diamond position controls browse the three hand-picked card previews and loop back to the wrapper. Clicking a preview opens the existing card inspector. Chase picks do not change pull odds. Returning to a pack resets the showcase to its wrapper.

The opening screen reuses CardDetail, existing audio settings, and shared page controls. Reduced-motion preferences disable opening, showcase, and reveal animations. The card inspector uses a native HTML dialog with keyboard focus containment and Escape dismissal.


The Debug pulls button opens DEBUG_PACK's fixed seven-card list in rarity order, bypassing random draws and rotation. Edit that fixture in src/shop/packs.ts to change the sample cards. It shares the normal reveal animations, inspection, and completion controls. Opening counters and wrapper labels use the actual card count; cards stay in one row and shrink to fit the available width and height. The adjacent temporary Debug reroll packs button immediately draws a fresh lineup and resets the rotation timer to five minutes, saving both through the normal rotation persistence.

Five-pack sessions generate five independent packs when started. Continue advances to the next pack, preserving the session through shop rotations. After the fifth pack, all 25 pulls appear in descending rarity-tier order, with duplicates retained and inspection available. Single-pack sessions return to selection on Continue.

## Unfinished: 3D pack opening (parked 2026-10-31)

The 3D wrapper and manual ripping feature is unfinished and needs a second round
of visual and interaction polish before it is enabled again. The live shop has
returned to its original flat CSS packs and automatic opening transition.

The dormant prototype is preserved in `src/components/shop/PackArtwork.tsx` and
`src/components/shop/packRenderer.ts`; Shop does not import it. Three.js dependencies
remain available for resuming this work. Reference: https://www.holosticker.dev.

Resume criteria and user preferences:
- Preserve saturated artwork and text beneath gloss; avoid washed-out lighting.
- Support each pack's own colors and theme.
- Use card-like tall proportions, a true square diamond, and fuller icon/text layout.
- Large, realistic top/bottom crimped seals with fewer grooves.
- Keep the wrapper stationary and straight on the ripping screen.
- Tear the top in either direction with a broad fold, without coiling or clipping.
- Show only the tops of five cards during the rip; no bottom protrusion.
- Space skips the manual rip. Keep the control below the pack and copy minimal.
- Finish with a short white background flash, respecting reduced motion.
- Reassess the overall material, seal geometry, proportions, and tear feel with the
  user before considering this feature finished. Previous iterations did not meet
  the required visual quality.
