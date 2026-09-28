import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

// ── Google OAuth Redirect ─────────────────────────────────────────────────────
// Builds the Google authorization URL and redirects the browser to it.
// A CSRF `state` value is stored in a short-lived httpOnly cookie so the
// callback can verify the request is legitimate.

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	if (!clientId) {
		throw redirect(302, '/login?error=google_not_configured');
	}

	// Generate a random state token for CSRF protection
	const state = crypto.randomUUID();

	// Store state in a short-lived cookie (10 minutes)
	cookies.set('oauth_state', state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 10
	});

	// Determine the callback origin (handles dev vs. production)
	const origin = url.origin;
	const callbackUrl = `${origin}/api/auth/google/callback`;

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: callbackUrl,
		response_type: 'code',
		scope: 'openid email profile',
		state,
		access_type: 'online',
		prompt: 'select_account'
	});

	throw redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
};
