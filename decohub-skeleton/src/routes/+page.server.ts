import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	// Root "/" redirects based on auth state
	if (locals.user) {
		throw redirect(302, '/home');
	} else {
		throw redirect(302, '/login');
	}
};
