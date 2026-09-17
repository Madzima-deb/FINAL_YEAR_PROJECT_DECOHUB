// ===========================================================
// COLLABORATOR 4 — Object Selection & Transform Controls
// ===========================================================
// Scope:
//  - Raycasting for click-to-select an object in the scene
//  - Wire up THREE.TransformControls for:
//      * move (translate)
//      * rotate
//      * scale
//  - Mode-switch UI (buttons/keys to toggle translate/rotate/scale)
//  - Duplicate + delete selected object, including proper
//    geometry/material disposal to avoid memory leaks
// ===========================================================

export function initSelection(scene, camera, renderer) {
	// TODO (Collaborator 4): raycaster + click handling
}

export function attachTransformControls(scene, camera, renderer, object) {
	// TODO (Collaborator 4): TransformControls setup
}

export function duplicateObject(object) {
	// TODO (Collaborator 4): clone + add to scene
}

export function deleteObject(object) {
	// TODO (Collaborator 4): remove from scene + dispose geometry/material
}
