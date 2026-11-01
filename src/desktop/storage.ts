import { BaseDirectory, exists, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { parseDeck, SavedDeck } from '../decks';
import { ActivationPopupMode, GameState } from '../types';
import { DuelStats, emptyDuelStats, getDuelReport } from '../game/duelReport';
import starterDeck from '../data/starter-deck.json';

export interface AccountStatistics extends DuelStats {
  trackedSince: string;
  wins: number;
  losses: number;
  draws: number;
  highestDuelScore: number;
  mostDamageInDuel: number;
}
const emptyStatistics = (): AccountStatistics => ({
  ...emptyDuelStats(), trackedSince: new Date().toISOString(),
  wins: 0, losses: 0, draws: 0, highestDuelScore: 0, mostDamageInDuel: 0,
});

function parseStatistics(raw: unknown): AccountStatistics {
  const defaults = emptyStatistics();
  if (raw === undefined) return defaults;
  const stats = raw as AccountStatistics;
  if (!stats || typeof stats.trackedSince !== 'string' || !Number.isFinite(Date.parse(stats.trackedSince)) ||
      (Object.keys(defaults) as (keyof AccountStatistics)[]).some(key => key !== 'trackedSince' &&
        (!Number.isSafeInteger(stats[key]) || stats[key] < 0))) throw new Error('Invalid account statistics in save file.');
  return { ...stats };
}

export interface SaveData {
  version: 1;
  decks: SavedDeck[];
  collection: Pick<SavedDeck, 'cards' | 'reserve'>;
  account: { totalXp: number; lastDuelId: string | null; statistics: AccountStatistics };
  settings: { activationPopupMode: ActivationPopupMode; username: string; profileImage: string | null; volume: number; fannedOutPiles: boolean; blueGreenBoard: boolean };
}
const empty = (): SaveData => ({ version: 1, decks: [], collection: { cards: [], reserve: [] }, account: { totalXp: 0, lastDuelId: null, statistics: emptyStatistics() }, settings: { activationPopupMode: 'auto', username: 'Player 1', profileImage: null, volume: 80, fannedOutPiles: false, blueGreenBoard: false } });

function collectionFromDecks(decks: SavedDeck[]): SaveData['collection'] {
  const pool: SaveData['collection'] = { cards: [], reserve: [] };
  for (const pile of ['cards', 'reserve'] as const) {
    const quantities = new Map<string, number>();
    for (const deck of decks) for (const entry of deck[pile] ?? []) {
      quantities.set(entry.cardId, Math.max(quantities.get(entry.cardId) ?? 0, entry.quantity));
    }
    pool[pile] = [...quantities].map(([cardId, quantity]) => ({ cardId, quantity }));
  }
  return pool;
}

// Version 0 used an unversioned deck array. Keep excess copies editable on migration.
export function migrateSave(raw: unknown, onCardPoolChange?: () => void): SaveData {
  const data = (Array.isArray(raw) ? { ...empty(), decks: raw, collection: undefined } : raw) as SaveData & { settings: { activationPopupsEnabled?: boolean } };
  if (!data || data.version !== 1 || !Array.isArray(data.decks) ||
      !data.settings || data.settings.activationPopupMode === undefined && typeof data.settings.activationPopupsEnabled !== 'boolean') throw new Error('Unsupported or damaged save file. Your existing file has been preserved.');
  const activationPopupMode = data.settings.activationPopupMode === undefined ? (data.settings.activationPopupsEnabled ? 'on' : 'off') : data.settings.activationPopupMode;
  if (!['off', 'auto', 'on'].includes(activationPopupMode)) throw new Error('Invalid settings in save file.');
  const decks = data.decks.map(deck => {
    let parsed: SavedDeck;
    try {
      parsed = parseDeck(deck, false);
    } catch (error) {
      if (!onCardPoolChange) throw error;
      parsed = parseDeck(deck, false, true);
    }
    const loadedIds = new Set([...parsed.cards, ...parsed.reserve ?? []].map(entry => entry.cardId));
    if ([...deck.cards, ...deck.reserve ?? []].some(entry => !loadedIds.has(entry.cardId))) onCardPoolChange?.();
    return parsed;
  });
  if (new Set(decks.map(deck => deck.id)).size !== decks.length) throw new Error('Duplicate deck IDs in save file.');
  const username = data.settings.username ?? 'Player 1';
  const profileImage = data.settings.profileImage ?? null;
  const volume = data.settings.volume ?? 80;
  const fannedOutPiles = data.settings.fannedOutPiles ?? false;
  const blueGreenBoard = data.settings.blueGreenBoard ?? false;
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 24 ||
      (profileImage !== null && (typeof profileImage !== 'string' || profileImage.length > 1_500_000 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profileImage))) ||
      typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 100 ||
      typeof fannedOutPiles !== 'boolean' || typeof blueGreenBoard !== 'boolean') throw new Error('Invalid settings in save file.');
  const account = data.account === undefined ? empty().account : data.account;
  if (!account || !Number.isSafeInteger(account.totalXp) || account.totalXp < 0 ||
      account.lastDuelId !== null && (typeof account.lastDuelId !== 'string' || !account.lastDuelId || account.lastDuelId.length > 128)) throw new Error('Invalid account progress in save file.');
  let collection = collectionFromDecks(decks);
  if (data.collection !== undefined) {
    if (!data.collection || !Array.isArray(data.collection.cards)) throw new Error('Invalid card collection in save file.');
    const parsed = parseDeck({ ...data.collection, version: 1, id: 'collection', name: 'Collection' }, false, !!onCardPoolChange);
    const original = [...data.collection.cards, ...data.collection.reserve ?? []];
    const loaded = [...parsed.cards, ...parsed.reserve ?? []];
    if (original.some(entry => !loaded.some(card => card.cardId === entry.cardId))) onCardPoolChange?.();
    collection = { cards: parsed.cards, reserve: parsed.reserve ?? [] };
  }
  return { version: 1, decks, collection, account: { ...account, statistics: parseStatistics(account.statistics) }, settings: { activationPopupMode, username: username.trim(), profileImage, volume, fannedOutPiles, blueGreenBoard } };
}

let current = empty();
let ready = false;
let cardPoolChanged = false;
let writes: Promise<void> = Promise.resolve();
let pendingWrite: Promise<void> = Promise.resolve();
const options = { baseDir: BaseDirectory.AppData };
export async function initializeStorage() {
  ready = false;
  cardPoolChanged = false;
  await mkdir('', { ...options, recursive: true });
  const hasSave = await exists('save.json', options);
  if (hasSave) current = migrateSave(JSON.parse(await readTextFile('save.json', options)), () => { cardPoolChanged = true; });
  else {
    const deck = parseDeck({ ...starterDeck, id: crypto.randomUUID(), starter: true });
    current = { ...empty(), decks: [deck], collection: collectionFromDecks([deck]) };
  }
  ready = true;
  if (!hasSave) await update(previous => ({ ...previous }));
}
export const getSavedDecks = () => structuredClone(current.decks);
export const getCollection = () => structuredClone(current.collection);
export const hasCardPoolChanges = () => cardPoolChanged;
export const getActivationPopupMode = () => current.settings.activationPopupMode;
export const getSettings = () => ({ ...current.settings });
export const getAccount = () => structuredClone(current.account);

/** The queued save deduplicates StrictMode, rerenders, and retries atomically. */
export async function awardDuelXp(state: GameState) {
  const report = getDuelReport(state, 0);
  if (!report.completed || !state.duelId) return { beforeXp: current.account.totalXp, afterXp: current.account.totalXp, xp: 0 };
  const duelId = state.duelId;
  const xp = report.xp;
  let afterXp = 0;
  await update(previous => {
    afterXp = previous.account.totalXp;
    if (previous.account.lastDuelId === duelId) return previous;
    afterXp += xp;
    if (!Number.isSafeInteger(afterXp) || !Number.isSafeInteger(xp) || xp < 0) throw new Error('Invalid duel XP.');
    const statistics = { ...previous.account.statistics };
    statistics[state.isDraw ? 'draws' : report.won ? 'wins' : 'losses'] += 1;
    for (const key of Object.keys(emptyDuelStats()) as (keyof DuelStats)[]) {
      statistics[key] += state.duelStats?.[0][key] ?? 0;
    }
    const damage = report.rows.filter(row => row.id === 'battleDamage' || row.id === 'effectDamage')
      .reduce((total, row) => total + row.count, 0);
    statistics.highestDuelScore = Math.max(statistics.highestDuelScore, report.total);
    statistics.mostDamageInDuel = Math.max(statistics.mostDamageInDuel, damage);
    return { ...previous, account: { totalXp: afterXp, lastDuelId: duelId, statistics: parseStatistics(statistics) } };
  });
  return { beforeXp: afterXp - xp, afterXp, xp };
}
export const saveSettings = (settings: Pick<SaveData['settings'], 'username' | 'volume' | 'fannedOutPiles' | 'blueGreenBoard'>) => {
  const validated = migrateSave({ ...current, settings: { ...current.settings, ...settings } }).settings;
  return update(previous => ({ ...previous, settings: { ...previous.settings, username: validated.username, volume: validated.volume, fannedOutPiles: validated.fannedOutPiles, blueGreenBoard: validated.blueGreenBoard } }));
};
export const saveProfile = (profile: Pick<SaveData['settings'], 'username' | 'profileImage'>) => {
  const validated = migrateSave({ ...current, settings: { ...current.settings, ...profile } }).settings;
  return update(previous => ({ ...previous, settings: { ...previous.settings, username: validated.username, profileImage: validated.profileImage } }));
};

export const resetAccount = () => update(previous => ({
  ...previous,
  account: { totalXp: 0, lastDuelId: previous.account.lastDuelId, statistics: emptyStatistics() },
}));

// Serialize writes and replace only after the complete temporary file is written.
function update(change: (previous: SaveData) => SaveData): Promise<void> {
  const job = writes.then(async () => {
    if (!ready) throw new Error('Save storage has not loaded.');
    const next = change(current);
    if (next === current) return;
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
