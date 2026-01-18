import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDatabase } from '$lib/server/db';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async () => {
	try {
		// Generate a new sync key
		const syncKey = randomUUID();

		// Create the database for this key
		createDatabase(syncKey);

		return json({
			success: true,
			syncKey
		});
	} catch (error) {
		console.error('Error creating sync key:', error);
		return json(
			{
				success: false,
				error: 'Failed to create sync key'
			},
			{ status: 500 }
		);
	}
};
