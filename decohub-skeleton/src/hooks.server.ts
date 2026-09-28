import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, verifySessionToken } from '$lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Default to no user
	event.locals.user = null;

	try {
		const token = event.cookies.get(SESSION_COOKIE_NAME);
		if (token) {
			const user = verifySessionToken(token);
			if (user) {
				event.locals.user = user;
			}
		}
	} catch (err) {
		// Never crash the request — just leave user as null
		console.error('[hooks.server] Session verification error:', err);
	}

	return resolve(event);
};
