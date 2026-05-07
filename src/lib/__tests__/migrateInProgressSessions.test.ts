import { describe, it, expect, beforeEach } from 'vitest';
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
	return new Tablinum({
		schema: {
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
		},
		relays: ['wss://relay.tablinum.dev/'],
		dbName: `test-${Math.random()}`,
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
