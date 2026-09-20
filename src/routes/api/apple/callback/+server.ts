import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	consumeAppleOAuthState,
	generateAppleClientSecret,
	verifyAppleIdToken
} from '$lib/server/apple-auth.js';
import {
	findOrCreateSocialUser,
	createSessionToken,
	SESSION_COOKIE_NAME,
	COOKIE_OPTIONS
} from '$lib/server/auth.js';

// ── Apple OAuth Callback (POST) ───────────────────────────────────────────────
// Apple posts form-encoded data to this endpoint after the user consents
// (or cancels). This is NOT a GET redirect like Google — it is a real HTTP POST.
//
// Body fields Apple sends:
//   code          — authorization code (used to exchange for tokens)
//   id_token      — signed RS256 JWT with sub, email, email_verified claims
//   state         — the CSRF state we sent in the redirect
//   user          — JSON string { name: { firstName, lastName }, email }
//                   ⚠ ONLY present on the VERY FIRST authorization ever.
//                     Apple never sends it again. We must store it immediately.
//   error         — present if the user cancelled or an error occurred
//
// We use the id_token directly (verified against Apple's JWKS) instead of
// doing a token exchange, because:
//   1. The id_token in form_post is already signed by Apple and contains all
//      the claims we need (sub, email).
//   2. We don't need a refresh token — our session is managed by our own JWT.

export const POST: RequestHandler = async ({ request, url }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw redirect(302, '/login?error=apple_oauth_error');
	}

	// ── 1. Check for Apple-side errors ───────────────────────────────────────
	const appleError = formData.get('error') as string | null;
	if (appleError) {
		// user_cancelled_authorize: user dismissed the Apple sheet — not an error
		if (appleError === 'user_cancelled_authorize') {
			throw redirect(302, '/login');
		}
		console.warn('[apple/callback] Apple returned error:', appleError);
		throw redirect(302, '/login?error=apple_oauth_error');
	}

	// ── 2. CSRF state validation ──────────────────────────────────────────────
	const returnedState = formData.get('state') as string | null;
	if (!returnedState || !consumeAppleOAuthState(returnedState)) {
		// State missing, expired, or already used
		throw redirect(302, '/login?error=invalid_state');
	}

	// ── 3. Extract required fields ────────────────────────────────────────────
	const idToken = formData.get('id_token') as string | null;
	if (!idToken) {
		throw redirect(302, '/login?error=apple_token_invalid');
	}

	// ── 4. Verify the id_token against Apple's JWKS ───────────────────────────
	let claims: Awaited<ReturnType<typeof verifyAppleIdToken>>;
	try {
		claims = await verifyAppleIdToken(idToken);
	} catch (err) {
		console.error('[apple/callback] id_token verification failed:', err);
		throw redirect(302, '/login?error=apple_token_invalid');
	}

	// ── 5. Extract user's name (first-login only) ─────────────────────────────
	// Apple only sends the `user` field on the very first authorization.
	// On all subsequent logins it is absent. We capture it now and store it
	// in the DB so the "Hi, [Name]" greeting works on every future login.
	let displayName = 'Apple User'; // safe fallback
	const userJson  = formData.get('user') as string | null;
	if (userJson) {
		try {
			const userObj    = JSON.parse(userJson) as {
				name?: { firstName?: string; lastName?: string };
				email?: string;
			};
			const firstName  = userObj.name?.firstName?.trim() ?? '';
			const lastName   = userObj.name?.lastName?.trim()  ?? '';
			const assembled  = [firstName, lastName].filter(Boolean).join(' ');
			if (assembled) displayName = assembled;
		} catch {
			// Malformed user JSON — keep the fallback name
		}
	}

	// ── 6. Upsert user in our SQLite database ─────────────────────────────────
	// findOrCreateSocialUser looks up by (provider='apple', provider_id=sub) first,
	// then falls back to email match (merges accounts), then creates a new record.
	// When a returning Apple user has no `user` field, we use whatever name is
	// already stored in the DB (the row's `name` column won't be overwritten
	// unless this is a brand-new insert, where displayName is used).
	let user: Awaited<ReturnType<typeof findOrCreateSocialUser>>;
	try {
		user = await findOrCreateSocialUser(
			'apple',
			claims.sub,
			claims.email,
			displayName,
			null // Apple doesn't provide a profile photo
		);
	} catch (err: unknown) {
		// Re-throw SvelteKit redirects
		if (typeof err === 'object' && err !== null && 'status' in err && 'location' in err) {
			throw err;
		}
		const e = err as { code?: string; existingProvider?: string };
		if (e?.code === 'PROVIDER_CONFLICT') {
			const via = e.existingProvider ?? 'another method';
			throw redirect(302, `/login?error=account_exists&provider=${encodeURIComponent(via)}`);
		}
		console.error('[apple/callback] findOrCreateSocialUser error:', err);
		throw redirect(302, '/login?error=server_error');
	}

	// ── 7. Create session & redirect ──────────────────────────────────────────
	const token = createSessionToken(user);
	// Note: COOKIE_OPTIONS uses sameSite='lax' which is fine for the final
	// redirect to /home — this Set-Cookie header is on OUR response, not
	// Apple's POST, so there's no SameSite issue at this point.
	const headers = new Headers({
		'Set-Cookie': `${SESSION_COOKIE_NAME}=${token}; Path=${COOKIE_OPTIONS.path}; Max-Age=${COOKIE_OPTIONS.maxAge}; SameSite=Lax; HttpOnly${COOKIE_OPTIONS.secure ? '; Secure' : ''}`,
		'Location':   '/home'
	});

	// Apple's form_post callback: we MUST respond with a redirect, not rely on
	// SvelteKit's cookies.set(), because this is a server-side POST handler and
	// we want a 302 redirect that the browser follows with a GET (clearing the POST).
	return new Response(null, { status: 302, headers });
};
