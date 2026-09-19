import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { SESSION_COOKIE_NAME } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ cookies }) => {
	cookies.set(SESSION_COOKIE_NAME, '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 0
	});

	return json({ success: true });
};
