import type { PageLoad } from './$types';
import { db } from '$lib/db';
import { DEPS } from '$lib/invalidation';
import type { Exercise, Session } from '$lib/types';

export const prerender = false;

export const load: PageLoad = async ({ params, depends, url }) => {
	depends(DEPS.exercises);
	depends(DEPS.sessions);

	const sessionId = params.id;

	// Load all exercises for the exercise picker
	const exercises = await db.collection('exercises').get() as Exercise[];

	// Check if there's an existing completed session with this ID (for viewing)
	let existingSession: Session | null = null;
	try {
		existingSession = await db.collection('sessions').get(sessionId) as Session;
	} catch {
		// Session doesn't exist yet, that's fine
	}

	// Check if we're copying from another session
	const fromSessionId = url.searchParams.get('from');
	let sourceSession: Session | null = null;
	if (fromSessionId) {
		try {
			sourceSession = await db.collection('sessions').get(fromSessionId) as Session;
		} catch {
			// Source session not found
		}
	}

	return {
		sessionId,
		exercises,
		existingSession,
		sourceSession
	};
}
