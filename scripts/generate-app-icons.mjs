import { readFile, writeFile, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const original = await readFile(join(root, 'src/styles/Logo/ProjEntityLogo.svg'), 'utf8');
// Nest the source SVG to preserve its proportions, paths, and transforms.
const mark = original.replace('<svg ', '<svg x="64" y="45" width="384" height="422" fill="#eab308" ');
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000"/>
  ${mark}
</svg>\n`;
await writeFile(join(root, 'assets/app-icon.svg'), icon);

// Generate in a temporary directory; keep only the desktop assets used by Tauri.
const temporary = await mkdtemp(join(tmpdir(), 'project-entity-icons-'));
try {
  const cli = join(root, 'node_modules/@tauri-apps/cli/tauri.js');
  execFileSync(process.execPath, [cli, 'icon', 'assets/app-icon.svg', '--output', temporary], { cwd: root, stdio: 'inherit' });
  for (const name of ['32x32.png', '128x128.png', '128x128@2x.png', 'icon.ico']) {
    await copyFile(join(temporary, name), join(root, 'src-tauri/icons', name));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
