/**
 * EVERY TRAP'S ANCHOR OCCURS EXACTLY ONCE IN ITS TARGET FILE.
 *
 *   npm run spec:trap-anchors
 *
 * WHY THIS EXISTS. A mutation trap is coupled to the source text of the line it
 * guards. Edit that line and the anchor stops matching: the trap plants nothing
 * and the spec it protects stays green, so the run ends with a trap that guards
 * nothing and says nothing. THREE aged out in three days —
 *
 *   trap 13   `resolveFromStore`'s return grew a field
 *   trap 115  the base term's `naturalVolume` changed shape
 *   trap 123  `autoBalanceMix` gained a parameter
 *
 * — and every one was on code the session was actively changing, broken by the
 * session least likely to be thinking about it.
 *
 * All three were caught only because the harness reports INCONCLUSIVE as a
 * state distinct from CAUGHT. That is a good design and a late one: it fires
 * during the most expensive run in the gate, after the mutation has been
 * attempted. This turns the same fact into a named failing check that costs a
 * file read, and it says WHICH trap and WHICH file.
 *
 * TWO OCCURRENCES IS ALSO A FAILURE, not only zero. `String.replace(string, …)`
 * replaces the FIRST match, so an anchor that appears twice plants somewhere
 * the trap's author did not choose — and the trap then guards the wrong line
 * while looking perfectly healthy. Trap 130's anchor was made unique by hand
 * for exactly this reason; this is that check, generalised.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => { if (c) pass++; else fails.push(n + (d ? `  [${d}]` : '')); };

type Dumped = { id: string; file: string; anchors: string[] };

// The registry, read from the harness itself rather than re-declared here. A
// copy of the trap list in this file would be one more thing to drift.
const raw = execFileSync('npx', ['tsx', 'scripts/guard-traps.ts'], {
  encoding: 'utf8',
  env: { ...process.env, TRAP_ANCHORS: '1' },
  shell: process.platform === 'win32',
  maxBuffer: 64 * 1024 * 1024,
});

let traps: Dumped[] = [];
try {
  traps = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
} catch {
  check('the trap registry dumped readable JSON', false, raw.slice(0, 200));
}

// A VACUOUS RUN IS THE FAILURE THIS CHECK IS MOST EXPOSED TO. If the dump
// returned nothing, every per-trap assertion below would be skipped and the
// spec would report a clean pass over zero traps.
check('the registry is non-empty', traps.length > 0, `${traps.length} traps`);
check('the registry has the expected order of magnitude', traps.length > 100,
  `${traps.length} — a sudden collapse means the dump broke, not that traps were deleted`);

const cache = new Map<string, string>();
const readLF = (f: string) => {
  if (!cache.has(f)) cache.set(f, fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  return cache.get(f)!;
};

/**
 * THE SIX ANCHORS THAT ARE NOT UNIQUE TODAY — recorded, not exempted.
 *
 * Each occurs 2-3 times in its file, so `replace()` plants at the FIRST match.
 * All six are CAUGHT by the harness today, so they plant somewhere effective;
 * what they cannot prove is that they plant where their author intended, and a
 * line inserted above any of them would move the trap silently.
 *
 * They are recorded rather than fixed because fixing them is anchor surgery on
 * six traps across three files, and doing it under time pressure is how trap 22
 * got broken and reverted inside this very session. It is its own brief.
 *
 * THE COUNT IS EXACT IN BOTH DIRECTIONS. A seventh fails here — which is the
 * whole point, since new rot is what this spec exists to catch. And FIXING one
 * also fails, forcing this list to be updated rather than letting it quietly
 * describe a state that no longer exists. An allowlist that can only grow is
 * the "exemption wired to nothing" this project has already paid for once.
 */
const KNOWN_NON_UNIQUE = new Set([
  '22 the cohort-months label loses its grain',
  '24 the blocked state collapses into covered',
  '26 the error banner survives a selection change',
  '51 a restored session drops its saved historical months',
  '102 the churn add falls behind the spread gate',
  '124 the forecastType identifier is translated',
]);
const seenNonUnique = new Set<string>();

let checkedAnchors = 0;
for (const t of traps) {
  // A trap whose mutate never called .replace with a string has no anchor this
  // can check. That is reported, not skipped silently: an unreadable trap is as
  // unguarded as a stale one, and a spec that quietly ignores it is worse than
  // no spec because it looks like coverage.
  if (t.anchors.length === 0) {
    check(`trap ${t.id}: an anchor could be recovered`, false,
      'mutate never called .replace with a string literal');
    continue;
  }
  const body = readLF(t.file);
  t.anchors.forEach((a, i) => {
    checkedAnchors++;
    const n = body.split(a).length - 1;
    // ZERO is always a failure: the trap plants nothing and guards nothing.
    if (n === 0) {
      check(`trap ${t.id}: anchor ${i + 1} still matches ${t.file.split('/').pop()}`,
        false, 'ZERO — the anchor has aged out; the trap plants nothing');
      return;
    }
    if (n > 1 && KNOWN_NON_UNIQUE.has(t.id)) { seenNonUnique.add(t.id); pass++; return; }
    check(`trap ${t.id}: anchor ${i + 1} occurs EXACTLY once in ${t.file.split('/').pop()}`,
      n === 1,
      `${n} occurrences — replace() takes the first, so the trap plants at the wrong one`);
  });
}

// THE BASELINE IS EXACT IN BOTH DIRECTIONS — see KNOWN_NON_UNIQUE.
check('the recorded non-unique anchors are still exactly those recorded',
  seenNonUnique.size === KNOWN_NON_UNIQUE.size,
  `${seenNonUnique.size} of ${KNOWN_NON_UNIQUE.size} — if one was FIXED, remove it from the list`);

check('every trap contributed at least one checked anchor',
  checkedAnchors >= traps.length, `${checkedAnchors} anchors over ${traps.length} traps`);

console.log(String.fromCharCode(10) + 'trap-anchors spec: ' + pass + ' passed, ' + fails.length + ' failed'
  + '  (' + traps.length + ' traps, ' + checkedAnchors + ' anchors)');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
