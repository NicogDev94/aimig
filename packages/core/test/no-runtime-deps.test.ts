import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const pkgDir = join(here, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Invariant 9 — the canonical state is independent of the LLM and of the
 * storage — is only credible if it is mechanically checked. The package
 * boundary makes it a build fact; these tests make it a red test the moment
 * someone crosses it.
 */
describe('@aimig/core', () => {
  it('has no runtime dependency', () => {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('imports no Node built-in outside the node-only entry point', () => {
    // `src/node` is the deliberately Node-only adapter, published as
    // `@aimig/core/node` and never re-exported from the main entry. Everything
    // else must stay loadable in a browser, because PR6 will do exactly that.
    const offenders = sourceFiles(join(pkgDir, 'src'))
      .filter((file) => !file.includes(`${sep}src${sep}node${sep}`))
      .filter((file) => /from\s+'node:/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not re-export the Node-only store from the browser-safe entry', () => {
    const index = readFileSync(join(pkgDir, 'src', 'index.ts'), 'utf8');
    expect(index).not.toMatch(/\.\/node\//);
  });
});
