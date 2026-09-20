import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	findOrCreateSocialUser,
	createSessionToken,
	SESSION_COOKIE_NAME,
	COOKIE_OPTIONS
} from '$lib/server/auth.js';

// ── Google OAuth Callback ─────────────────────────────────────────────────────
// Google redirects here after the user consents. We:
//   1. Validate the CSRF state cookie
//   2. Exchange the authorization code for tokens
//   3. Fetch the user's profile from Google
//   4. Upsert the user in our SQLite database
//   5. Create a JWT session cookie and redirect to /home

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const clientId = process.env.GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw redirect(302, '/login?error=google_not_configured');
	}

	// ── 1. CSRF state validation ─────────────────────────────────────────────
	const returnedState = url.searchParams.get('state');
	const storedState   = cookies.get('oauth_state');

	// Clean up the state cookie regardless of outcome
	cookies.delete('oauth_state', { path: '/' });

	if (!returnedState || returnedState !== storedState) {
		throw redirect(302, '/login?error=invalid_state');
	}

	// ── 2. Check for OAuth errors from Google ────────────────────────────────
	const oauthError = url.searchParams.get('error');
	if (oauthError) {
		// User cancelled or denied — not an error, just go back
		if (oauthError === 'access_denied') {
			throw redirect(302, '/login');
		}
		throw redirect(302, '/login?error=google_oauth_error');
	}

	const code = url.searchParams.get('code');
	if (!code) {
		throw redirect(302, '/login?error=missing_code');
	}

	try {
		// ── 3. Exchange code for tokens ──────────────────────────────────────
		const callbackUrl = `${url.origin}/api/auth/google/callback`;

		const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id:     clientId,
				client_secret: clientSecret,
				redirect_uri:  callbackUrl,
				grant_type:    'authorization_code'
			}).toString()
		});

		if (!tokenRes.ok) {
			console.error('[google/callback] Token exchange failed:', await tokenRes.text());
			throw redirect(302, '/login?error=token_exchange_failed');
		}

		const tokens = await tokenRes.json() as { access_token: string };

		// ── 4. Fetch Google user profile ─────────────────────────────────────
		const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
			headers: { Authorization: `Bearer ${tokens.access_token}` }
		});

		if (!userInfoRes.ok) {
			console.error('[google/callback] userinfo fetch failed:', await userInfoRes.text());
			throw redirect(302, '/login?error=profile_fetch_failed');
		}

		const profile = await userInfoRes.json() as {
			sub:     string;
			email:   string;
			name:    string;
			picture: string;
			email_verified: boolean;
		};

		if (!profile.email_verified) {
			throw redirect(302, '/login?error=email_not_verified');
		}

		// ── 5. Upsert user & create session ──────────────────────────────────
		const user = await findOrCreateSocialUser(
			'google',
			profile.sub,
			profile.email,
			profile.name,
			profile.picture ?? null
		);

		const token = createSessionToken(user);
		cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);

		throw redirect(302, '/home');

	} catch (err: any) {
		// Re-throw SvelteKit redirects (they're not actually errors)
		if (err?.status && err?.location) throw err;

		// Provider conflict — account exists with a different sign-in method
		if (err?.code === 'PROVIDER_CONFLICT') {
			const provider = err.existingProvider ?? 'another method';
			throw redirect(302, `/login?error=account_exists&provider=${encodeURIComponent(provider)}`);
		}

		console.error('[google/callback] Unexpected error:', err);
		throw redirect(302, '/login?error=server_error');
	}
};
