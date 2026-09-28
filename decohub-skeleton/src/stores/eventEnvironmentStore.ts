import { writable } from 'svelte/store';

export const activeEnvironmentId = writable<string | null>(null);
