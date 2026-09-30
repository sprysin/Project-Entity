import { registerCardModules, CardModule } from '../CardRegistry';

registerCardModules(import.meta.glob<{ default: CardModule }>(['./**/*.ts', '!./index.ts'], { eager: true }));
