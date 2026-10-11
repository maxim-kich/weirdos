import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep, extname } from 'node:path';
import { Script } from 'node:vm';
import { snippets } from '../snippets.js';

const root = resolve(import.meta.dirname, '..');
const elements = resolve(root, 'elements');
const ids = new Set();
function requireValid(condition, message) {
  if (!condition) throw new Error(message);
}
function filesIn(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const path = resolve(folder, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
function localFile(value, base, folder) {
  const plain = value.split(/[?#]/)[0];
  if (!plain || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(plain)) return;
  requireValid(!plain.startsWith('/'), `Use a relative asset path: ${value}`);
  const target = resolve(base, decodeURIComponent(plain));
  requireValid(target.startsWith(folder + sep), `Asset must stay inside its element folder: ${value}`);
  requireValid(statSync(target, { throwIfNoEntry: false })?.isFile(), `Missing asset: ${relative(root, target)}`);
}

for (const snippet of snippets) {
  requireValid(typeof snippet.id === 'string' && /^[A-Za-z0-9_-]+$/.test(snippet.id), 'Invalid snippet ID');
  requireValid(!ids.has(snippet.id), `Duplicate ID: ${snippet.id}`);
  ids.add(snippet.id);
  requireValid(typeof snippet.title === 'string' && snippet.title.trim() && !/[\r\n]/.test(snippet.title), `Invalid title: ${snippet.id}`);
  requireValid(snippet.download === `./downloads/${snippet.id}.zip`, `ZIP path must match ID: ${snippet.id}`);
  requireValid(snippet.readyMessage === true, `Every snippet must implement the shared ready message: ${snippet.id}`);
  requireValid(snippet.transitionPose === undefined, `Gallery pose transitions are obsolete: ${snippet.id}`);
  const source = resolve(root, snippet.src || '');
  requireValid(source.startsWith(elements + sep) && source.endsWith(`${sep}index.html`), `Expected elements/<folder>/index.html: ${snippet.id}`);
  const folder = dirname(source);
  requireValid(statSync(source, { throwIfNoEntry: false })?.isFile(), `Missing entry HTML: ${snippet.id}`);
  const preview = resolve(root, snippet.previewSrc || '');
  requireValid(preview !== source && preview.startsWith(folder + sep) && extname(preview) === '.html', `Expected a separate static preview: ${snippet.id}`);
  requireValid(statSync(preview, { throwIfNoEntry: false })?.isFile(), `Missing preview HTML: ${snippet.id}`);
  requireValid(!/<script\b|\son\w+\s*=/i.test(readFileSync(preview, 'utf8')), `Preview must not contain scripts or event handlers: ${snippet.id}`);
  for (const path of filesIn(folder)) {
    if (!['.html', '.css'].includes(extname(path))) continue;
    const content = readFileSync(path, 'utf8');
    const markup = content.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
    const css = extname(path) === '.css' ? content : [...markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
    for (const match of markup.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) localFile(match[1], dirname(path), folder);
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) localFile(match[1], dirname(path), folder);
    for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc\s*=|\btype\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1])) {
        new Script(match[2], { filename: relative(root, path) });
      }
    }
  }
}
console.log(`Validated ${snippets.length} weirdo${snippets.length === 1 ? '' : 's'}.`);
