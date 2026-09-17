<script>
	// ===========================================================
	// COLLABORATOR 2 — 3D Scene Core (Three.js setup)
	// ===========================================================
	// Scope:
	//  - Initialise the Three.js Scene, Renderer, Camera, Lighting
	//  - Mount the renderer canvas into this page
	//  - Handle resize / fullscreen container sizing
	//  - Expose the scene/camera/renderer instances (e.g. via a
	//    store in src/lib/stores/) so other collaborators' modules
	//    (model loader, transform controls, camera controls) can
	//    plug into the SAME scene instead of creating their own
	//  - Put core scene logic in src/lib/three/scene.js
	// ===========================================================
	import { onMount } from 'svelte';
	// import { initScene } from '$lib/three/scene.js';

	let canvasContainer;

	onMount(() => {
		// TODO (Collaborator 2): initScene(canvasContainer)
	});
</script>

<div bind:this={canvasContainer} id="scene-container" style="width:100%; height:100vh;">
	<!-- TODO (Collaborator 2): Three.js canvas mounts here -->
</div>
