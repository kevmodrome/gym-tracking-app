import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = async ({ params, url }) => {
	return {
		sessionId: params.id,
		fromSessionId: url.searchParams.get('from')
	};
};
