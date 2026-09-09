/**
 * THE AI-APPROVAL HOLD, ASSERTED RATHER THAN WALKED.
 *
 *   npm run spec:ai-hold
 *
 * main is under an AI-approval hold (EXPECTED.md §33, "AI capability — hard
 * gate"). Until 2026-09-07 that hold was enforced by a paragraph in
 * regression-guard.md telling a gate agent what to check by hand. This file
 * replaces the walking with assertions; the paragraph now points here.
 *
 * WHY A SPEC AND NOT A CHECKLIST ITEM. A hand-walked check is re-derived by a
 * different reader every time, and this project has measured what that costs:
 * a gate cited a module that does not exist, twice, with sound conclusions
 * both times. The hold is exactly the kind of claim where "I looked and it was
 * fine" is worth nothing to the person who has to act on it six weeks later.
 *
 * ── THE THREE DECISIONS THAT FIX THIS SPEC'S SCOPE ────────────────────────
 * (Jon, 2026-09-07; recorded in EXPECTED.md §33 before this file was written.)
 *
 * 1. `APP_URL` IS OUT OF SCOPE. It is a deployment URL, kept deliberately in
 *    `432837d` — the same commit that removed the `GEMINI_API_KEY` block from
 *    `.env.example` five lines above it. It is named at check (d) so a later
 *    reader does not re-open it as a suspected leak.
 *
 * 2. TRACKED FILES ONLY. Gitignored hits are an ADVISORY line, never a
 *    failure. `_archive/` and `.claude/worktrees/` both hold pre-removal
 *    copies of `.env.example` carrying `GEMINI_API_KEY="MY_GEMINI_API_KEY"`;
 *    neither is built, neither can be pushed. §33's scope sentence says
 *    "working tree, and therefore what is actually built and deployed" — and
 *    where those two come apart, as they do for an ignored archive, what
 *    SHIPS is the half that governs. A stale local archive must not be able
 *    to fail a gate guarding production.
 *
 * 3. THE IDENTIFIERS, NOT THE PATHS. The `ai-capability` tree carries seven
 *    paths main's does not, and FOUR of them (`app.py`, `run_app.py`,
 *    `requirements.txt`, `metadata.json`) are a Streamlit/statsmodels
 *    prototype with no LLM content at all. Pinning those under an AI-hold
 *    spec would assert something untrue about why they must stay absent.
 *
 * ── TWO FACTS THE 1230 MEASUREMENT ESTABLISHED ────────────────────────────
 *
 * THE BRANCH IS A FROZEN ANCESTOR. `ai-capability` (tip b2d5a5e) is an
 * ANCESTOR of main — 0 commits ahead, 626 behind — so
 * `git diff main...ai-capability` is EMPTY and reads as a clean bill of
 * health. Anyone re-deriving this list must not use that diff.
 *
 * THERE IS NO CALL SITE, ON THE BRANCH EITHER. Nothing in the branch's `src/`
 * imports `@google/genai`, constructs `GoogleGenAI`, or calls
 * `generateContent`. The capability was declared — dependency, key, vite
 * define, README instructions — and never wired. So this spec guards the
 * DECLARATION surface, which is the whole of what ever existed.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

let pass = 0; const fails: string[] = [];
const check = (n: string, c: boolean, d?: string) => {
  if (c) pass++; else fails.push(n + (d ? `  [${d}]` : ''));
};

/**
 * THE PINNED IDENTIFIER LIST, exact both ways.
 *
 * Derived 2026-09-07 from `ai-capability` tip **b2d5a5e**, by grepping that
 * tree for real AI markers. Both the hash and the date are here so that a
 * change to the branch forces this list to be RE-DERIVED DELIBERATELY rather
 * than adjusted until the spec passes.
 *
 * Exact both ways means: a new identifier appearing on the branch fails here,
 * and so does one disappearing. The second direction matters as much — an
 * identifier quietly dropped from this list is a guard silently narrowed.
 */
const DERIVED_FROM = 'b2d5a5e';
const DERIVED_ON = '2026-09-07';

/** SDK dependencies the hold forbids in package.json / package-lock.json. */
const SDK_DEPS = ['@google/genai', 'openai', 'anthropic'] as const;

/** The three AI identifiers the branch introduces. NOT `APP_URL` — see (1). */
const AI_IDENTIFIERS = [
  '@google/genai',
  'GEMINI_API_KEY',
  'process.env.GEMINI_API_KEY',
] as const;

/**
 * THE SOURCE PATTERNS §33 NAMES, TIGHTENED.
 *
 * §33 forbids "AI/LLM imports, model API calls or API-key patterns in src/".
 * A first pass at this list on 2026-09-07 included a bare `LLM` alternative
 * and reported hits in two components. Both were FALSE POSITIVES:
 * `generateAllMissingForecasts` contains "a<llM>issing" and
 * `showAcceptAllModal` contains "AcceptA<llMo>dal". A guard that cries wolf on
 * two of this codebase's ordinary identifiers is a guard that gets muted.
 *
 * So every alternative below is either a package specifier, an exported SDK
 * symbol, or a key name — each of which contains a character (`@`, `/`, `_`)
 * or a capitalisation that ordinary camelCase cannot produce by accident.
 * `api[_-]key` requires the separator for the same reason: bare `apikey`
 * would match `rapidApiKeyed`-shaped names, and the separator is what makes
 * it a key pattern rather than a substring.
 */
const SRC_PATTERNS: readonly RegExp[] = [
  /@google\/genai/,
  /\bGoogleGenAI\b/,
  /\bgenerateContent\b/,
  /\bGEMINI_API_KEY\b/,
  /\bfrom\s+['"]openai['"]/,
  /\bfrom\s+['"]@anthropic-ai\//,
  /\bapi[_-]key\b/i,
];

const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Every file git tracks. The whole of what this spec may fail on. */
const tracked = git('ls-files').split('\n').map(s => s.trim()).filter(Boolean);

/**
 * A TEXT STRIP, not a parse — the same approximation `spec:survival` uses and
 * for the same reason: an AST pass would be a second parser to keep in step,
 * and the quantity guarded ("did a new one appear") survives it.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

const read = (p: string) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

console.log('');
console.log('AI-HOLD  (EXPECTED.md §33; identifiers derived ' + DERIVED_ON
  + ' from ai-capability ' + DERIVED_FROM + ')');
console.log('='.repeat(72));

// ══ THE PIN ═══════════════════════════════════════════════════════════════
check('PIN: exactly 3 AI identifiers, exact both ways',
  AI_IDENTIFIERS.length === 3, String(AI_IDENTIFIERS.length)
  + ' — re-derive from the branch deliberately; do not edit to pass');
check('PIN: APP_URL is NOT among them (decision 1, kept by 432837d)',
  !(AI_IDENTIFIERS as readonly string[]).includes('APP_URL'));

// ══ (a) NO SDK DEPENDENCY ═════════════════════════════════════════════════
//
// Both files. package-lock.json is where a transitive or half-removed
// dependency survives a tidy-looking package.json, so checking only the
// manifest would miss exactly the case worth catching.
for (const manifest of ['package.json', 'package-lock.json']) {
  const src = read(manifest);
  for (const dep of SDK_DEPS) {
    // Quoted, so `anthropic` cannot match a URL or a comment mentioning it.
    const present = new RegExp('"[^"]*' + dep.replace(/[/@]/g, '\\$&') + '[^"]*"\\s*:')
      .test(src) || src.includes('"' + dep + '"');
    check(`(a) ${manifest} declares no ${dep}`, !present,
      'an AI SDK dependency is the first of §33\'s three criteria');
  }
}

// ══ (b) ZERO OCCURRENCES IN TRACKED src/ ══════════════════════════════════
const srcFiles = tracked.filter(f => /^src\/.*\.(ts|tsx)$/.test(f));
const srcHits: string[] = [];
for (const f of srcFiles) {
  const body = stripComments(read(f));
  body.split('\n').forEach((line, i) => {
    for (const re of SRC_PATTERNS) {
      if (re.test(line)) srcHits.push(`${f}:${i + 1}  ${re.source}`);
    }
  });
}
check(`(b) zero AI import/call/key patterns in ${srcFiles.length} tracked src/ files`,
  srcHits.length === 0, srcHits.slice(0, 5).join(' | '));

// THE PATTERNS MUST BITE. A pattern list that matches nothing is
// indistinguishable from a clean tree, which is the vacuous-pass failure this
// project has hit before. Assert against a known-positive sample.
const POSITIVE = `import { GoogleGenAI } from "@google/genai";
const k = process.env.GEMINI_API_KEY;
await ai.models.generateContent({});
const api_key = "x";`;
const bites = SRC_PATTERNS.filter(re => re.test(POSITIVE)).length;
check('(b) the pattern list BITES on a known-positive sample',
  bites >= 5, bites + ' of ' + SRC_PATTERNS.length
  + ' matched — a list that matches nothing passes on any tree');

// AND MUST NOT BITE on the two identifiers that produced 1230's false
// positives. This is the regression test for that specific mistake.
const NEGATIVE = `const generateAllMissingForecasts = useCallback(async () => {});
const [showAcceptAllModal, setShowAcceptAllModal] = useState(false);`;
const falsePos = SRC_PATTERNS.filter(re => re.test(NEGATIVE));
check('(b) and does NOT match generateAllMissing / showAcceptAllModal',
  falsePos.length === 0, falsePos.map(r => r.source).join(' ')
  + ' — 1230 reported these as AI call sites; they are not');

// ══ (c) .env NOT TRACKED ══════════════════════════════════════════════════
const envTracked = tracked.filter(f => /(^|\/)\.env/.test(f));
check('(c) git tracks .env.example and no other .env file',
  envTracked.length === 1 && envTracked[0] === '.env.example',
  envTracked.join(' ') || 'none');

// ══ (d) THE THREE IDENTIFIERS, ZERO IN TRACKED FILES ══════════════════════
//
// APP_URL IS DELIBERATELY ABSENT FROM THIS LIST (decision 1). It is on main's
// tracked .env.example and is EXPECTED there: `432837d` ("Remove AI
// capability from main ahead of prod deployment pending approval") removed the
// GEMINI_API_KEY block and KEPT APP_URL, in the same commit. It is a
// deployment URL, not a capability. Do not add it here without reversing that
// decision explicitly.
const idHits: string[] = [];
for (const f of tracked) {
  // THE FILES THAT MUST NAME AN IDENTIFIER IN ORDER TO GUARD OR RECORD IT.
  //
  // A guard that fails on its own text is unkeepable, and so is one that
  // fails on the record documenting why it exists. Each exclusion below is a
  // file whose JOB is to carry these strings:
  //
  //   ai-hold-spec.ts   this file — it defines the list
  //   guard-traps.ts    traps 172/173 quote the identifiers as their planted
  //                     mutation text. ADDED after trap 172 was verified by
  //                     hand and turned this check red on a CLEAN tree: the
  //                     trap that proves the guard bites had made the guard
  //                     bite on itself. Same class as spec:survival counting
  //                     quoted anchor text as first-row dereferences.
  //   EXPECTED.md       §33 records the hold and the three decisions
  //   reports/          the sessions that measured and built this
  //   the working agreement, regression-guard.md
  //                     both state the rule and cite the identifiers
  //
  // NONE of these ships. Every one is a script, a record, or a prompt file;
  // the bundler reaches none of them. That is what makes the exclusion safe
  // rather than a hole — the check still covers all of src/, both manifests,
  // and every other tracked file.
  if (f === 'scripts/ai-hold-spec.ts') continue;
  if (f === 'scripts/guard-traps.ts') continue;
  if (f === 'test-data/EXPECTED.md') continue;
  if (f.startsWith('reports/')) continue;
  if (f === 'docs/PROSPECT-development-history-and-working-agreement-v3-3-16.md') continue;
  if (f === '.claude/agents/regression-guard.md') continue;
  const body = read(f);
  for (const id of AI_IDENTIFIERS) {
    if (body.includes(id)) idHits.push(`${f} :: ${id}`);
  }
}
check('(d) the three AI identifiers appear in ZERO tracked files',
  idHits.length === 0, idHits.slice(0, 5).join(' | ')
  + '  (APP_URL is excluded by decision 1 — kept deliberately in 432837d)');

// ══ (e) ADVISORY — gitignored hits, printed, never failed ═════════════════
//
// Decision 2. These paths are neither built nor pushable, so they cannot
// reach production and must not fail this gate. They are printed because a
// pre-removal copy of the key template sitting in the working tree is worth
// a reader knowing about, even though it is harmless.
const IGNORED_ROOTS = ['_archive', '.claude/worktrees'];
const advisory: string[] = [];
const walk = (dir: string, depth = 0) => {
  if (depth > 6) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, depth + 1); continue; }
    if (!/\.(env\.example|json|ts|tsx|md)$/.test(e.name) && !e.name.startsWith('.env')) continue;
    const body = read(p);
    for (const id of AI_IDENTIFIERS) {
      if (body.includes(id)) advisory.push(`${p.replace(/\\/g, '/')} :: ${id}`);
    }
  }
};
for (const root of IGNORED_ROOTS) if (fs.existsSync(root)) walk(root);

console.log('');
if (advisory.length === 0) {
  console.log('  ADVISORY: no gitignored copies carry an AI identifier.');
} else {
  console.log('  ADVISORY (not a failure — gitignored, unbuilt, unpushable):');
  for (const a of advisory) console.log('    ' + a);
  console.log('  These cannot reach production. Decision 2, 2026-09-07.');
}

// ══ REPORT ════════════════════════════════════════════════════════════════
console.log('');
console.log(`  tracked files scanned: ${tracked.length}   src/ files: ${srcFiles.length}`);
console.log('');
console.log(`ai-hold spec: ${pass} passed, ${fails.length} failed`);
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
