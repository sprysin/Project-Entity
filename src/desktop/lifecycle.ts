import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirmAction, showMessage } from './files';
import { flushSaves } from './storage';

const reasons = new Map<string, string>();
export function setCloseReason(key: string, reason: string | null) {
  if (reason) reasons.set(key, reason);
  else reasons.delete(key);
}

export async function initializeWindow() {
  const windowHandle = getCurrentWindow();
  let confirming = false;
  await windowHandle.onCloseRequested(async event => {
    event.preventDefault();
    if (confirming) return;
    confirming = true;
    try {
      if (reasons.size && !await confirmAction([...reasons.values()].join('\n') + '\n\nQuit Project Entity?')) return;
      await flushSaves();
      await windowHandle.destroy();
    } catch (error) {
      await showMessage(`Could not close the game: ${String(error)}`);
    } finally { confirming = false; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'F11' || (event.altKey && event.key === 'Enter')) {
      event.preventDefault();
      if (!event.repeat) void windowHandle.isFullscreen().then(fullscreen => windowHandle.setFullscreen(!fullscreen)).catch(error => showMessage(String(error)));
    }
    if (event.key === 'F5' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r')) event.preventDefault();
  });
  document.addEventListener('click', event => {
    if ((event.target as Element).closest?.('a[href]')) event.preventDefault();
  });
}
