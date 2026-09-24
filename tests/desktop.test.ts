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

import { flushSaves, getActivationPopups, getSettings, saveSettings, getSavedDecks, initializeStorage, migrateSave, saveActivationPopups, saveDeckLibrary } from '../src/desktop/storage';
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

it('persists decks and settings together across a restart, even with concurrent writes', async () => {
  const deck = newDeck();
  await Promise.all([saveDeckLibrary([deck]), saveActivationPopups(false), saveSettings({ username: '  Drake  ', volume: 35 })]);
  await initializeStorage();
  expect(getSavedDecks()).toEqual([deck]);
  expect(getActivationPopups()).toBe(false);
  expect(getSettings()).toEqual({ activationPopupsEnabled: false, username: 'Drake', volume: 35 });
  expect(disk.files.has('save.json.tmp')).toBe(false);
});

it('keeps the previous save and cached state when replacement fails, then supports retry', async () => {
  const deck = newDeck();
  await saveDeckLibrary([deck]);
  const original = disk.files.get('save.json');
  disk.failRename = true;
  await expect(saveDeckLibrary([])).rejects.toThrow('Disk unavailable');
  await expect(flushSaves()).rejects.toThrow('Disk unavailable');
  expect(disk.files.get('save.json')).toBe(original);
  expect(getSavedDecks()).toEqual([deck]);
  disk.failRename = false;
  await saveDeckLibrary([]);
  expect(getSavedDecks()).toEqual([]);
});

it('migrates legacy arrays and rejects future versions and duplicate IDs', () => {
  const deck = newDeck();
  expect(migrateSave([deck])).toEqual({ version: 1, decks: [deck], settings: { activationPopupsEnabled: true, username: 'Player 1', volume: 80 } });
  expect(migrateSave({ version: 1, decks: [], settings: { activationPopupsEnabled: false } }).settings).toEqual({ activationPopupsEnabled: false, username: 'Player 1', volume: 80 });
  for (const settings of [{ username: ' ' }, { username: 'x'.repeat(25) }, { volume: -1 }, { volume: 101 }]) {
    expect(() => migrateSave({ version: 1, decks: [], settings: { activationPopupsEnabled: true, ...settings } })).toThrow('Invalid settings');
  }
  expect(() => migrateSave({ version: 2 })).toThrow('Unsupported');
  expect(() => migrateSave([deck, deck])).toThrow('Duplicate');
});

it('does not overwrite a damaged save or permit saving after failed initialization', async () => {
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
