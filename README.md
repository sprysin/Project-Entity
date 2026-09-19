# Project Entity

**Project Entity** is a tactical non-mana card game.

## Game Overview

Project Entity is a card game where you summon **Pawns** with a range of effects while trying to reduce your opponent's Life Points to 0. You command the field not only through your Pawns but also through **Action** and **Condition** cards.

Inspired by "no-mana" systems, the game focuses on hand management and tempo rather than a slow-building resource pool. Players must balance the raw power of **High-Level Pawns** which require **Tributes** to summon with the reactive utility of fast-paced Actions and face down Condition cards.

## Key Mechanics

- **No-Mana System**: The game eschews traditional mana curves for a system based on card advantage and strategic timing.
- **Draw to 5**: Players refill their hand to 5 cards at the start of their turn.
- **Tribute Summoning**: Powerful Pawns cannot be summoned for free; they require the sacrifice of other Pawns to summon. Basically acting like a resource system.
- **Card subtypes**: Actions and Conditions can be Normal, Lingering or Attach. Attach Actions and Attach Conditions link to a field card; hover over an activated Attach card to see yellow outlines and beads moving toward its target. Reinforcement is the first Attach Condition. Both the deck editor and card database support subtype search.
- **The Void**: Distinct from the standard Discard Pile, the Void is a zone for permanent removal.

**Prerequisites:**  Node.js

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm run dev
   ```

## Project Layout

- `src/components/` — React views and reusable UI
- `src/hooks/` — game-state and animation hooks
- `src/cards/` — card definitions, registry, and effect engine
- `src/game/` — shared game-state utilities
- `src/styles/` — global and game-wide styles
- `tests/` — automated tests
- `docs/` — contributor documentation
