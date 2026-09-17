// ===========================================================
// SHARED — Scene reference store
// ===========================================================
// A single writable store holding the active THREE.Scene, camera,
// renderer and currently-selected object, so every collaborator's
// module reads/writes the SAME instances instead of creating
// their own separate scenes.
//
// Collaborator 2 sets this on scene init.
// Collaborators 3-7 read from it.
// ===========================================================

import { writable } from 'svelte/store';

export const sceneStore = writable({
	scene: null,
	camera: null,
	renderer: null,
	selectedObject: null
});
