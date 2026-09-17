// ===========================================================
// COLLABORATOR 3 — Model Library & GLB Loading / Categorisation
// ===========================================================
// Scope:
//  - GLTFLoader setup for loading .glb decoration/furniture models
//  - Categorisation logic: tables / seating / decor
//    (matches the folders in static/models/)
//  - Function to add a loaded model into the active Three.js scene
//  - Bounding-box normalisation so models come in at a sane scale
//    regardless of how they were exported
// ===========================================================

export function loadModel(path, scene) {
	// TODO (Collaborator 3): implement GLTFLoader + add to scene
}

export function getModelCategories() {
	// TODO (Collaborator 3): return category list, matching
	// static/models/tables, static/models/seating, static/models/decor
	return {
		tables: [],
		seating: [],
		decor: []
	};
}
