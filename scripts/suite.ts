/**
 * THE COMMITTED SUITE RUNNER.
 *
 *   npm run suite
 *
 * WHY THIS EXISTS. "58/58 specs" has been reported in every gate block for
 * weeks, and until now it was produced by an ad-hoc `node -e` one-liner typed
 * fresh each session. A figure that is recomputed by a different instrument
 * every time is not a measurement, it is a habit — and the instrument was
 * never committed, so nothing could go wrong with it visibly. From now on the
 * "full suite" figure in a report is whatever THIS prints.
 *
 * SERIALLY, AND THAT IS NOT A PERFORMANCE CHOICE. Several specs mount JSDOM
 * and assign to globals; two of them running at once would share a document.
 * guard-traps additionally MUTATES TRACKED SOURCE, which is why it is a
 * separate step and is deliberately NOT run from here: a suite that could
 * interleave with it would be reading files mid-plant.
 *
 * THREE STATES, NOT TWO — the lesson guard-traps learned as CRASHED. A spec
 * that dies before it reports is not a spec that failed: it is a spec that
 * said nothing, and a runner keying only on exit code cannot tell those apart.
 * So each run is required to print a terminal report line, and one that does
 * not is CRASHED however it exited.
 *
 * THE SENTINEL ACCEPTS TWO SHAPES, because the suite genuinely has two:
 * most specs end `<name> spec: N passed, M failed` or `N/N passed`, while
 * `spec:i18n-scan` ends with a `PASS:` / `FAIL:` paragraph. Both were measured
 * rather than assumed; a third shape appearing will read as CRASHED and say so
 * rather than being quietly accepted by a looser pattern.
 *
 * Captures go to the OS temp directory, not the repo — a run that left 58
 * files in the tree would hide genuinely unexpected entries in `git status`.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type State = 'GREEN' | 'FAILED' | 'CRASHED';

/** A terminal report line, in either shape the suite actually uses. */
const REPORT_LINE = /(^|\n)[^\n]*\sspec:[^\n]*\bpassed\b|(^|\n)\s*(?:PASS|FAIL):/;

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const specs: string[] = Object.keys(pkg.scripts)
  .filter(k => k.startsWith('spec:'))
  .sort();

const outDir = path.join(os.tmpdir(), 'prospect-suite');
fs.mkdirSync(outDir, { recursive: true });

const results: { spec: string; state: State; status: number | null; file: string }[] = [];

for (const spec of specs) {
  const r = spawnSync('npm', ['run', '-s', spec], {
    encoding: 'utf8', shell: process.platform === 'win32',
  });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const file = path.join(outDir, spec.replace(/[:/\\]/g, '_') + '.txt');
  fs.writeFileSync(file, out);
  const reported = REPORT_LINE.test(out);
  const state: State = !reported ? 'CRASHED' : r.status === 0 ? 'GREEN' : 'FAILED';
  results.push({ spec, state, status: r.status, file });
  console.log(`[${state.padEnd(7)}] ${spec}`);
}

console.log('\nSUITE\n' + '='.repeat(72));
const green = results.filter(r => r.state === 'GREEN');
const bad = results.filter(r => r.state !== 'GREEN');
for (const b of bad) {
  console.log(`  ${b.state}  ${b.spec}  (exit ${b.status})  ->  ${b.file}`);
}
console.log(`${green.length}/${results.length} green`);
if (bad.length) {
  console.log('A CRASHED spec printed no terminal report line: it did not fail,');
  console.log('it said nothing, and the repair is an assertion rather than a fix.');
}
console.log(`captures: ${outDir}`);
process.exit(bad.length ? 1 : 0);
