import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('loads presentation assets locally rather than from external services', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('href="/index.css"');
});
