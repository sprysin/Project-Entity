import { BaseDirectory, exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { parseDeck, SavedDeck } from '../decks';
import { ActivationPopupMode } from '../types';

export interface SaveData {
  version: 1;
  decks: SavedDeck[];
  settings: { activationPopupMode: ActivationPopupMode; username: string; profileImage: string | null; volume: number; fannedOutPiles: boolean };
}
const empty = (): SaveData => ({ version: 1, decks: [], settings: { activationPopupMode: 'auto', username: 'Player 1', profileImage: null, volume: 80, fannedOutPiles: false } });

// Version 0 used an unversioned deck array. Keep excess copies editable on migration.
export function migrateSave(raw: unknown): SaveData {
  const data = (Array.isArray(raw) ? { ...empty(), decks: raw } : raw) as SaveData & { settings: { activationPopupsEnabled?: boolean } };
  if (!data || data.version !== 1 || !Array.isArray(data.decks) ||
      !data.settings || data.settings.activationPopupMode === undefined && typeof data.settings.activationPopupsEnabled !== 'boolean') throw new Error('Unsupported or damaged save file. Your existing file has been preserved.');
  const activationPopupMode = data.settings.activationPopupMode === undefined ? (data.settings.activationPopupsEnabled ? 'on' : 'off') : data.settings.activationPopupMode;
  if (!['off', 'auto', 'on'].includes(activationPopupMode)) throw new Error('Invalid settings in save file.');
  const decks = data.decks.map(deck => parseDeck(deck, false));
  if (new Set(decks.map(deck => deck.id)).size !== decks.length) throw new Error('Duplicate deck IDs in save file.');
  const username = data.settings.username ?? 'Player 1';
  const profileImage = data.settings.profileImage ?? null;
  const volume = data.settings.volume ?? 80;
  const fannedOutPiles = data.settings.fannedOutPiles ?? false;
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 24 ||
      (profileImage !== null && (typeof profileImage !== 'string' || profileImage.length > 1_500_000 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profileImage))) ||
      typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 100 ||
      typeof fannedOutPiles !== 'boolean') throw new Error('Invalid settings in save file.');
  return { version: 1, decks, settings: { activationPopupMode, username: username.trim(), profileImage, volume, fannedOutPiles } };
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
export const getActivationPopupMode = () => current.settings.activationPopupMode;
export const getSettings = () => ({ ...current.settings });
export const saveSettings = (settings: Pick<SaveData['settings'], 'username' | 'volume' | 'fannedOutPiles'>) => {
  const validated = migrateSave({ ...current, settings: { ...current.settings, ...settings } }).settings;
  return update(previous => ({ ...previous, settings: { ...previous.settings, username: validated.username, volume: validated.volume, fannedOutPiles: validated.fannedOutPiles } }));
};
export const saveProfile = (profile: Pick<SaveData['settings'], 'username' | 'profileImage'>) => {
  const validated = migrateSave({ ...current, settings: { ...current.settings, ...profile } }).settings;
  return update(previous => ({ ...previous, settings: { ...previous.settings, username: validated.username, profileImage: validated.profileImage } }));
};

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
export const saveActivationPopupMode = (mode: ActivationPopupMode) => {
  const activationPopupMode = migrateSave({ ...current, settings: { ...current.settings, activationPopupMode: mode } }).settings.activationPopupMode;
  return update(previous => ({ ...previous, settings: { ...previous.settings, activationPopupMode } }));
};
export const flushSaves = () => pendingWrite;
