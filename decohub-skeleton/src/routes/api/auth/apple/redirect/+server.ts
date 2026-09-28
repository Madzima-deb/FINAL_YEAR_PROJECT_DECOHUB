import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { appleCredentialsConfigured, createAppleOAuthState } from '$lib/server/apple-auth.js';

// ── Apple OAuth Redirect ──────────────────────────────────────────────────────
// Generates a CSRF state token (stored server-side, not in a cookie — see
// apple-auth.ts for why), then redirects the browser to Apple's auth page.
//
// Apple quirk: response_mode MUST be "form_post" for web flows that request
// the "name email" scope. Apple will POST the result to our callback.
//
// IMPORTANT: Apple requires the redirect_uri to use HTTPS. For local dev,
// use a tunnel such as ngrok (`ngrok http 5173`) and register the HTTPS URL
// in Apple Developer → Certificates → Services IDs → your service → Sign In
// with Apple → Configure → Web Authentication → Return URLs.

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';

export const GET: RequestHandler = async ({ url }) => {
	if (!appleCredentialsConfigured()) {
		throw redirect(302, '/login?error=apple_not_configured');
	}

	// State is kept in the server-side in-memory map (see apple-auth.ts)
	// because SameSite=Lax cookies are not sent on Apple's cross-origin form_post.
	const state = createAppleOAuthState();

	const callbackUrl = `${url.origin}/api/auth/apple/callback`;

	const params = new URLSearchParams({
		client_id:     process.env.APPLE_CLIENT_ID!,
		redirect_uri:  callbackUrl,
		response_type: 'code id_token',
		scope:         'name email',
		state,
		response_mode: 'form_post' // Required for scope=name email; triggers POST callback
	});

	throw redirect(302, `${APPLE_AUTH_URL}?${params.toString()}`);
};
