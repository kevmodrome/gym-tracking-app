import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';

export const prerender = false;

export const load: PageLoad = async ({ params, depends, url }) => {
	depends(DEPS.exercises);
	depends(DEPS.sessions);

	const sessionId = params.id;

	// Load all exercises for the exercise picker
	const exercises = await db.exercises.toArray();

	// Check if there's an existing completed session with this ID (for viewing)
	const existingSession = await db.sessions.get(sessionId);

	// Check if we're copying from another session
	const fromSessionId = url.searchParams.get('from');
	const sourceSession = fromSessionId ? await db.sessions.get(fromSessionId) : null;

	return {
		sessionId,
		exercises,
		existingSession,
		sourceSession
	};
}
