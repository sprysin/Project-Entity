import { BaseDirectory, exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { parseDeck, SavedDeck } from '../decks';

export interface SaveData {
  version: 1;
  decks: SavedDeck[];
  settings: { activationPopupsEnabled: boolean };
}
const empty = (): SaveData => ({ version: 1, decks: [], settings: { activationPopupsEnabled: true } });

// Version 0 used an unversioned deck array. Keep excess copies editable on migration.
export function migrateSave(raw: unknown): SaveData {
  const data = Array.isArray(raw) ? { version: 1, decks: raw, settings: { activationPopupsEnabled: true } } : raw as SaveData;
  if (!data || data.version !== 1 || !Array.isArray(data.decks) ||
      typeof data.settings?.activationPopupsEnabled !== 'boolean') throw new Error('Unsupported or damaged save file. Your existing file has been preserved.');
  const decks = data.decks.map(deck => parseDeck(deck, false));
  if (new Set(decks.map(deck => deck.id)).size !== decks.length) throw new Error('Duplicate deck IDs in save file.');
  return { version: 1, decks, settings: { activationPopupsEnabled: data.settings.activationPopupsEnabled } };
}

let current = empty();
let ready = false;
let writes: Promise<void> = Promise.resolve();
let pendingWrite: Promise<void> = Promise.resolve();
const options = { baseDir: BaseDirectory.AppData };
export async function initializeStorage() {
  ready = false;
  await mkdir('', { ...options, recursive: true });
  current = await exists('save.json', options) ? migrateSave(JSON.parse(await readTextFile('save.json', options))) : empty();
  ready = true;
}
export const getSavedDecks = () => structuredClone(current.decks);
export const getActivationPopups = () => current.settings.activationPopupsEnabled;

// Serialize writes and replace only after the complete temporary file is written.
function update(change: (previous: SaveData) => SaveData): Promise<void> {
  const job = writes.then(async () => {
    if (!ready) throw new Error('Save storage has not loaded.');
    const next = change(current);
    await writeTextFile('save.json.tmp', JSON.stringify(next, null, 2), options);
    await rename('save.json.tmp', 'save.json', { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
    current = next;
  });
  writes = job.catch(() => {});
  pendingWrite = job;
  return job;
}
export const saveDeckLibrary = (decks: SavedDeck[]) => {
  const snapshot = migrateSave({ version: 1, decks, settings: current.settings }).decks;
  return update(previous => ({ ...previous, decks: snapshot }));
};
export const saveActivationPopups = (enabled: boolean) => update(previous => ({ ...previous, settings: { ...previous.settings, activationPopupsEnabled: enabled } }));
export const flushSaves = () => pendingWrite;
