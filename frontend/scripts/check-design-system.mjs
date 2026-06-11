#!/usr/bin/env node
/**
 * Design-system guardrail — runs in CI (no ESLint dependency; matches the
 * tsc + test + build pipeline). ERRORS fail the build; WARNINGS are advisory.
 *
 * Add rules here as the migration completes (e.g. promote the hand-rolled-dialog
 * warning to an error once admin/onboarding modals adopt <Modal>).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const EXT = ['.tsx', '.ts'];

// Fail the build — these patterns must stay at zero.
const ERRORS = [
  {
    id: 'no-gray-400-text',
    re: /text-gray-400/,
    msg: 'Use text-fg-subtle / text-fg-muted — gray-400 (~2.8:1) fails WCAG AA for text.',
  },
  {
    id: 'hand-rolled-dialog',
    re: /role="dialog"/,
    msg: 'Use the accessible <Modal> primitive (Radix: focus-trap + Escape).',
    // Modal itself is built on Radix; the notification bell is a popover, not a dialog.
    skipFile: f => f.endsWith('components/ui/Modal.tsx') || f.endsWith('components/NotificationBell.tsx'),
  },
];

// Advisory only — surfaced but non-blocking.
const WARNINGS = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (EXT.some(e => p.endsWith(e)) && !p.endsWith('.test.tsx') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

let errors = 0;
let warnings = 0;

for (const file of walk(SRC)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const r of ERRORS) {
      if (r.skipFile?.(rel)) continue;
      if (r.re.test(line)) { console.error(`ERROR ${rel}:${i + 1}  [${r.id}] ${r.msg}`); errors++; }
    }
    for (const r of WARNINGS) {
      if (r.skipFile?.(rel)) continue;
      if (r.re.test(line)) { console.warn(`warn  ${rel}:${i + 1}  [${r.id}] ${r.msg}`); warnings++; }
    }
  });
}

console.log(`\nDesign-system check: ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) {
  console.error('Design-system check failed.');
  process.exit(1);
}
