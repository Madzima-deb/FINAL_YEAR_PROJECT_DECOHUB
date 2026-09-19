import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	verifyUser,
	createSessionToken,
	SESSION_COOKIE_NAME,
	COOKIE_OPTIONS
} from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const body = await request.json();
		const { email, password } = body;

		// ── Validation ──────────────────────────────────────────────────────
		const errors: Record<string, string> = {};

		if (!email || typeof email !== 'string') {
			errors.email = 'Email is required.';
		}

		if (!password || typeof password !== 'string') {
      errors.password = 'Password is required.';
		}

		if (Object.keys(errors).length > 0) {
			return json({ success: false, errors }, { status: 400 });
		}

		// ── Verify credentials ──────────────────────────────────────────────
		const user = await verifyUser(email, password);

		if (!user) {
			return json(
				{ success: false, errors: { _form: 'Invalid email or password.' } },
				{ status: 401 }
			);
		}

		// ── Create session ──────────────────────────────────────────────────
		const token = createSessionToken(user);
		cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);

		return json({
			success: true,
			user: { name: user.name, email: user.email }
		});
	} catch (err) {
		console.error('[login] Unexpected error:', err);
		return json(
			{ success: false, errors: { _form: 'Something went wrong. Please try again.' } },
			{ status: 500 }
		);
	}
};
