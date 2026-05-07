# In-progress workout sessions in Tablinum

**Date:** 2026-05-07
**Status:** Approved for implementation

## Context

Today, in-progress workout sessions are stored in `localStorage` under keys shaped like `gym-app-session-{sessionId}`. This caused a recent bug — after importing a backup, the Today page got stuck showing "Resume workout" with no way to dismiss because the localStorage state lived outside the imported snapshot. The user wants to fix the underlying class of bug *and* unlock cross-device handoff: start a workout on one device, continue on another. Tablinum has built-in sync (Nostr-relay-based, via `tablinum/svelte`), so promoting in-progress state into the same DB collection that holds completed sessions gives us reactive UI and free sync.

## Design decisions

| Decision | Choice |
|---|---|
| Schema | Add `status: 'in_progress' \| 'completed'` to the existing `sessions` collection (one record, full lifecycle). |
| Concurrency | One in-progress at a time; "Start workout" with an existing in-progress shows a confirm prompt (Discard + start fresh, or Resume). |
| Backup format | Export only `status === 'completed'` sessions. Import sweeps any local in-progress rows. |
| Migration of existing localStorage entries | One-shot on app boot, alongside the existing Dexie→Tablinum migration, guarded by a `gym-app-in-progress-migrated` flag. |
| Insertion timing | Eager — session row is inserted at session creation (in `session/new`), so cross-device sync works from the first moment. |
| Save cadence | Action-driven (unchanged). Per-second `sessionDuration` ticks do not trigger writes; duration is recomputed on read from `date`. |

## Schema change

`src/lib/db.ts`, `sessionsDef`:

```ts
const sessionsDef = collection('sessions', {
    exercises: field.array(sessionExerciseDef),
    date: field.string(),
    duration: field.number(),
    notes: field.optional(field.string()),
    createdAt: field.string(),
    status: field.string(),                              // NEW: 'in_progress' | 'completed'
    currentExerciseIndex: field.optional(field.number()),// NEW
    currentSetIndex: field.optional(field.number()),     // NEW
}, { indices: ['date', 'createdAt', 'status'] });        // add status to indices
```

`status` is required (not `optional`) so svelte-check forces every reader to be updated. The two cursor fields are optional because completed sessions don't need them.

For an in-progress session, `date` doubles as the start timestamp; `duration` is recomputed on read as `(now - date) / 60_000` rather than persisted (avoids stale values across sync). On finish, `duration` is written with the final value.

## Lifecycle and call sites

### Create — `src/routes/(public)/session/new/+page.ts`
Currently generates an id locally, optionally prefills `localStorage` from a routine, then redirects to `/session/{id}`. The `?from={completedSessionId}` "repeat" flow is currently handled inside `session/[id]/+page.svelte`'s load.

Change to: build the initial `sessionExercises` array (from routine via `?routine=`, from a completed session via `?from=`, or empty), then `add()` a row to `sessions` with `status: 'in_progress'`, `date` = now, `exercises` = built array, `duration: 0`, `createdAt` = now. Redirect to `/session/{returnedId}`. The `?from=` prefill logic moves *out* of `session/[id]` and into `session/new`, so `session/[id]` just loads whatever's in the row.

Note: Tablinum auto-generates ids on `add()`; we cannot preserve a caller-supplied id. The local-uuid generation in `session/new` is removed.

### Read/save — `src/routes/(public)/session/[id]/+page.svelte`
- `loadSessionProgress()` → read the row from Tablinum by id (instead of `localStorage.getItem`). If the row doesn't exist (e.g. stale URL), redirect to `/`.
- `saveSessionProgress()` → `db.collection('sessions').update(sessionId, {...})` with `exercises`, `currentExerciseIndex`, `currentSetIndex`, `notes`. Stays action-driven.
- `saveWorkout()` (finish, ~line 518) → `update(sessionId, { status: 'completed', duration, date })` instead of `add()` + localStorage delete.
- Exit confirm (~line 991) → revert to `goto('/')` only (no localStorage clear). Row stays in_progress; user resumes later. The "Discard" path lives on the Today-page hero (already added).
- The `?from=<completedSessionId>` branch in load is removed (now handled in `session/new`).

### Today page — `src/routes/(public)/+page.svelte`
- Replace the localStorage-scanning `$effect` with a `$derived` from the reactive Tablinum sessions collection: `inProgressSession = sessions.find(s => s.status === 'in_progress')`.
- `discardInProgressSession(sessionId)` → `db.collection('sessions').delete(sessionId)`.
- The `lastSession` / `sessionToday` / `daysSinceLast` derivations all need to filter by `status === 'completed'`.
- "Start workout" CTA: if an in-progress session exists, intercept and show a `ConfirmDialog`: *"You have a workout in progress. Discard it and start fresh, or resume?"* — Discard (delete row + navigate to `/session/new`) or Resume (navigate to `/session/{inProgressId}`).

### All other readers of `sessions`
Filter by `status === 'completed'`:
- History/list views
- Progress charts
- Stats and streak calculation (`calculateStreakDays`, `getLastWorkoutDate`)
- `calculatePersonalRecords`
- `backupUtils.ts` export

svelte-check will flag the missed sites because `status` is required.

### Backup — `src/lib/backupUtils.ts`
- Export: filter sessions by `status === 'completed'`.
- Import: imported sessions arrive with `status: 'completed'`. After the IDB writes, sweep any rows with `status === 'in_progress'` (replaces the localStorage sweep added in the previous fix). Keep the localStorage sweep too for one or two releases as a safety net for users on intermediate versions.

## Migration

`src/lib/migrateDexieToTablinum.ts` — add `migrateInProgressSessions(db)`:

1. Guard: return early if `localStorage.getItem('gym-app-in-progress-migrated')` is set.
2. Scan `localStorage` for keys starting with `gym-app-session-`. For each:
   - Parse the JSON; on parse failure, delete the key and continue.
   - `add()` to `sessions` (Tablinum will assign a fresh id):
     - `status: 'in_progress'`
     - `exercises: data.sessionExercises ?? []`
     - `date: new Date(data.sessionStartTime ?? Date.now()).toISOString()`
     - `duration: data.sessionDuration ?? 0`
     - `notes: data.sessionNotes`
     - `currentExerciseIndex: data.currentExerciseIndex`
     - `currentSetIndex: data.currentSetIndex`
     - `createdAt: new Date(data.sessionStartTime ?? Date.now()).toISOString()`
   - Delete the localStorage key.
3. After the loop completes successfully, set `localStorage.setItem('gym-app-in-progress-migrated', 'true')`.

The original sessionId (from the localStorage key) is discarded — Tablinum auto-generates a fresh id. This means any open `/session/{oldId}` browser tab that survives the upgrade will 404 (and our load handler redirects to `/`). In practice the user's path back into the workout is the Today page, which now reads the new row reactively, so this isn't a UX problem.

Wire into `hooks.client.ts` — call after `migrateFromDexieIfNeeded` and before `initializeExercises`. Order matters: Dexie→Tablinum must run first so the `sessions` collection exists in Tablinum.

The flag is set *after* the loop so a Tablinum insert failure leaves the localStorage entry intact and we retry on next boot.

## Tests

- **Unit:** `migrateInProgressSessions` — seed localStorage, run, assert a Tablinum row exists with the right exercises/start-time, assert localStorage is empty, assert flag is set, assert second invocation is a no-op. Cover the bad-JSON skip-and-delete path.
- **Reset:** `clearAppLocalState` already removes anything with `gym-app` prefix, so the new flag is covered. Verify in `reset.test.ts`.
- **Existing E2E** (`home.page.e2e.test.ts`): the Today-page resume detection now reads from Tablinum — update fixtures accordingly. The localStorage `clear()` in `beforeEach` continues to work since the migration flag is per-fresh-boot.
- **Backup utils:** add a test that import deletes any in-progress row.

## Verification (manual)

1. Cold install → fresh CTA. Start workout, complete a set, navigate home → Resume hero appears (now Tablinum-backed).
2. Discard on Today → row deleted, hero switches mode.
3. Exit (preserve) inside session → row stays in_progress; Today shows Resume.
4. Finish workout → row flips to completed; history shows it; Today shows "done today".
5. Migration: pre-populate localStorage with a `gym-app-session-{id}` entry, reload → a new Tablinum row appears (with a fresh Tablinum id) carrying the same exercises/cursor/start-time, localStorage is cleared, flag is set. Today page surfaces it as Resume.
6. Same-device new-session-with-existing → confirm dialog appears with Discard / Resume.
7. Cross-device sync: two profiles sharing a DB via invite — start in profile A, observe Resume hero appears in profile B within sync interval. Complete a set in B, observe the change reflected in A.
8. Import backup while an in-progress row exists locally → in-progress row removed; imported sessions arrive as completed; no stuck Resume.

## Out of scope

- Promoting other localStorage keys (PWA install dismiss, scan-handoff, invite bootstrap, migration flags) — already triaged separately and have legitimate non-Tablinum reasons.
- A list UI for multiple in-progress sessions (we picked single-in-progress with confirm).
- Conflict-resolution UI for concurrent multi-device edits to the same session row (Tablinum's last-write-wins is acceptable for this app's usage pattern).
