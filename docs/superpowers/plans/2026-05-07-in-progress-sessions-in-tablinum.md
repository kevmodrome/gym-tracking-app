# In-progress sessions in Tablinum — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move in-progress workout state out of `localStorage` and into the Tablinum `sessions` collection (with a new `status` field), so the data syncs across devices and is not lost on backup import.

**Architecture:** Add `status: 'in_progress' | 'completed'` to the existing `sessions` collection. The session row is created in Tablinum at "Start workout" time (status='in_progress') and transitions to status='completed' on finish. The Today page derives the resume state from the reactive Tablinum collection. All readers of completed-history (PRs, history list, charts, backup export) get a `status === 'completed'` filter. A one-shot boot-time migration ports any existing `gym-app-session-*` localStorage entries into Tablinum rows and clears the keys.

**Tech Stack:** SvelteKit (runes), Svelte 5, Tablinum 0.7 (`tablinum/svelte`), Vitest + fake-indexeddb, Tailwind, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-05-07-in-progress-sessions-in-tablinum-design.md`

---

## Task 1: Schema — add `status` and cursor fields

**Files:**
- Modify: `src/lib/db.ts:64-70`

The session collection definition gets `status` (required string) plus optional cursor fields. After this task, `pnpm check` will fail at every existing creator/reader because `status` is now a required field. We fix those in Task 2.

- [ ] **Step 1: Update `sessionsDef` in `src/lib/db.ts`**

Replace the `sessionsDef` block (currently at lines 64-70):

```ts
const sessionsDef = collection('sessions', {
    exercises: field.array(sessionExerciseDef),
    date: field.string(),
    duration: field.number(),
    notes: field.optional(field.string()),
    createdAt: field.string(),
    status: field.string(),
    currentExerciseIndex: field.optional(field.number()),
    currentSetIndex: field.optional(field.number()),
}, { indices: ['date', 'createdAt', 'status'] });
```

- [ ] **Step 2: Run typecheck — expect failures**

Run: `pnpm check 2>&1 | tail -30`
Expected: Errors at every `db.collection('sessions').add(...)` call site (it's missing the now-required `status` field). Note these locations — Task 2 fixes them all.

- [ ] **Step 3: Do NOT commit yet**

The codebase doesn't compile in isolation. Combine with Task 2's commit.

---

## Task 2: Tag every existing session writer with `status: 'completed'`

**Files:**
- Modify: `src/routes/(public)/session/[id]/+page.svelte:509-515`
- Modify: `src/lib/migrateDexieToTablinum.ts:65`
- Modify: `src/lib/backupUtils.ts:395,399`
- Modify: `src/routes/(public)/progress/activity/+page.svelte:266`

Every `db.collection('sessions').add(...)` and `update(...)` that creates a session today is creating a *completed* one. Tag them. After this commit the codebase compiles again and behavior is unchanged.

- [ ] **Step 1: `src/routes/(public)/session/[id]/+page.svelte` — `completeSession()`**

Inside the `add` payload (around line 509), include `status: 'completed'`:

```ts
await db.collection('sessions').add({
    exercises: $state.snapshot(session.exercises),
    date: session.date,
    duration: session.duration,
    notes: session.notes,
    createdAt: session.createdAt,
    status: 'completed',
});
```

- [ ] **Step 2: `src/lib/migrateDexieToTablinum.ts` — Dexie migration**

Around line 65, the existing `db.collection('sessions').add(data)` migrates legacy completed sessions. Tag them:

```ts
await db.collection('sessions').add({ ...data, status: 'completed' });
```

- [ ] **Step 3: `src/lib/backupUtils.ts` — import handler**

Inside `importBackupData`, around line 395 (`update`) and 399 (`add`), include `status: 'completed'` in `cleanData` before the call. The cleanest spot is where `cleanData` is built (look for `const cleanData = { ... }` upstream of these lines, around line 380); just spread `status: 'completed'` into the object.

- [ ] **Step 4: `src/routes/(public)/progress/activity/+page.svelte` — manual entry**

Around line 266 there's a `db.collection('sessions').add({...})` for adding a session manually. Add `status: 'completed'`.

- [ ] **Step 5: Run typecheck — expect zero errors**

Run: `pnpm check 2>&1 | tail -10`
Expected: `0 ERRORS`. If any remain, they are session writers we missed — add `status: 'completed'` and re-run.

- [ ] **Step 6: Run tests**

Run: `pnpm test:run 2>&1 | tail -30`
Expected: All pass. (If any test creates a session via raw Tablinum, it needs the status field too — fix and re-run.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/routes/\(public\)/session/\[id\]/+page.svelte src/lib/migrateDexieToTablinum.ts src/lib/backupUtils.ts src/routes/\(public\)/progress/activity/+page.svelte
git commit -m "feat(sessions): add status field to sessions schema

Tags every existing session writer with status: 'completed'.
Lays the groundwork for storing in-progress sessions in Tablinum."
```

---

## Task 3: Filter completed-only readers by `status === 'completed'`

**Files:**
- Modify: `src/lib/prUtils.ts:5,67`
- Modify: `src/lib/dashboardMetrics.ts` (find `db.collection('sessions')` reads)
- Modify: `src/lib/backupUtils.ts:62` (export)
- Modify: `src/routes/(public)/+page.svelte:13` (today page)
- Modify: `src/routes/(public)/+layout.svelte:38`
- Modify: `src/routes/(public)/train/+page.svelte:10`
- Modify: `src/routes/(public)/exercises/[id]/+page.svelte:33`
- Modify: `src/routes/(public)/progress/records/+page.svelte:12`
- Modify: `src/routes/(public)/progress/activity/+page.svelte:47`
- Modify: `src/routes/(public)/session/[id]/+page.svelte:415` (`priorSessions` filter)

These consumers want only finished workouts. With nothing in_progress yet (we haven't started writing them), this is a no-op behaviorally — but it's the precondition that lets us safely begin writing in_progress rows in Task 5+.

- [ ] **Step 1: `src/lib/prUtils.ts`**

In `calculatePersonalRecords` (line 5) and `getPRHistoryForExercise` (line 67), after fetching `const sessions = await db.collection('sessions').get();`, immediately narrow:

```ts
const sessions = (await db.collection('sessions').get() as Session[])
    .filter((s) => s.status === 'completed');
```

(`Session` type may need `status` added — see Step 2.)

- [ ] **Step 2: `src/lib/types.ts` — extend Session type**

Open `src/lib/types.ts`. Find the `Session` interface. Add:

```ts
status: 'in_progress' | 'completed';
currentExerciseIndex?: number;
currentSetIndex?: number;
```

- [ ] **Step 3: `src/lib/dashboardMetrics.ts`**

Open the file. Locate every `db.collection('sessions').get()` (or equivalent) and add a `.filter((s) => s.status === 'completed')` after the cast. If there's a single session-fetching helper, narrow it once at the source.

- [ ] **Step 4: `src/lib/backupUtils.ts:62` — export**

```ts
const sessions = (await db.collection('sessions').get() as Session[])
    .filter((s) => s.status === 'completed');
```

- [ ] **Step 5: Route components — add the filter at the read site**

For each route component (`+page.svelte:13`, `+layout.svelte:38`, `train/+page.svelte:10`, `exercises/[id]/+page.svelte:33`, `progress/records/+page.svelte:12`, `progress/activity/+page.svelte:47`):

The existing pattern uses `$effect` + imperative `.get()`:

```ts
$effect(() => {
    sessionsCol.orderBy('date').reverse().get().then((data) => {
        sessions = data as Session[];
    });
});
```

Apply the filter inside the `.then` so the downstream `$state` only ever sees completed:

```ts
$effect(() => {
    sessionsCol.orderBy('date').reverse().get().then((data) => {
        sessions = (data as Session[]).filter((s) => s.status === 'completed');
    });
});
```

**Exception — `src/routes/(public)/+page.svelte` (today page):** this file needs both the completed list (for history-style derivations like `sessionToday` / `lastSession` / streak) AND the in-progress row (for the resume hero, added in Task 7). Don't filter at the fetch site here. Instead, store the raw list and derive both views:

```ts
let allSessions = $state<Session[]>([]);

$effect(() => {
    sessionsCol.orderBy('date').reverse().get().then((data) => {
        allSessions = data as Session[];
    });
});

const sessions = $derived(allSessions.filter((s) => s.status === 'completed'));
```

Replace the existing `sessions` `$state` declaration and its populating `$effect` with the two blocks above. All existing consumers of `sessions` (lastSession, sessionToday, daysSinceLast, etc.) keep working unchanged because `sessions` is now derived rather than $state.

For the other route components, the filter goes inline in the `.then`.

- [ ] **Step 6: `src/routes/(public)/session/[id]/+page.svelte:415` — celebration**

`priorSessions` already excludes the current session id. Also exclude in_progress:

```ts
const priorSessions = allSessions.filter(
    (s) => s.id !== sessionId && s.status === 'completed'
);
```

- [ ] **Step 7: Run typecheck and tests**

Run: `pnpm check && pnpm test:run 2>&1 | tail -20`
Expected: No errors. No behavior change yet (no in_progress rows exist).

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "feat(sessions): filter completed-only at every history reader

PR calculator, dashboard metrics, backup export, and every UI list of
sessions now narrows to status === 'completed'. No behavior change yet —
this is the precondition for the in-progress writer changes."
```

---

## Task 4: `migrateInProgressSessions` — TDD

**Files:**
- Modify: `src/lib/migrateDexieToTablinum.ts` (add new function)
- Create: `src/lib/__tests__/migrateInProgressSessions.test.ts`
- Modify: `src/hooks.client.ts` (wire it up)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/migrateInProgressSessions.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { Tablinum } from 'tablinum/svelte';
import { field, collection } from 'tablinum';
import { migrateInProgressSessions } from '../migrateDexieToTablinum';

const FLAG = 'gym-app-in-progress-migrated';

function makeTestDb() {
    const sessionExerciseDef = field.object({
        exerciseId: field.string(),
        exerciseName: field.string(),
        primaryMuscle: field.string(),
        sets: field.array(field.object({
            reps: field.number(),
            weight: field.json(),
            completed: field.boolean(),
        })),
        notes: field.optional(field.string()),
    });
    return new Tablinum(`test-${Math.random()}`, {
        sessions: collection('sessions', {
            exercises: field.array(sessionExerciseDef),
            date: field.string(),
            duration: field.number(),
            notes: field.optional(field.string()),
            createdAt: field.string(),
            status: field.string(),
            currentExerciseIndex: field.optional(field.number()),
            currentSetIndex: field.optional(field.number()),
        }),
    });
}

describe('migrateInProgressSessions', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('migrates a single localStorage entry into a Tablinum in_progress row', async () => {
        const db = makeTestDb();
        await db.ready;
        const startTime = Date.UTC(2026, 4, 7, 10, 0, 0);
        localStorage.setItem(
            'gym-app-session-old-id-123',
            JSON.stringify({
                sessionExercises: [{
                    exerciseId: 'ex1',
                    exerciseName: 'Bench',
                    primaryMuscle: 'chest',
                    sets: [{ reps: 5, weight: 60, completed: true }],
                }],
                currentExerciseIndex: 0,
                currentSetIndex: 1,
                sessionStartTime: startTime,
                sessionDuration: 4,
                sessionNotes: 'note',
            })
        );

        await migrateInProgressSessions(db);

        const rows = (await db.collection('sessions').get()) as any[];
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe('in_progress');
        expect(rows[0].exercises[0].exerciseName).toBe('Bench');
        expect(rows[0].currentSetIndex).toBe(1);
        expect(rows[0].notes).toBe('note');
        expect(rows[0].date).toBe(new Date(startTime).toISOString());
        expect(localStorage.getItem('gym-app-session-old-id-123')).toBeNull();
        expect(localStorage.getItem(FLAG)).toBe('true');
    });

    it('is a no-op on second invocation', async () => {
        const db = makeTestDb();
        await db.ready;
        localStorage.setItem(FLAG, 'true');
        localStorage.setItem(
            'gym-app-session-leftover',
            JSON.stringify({ sessionExercises: [] })
        );

        await migrateInProgressSessions(db);

        expect((await db.collection('sessions').get())).toHaveLength(0);
        expect(localStorage.getItem('gym-app-session-leftover')).not.toBeNull();
    });

    it('skips and deletes a malformed entry, then sets the flag', async () => {
        const db = makeTestDb();
        await db.ready;
        localStorage.setItem('gym-app-session-broken', '{not json');

        await migrateInProgressSessions(db);

        expect((await db.collection('sessions').get())).toHaveLength(0);
        expect(localStorage.getItem('gym-app-session-broken')).toBeNull();
        expect(localStorage.getItem(FLAG)).toBe('true');
    });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `pnpm test:run src/lib/__tests__/migrateInProgressSessions.test.ts`
Expected: FAIL with "migrateInProgressSessions is not a function" or similar import error.

- [ ] **Step 3: Implement the function**

Append to `src/lib/migrateDexieToTablinum.ts`:

```ts
const IN_PROGRESS_MIGRATION_FLAG = 'gym-app-in-progress-migrated';
const IN_PROGRESS_KEY_PREFIX = 'gym-app-session-';

export async function migrateInProgressSessions(db: Tablinum<any>): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(IN_PROGRESS_MIGRATION_FLAG)) return;

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(IN_PROGRESS_KEY_PREFIX)) keys.push(key);
    }

    for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        let data: any;
        try {
            data = JSON.parse(raw);
        } catch {
            localStorage.removeItem(key);
            continue;
        }

        const start = typeof data.sessionStartTime === 'number'
            ? data.sessionStartTime
            : Date.now();
        const isoStart = new Date(start).toISOString();

        try {
            await db.collection('sessions').add({
                exercises: Array.isArray(data.sessionExercises) ? data.sessionExercises : [],
                date: isoStart,
                duration: typeof data.sessionDuration === 'number' ? data.sessionDuration : 0,
                notes: data.sessionNotes || undefined,
                createdAt: isoStart,
                status: 'in_progress',
                currentExerciseIndex: typeof data.currentExerciseIndex === 'number'
                    ? data.currentExerciseIndex
                    : undefined,
                currentSetIndex: typeof data.currentSetIndex === 'number'
                    ? data.currentSetIndex
                    : undefined,
            });
            localStorage.removeItem(key);
        } catch (e) {
            console.error('[Migration] Failed to migrate in-progress session', key, e);
            // Leave the localStorage entry; do not set flag below if any failed.
            return;
        }
    }

    localStorage.setItem(IN_PROGRESS_MIGRATION_FLAG, 'true');
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm test:run src/lib/__tests__/migrateInProgressSessions.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Wire into `src/hooks.client.ts`**

Update the `init` function to call the new migration after `migrateFromDexieIfNeeded` and before `initializeExercises`:

```ts
const { db, clearStoredInvite, initializeExercises, deduplicateExercises } = await import('$lib/db');
const { migrateFromDexieIfNeeded, migrateInProgressSessions } = await import('$lib/migrateDexieToTablinum');
const { preferencesStore } = await import('$lib/stores/preferences.svelte');

await db.ready;
clearStoredInvite();
await migrateFromDexieIfNeeded(db);
await migrateInProgressSessions(db);
await initializeExercises();
await deduplicateExercises();
await preferencesStore.load();
```

- [ ] **Step 6: Run all tests + typecheck**

Run: `pnpm check && pnpm test:run 2>&1 | tail -20`
Expected: 0 errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/migrateDexieToTablinum.ts src/lib/__tests__/migrateInProgressSessions.test.ts src/hooks.client.ts
git commit -m "feat(sessions): migrate localStorage in-progress sessions to Tablinum

Boot-time one-shot migration ports any gym-app-session-* localStorage
entries into Tablinum sessions rows with status='in_progress'.
Guarded by gym-app-in-progress-migrated flag."
```

---

## Task 5: `session/new` — create the row in Tablinum

**Files:**
- Modify: `src/routes/(public)/session/new/+page.ts` (full rewrite)

The new flow: build the initial `sessionExercises` (from routine via `?routine=`, from a completed session via `?from=`, or empty), `add()` to Tablinum with status='in_progress', redirect to `/session/{returnedId}`.

- [ ] **Step 1: Replace `src/routes/(public)/session/new/+page.ts` with:**

```ts
import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db';
import type { Workout, Session, SessionExercise, Exercise } from '$lib/types';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = async ({ url }) => {
    const routineId = url.searchParams.get('routine');
    const fromSessionId = url.searchParams.get('from');

    let initialExercises: SessionExercise[] = [];

    if (routineId) {
        try {
            const routine = (await db.collection('workouts').get(routineId)) as Workout;
            if (routine?.exercises?.length) {
                const allExercises = (await db.collection('exercises').get()) as Exercise[];
                const exerciseById = new Map(allExercises.map((ex) => [ex.id, ex]));
                initialExercises = routine.exercises.map((er) => {
                    const exercise = exerciseById.get(er.exerciseId);
                    const targetSets = Math.max(1, er.targetSets || 1);
                    return {
                        exerciseId: er.exerciseId,
                        exerciseName: er.exerciseName,
                        primaryMuscle: exercise?.primary_muscle ?? '',
                        sets: Array.from({ length: targetSets }, () => ({
                            reps: er.targetReps || 0,
                            weight: er.targetWeight || 0,
                            completed: false,
                            notes: ''
                        })),
                        notes: er.notes || undefined
                    };
                });
            }
        } catch (e) {
            console.error('Failed to prefill session from routine:', e);
        }
    } else if (fromSessionId) {
        try {
            const prior = (await db.collection('sessions').get(fromSessionId)) as Session;
            if (prior?.exercises?.length) {
                initialExercises = prior.exercises.map((ex) => ({
                    exerciseId: ex.exerciseId,
                    exerciseName: ex.exerciseName,
                    primaryMuscle: ex.primaryMuscle,
                    sets: ex.sets.map((s) => ({
                        reps: s.reps,
                        weight: s.weight,
                        completed: false
                    })),
                    notes: ex.notes
                }));
            }
        } catch (e) {
            console.error('Failed to prefill session from prior session:', e);
        }
    }

    const startTime = new Date().toISOString();
    const newId = await db.collection('sessions').add({
        exercises: initialExercises,
        date: startTime,
        duration: 0,
        notes: undefined,
        createdAt: startTime,
        status: 'in_progress',
        currentExerciseIndex: 0,
        currentSetIndex: 0,
    });

    redirect(307, `/session/${newId}`);
};
```

Note: the `?from=` query param is no longer forwarded to `/session/[id]` because the prefill happens here.

- [ ] **Step 2: Typecheck**

Run: `pnpm check 2>&1 | tail -10`
Expected: 0 errors. (We haven't yet changed `session/[id]` to expect the row in DB — but type-checking should still pass.)

- [ ] **Step 3: Do not commit yet — combine with Task 6**

The session detail page still reads from localStorage. If we ship this alone, "Start workout" creates an empty in-progress row that the session page can't load. Combine commits.

---

## Task 6: `session/[id]` — read/save/finish via Tablinum

**Files:**
- Modify: `src/routes/(public)/session/[id]/+page.svelte`

Big-ish edit but mechanical. Replace localStorage I/O with Tablinum calls; rewrite finish to update instead of add; revert the exit handler.

- [ ] **Step 1: Replace `loadSessionProgress`**

Current (lines ~258-282):

```ts
function loadSessionProgress() {
    const saved = localStorage.getItem(`gym-app-session-${sessionId}`);
    if (saved) { /* ... */ }
}
```

Replace with an async version that reads the Tablinum row:

```ts
async function loadSessionProgress() {
    const row = (await db.collection('sessions').get(sessionId)) as Session | undefined;
    if (!row) {
        // Stale URL (e.g. row was deleted on another device). Bounce home.
        goto('/');
        return;
    }
    sessionExercises = (row.exercises ?? []).map((ex) => ({
        ...ex,
        notes: ex.notes || undefined
    }));
    currentExerciseIndex = row.currentExerciseIndex ?? 0;
    currentSetIndex = row.currentSetIndex ?? 0;
    sessionNotes = row.notes ?? '';
    sessionStartTime = new Date(row.date).getTime();
    sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60);
    startDurationTracking();
}
```

Find the call site in the load `$effect` (around line 211 — `loadSessionProgress();`) and `await` it.

- [ ] **Step 2: Replace `saveSessionProgress`**

Current (lines ~244-256):

```ts
function saveSessionProgress() {
    localStorage.setItem(`gym-app-session-${sessionId}`, JSON.stringify({...}));
}
```

Replace with:

```ts
async function saveSessionProgress() {
    await db.collection('sessions').update(sessionId, {
        exercises: $state.snapshot(sessionExercises),
        currentExerciseIndex,
        currentSetIndex,
        notes: sessionNotes || undefined,
    });
}
```

Note: callers don't `await` saveSessionProgress today (it's called synchronously e.g. inside `completeSet`). It's safe to leave them un-awaited — Tablinum's update returns a Promise, fire-and-forget is acceptable here. The function signature changes from `void` to `Promise<void>` but Svelte's reactivity is unaffected.

- [ ] **Step 3: Replace `completeSession()` (around line 499-521)**

Was an `add` + `localStorage.removeItem`. Now it's an `update`:

```ts
async function completeSession() {
    await db.collection('sessions').update(sessionId, {
        exercises: $state.snapshot(sessionExercises),
        date: new Date().toISOString(),
        duration: sessionDuration,
        notes: sessionNotes.trim() || undefined,
        status: 'completed',
        currentExerciseIndex: undefined,
        currentSetIndex: undefined,
    });
    await calculatePersonalRecords();
    goto('/');
}
```

- [ ] **Step 4: Revert exit-confirm handler**

Find the `<ConfirmDialog>` block we modified earlier (around line 991). It currently does:

```svelte
onconfirm={() => {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`gym-app-session-${sessionId}`);
    }
    goto('/');
}}
```

Revert to:

```svelte
onconfirm={() => goto('/')}
```

The row stays as `status: 'in_progress'`. Discard now lives on the Today-page hero (already implemented).

- [ ] **Step 5: Drop the now-unused `sourceSession` branch and load via Tablinum**

In `onMount` (around lines 196-227), the current shape is:

```ts
onMount(() => {
    if (sourceSession && sessionExercises.length === 0) {
        sessionExercises = sourceSession.exercises.map(/* ... */);
    } else {
        loadSessionProgress();
    }

    if (sessionExercises.length === 0) {
        currentView = 'picker';
    } else {
        currentView = 'set';
    }

    if (sessionStartTime === 0) {
        sessionStartTime = Date.now();
        startDurationTracking();
    }

    loading = false;
});
```

The `sourceSession` branch (and any `?from=` lookup that populates it) is now dead — `session/new` handles the prefill before redirecting. `loadSessionProgress` is async and sets `sessionStartTime` itself from the row. Replace with:

```ts
onMount(async () => {
    await loadSessionProgress();

    if (sessionExercises.length === 0) {
        currentView = 'picker';
    } else {
        currentView = 'set';
    }

    loading = false;
});
```

Also remove any module-level code that fetches `sourceSession` from `?from=` (search for `sourceSession`, `searchParams.get('from')`, `from=` in the file). Delete the dead variable and its loader.

- [ ] **Step 6: Typecheck**

Run: `pnpm check 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 7: Tests**

Run: `pnpm test:run 2>&1 | tail -10`
Expected: pass.

- [ ] **Step 8: Commit (combined with Task 5)**

```bash
git add src/routes/\(public\)/session/new/+page.ts src/routes/\(public\)/session/\[id\]/+page.svelte
git commit -m "feat(sessions): persist in-progress session state in Tablinum

session/new creates the Tablinum row up front (status='in_progress')
and redirects to /session/{newId}. session/[id] reads/saves/finishes
via Tablinum instead of localStorage. Exit dialog preserves state
(was destructively clearing localStorage on the previous patch)."
```

---

## Task 7: Today page — derive in-progress from Tablinum

**Files:**
- Modify: `src/routes/(public)/+page.svelte`

Replace the localStorage-scanning effect with a `$derived` from the reactive sessions collection. The discard handler also moves to Tablinum.

- [ ] **Step 1: Replace the localStorage-scan `$effect`**

Find the block at lines ~63-88 (`$effect(() => { ... loop over localStorage ... })`) and delete it. After Task 3, the file already has `allSessions` (raw, $state) and `sessions` (completed-only, $derived).

Add an `inProgressRow` derived from the same `allSessions` source, and rebuild `inProgressSession` as a derived:

```ts
const inProgressRow = $derived(
    allSessions.find((s) => s.status === 'in_progress') ?? null
);

const inProgressSession = $derived.by(() => {
    if (!inProgressRow) return null;
    const startTime = new Date(inProgressRow.date).getTime();
    const elapsedMinutes = Math.max(0, Math.floor((now - startTime) / 1000 / 60));
    const exerciseCount = (inProgressRow.exercises ?? []).filter((ex) =>
        ex.sets?.some((s) => s.completed)
    ).length;
    return { sessionId: inProgressRow.id, elapsedMinutes, exerciseCount };
});
```

Also delete the existing `let inProgressSession = $state<...>(null);` declaration around line 22-26 — it's now a derived, not state.

Note: `now` is the existing `$state(Date.now())` already in the file (around line 27), used to make time-based derivations recompute periodically. Reuse it; do not call `Date.now()` inline (that would freeze the elapsed display).

Switching `inProgressSession` from `$state` to `$derived` means `discardInProgressSession` can no longer set it to `null` directly — the discard happens by deleting the Tablinum row, which removes it from `allSessions` on the next refetch, which collapses the derived. See Step 2.

- [ ] **Step 2: Update `discardInProgressSession`**

Replace the implementation (added in the previous patch):

```ts
async function discardInProgressSession(sessionId: string) {
    await db.collection('sessions').delete(sessionId);
}
```

The Tablinum reactive store will update, `inProgressRow` becomes undefined, `inProgressSession` becomes null, hero re-renders.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm check && pnpm test:run 2>&1 | tail -10`
Expected: 0 errors, tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/\(public\)/+page.svelte
git commit -m "feat(sessions): derive Today resume state from Tablinum

Replaces the localStorage scan with a reactive \$derived over the
sessions collection. Discard now deletes the Tablinum row directly;
the derived auto-clears."
```

---

## Task 8: Confirm-prompt when starting a workout with one already in progress

**Files:**
- Modify: `src/routes/(public)/+page.svelte`
- Modify: `src/lib/components/TodayHero.svelte`

When the user clicks the primary CTA in `fresh` / `repeat-last` / `done-today` modes and there's already an in_progress row (which can happen via cross-device sync), intercept and show a confirm dialog.

- [ ] **Step 1: Add a `requestStart` handler in `+page.svelte`**

Add to the script:

```ts
import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';

let showStartConfirm = $state(false);
let pendingStartHref = $state<string | null>(null);

function requestStart(href: string) {
    if (inProgressRow) {
        pendingStartHref = href;
        showStartConfirm = true;
        return;
    }
    goto(href);
}

async function discardAndStart() {
    if (inProgressRow) {
        await db.collection('sessions').delete(inProgressRow.id);
    }
    showStartConfirm = false;
    if (pendingStartHref) goto(pendingStartHref);
}

function resumeInsteadOfStart() {
    showStartConfirm = false;
    if (inProgressRow) goto(`/session/${inProgressRow.id}`);
}
```

- [ ] **Step 2: Render the confirm dialog**

At the bottom of `+page.svelte`'s template, add:

```svelte
<ConfirmDialog
    open={showStartConfirm}
    title="Workout in progress"
    message="You have a workout in progress. Discard it and start fresh, or resume?"
    confirmText="Discard & start fresh"
    cancelText="Resume"
    onconfirm={discardAndStart}
    oncancel={resumeInsteadOfStart}
/>
```

(Verify `ConfirmDialog` accepts `cancelText`. If not, check its source and either add the prop or use a different component pattern.)

- [ ] **Step 3: Wire the CTA to use `requestStart`**

In `src/lib/components/TodayHero.svelte`, the primary `<Button>` in the `fresh` and `repeat-last` branches uses `href={...}`. Add an optional `onstart` callback prop:

```ts
interface TodayHeroProps {
    mode: Mode;
    inProgress?: InProgressInfo | null;
    lastSession?: Session | null;
    ondiscard?: (sessionId: string) => void;
    onstart?: (href: string) => void;
}

let { mode, inProgress = null, lastSession = null, ondiscard, onstart }: TodayHeroProps = $props();
```

For the `repeat-last` button, change the markup so it calls `onstart?.(href)` instead of navigating directly when the prop is provided:

```svelte
{#if onstart}
    <Button variant="primary" size="lg" onclick={() => onstart?.(`/session/new?from=${lastSession.id}`)} fullWidth>
        <RotateCcw class="w-5 h-5" />
        Start workout
    </Button>
{:else}
    <Button variant="primary" size="lg" href={`/session/new?from=${lastSession.id}`} fullWidth>
        <RotateCcw class="w-5 h-5" />
        Start workout
    </Button>
{/if}
```

Same pattern for the `fresh` and `done-today` "Start" CTAs (`/session/new`).

(If `Button` doesn't accept `onclick`, check its API and use the closest equivalent.)

- [ ] **Step 4: Pass `onstart={requestStart}` from `+page.svelte`**

```svelte
<TodayHero
    mode={heroMode}
    inProgress={inProgressSession}
    lastSession={lastSession}
    ondiscard={discardInProgressSession}
    onstart={requestStart}
/>
```

- [ ] **Step 5: Typecheck + tests**

Run: `pnpm check && pnpm test:run 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/\(public\)/+page.svelte src/lib/components/TodayHero.svelte
git commit -m "feat(sessions): confirm before starting a workout with one in progress

Today CTA intercepts when an in-progress session exists and asks the
user to either discard it and start fresh or resume the existing one."
```

---

## Task 9: Backup import — sweep in-progress rows

**Files:**
- Modify: `src/lib/backupUtils.ts`

The export already filters to completed (Task 3). On import, any locally-orphaned in-progress row should be cleared so the imported snapshot is the authoritative state. The localStorage sweep added previously stays as a safety net for users on intermediate versions.

- [ ] **Step 1: Add an in-progress sweep in `importBackupData`**

In `src/lib/backupUtils.ts`, find the existing localStorage sweep (added previously, near the end of `importBackupData` before `return result`). Add a Tablinum sweep alongside it:

```ts
// Drop any in-progress session state. Imported sessions arrive as completed,
// so any pre-existing in-progress row is now stale relative to the imported
// snapshot.
const allRows = (await db.collection('sessions').get()) as Session[];
for (const row of allRows) {
    if (row.status === 'in_progress') {
        await db.collection('sessions').delete(row.id);
    }
}

// Belt-and-suspenders: also clear localStorage entries that may exist on
// intermediate versions where in-progress lived in localStorage.
if (typeof localStorage !== 'undefined') {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('gym-app-session-')) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
}
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm check && pnpm test:run 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/backupUtils.ts
git commit -m "feat(backup): sweep in-progress sessions on import

Imported snapshots arrive as completed; any pre-existing in-progress
row is now stale and would leave the Today page stuck on Resume.
Existing localStorage sweep kept as a safety net."
```

---

## Task 10: Manual verification

No code changes — just walk the verification list from the spec.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

- [ ] **Step 2: Cold-install path**

Open in incognito (or `localStorage.clear()` + clear IDB). Navigate to `/`. Expected: fresh CTA mode.

Click "Start workout" → `/session/new` redirects to `/session/{id}` (a real Tablinum id). Add an exercise, complete a set. Navigate home (back arrow / hard refresh `/`). Expected: Resume hero shows with elapsed minutes and exercise count.

- [ ] **Step 3: Discard from Today**

Click "Discard" under Resume. Hero switches to fresh/repeat-last/done-today. Reload the page; Resume should not return.

- [ ] **Step 4: Exit (preserve)**

Start a workout, click the exit icon, confirm Exit. Today shows Resume again. Click Resume — sets and notes are intact.

- [ ] **Step 5: Finish**

Resume the in-progress session, complete the workout. Today shows "done today"; history list shows the new completed session.

- [ ] **Step 6: Confirm-on-restart**

While an in-progress session exists, click "Start workout" on Today. Confirm dialog appears with Discard / Resume. Test both branches.

- [ ] **Step 7: Migration**

Manually seed a localStorage entry to simulate a pre-upgrade user:

```js
// in DevTools console
localStorage.setItem('gym-app-session-legacy-1', JSON.stringify({
    sessionExercises: [{ exerciseId: 'x', exerciseName: 'Squat', primaryMuscle: 'legs', sets: [{ reps: 5, weight: 100, completed: true }] }],
    currentExerciseIndex: 0, currentSetIndex: 1,
    sessionStartTime: Date.now() - 5*60*1000,
    sessionDuration: 5,
    sessionNotes: ''
}));
localStorage.removeItem('gym-app-in-progress-migrated');
location.reload();
```

After reload: Today shows Resume, the localStorage key is gone, the migration flag is set. Inspect the sessions collection in DevTools (`await db.collection('sessions').get()`) — there's a row with `status: 'in_progress'` and the seeded exercises.

- [ ] **Step 8: Backup import sweep**

Start a workout (in-progress row exists). Open Settings → Import Backup, import any valid backup JSON. After import: Today does NOT show Resume; the imported sessions appear as history.

- [ ] **Step 9: Cross-device sync (manual, optional)**

If you have two browser profiles set up with the same DB via invite: start a session in profile A, observe Resume hero appear in profile B (allow Tablinum sync interval). Complete a set in B; A's resume info reflects the new exercise count on next reactive tick.

- [ ] **Step 10: No regressions in console**

DevTools console should be clean across all the above flows. No `[import]` / `[modal]` / migration error spam.
