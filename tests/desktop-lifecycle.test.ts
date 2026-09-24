import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  close: undefined as undefined | ((event: { preventDefault: () => void }) => Promise<void>),
  destroy: vi.fn(async () => {}),
  confirm: vi.fn(async () => false),
  flush: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({
  onCloseRequested: async (callback: typeof mocks.close) => { mocks.close = callback; },
  destroy: mocks.destroy,
  isFullscreen: async () => false,
  setFullscreen: vi.fn(async () => {}),
}) }));
vi.mock('../src/desktop/files', () => ({ confirmAction: mocks.confirm, showMessage: vi.fn() }));
vi.mock('../src/desktop/storage', () => ({ flushSaves: mocks.flush }));

import { initializeWindow, setCloseReason } from '../src/desktop/lifecycle';
const listeners = new Map<string, (event: unknown) => void>();
beforeEach(async () => {
  vi.clearAllMocks();
  setCloseReason('deck', null);
  setCloseReason('match', null);
  vi.stubGlobal('document', { addEventListener: (name: string, cb: (event: unknown) => void) => listeners.set(name, cb) });
  await initializeWindow();
});

it('keeps the window open when unsaved edits are not discarded', async () => {
  setCloseReason('deck', 'Unsaved deck');
  const preventDefault = vi.fn();
  await mocks.close!({ preventDefault });
  expect(preventDefault).toHaveBeenCalled();
  expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining('Unsaved deck'));
  expect(mocks.destroy).not.toHaveBeenCalled();
});

it('flushes pending saves before a confirmed close', async () => {
  setCloseReason('match', 'Match will be lost');
  mocks.confirm.mockResolvedValueOnce(true);
  await mocks.close!({ preventDefault: vi.fn() });
  expect(mocks.flush).toHaveBeenCalled();
  expect(mocks.destroy).toHaveBeenCalled();
  expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.destroy.mock.invocationCallOrder[0]);
});
