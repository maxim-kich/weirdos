import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { snippets } from '../snippets.js';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output);

// Publish every root-level page and browser resource, including the legal page.
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && ['.html', '.css', '.js'].includes(extname(entry.name))) {
    await cp(resolve(root, entry.name), resolve(output, entry.name));
  }
}
for (const folder of ['assets', 'elements']) {
  await cp(resolve(root, folder), resolve(output, folder), {
    recursive: true,
    filter: path => !path.slice(root.length + 1).split(sep).some(part => part.startsWith('.')),
  });
}
await mkdir(resolve(output, 'downloads'));
for (const snippet of snippets) {
  await cp(resolve(root, snippet.download), resolve(output, snippet.download));
}

// Fail the build if a page links to an omitted local page or resource.
async function validatePages(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) {
      await validatePages(path);
    } else if (extname(path) === '.html') {
      const html = await readFile(path, 'utf8');
      for (const [, value] of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) continue;
        const pathname = decodeURIComponent(value.split(/[?#]/)[0]);
        if (!pathname) continue;
        const target = pathname.startsWith('/')
          ? resolve(output, `.${pathname}`)
          : resolve(dirname(path), pathname);
        if (!target.startsWith(output + sep) && target !== output) {
          throw new Error(`Link escapes deployment output: ${value}`);
        }
        const info = await stat(target);
        if (info.isDirectory()) await stat(resolve(target, 'index.html'));
      }
    }
  }
}
await validatePages(output);
console.log('Built dist/ with gallery, legal pages, elements, and ZIP downloads.');
