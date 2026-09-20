import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── In-Memory OAuth State Store ───────────────────────────────────────────────
// Apple uses response_mode=form_post, which means the callback is a cross-origin
// POST from appleid.apple.com. SameSite=Lax cookies are NOT sent on cross-origin
// POSTs, so we can't use the cookie-based state approach used for Google.
// Instead, we keep a server-side Map of pending states with a TTL.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const pendingStates = new Map<string, number>(); // state → expiry timestamp

/** Generate and register a new CSRF state token for an Apple OAuth flow. */
export function createAppleOAuthState(): string {
	// Purge expired entries lazily
	const now = Date.now();
	for (const [s, exp] of pendingStates) {
		if (now > exp) pendingStates.delete(s);
	}
	const state = crypto.randomUUID();
	pendingStates.set(state, now + STATE_TTL_MS);
	return state;
}

/** Validate and consume a state token (single-use). Returns false if invalid/expired. */
export function consumeAppleOAuthState(state: string): boolean {
	const expiry = pendingStates.get(state);
	pendingStates.delete(state); // always delete — single use
	if (!expiry || Date.now() > expiry) return false;
	return true;
}

// ── Apple Client Secret Generation ───────────────────────────────────────────
// Apple does not provide a static client_secret like Google does.
// You must generate one by signing a short-lived JWT with your .p8 EC private key.

/**
 * Generate a signed ES256 JWT to use as the Apple client_secret.
 * Apple accepts client_secrets valid for up to 6 months (15,777,000 seconds).
 * We generate a fresh one per request so we never need to cache/refresh it.
 */
export function generateAppleClientSecret(): string {
	// Handle both real newlines and escaped \n in env vars
	const privateKey = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
	const teamId     = process.env.APPLE_TEAM_ID     ?? '';
	const keyId      = process.env.APPLE_KEY_ID      ?? '';
	const clientId   = process.env.APPLE_CLIENT_ID   ?? '';

	if (!privateKey || !teamId || !keyId || !clientId) {
		throw new Error('Missing one or more Apple credentials (APPLE_PRIVATE_KEY, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID)');
	}

	const now = Math.floor(Date.now() / 1000);

	return jwt.sign(
		{
			iss: teamId,
			iat: now,
			exp: now + 15_777_000, // 6 months — Apple's hard maximum
			aud: 'https://appleid.apple.com',
			sub: clientId
		},
		privateKey,
		{
			algorithm: 'ES256',
			keyid:     keyId
		}
	);
}

// ── Apple id_token Verification ───────────────────────────────────────────────
// Apple returns a signed RS256 JWT (id_token) in the form_post body.
// We verify it against Apple's public JWKS endpoint before trusting any claims.

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

// Simple 24-hour cache to avoid hammering Apple's JWKS endpoint
let cachedKeys: Record<string, unknown>[] = [];
let keysCachedAt = 0;
const KEYS_CACHE_MS = 24 * 60 * 60 * 1000;

async function fetchApplePublicKeys(): Promise<Record<string, unknown>[]> {
	const now = Date.now();
	if (cachedKeys.length > 0 && now - keysCachedAt < KEYS_CACHE_MS) {
		return cachedKeys;
	}
	const res = await fetch(APPLE_JWKS_URL);
	if (!res.ok) throw new Error(`Failed to fetch Apple JWKS: ${res.status}`);
	const body = (await res.json()) as { keys: Record<string, unknown>[] };
	cachedKeys    = body.keys;
	keysCachedAt  = now;
	return cachedKeys;
}

export interface AppleIdTokenClaims {
	sub:            string;
	email:          string;
	email_verified: boolean | string; // Apple returns "true"/"false" as strings in some flows
	is_private_email?: boolean | string;
}

/**
 * Verify an Apple id_token JWT and return its claims.
 * - Fetches Apple's JWKS, matches by `kid`, converts the JWK → PEM,
 *   then calls jwt.verify (RS256) against the PEM public key.
 * - Retries with a fresh key fetch if no matching `kid` is found
 *   (handles Apple rotating keys).
 */
export async function verifyAppleIdToken(idToken: string): Promise<AppleIdTokenClaims> {
	// Decode the header (without verification) to get the kid
	const [headerB64] = idToken.split('.');
	const header = JSON.parse(
		Buffer.from(headerB64, 'base64url').toString('utf-8')
	) as { kid: string; alg: string };

	let keys = await fetchApplePublicKeys();
	let jwk  = keys.find((k) => k.kid === header.kid);

	// Key not in cache — invalidate and re-fetch once (Apple key rotation)
	if (!jwk) {
		cachedKeys = [];
		keys = await fetchApplePublicKeys();
		jwk  = keys.find((k) => k.kid === header.kid);
		if (!jwk) {
			throw new Error(`No Apple public key found for kid="${header.kid}"`);
		}
	}

	// Convert the JWK object to a Node.js KeyObject, then export as PEM.
	// crypto.createPublicKey({ key, format: 'jwk' }) is available in Node 15.12+
	// (SvelteKit 2.x requires Node 18+, so this is always safe).
	const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
	const pem       = publicKey.export({ type: 'spki', format: 'pem' }) as string;

	// Verify signature and standard claims
	const claims = jwt.verify(idToken, pem, {
		algorithms: ['RS256'],
		audience:   process.env.APPLE_CLIENT_ID,
		issuer:     'https://appleid.apple.com'
	}) as AppleIdTokenClaims;

	return claims;
}

// ── Apple Credentials Check ───────────────────────────────────────────────────

/** Returns true only when all four Apple env vars are present and non-empty. */
export function appleCredentialsConfigured(): boolean {
	return Boolean(
		process.env.APPLE_CLIENT_ID   &&
		process.env.APPLE_TEAM_ID     &&
		process.env.APPLE_KEY_ID      &&
		process.env.APPLE_PRIVATE_KEY
	);
}
