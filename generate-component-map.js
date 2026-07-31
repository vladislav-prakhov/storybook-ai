#!/usr/bin/env node
/**
 * generate-component-map.js
 *
 * Scans a components directory (default: src/components) and writes a
 * compact markdown checklist of each component's structure:
 *   - index.tsx
 *   - types.ts
 *   - __stories__/<name>.stories.tsx
 *   - __stories__/generated/<name>.generated.stories.tsx
 *
 * Intended as a small, machine-readable reference for a coding agent
 * (e.g. to spot which components are missing stories).
 *
 * Requires: Node 22+, no dependencies (plain `fs`/`path`).
 *
 * Usage:
 *   node generate-component-map.js [componentsDir] [outputFile]
 *
 * Defaults:
 *   componentsDir = ./src/components
 *   outputFile    = ./components-map.md
 */

const fs = require('fs');
const path = require('path');

const componentsDir = path.resolve(process.argv[2] || 'src/components');
const outputFile = path.resolve(process.argv[3] || 'components-map.md');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function mark(bool) {
  return bool ? '✅' : '❌';
}

// Expected layout per component folder:
//   src/components/<name>/
//     index.tsx
//     types.ts
//     __stories__/
//       <name>.stories.tsx
//       generated/
//         <name>.generated.stories.tsx
function scanComponent(name, dir) {
  const storiesDir = path.join(dir, '__stories__');
  const storiesFile = path.join(storiesDir, `${name}.stories.tsx`);
  const generatedDir = path.join(storiesDir, 'generated');
  const generatedFile = path.join(generatedDir, `${name}.generated.stories.tsx`);
  const typesFile = path.join(dir, 'types.ts');
  const indexFile = path.join(dir, 'index.tsx');

  return {
    name,
    hasIndex: exists(indexFile),
    hasTypes: exists(typesFile),
    hasStoriesDir: isDir(storiesDir),
    hasStoriesFile: exists(storiesFile),
    hasGeneratedDir: isDir(generatedDir),
    hasGeneratedFile: exists(generatedFile),
  };
}

function main() {
  if (!isDir(componentsDir)) {
    console.error(`Not a directory: ${componentsDir}`);
    process.exit(1);
  }

  const entries = fs
    .readdirSync(componentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const rows = entries.map((name) => scanComponent(name, path.join(componentsDir, name)));

  const lines = [];
  lines.push('# Component structure map');
  lines.push('');
  lines.push(`Source: \`${path.relative(process.cwd(), componentsDir)}\` — ${rows.length} components.`);
  lines.push('');
  lines.push('✅ = present, ❌ = missing');
  lines.push('');
  lines.push('| Component | index.tsx | types.ts | __stories__ | stories.tsx | generated/ | generated.stories.tsx |');
  lines.push('|---|---|---|---|---|---|---|');

  for (const r of rows) {
    lines.push(
      `| ${r.name} | ${mark(r.hasIndex)} | ${mark(r.hasTypes)} | ${mark(r.hasStoriesDir)} | ${mark(
        r.hasStoriesFile
      )} | ${mark(r.hasGeneratedDir)} | ${mark(r.hasGeneratedFile)} |`
    );
  }

  fs.writeFileSync(outputFile, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${rows.length} components to ${outputFile}`);
}

main();