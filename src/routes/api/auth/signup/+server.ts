import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	createUser,
	createSessionToken,
	SESSION_COOKIE_NAME,
	COOKIE_OPTIONS
} from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { name, email, password, confirmPassword } = body;

		// ── Validation ──────────────────────────────────────────────────────
		const errors: Record<string, string> = {};

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			errors.name = 'Name is required.';
		}

  if (!email || typeof email !== 'string') {
			errors.email = 'Email is required.';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			errors.email = 'Please enter a valid email address.';
		}

		if (!password || typeof password !== 'string') {
			errors.password = 'Password is required.';
		} else if (password.length < 8) {
			errors.password = 'Password must be at least 8 characters.';
		}

		if (password !== confirmPassword) {
			errors.confirmPassword = 'Passwords do not match.';
		}

		if (Object.keys(errors).length > 0) {
			return json({ success: false, errors }, { status: 400 });
		}

		// ── Create user ─────────────────────────────────────────────────────
		let user;
		try {
			user = await createUser(name.trim(), email, password);
		} catch (err: any) {
			// SQLite UNIQUE constraint violation
			if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.message?.includes('UNIQUE')) {
				return json(
					{ success: false, errors: { email: 'This email is already registered.' } },
					{ status: 409 }
				);
			}
			throw err; // re-throw unexpected errors
		}

		// ── Create session ──────────────────────────────────────────────────
		const token = createSessionToken(user);
		cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);

		return json({
			success: true,
			user: { name: user.name, email: user.email }
		});
	} catch (err) {
		console.error('[signup] Unexpected error:', err);
		return json(
			{ success: false, errors: { _form: 'Something went wrong. Please try again.' } },
			{ status: 500 }
		);
	}
};
