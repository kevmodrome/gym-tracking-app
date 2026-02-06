import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDatabase, databaseExists } from '$lib/server/db';
import { mergeAndSync, getLastSyncTimestamp, type SyncPayload } from '$lib/server/merge';

// GET - Pull latest data (read-only check)
export const GET: RequestHandler = async ({ params }) => {
	const { key } = params;

	try {
		if (!databaseExists(key)) {
			return json(
				{
					success: false,
					error: 'Sync key not found'
				},
				{ status: 404 }
			);
		}

		const db = getDatabase(key);
		const lastSync = getLastSyncTimestamp(db);

		// Get all records
		const exercises = db.prepare('SELECT * FROM exercises').all();
		const workouts = db.prepare('SELECT * FROM workouts').all();
		const sessions = db.prepare('SELECT * FROM sessions').all();
		const personal_records = db.prepare('SELECT * FROM personal_records').all();
		const preferences = db.prepare('SELECT * FROM preferences').all();

		return json({
			success: true,
			data: {
				exercises,
				workouts,
				sessions,
				personal_records,
				preferences,
				syncTimestamp: lastSync
			}
		});
	} catch (error) {
		console.error('Error fetching sync data:', error);
		return json(
			{
				success: false,
				error: 'Failed to fetch sync data'
			},
			{ status: 500 }
		);
	}
};

// POST - Push local data, receive merged data
export const POST: RequestHandler = async ({ params, request }) => {
	const { key } = params;

	try {
		if (!databaseExists(key)) {
			return json(
				{
					success: false,
					error: 'Sync key not found'
				},
				{ status: 404 }
			);
		}

		const payload: SyncPayload = await request.json();
		const db = getDatabase(key);

		// Merge incoming data with server data
		const result = mergeAndSync(db, payload);

		return json({
			success: true,
			data: result
		});
	} catch (error) {
		console.error('Error syncing data:', error);
		return json(
			{
				success: false,
				error: 'Failed to sync data'
			},
			{ status: 500 }
		);
	}
};
