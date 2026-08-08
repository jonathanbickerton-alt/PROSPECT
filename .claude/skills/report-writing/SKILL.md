---
name: report-writing
description: Use when writing any session report, gate report, diagnosis, or verification report to reports/ — anything that will be uploaded to the advisor chat or read by someone who was not in the session. Covers the filename convention, the FOR ADVISOR block, and the command that sources the timestamp. Trigger on "write the report", "report per convention", "standard report format", or whenever a session is being closed out.
---

# Writing a report

A report that exists only in a chat transcript is not retrievable by anyone who
was not in the session, and is lost at compaction. Every report is a repo
artefact.

## 1. Source the timestamp — one command, never composed

Run this and use its output verbatim. Do not infer the time from context,
estimate it from how long the session felt, or carry it forward from an earlier
message.

```bash
date +"%Y-%m-%d %H:%M %z (UTC $(date -u +'%Y-%m-%d %H:%M'))"
```

For the filename's `HHMM`, from the same clock:

```bash
date +"%Y-%m-%d-%H%M"
```

<!-- Why one command for both parts: the offset and the UTC must come from the
     same read or they can disagree. And why the offset is carried at all —
     `date` on this machine reports the zone label `GMTST`, which is not a real
     abbreviation. The offset (+0100) is sound; the label is malformed, so a
     bare local time is ambiguous to a later reader.

     Why command-sourced at all: a stamp was once composed by hand. The Session H
     report is headed 21:34 and was written at about 13:56 — no timezone accounts
     for the gap. The conclusions in that report were sound, which is what makes
     it worth a rule: a plausible number in a header is not checkable by the
     person reading it, and the header outlives the transcript. -->

## 2. Filename

```
reports/<yyyy-mm-dd-HHMM>-<topic>.md
```

24-hour local time, so reports sort chronologically by name alone — filesystem
timestamps do not survive copying, archiving, or a fresh clone, and several
reports a day is normal. `<topic>` is lower-case kebab.

<!-- Three reports predate this convention (2026-08-05-b3-mix-panel-filterbar,
     2026-08-05-b3-walk-grading, 2026-08-05-session-b-merged). They are not
     templates; do not copy their shape. -->

## 3. The FOR ADVISOR block

**Structural exemplar: `reports/2026-08-08-1550-session-m-section-c-close.md`.**
Open it and match its shape.

It comes first, is titled `## FOR ADVISOR`, and its body is a fenced code block
(so it survives copy-paste into chat without markdown mangling). **Maximum 25
lines inside the fence.** It contains only:

1. `Generated: <yyyy-mm-dd HH:MM> <±hhmm> (UTC <yyyy-mm-dd HH:MM>)` — first line,
   from the command above.
2. The hash line. Two forms are in use, and they are not interchangeable:
   - `Certifies: <hash> (merge of <branch> at <hash>) — MERGED` when the session
     produced a merge, or `Certifies: none — HELD, <reason>` when it did not.
   - `Verified against: HEAD <hash>, branch <b>, tree CLEAN` for a read-only
     verification or diagnosis that certifies nothing.
   Either way it names **the commit the report's numbers were measured against**.
3. Findings — **one line each**.
4. Decisions needed from Jon or the advisor — **one line each**.
5. Current merge/hold state, as a single line.

Everything else follows below the block.

**The line cap is the point, not a formatting preference.** This block is read by
someone who was not in the session and will not read the rest. If a finding does
not fit on one line, the line states the finding and the detail goes below the
block — never a second line inside it.

## 4. What goes below

No fixed template, but the practised shape is: what changed and why, the
mechanism of anything found, what the gate measured, what was recorded rather
than fixed, and where the walk stands. Figures are re-measured and stated with
their instrument, never quoted from an earlier report.

## Checklist

- [ ] Timestamp read from the command, not composed
- [ ] Filename `reports/<yyyy-mm-dd-HHMM>-<topic>.md`
- [ ] FOR ADVISOR first, fenced, ≤25 lines
- [ ] `Generated:` line carries offset **and** UTC
- [ ] Hash line names what the numbers were measured against
- [ ] Findings and decisions one line each
- [ ] Merge/hold state stated
- [ ] Report committed
