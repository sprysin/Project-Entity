import { open, save, confirm, message } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';
import { parseDeck, SavedDeck } from '../decks';

export const confirmAction = (text: string) => confirm(text, { title: 'Project Entity', kind: 'warning' });
export const showMessage = (text: string) => message(text, { title: 'Project Entity' });

export async function importDeck(): Promise<SavedDeck | null> {
  const path = await open({ title: 'Open deck', multiple: false, directory: false, filters: [{ name: 'Deck JSON', extensions: ['json'] }] });
  if (!path) return null;
  if ((await stat(path)).size > 1024 * 1024) throw new Error('Please choose a deck JSON file smaller than 1 MB.');
  const deck = parseDeck(JSON.parse(await readTextFile(path)));
  return { ...deck, id: crypto.randomUUID() };
}

export async function exportDeck(deck: SavedDeck): Promise<boolean> {
  const valid = parseDeck(deck);
  const name = (valid.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'deck') + '.json';
  const path = await save({ title: 'Export deck', defaultPath: name, filters: [{ name: 'Deck JSON', extensions: ['json'] }] });
  if (!path) return false;
  await writeTextFile(path, JSON.stringify(valid, null, 2) + '\n');
  return true;
}
