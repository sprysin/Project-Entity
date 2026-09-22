import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const icons = fileURLToPath(new URL('../src-tauri/icons/', import.meta.url));
const unused = [
  'android',
  'ios',
  '64x64.png',
  'icon.icns',
  'icon.png',
  'StoreLogo.png',
  ...readdirSync(icons).filter(name => /^Square\d+x\d+Logo\.png$/.test(name)),
];

for (const name of unused) rmSync(join(icons, name), { recursive: true, force: true });
