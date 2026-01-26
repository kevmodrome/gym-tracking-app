import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const prerender = false;

export const load: PageLoad = async () => {
	// Generate a unique session ID using timestamp + random string
	const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

	// Redirect to the new session
	redirect(307, `/session/${sessionId}`);
};
