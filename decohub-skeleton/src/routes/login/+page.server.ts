import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	// Already logged in — redirect to home
	if (locals.user) {
		throw redirect(302, '/home');
	}

	return {};
};
