# Project Entity

**Project Entity** is a digital trading card game.

## Game Overview

Project Entity is a card game where you summon **Pawns** with a range of effects while trying to reduce your opponent's Life Points to 0. You fight on the field not only through your Pawns but also through **Action** and **Condition** cards.

Inspired by "no-mana" systems, the game focuses on hand management and tempo rather than a slow-building resource pool. Players must balance the raw power of **High-Level Pawns** with the utility of fast-paced Actions and face down Condition cards.

## Key Mechanics

- **No-Mana System**: The game eschews traditional mana curves for a system based on card advantage and strategic timing.
- **Draw to 5**: Players refill their hand to 5 cards at the start of their turn.
- **Tribute Summoning**: Powerful Pawns cannot be summoned for free; they require the sacrifice of other Pawns to summon. Basically acting like a resource system.
- **Card subtypes**: Actions and Conditions can be Normal, Lingering or Attach. Attach Actions and Attach Conditions link to a field card; hover over an activated Attach card to see yellow outlines and beads moving toward its target. Reinforcement is the first Attach Condition. Both the deck editor and card database support subtype search.
- **The Void**: Distinct from the standard Discard Pile, the Void is a zone for permanent removal.

## Playing on Windows

Install the `Project Entity_0.1.0_x64-setup.exe` release, then launch **Project Entity** from the Start menu. The game runs locally, offline, with no website, account, Node.js, or terminal required. The installer installs Microsoft WebView2 if it is missing (internet is required for that first-time prerequisite only).

F11 or Alt+Enter toggles fullscreen. Closing during a match or with unsaved deck edits asks for confirmation. Matches are not saved between sessions.

Decks and preferences are stored in `%APPDATA%\com.projectentity.game\save.json`. The file uses a versioned format and is replaced through a temporary file after each successful save. An unreadable or newer-format save is preserved and blocks startup instead of being reset. Back up this file before editing it manually.

Use **Open JSON** and **Export deck to JSON** in the deck creator for native file import/export. Existing browser saves are not automatically accessible to the desktop app: export decks from the old version, then import those files here. Each import creates a separate deck; click **Save** to add it to your library.

## Desktop development

**Prerequisites:** Node.js, Rust (MSVC toolchain), Microsoft C++ Build Tools with the Desktop development with C++ workload, and WebView2. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Restart your terminal after installing toolchains.

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the desktop app with live reload:**
   ```bash
   npm run dev
   ```

3. **Build the executable and Windows installer:**
   ```bash
   npm run desktop:build
   ```

The executable is `src-tauri/target/release/project-entity.exe`; the installer is under `src-tauri/target/release/bundle/nsis/`. `RunGame.bat` opens the compiled executable. Vite is only an internal development/build tool; production embeds the assets and starts no server.

Run `npm run typecheck` and `npm test` for checks. `npm run icons` regenerates the Windows application icons from `assets/app-icon.svg` and removes Tauri's unused mobile, macOS, and Store variants.

The application opens a single window, restricts navigation, and limits filesystem access to its own save files and files selected in native dialogs. Automatic updates, installer signing, and clean-machine release testing are intentionally deferred.

## Project Layout

- `src/components/` — React views and reusable UI
- `src/hooks/` — game-state and animation hooks
- `src/cards/` — card definitions, registry, and effect engine
- `src/game/` — React-independent rules engine, commands, AI, and game-state utilities
- `src/styles/` — global and game-wide styles
- `tests/` — automated tests
- `docs/` — contributor documentation

See [Rules engine and React adapters](docs/rules-engine.md) for the command API and headless match execution.
