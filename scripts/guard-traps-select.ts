/**
 * GUARD-TRAPS TARGETED RUNS — the selector, the ledger and the control hash.
 *
 * EXPECTED.md "GUARD-TRAPS TARGETED RUNS" (Jon, 2026-09-10; built 2026-09-15).
 * The harness (`guard-traps.ts`) owns planting and judging; this file only
 * decides WHICH traps a targeted run executes, and remembers what ran.
 *
 * ANCHORS ARE LOCATED BY EXECUTION, NOT BY READING THE TRAP'S TEXT. Each trap's
 * mutate() is applied to the target's current text and the result is diffed
 * line by line against the original: the lines that differ ARE the anchor's
 * span. The 1919 costing parsed anchors out of source text and could not read
 * 16-17 of them per session; executing the mutation has no such class, because
 * it finds exactly what a real plant would change.
 *
 * A TRAP IS SELECTED when (EXPECTED clause 1):
 *   hunk          its span intersects a hunk of `git diff -U2 BASE -- <target>`
 *                 (two lines of context; BASE against the working tree, so an
 *                 uncommitted change counts)
 *   spec-changed  its target spec is in `git diff --name-only BASE`
 *   added/edited  its registry entry is new since BASE, or its text hash
 *                 (comment lines excluded) differs from BASE's
 *   anchor-moved  its span's text differs from the span the ledger recorded
 *                 at its last run (a pure line-number shift is NOT a move)
 *   anchor-missing / mutate-threw
 *                 the mutation plants nothing or throws on today's text — the
 *                 harness will report it INCONCLUSIVE / CRASHED, so it runs
 * plus a ROTATION of the N oldest `lastRunDate` in the ledger not already
 * selected (never-run traps are oldest).
 *
 * BATCHING IS NOT BUILT (clause 5): two mutations in one file can mask each
 * other, and 1206's traps 229/232 CRASHED on exactly that shape.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';

export type Span = { start: number; end: number; textHash: string };
export type LedgerTrap = { lastRunHash: string; lastRunDate: string; lastState: string; anchorSpan: Span | null };
export type Ledger = {
  version: 1;
  lastFullRun: { hash: string; date: string; caught: number; total: number } | null;
  control: { hash: string; date: string } | null;
  traps: Record<string, LedgerTrap>;
};
export type TrapIn = {
  num: string; id: string; file: string; spec: string;
  mutate: (s: string) => string;
  /** Precomputed location (historical measurement only); otherwise mutate() is executed. */
  span?: Span | 'missing' | 'threw';
};
export type Picked = { num: string; reasons: string[]; span: Span | null; file: string; spec: string };
export type Selection = {
  targeted: Map<string, Picked>; rotation: string[]; run: Set<string>;
  changedFiles: string[]; notRun: number; total: number;
};

const MAXBUF = 512 * 1024 * 1024;
const sha = (alg: string, s: string | Buffer) => createHash(alg).update(s).digest('hex');

function git(args: string[], okCodes: number[] = [0]): string {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: MAXBUF });
  if (!okCodes.includes(r.status ?? -1)) {
    throw new Error(`git ${args.join(' ')} exited ${r.status}: ${(r.stderr || '').trim()}`);
  }
  return r.stdout;
}
/** `git show rev:file`, or null when the file did not exist at rev. */
export function showAt(rev: string, file: string): string | null {
  const r = spawnSync('git', ['show', `${rev}:${file}`], { encoding: 'utf8', maxBuffer: MAXBUF });
  return r.status === 0 ? r.stdout : null;
}
export function verifyRev(rev: string): string {
  return git(['rev-parse', '--short', '--verify', `${rev}^{commit}`]).trim();
}

/** HEAD's short hash, suffixed `+dirty` when tracked files differ — the ledger itself excepted. */
export function headHash(ledgerPath: string): string {
  const h = git(['rev-parse', '--short', 'HEAD']).trim();
  const norm = ledgerPath.replace(/\\/g, '/');
  const dirty = git(['status', '--porcelain', '--untracked-files=no']).split(/\r?\n/)
    .filter(l => l.trim() && !l.replace(/\\/g, '/').endsWith(norm)).length > 0;
  return dirty ? `${h}+dirty` : h;
}

export function readLedger(p: string): Ledger {
  if (!fs.existsSync(p)) return { version: 1, lastFullRun: null, control: null, traps: {} };
  const l = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { version: 1, lastFullRun: l.lastFullRun ?? null, control: l.control ?? null, traps: l.traps ?? {} };
}
/** Stable on disk: traps sorted by number, so a run's ledger diff reads as what ran. */
export function writeLedger(p: string, l: Ledger): void {
  const nums = Object.keys(l.traps).sort((a, b) => (parseInt(a, 10) - parseInt(b, 10)) || a.localeCompare(b));
  const traps: Record<string, LedgerTrap> = {};
  for (const n of nums) traps[n] = l.traps[n];
  fs.writeFileSync(p, JSON.stringify({ version: 1, lastFullRun: l.lastFullRun, control: l.control, traps }, null, 2) + '\n');
}

/** Where a trap's mutation lands in `text` (LF), found by EXECUTING it. */
export function spanOf(mutate: (s: string) => string, text: string): Span | 'missing' | 'threw' {
  let m: string;
  try { m = mutate(text); } catch { return 'threw'; }
  if (m === text) return 'missing';
  const a = text.split('\n'), b = m.split('\n');
  const min = Math.min(a.length, b.length);
  let p = 0;
  while (p < min && a[p] === b[p]) p++;
  let s = 0;
  while (s < min - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  let start = p + 1, end = a.length - s;
  if (end < start) end = start;          // a pure insertion: the line it lands at
  start = Math.min(start, a.length); end = Math.min(end, a.length);
  return { start, end, textHash: sha('sha1', a.slice(start - 1, end).join('\n')).slice(0, 16) };
}

/** New-side line ranges of every hunk (context included). */
export function parseHunks(diff: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const c = Number(m[1]), d = m[2] === undefined ? 1 : Number(m[2]);
    out.push([Math.max(1, c), Math.max(Math.max(1, c), c + d - 1)]);
  }
  return out;
}

function hunksFor(base: string, head: string | undefined, file: string, scratch: Map<string, string>): [number, number][] {
  if (scratch.has(file)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-sel-'));
    try {
      const baseFile = path.join(dir, 'base');
      fs.writeFileSync(baseFile, showAt(base, file) ?? '');
      return parseHunks(git(['diff', '--no-index', '-U2', '--no-color', baseFile, scratch.get(file)!], [0, 1]));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return parseHunks(git(['diff', '-U2', '--no-color', base, ...(head ? [head] : []), '--', file]));
}

/** Registry entry hashes by trap NUMBER, from harness source text. Comment lines are excluded. */
export function registryHashes(text: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!text) return out;
  const t = text.replace(/\r\n/g, '\n');
  const s = t.indexOf('const TRAPS: Trap[] = [');
  if (s < 0) return out;
  const e = t.indexOf('\n];', s);
  for (const part of t.slice(s, e < 0 ? undefined : e).split(/\n\s*\{ id: /).slice(1)) {
    const m = part.match(/^(['"`])(.*?)\1/);
    if (!m) continue;
    const num = m[2].trim().split(/\s/)[0];
    const body = part.split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.trimEnd()).join('\n');
    out.set(num, sha('sha1', body).slice(0, 16));
  }
  return out;
}

export function select(o: {
  traps: TrapIn[]; base: string; head?: string; ledger: Ledger; rotation: number;
  scratch: Map<string, string>; headText: (file: string) => string;
  harnessPath: string; harnessText: string;
}): Selection {
  const changedFiles = git(['diff', '--name-only', o.base, ...(o.head ? [o.head] : [])])
    .split(/\r?\n/).filter(Boolean);
  const changed = new Set(changedFiles);
  const baseReg = registryHashes(showAt(o.base, o.harnessPath));
  const curReg = registryHashes(o.harnessText);
  const hunks = new Map<string, [number, number][]>();
  const texts = new Map<string, string>();
  const targeted = new Map<string, Picked>();
  for (const t of o.traps) {
    const reasons: string[] = [];
    let sp = t.span;
    if (sp === undefined) {
      if (!texts.has(t.file)) texts.set(t.file, o.headText(t.file).replace(/\r\n/g, '\n'));
      sp = spanOf(t.mutate, texts.get(t.file)!);
    }
    let span: Span | null = null;
    if (sp === 'threw') reasons.push('mutate-threw');
    else if (sp === 'missing') reasons.push('anchor-missing');
    else {
      span = sp;
      if (!hunks.has(t.file)) hunks.set(t.file, hunksFor(o.base, o.head, t.file, o.scratch));
      if (hunks.get(t.file)!.some(([a, b]) => span!.start <= b && span!.end >= a)) {
        reasons.push(`hunk ${t.file}:${span.start}-${span.end}`);
      }
      const prev = o.ledger.traps[t.num]?.anchorSpan;
      if (prev && (prev.textHash !== span.textHash || prev.end - prev.start !== span.end - span.start)) {
        reasons.push('anchor-moved');
      }
    }
    if (changed.has(t.spec)) reasons.push('spec-changed');
    if (!baseReg.has(t.num)) reasons.push('added');
    else if (baseReg.get(t.num) !== curReg.get(t.num)) reasons.push('edited');
    if (reasons.length) targeted.set(t.num, { num: t.num, reasons, span, file: t.file, spec: t.spec });
  }
  const dateOf = (n: string) => o.ledger.traps[n]?.lastRunDate ?? '';
  const rotation = o.traps.filter(t => !targeted.has(t.num))
    .sort((a, b) => dateOf(a.num).localeCompare(dateOf(b.num)) || (parseInt(a.num, 10) - parseInt(b.num, 10)))
    .slice(0, Math.max(0, o.rotation)).map(t => t.num);
  const run = new Set([...targeted.keys(), ...rotation]);
  return { targeted, rotation, run, changedFiles, notRun: o.traps.length - run.size, total: o.traps.length };
}

export function printSelection(sel: Selection, base: string, source: string, head: string, ledger: Ledger): void {
  console.log(`\n[select] BASE ${base} (${source}) -> ${head}; ${sel.changedFiles.length} changed file(s)`);
  for (const p of sel.targeted.values()) console.log(`[select] ${p.num.padEnd(4)} ${p.reasons.join(', ')}  ->  ${p.spec}`);
  console.log(`[select] rotation ${sel.rotation.length}: ${sel.rotation.map(n => `${n}@${(ledger.traps[n]?.lastRunDate ?? 'never').slice(0, 16)}`).join(' ') || '-'}`);
  console.log(`[select] targeted ${sel.targeted.size}, rotation ${sel.rotation.length}, NOT RUN ${sel.notRun} of ${sel.total}`);
}

/**
 * THE CONTROL CACHE KEY (clause 3): sha256 over the control spec files, every
 * TARGET file, the harness files (sorted by path) and the registry text.
 * A `scratch` substitution is honoured so the decision can be shown without
 * touching a tracked file. It does NOT cover modules a control spec imports
 * that are not TARGETS — the scope clause 3 names.
 */
export function controlHash(files: string[], registryText: string, scratch: Map<string, string>): string {
  const h = createHash('sha256');
  for (const f of [...new Set(files)].sort()) {
    h.update(f + ' ');
    h.update(scratch.has(f) ? fs.readFileSync(scratch.get(f)!) : fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from('<missing>'));
    h.update(' ');
  }
  h.update(registryText);
  return h.digest('hex');
}
