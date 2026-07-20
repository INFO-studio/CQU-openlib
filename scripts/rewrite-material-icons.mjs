import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../public/doc');

const MAP = {
  'material-account': 'l-user',
  'material-arrow-left': 'l-arrow-left',
  'material-arrow-right': 'l-arrow-right',
  'material-arrow-up-circle': 'l-circle-arrow-up',
  'material-book': 'l-book',
  'material-calendar': 'l-calendar',
  'material-comment-text': 'l-message-square-text',
  'material-domain': 'l-building-2',
  'material-emoticon-sad-outline': 'l-frown',
  'material-file-document': 'l-file-text',
  'material-form-select': 'l-list-checks',
  'material-format-quote-open': 'l-quote',
  'material-printer': 'l-printer',
  'material-tag': 'l-tag',
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

let changedFiles = 0;
let replacements = 0;

for (const file of walk(ROOT)) {
  let text = readFileSync(file, 'utf8');
  let next = text;
  for (const [from, to] of Object.entries(MAP)) {
    const re = new RegExp(`:${from}:`, 'g');
    const matches = next.match(re);
    if (matches) replacements += matches.length;
    next = next.replace(re, `:${to}:`);
  }
  if (next !== text) {
    writeFileSync(file, next);
    changedFiles += 1;
  }
}

console.log(
  `Rewrote ${replacements} icon tokens across ${changedFiles} files under public/doc`,
);
