import { beforeEach, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({ files: new Map<string, string>(), failRename: false }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 14 },
  mkdir: vi.fn(async () => {}),
  exists: vi.fn(async (path: string) => disk.files.has(path)),
  readTextFile: vi.fn(async (path: string) => disk.files.get(path)),
  writeTextFile: vi.fn(async (path: string, value: string) => { disk.files.set(path, value); }),
  rename: vi.fn(async (from: string, to: string) => {
    if (disk.failRename) throw new Error('Disk unavailable');
    disk.files.set(to, disk.files.get(from)!);
    disk.files.delete(from);
  }),
  stat: vi.fn(async () => ({ size: 20 })),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn(), confirm: vi.fn(), message: vi.fn() }));

import { awardDuelXp, getAccount, flushSaves, getSettings, saveProfile, saveSettings, getSavedDecks, hasCardPoolChanges, initializeStorage, migrateSave, saveActivationPopupMode, saveDeckLibrary } from '../src/desktop/storage';
import { createGame } from '../src/game/engine';
import { accountProgress, damageScore, getDuelReport } from '../src/game/duelReport';
import { newDeck } from '../src/decks';
import { exportDeck, importDeck } from '../src/desktop/files';
import { open, save } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';

beforeEach(async () => {
  vi.clearAllMocks();
  disk.files.clear();
  disk.failRename = false;
  await initializeStorage();
});

it('awards completed duel XP once and persists progression with concurrent profile and deck writes', async () => {
  const duel = createGame([{ id: 'p0', name: 'Player', deck: [] }, { id: 'p1', name: 'Opponent', deck: [] }]);
  duel.duelStats![0] = { battleDestructions: 1, actionDestructions: 1, effectDestructions: 1, tributeSummons: 6, vassalSummons: 1, mergeSummons: 1 };
  await awardDuelXp(duel);
  expect([getDuelReport(duel, 0).xp, getDuelReport(duel, 1).xp, getAccount().totalXp]).toEqual([0, 0, 0]);
  duel.winner = 'Player'; duel.resultReason = 'lp';
  expect(getDuelReport(duel, 0)).toMatchObject({ total: 1375, xp: 137 });
  expect(damageScore(810)).toBeGreaterThan(damageScore(800));
  expect(Math.round(damageScore(1600))).toBe(1355);
  expect(accountProgress(929)).toMatchObject({ level: 3, xp: 319, required: 320 });
  expect(accountProgress(930)).toMatchObject({ level: 4, xp: 0, required: 330 });
  const deck = newDeck();
  await Promise.all([awardDuelXp(duel), awardDuelXp(duel), saveDeckLibrary([deck]), saveActivationPopupMode('off'), saveSettings({ username: '  Drake  ', volume: 35, fannedOutPiles: true })]);
  const profileImage = 'data:image/webp;base64,UklGRg==';
  await saveProfile({ username: '  Drake  ', profileImage });
  await initializeStorage();
  expect(getSavedDecks()).toEqual([deck]);
  expect(getSettings()).toEqual({ activationPopupMode: 'off', username: 'Drake', profileImage, volume: 35, fannedOutPiles: true });
  await awardDuelXp(duel);
  expect(getAccount()).toEqual({ totalXp: 137, lastDuelId: duel.duelId });
  expect(disk.files.has('save.json.tmp')).toBe(false);
});

it('keeps the previous save and cached state when replacement fails, then supports retry', async () => {
  const deck = newDeck();
  await saveDeckLibrary([deck]);
  const original = disk.files.get('save.json');
  const duel = { ...createGame([{ id: 'p0', name: 'Player', deck: [] }, { id: 'p1', name: 'Opponent', deck: [] }]), winner: 'Player', resultReason: 'lp' as const };
  disk.failRename = true;
  await expect(awardDuelXp(duel)).rejects.toThrow('Disk unavailable');
  await expect(flushSaves()).rejects.toThrow('Disk unavailable');
  expect(disk.files.get('save.json')).toBe(original);
  expect(getSavedDecks()).toEqual([deck]);
  expect(getAccount().totalXp).toBe(0);
  disk.failRename = false;
  await awardDuelXp(duel);
  expect(getAccount().totalXp).toBe(50);
});

it('migrates legacy arrays and rejects future versions and duplicate IDs', () => {
  const deck = newDeck();
  expect(migrateSave([deck])).toEqual({ version: 1, decks: [deck], account: { totalXp: 0, lastDuelId: null }, settings: { activationPopupMode: 'auto', username: 'Player 1', profileImage: null, volume: 80, fannedOutPiles: false } });
  expect(() => migrateSave({ ...migrateSave([]), account: { totalXp: -1, lastDuelId: null } })).toThrow('Invalid account');
  expect(migrateSave({ version: 1, decks: [], settings: { activationPopupsEnabled: false, profileIcon: 'star' } }).settings).toEqual({ activationPopupMode: 'off', username: 'Player 1', profileImage: null, volume: 80, fannedOutPiles: false });
  expect(migrateSave({ version: 1, decks: [], settings: { activationPopupsEnabled: true } }).settings.activationPopupMode).toBe('on');
  for (const activationPopupMode of ['always', true, null]) {
    expect(() => migrateSave({ version: 1, decks: [], settings: { activationPopupMode } })).toThrow('Invalid settings');
  }
  for (const settings of [{ username: ' ' }, { username: 'x'.repeat(25) }, { profileImage: 'https://example.com/image.png' }, { volume: -1 }, { volume: 101 }, { fannedOutPiles: 'yes' }]) {
    expect(() => migrateSave({ version: 1, decks: [], settings: { activationPopupsEnabled: true, ...settings } })).toThrow('Invalid settings');
  }
  expect(() => migrateSave({ version: 2 })).toThrow('Unsupported');
  expect(() => migrateSave([deck, deck])).toThrow('Duplicate');
});

it('recovers changed card pools without overwriting saves, but still rejects damaged saves', async () => {
  const unaffected = newDeck();
  for (const oldId of ['A_Law_Of_The_Normal', 'action_law_of_the_normal']) {
    const deck = { ...newDeck(), cards: [{ cardId: oldId, quantity: 2 }] };
    const raw = JSON.stringify({ version: 1, decks: [deck, unaffected], settings: { activationPopupMode: 'off', username: 'Drake', volume: 35 } });
    disk.files.set('save.json', raw);
    await initializeStorage();
    expect(getSavedDecks()).toEqual([{ ...deck, cards: [{ cardId: 'A_On_Common_Ground', quantity: 2 }] }, unaffected]);
    expect(hasCardPoolChanges()).toBe(true);
    expect(getSettings()).toMatchObject({ activationPopupMode: 'off', username: 'Drake', volume: 35 });
    expect(disk.files.get('save.json')).toBe(raw);
  }
  const deck = { ...newDeck(), cards: [{ cardId: 'A_On_Common_Ground', quantity: 2 }, { cardId: 'A_Removed', quantity: 1 }], reserve: [{ cardId: 'P_Removed', quantity: 3 }] };
  disk.files.set('save.json', JSON.stringify([deck, unaffected]));
  await initializeStorage();
  expect(getSavedDecks()).toEqual([{ ...deck, cards: [deck.cards[0]], reserve: [] }, unaffected]);
  expect(hasCardPoolChanges()).toBe(true);
  expect(() => migrateSave([deck])).toThrow('unknown cards');
  await saveDeckLibrary(getSavedDecks());
  await initializeStorage();
  expect(hasCardPoolChanges()).toBe(false);
  const invalid = { ...deck, cards: [{ cardId: 'A_Removed', quantity: -1 }] };
  disk.files.set('save.json', JSON.stringify([invalid]));
  await expect(initializeStorage()).rejects.toThrow('invalid quantities');
  expect(disk.files.get('save.json')).toBe(JSON.stringify([invalid]));
  disk.files.set('save.json', '{broken');
  await expect(initializeStorage()).rejects.toThrow();
  await expect(saveDeckLibrary([])).rejects.toThrow('has not loaded');
  expect(disk.files.get('save.json')).toBe('{broken');
});

it('round-trips native deck files with a fresh import ID and rejects oversized files', async () => {
  const deck = { ...newDeck(), name: 'My deck' };
  vi.mocked(save).mockResolvedValueOnce('chosen.json');
  expect(await exportDeck(deck)).toBe(true);
  vi.mocked(open).mockResolvedValueOnce('chosen.json');
  const imported = await importDeck();
  expect(imported).toMatchObject({ name: deck.name, cards: [] });
  expect(imported!.id).not.toBe(deck.id);
  vi.mocked(open).mockResolvedValueOnce('huge.json');
  vi.mocked(stat).mockResolvedValueOnce({ size: 1024 * 1024 + 1 } as Awaited<ReturnType<typeof stat>>);
  await expect(importDeck()).rejects.toThrow('smaller than 1 MB');
});
