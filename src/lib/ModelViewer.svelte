<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import * as THREE from 'three';
    import { modelCategories, colorPalette, getAllModels, type DecorModel, FLOOR_SURFACE_SIZE_M } from '$lib/models';
    import { SceneManager } from '$lib/Scene';
    import { eventEnvironments } from '$lib/events';
    import { activeEnvironmentId } from '../../../stores/eventEnvironmentStore';

    let canvas: HTMLCanvasElement;
    let canvasContainer: HTMLDivElement;
    let sceneManager: SceneManager;

    let selectedModels = $state(new Set<string>());
    let modelColors = $state<Record<string, string | null>>({});
    let loadFailures = $state<Record<string, string>>({}); // modelId → error message

    let activeObjectId = $state<string | null>(null);
    let transformMode = $state<'translate' | 'rotate'>('translate');
    let isFullscreen = $state(false);

    let envImage = $state<string | null>(null);
    let envMode = $state<'contain' | 'cover' | 'stretch' | 'original'>('cover');
    let objProps = $state({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });

    /**
     * Tracks duplicate instances created via the Duplicate button.
     * Key = unique instance ID (e.g. "wooden_table__dup_1").
     * Value carries the source catalog model ID and its current colour so the
     * sidebar panel can render an appropriate label and colour picker.
     */
    let duplicateInstances = $state<Record<string, { sourceModelId: string; label: string; color: string | null }>>({});

    /** Monotonically-increasing counter for generating unique model IDs. */
    let modelCounter = 0;
    /** Counter per source-model used to label duplicates as "#2", "#3", etc. */
    let dupCounters: Record<string, number> = {};

    // ── Save/Load Design state ─────────────────────────────────────────────────

    interface DesignItem {
        instanceId: string;
        modelKey: string;
        isDuplicate: boolean;
        sourceModelId: string;
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
        color: string | null;
    }

    interface SavedDesign {
        id: string;
        name: string;
        createdAt: string;
        items: DesignItem[];
        envImage?: string | null;
        envMode?: 'fit' | 'contain' | 'cover' | 'stretch' | 'original';
    }

    const STORAGE_KEY = 'decohub_designs';

    let showSaveModal = $state(false);
    let saveName = $state('My Design');
    let saveToast = $state('');
    let saveToastTimer: ReturnType<typeof setTimeout> | null = null;

    let showDesignsPanel = $state(false);
    let savedDesigns = $state<SavedDesign[]>([]);

    let showEventsPanel = $state(false);
    let prevEnvId = $state<string | null>(null);

    $effect(() => {
        if (sceneManager && prevEnvId !== $activeEnvironmentId) {
            prevEnvId = $activeEnvironmentId;
            const env = eventEnvironments.find(e => e.id === $activeEnvironmentId);
            sceneManager.setEnvironment(env ? env.file : null).then(ok => {
                if (!ok && $activeEnvironmentId !== null) {
                    showToast('⚠ Failed to load environment.');
                    $activeEnvironmentId = null;
                }
            });
        }
    });

    function loadDesignsFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            savedDesigns = raw ? JSON.parse(raw) : [];
        } catch {
            savedDesigns = [];
        }
    }

    function writeDesignsToStorage(designs: SavedDesign[]) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
        } catch (e) {
            showToast('⚠ Storage full — design could not be saved.');
        }
    }

    function showToast(msg: string) {
        saveToast = msg;
        if (saveToastTimer) clearTimeout(saveToastTimer);
        saveToastTimer = setTimeout(() => { saveToast = ''; }, 3500);
    }

    function openSaveModal() {
        saveName = 'My Design';
        showSaveModal = true;
    }

    function cancelSave() {
        showSaveModal = false;
    }

    async function confirmSave() {
        const transforms = sceneManager.getModelTransforms();
        const items: DesignItem[] = [];

        // Catalog models
        for (const id of selectedModels) {
            const t = transforms.get(id);
            if (!t) continue;
            items.push({
                instanceId: id,
                modelKey: id,
                isDuplicate: false,
                sourceModelId: id,
                position: [t.position.x, t.position.y, t.position.z],
                rotation: [t.rotation.x, t.rotation.y, t.rotation.z],
                scale: [t.scale.x, t.scale.y, t.scale.z],
                color: modelColors[id] ?? null
            });
        }

        // Duplicate instances
        for (const [instId, inst] of Object.entries(duplicateInstances)) {
            const t = transforms.get(instId);
            if (!t) continue;
            items.push({
                instanceId: instId,
                modelKey: instId,
                isDuplicate: true,
                sourceModelId: inst.sourceModelId,
                position: [t.position.x, t.position.y, t.position.z],
                rotation: [t.rotation.x, t.rotation.y, t.rotation.z],
                scale: [t.scale.x, t.scale.y, t.scale.z],
                color: inst.color ?? null
            });
        }

        let compressedEnv = envImage;
        if (envImage && envImage.length > 500000 && envImage.startsWith('data:image')) {
            showToast('Compressing image...');
            compressedEnv = await compressImage(envImage);
        }

        const design: SavedDesign = {
            id: `design_${Date.now()}`,
            name: saveName.trim() || 'Untitled',
            createdAt: new Date().toISOString(),
            items,
            envImage: compressedEnv,
            envMode
        };

        const next = [...savedDesigns, design];
        writeDesignsToStorage(next);
        savedDesigns = next;
        showSaveModal = false;
        showToast(`✓ "${design.name}" saved!`);
    }

    async function loadDesign(design: SavedDesign) {
        // 1. Clear current scene
        for (const id of [...selectedModels]) {
            sceneManager.deleteModel(id);
        }
        for (const id of Object.keys(duplicateInstances)) {
            sceneManager.deleteModel(id);
        }
        selectedModels = new Set();
        duplicateInstances = {};
        modelColors = {};
        activeObjectId = null;
        modelCounter = 0;
        dupCounters = {};
        sceneManager.resetReference();

        // Pre-init colors for all catalog models
        getAllModels().forEach(m => { modelColors[m.id] = null; });

        // 2. Load each item
        for (const item of design.items) {
            if (!item.isDuplicate) {
                // Find the catalog model entry (needed for file path and targetSize)
                let catalogModel: import('$lib/models').DecorModel | null = null;
                for (const cat of modelCategories) {
                    const m = cat.models.find(m => m.id === item.sourceModelId);
                    if (m) { catalogModel = m; break; }
                }
                if (!catalogModel) continue;

                const pos = new THREE.Vector3(item.position[0], item.position[1], item.position[2]);
                // Pass categoryKey so the model scales relative to the reference object.
                // applyTransform below immediately restores saved scale — no double-apply.
                const ok = await sceneManager.loadModel(item.sourceModelId, catalogModel.file, pos, catalogModel.categoryKey, catalogModel.realHeightMeters, catalogModel.targetSize, undefined, catalogModel.category);
                if (!ok) continue;

                // Re-apply stored position/rotation/scale after load
                sceneManager.applyTransform(item.sourceModelId, item.position, item.rotation, item.scale, false);

                const next = new Set(selectedModels);
                next.add(item.sourceModelId);
                selectedModels = next;
                modelColors[item.sourceModelId] = item.color;
                if (item.color) sceneManager.setModelColor(item.sourceModelId, item.color);
                modelCounter++;
            } else {
                // Re-duplicate from source
                const newId = item.instanceId;
                const result = sceneManager.duplicateModel(item.sourceModelId, newId);
                if (!result) continue;

                sceneManager.applyTransform(newId, item.position, item.rotation, item.scale, false);

                const baseName = labelForId(item.sourceModelId);
                const copyNumber = (dupCounters[item.sourceModelId] ?? 1) + 1;
                dupCounters[item.sourceModelId] = copyNumber;
                const label = `${baseName} #${copyNumber}`;

                modelColors[newId] = item.color;
                if (item.color) sceneManager.setModelColor(newId, item.color);

                duplicateInstances = {
                    ...duplicateInstances,
                    [newId]: { sourceModelId: item.sourceModelId, label, color: item.color }
                };
            }
        }

        envImage = design.envImage || null;
        envMode = (design.envMode === 'fit' ? 'contain' : design.envMode || 'cover') as 'contain' | 'cover' | 'stretch' | 'original';
        sceneManager.setBackgroundImage(envImage, envMode);

        showDesignsPanel = false;
        showToast(`✓ "${design.name}" loaded!`);
    }

    function deleteDesign(id: string) {
        const next = savedDesigns.filter(d => d.id !== id);
        writeDesignsToStorage(next);
        savedDesigns = next;
    }

    // ── Derived helpers ───────────────────────────────────────────────────────

    /** True when the currently selected object is a duplicate instance. */
    function isDuplicate(id: string | null): boolean {
        return id !== null && id in duplicateInstances;
    }

    /** Human-readable label for any model ID (catalog or duplicate). */
    function labelForId(id: string): string {
        if (id in duplicateInstances) return duplicateInstances[id].label;
        for (const cat of modelCategories) {
            const m = cat.models.find(m => m.id === id);
            if (m) return m.name;
        }
        return id;
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    onMount(() => {
        sceneManager = new SceneManager(canvas);
        
        sceneManager.onObjectSelected = (id) => {
            activeObjectId = id;
            if (id) {
                const transforms = sceneManager.getModelTransforms();
                const t = transforms.get(id);
                if (t) {
                    objProps = {
                        x: Number(t.position.x.toFixed(2)),
                        y: Number(t.position.y.toFixed(2)),
                        z: Number(t.position.z.toFixed(2)),
                        rx: Number(THREE.MathUtils.radToDeg(t.rotation.x).toFixed(0)),
                        ry: Number(THREE.MathUtils.radToDeg(t.rotation.y).toFixed(0)),
                        rz: Number(THREE.MathUtils.radToDeg(t.rotation.z).toFixed(0))
                    };
                }
            }
        };

        sceneManager.onTransformChange = (id, pos, rot, scale) => {
            if (id === activeObjectId) {
                objProps = {
                    x: Number(pos.x.toFixed(2)),
                    y: Number(pos.y.toFixed(2)),
                    z: Number(pos.z.toFixed(2)),
                    rx: Number(THREE.MathUtils.radToDeg(rot.x).toFixed(0)),
                    ry: Number(THREE.MathUtils.radToDeg(rot.y).toFixed(0)),
                    rz: Number(THREE.MathUtils.radToDeg(rot.z).toFixed(0))
                };
            }
        };

        getAllModels().forEach(m => {
            modelColors[m.id] = null;
        });

        loadDesignsFromStorage();

        // Trigger initial environment if one is already set
        const initialEnv = eventEnvironments.find(e => e.id === $activeEnvironmentId);
        if (initialEnv) {
            sceneManager.setEnvironment(initialEnv.file);
            prevEnvId = $activeEnvironmentId;
        }

        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('keydown', onKeyDown);
    });

    onDestroy(() => {
        if (sceneManager) {
            sceneManager.destroy();
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('keydown', onKeyDown);
        }
        if (saveToastTimer) clearTimeout(saveToastTimer);
    });

    // ── Catalog model toggle (sidebar checkboxes) ─────────────────────────────

    async function toggleModel(model: DecorModel) {
        const next = new Set(selectedModels);
        if (next.has(model.id)) {
            next.delete(model.id);
            sceneManager.removeModel(model.id);
            // Clear any previous load failure when unchecking
            const { [model.id]: _, ...rest } = loadFailures;
            loadFailures = rest;
            if (activeObjectId === model.id) {
                activeObjectId = null;
            }
        } else {
            next.add(model.id);
            const pos = new THREE.Vector3((modelCounter % 3) * 1.5 - 1.5, 0, Math.floor(modelCounter / 3) * 1.5 - 1.5);
            modelCounter++;

            // ── Surface-relative initial scale ────────────────────────────────────
            //
            // Determine the surface the new model will sit on:
            //   • Object-on-object: an existing model is selected → use its
            //     bounding-box XZ footprint (min of width & depth) as the surface.
            //   • Floor fallback: no selection, or selected object has no measurable
            //     footprint → use the FLOOR_SURFACE_SIZE_M constant (1.5 m grid cell).
            //
            // Then call SceneManager.computeAutoScale() which applies the model's
            // fill-ratio formula and clamps the result within [minScale, maxScale].
            let surfaceSize = FLOOR_SURFACE_SIZE_M;

            if (activeObjectId) {
                const bbox = sceneManager.getModelBoundingBox(activeObjectId);
                if (bbox) {
                    const bboxSize = new THREE.Vector3();
                    bbox.getSize(bboxSize);
                    // Use the smaller of width/depth so the new model doesn't
                    // auto-scale beyond the shorter dimension of the surface.
                    const footprintMin = Math.min(bboxSize.x, bboxSize.z);
                    if (footprintMin > 0.05) {
                        // Only treat it as an object-on-object surface if it has
                        // meaningful physical extent (> 5 cm prevents degenerate cases).
                        surfaceSize = footprintMin;
                        console.log(`[Studio] Object-on-object placement: surface from "${activeObjectId}" = ${surfaceSize.toFixed(3)} m`);
                    }
                }
            }

            // Compute the initial scale multiplier (applied after targetSize normalisation).
            // model.autoScale is always defined — buildModelCategories() always sets it.
            const initialScale = model.autoScale
                ? sceneManager.computeAutoScale(model.id, surfaceSize, model.autoScale, model.targetSize)
                : 1.0;

            // Pass categoryKey — Scene.ts applies reference-relative uniform ratio scaling.
            // Pass initialScale — applied AFTER normalization, so the model
            // spawns at a size sensible for the surface it's being placed on.
            const ok = await sceneManager.loadModel(model.id, model.file, pos, model.categoryKey, model.realHeightMeters, model.targetSize, initialScale, model.category);
            if (!ok) {
                // Load failed — show error badge, don't add to selectedModels
                const errMsg = sceneManager.loadErrors.get(model.id) ?? 'Unknown error';
                loadFailures = { ...loadFailures, [model.id]: errMsg };
                next.delete(model.id); // keep checkbox unchecked
                selectedModels = next;
                return;
            }
            if (modelColors[model.id]) {
                sceneManager.setModelColor(model.id, modelColors[model.id]);
            }
            // Auto-select newly added model
            sceneManager.selectObject(model.id);
        }
        selectedModels = next;
    }

    // ── Per-instance colour ───────────────────────────────────────────────────

    function changeColor(modelId: string, color: string | null) {
        modelColors[modelId] = color;

        // Update duplicate label colour tracking too
        if (modelId in duplicateInstances) {
            duplicateInstances[modelId] = { ...duplicateInstances[modelId], color };
        }

        // Apply to scene if the model is currently loaded (catalog or duplicate)
        if (selectedModels.has(modelId) || modelId in duplicateInstances) {
            sceneManager.setModelColor(modelId, color);
        }
    }

    function customColorChanged(modelId: string, event: Event) {
        const target = event.target as HTMLInputElement;
        changeColor(modelId, target.value);
    }

    // ── Duplicate selected model ──────────────────────────────────────────────

    function duplicateSelected() {
        if (!activeObjectId) return;

        const baseId = isDuplicate(activeObjectId)
            ? duplicateInstances[activeObjectId].sourceModelId
            : activeObjectId;

        dupCounters[baseId] = (dupCounters[baseId] ?? 1) + 1;
        const copyNumber = dupCounters[baseId];

        const newId = `${baseId}__dup_${copyNumber}`;
        const baseName = labelForId(baseId);
        const label = `${baseName} #${copyNumber}`;

        const result = sceneManager.duplicateModel(activeObjectId, newId);
        if (!result) return;

        const sourceColor = modelColors[activeObjectId] ?? null;
        modelColors[newId] = sourceColor;
        if (sourceColor) {
            sceneManager.setModelColor(newId, sourceColor);
        }

        duplicateInstances = {
            ...duplicateInstances,
            [newId]: { sourceModelId: baseId, label, color: sourceColor }
        };

        sceneManager.selectObject(newId);
    }

    // ── Delete models ─────────────────────────────────────────────────────────

    function deleteObjectById(id: string) {
        if (!sceneManager) return;
        sceneManager.deleteModel(id);

        if (id in duplicateInstances) {
            const { [id]: _, ...rest } = duplicateInstances;
            duplicateInstances = rest;
            const { [id]: _c, ...restColors } = modelColors;
            modelColors = restColors;
        } else {
            const next = new Set(selectedModels);
            next.delete(id);
            selectedModels = next;
        }

        if (activeObjectId === id) {
            activeObjectId = null;
        }
    }

    function deleteSelected() {
        if (!activeObjectId) return;
        deleteObjectById(activeObjectId);
    }

    // ── Transform mode ────────────────────────────────────────────────────────

    function setMode(mode: 'translate' | 'rotate') {
        transformMode = mode;
        if (sceneManager) sceneManager.setTransformMode(mode);
    }

    // ── Fullscreen ────────────────────────────────────────────────────────────

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            canvasContainer.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    function onFullscreenChange() {
        isFullscreen = !!document.fullscreenElement;
        setTimeout(() => {
            if (sceneManager) sceneManager.triggerResize();
        }, 50);
    }

    // ── Keyboard shortcuts ────────────────────────────────────────────────────

    function onKeyDown(e: KeyboardEvent) {
        if (e.target instanceof HTMLInputElement) return; // ignore typing
        if (e.key === 'Escape') { showSaveModal = false; showDesignsPanel = false; showEventsPanel = false; }
        if (!activeObjectId) return;
        if (e.key === 'g' || e.key === 'G') setMode('translate');
        if (e.key === 'r' || e.key === 'R') setMode('rotate');
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    }

    // ── Environment Image Handlers ────────────────────────────────────────────

    function handleEnvUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            envImage = e.target?.result as string;
            if (sceneManager) sceneManager.setBackgroundImage(envImage, envMode);
            // Clear input so selecting the same file again triggers change
            (e.target as any).value = ''; 
        };
        reader.readAsDataURL(file);
    }

    function updateEnvMode(mode: 'contain' | 'cover' | 'stretch' | 'original') {
        envMode = mode;
        if (sceneManager) sceneManager.setBackgroundImage(envImage, envMode);
    }

    function removeEnv() {
        envImage = null;
        if (sceneManager) sceneManager.setBackgroundImage(null);
    }

    async function compressImage(dataUrl: string): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(dataUrl);
                
                let { width, height } = img;
                const MAX_DIM = 1920;
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    } else {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = dataUrl;
        });
    }

    // ── Properties Panel Handlers ────────────────────────────────────────────

    function updateObjProps() {
        if (!activeObjectId || !sceneManager) return;
        // Apply position and rotation via applyTransform (Y-lock is re-enforced inside).
        sceneManager.applyTransform(
            activeObjectId, 
            [objProps.x, objProps.y, objProps.z],
            [THREE.MathUtils.degToRad(objProps.rx), THREE.MathUtils.degToRad(objProps.ry), THREE.MathUtils.degToRad(objProps.rz)]
        );
    }

    // ── Capture Scene ─────────────────────────────────────────────────────────

    function captureScene() {
        if (!sceneManager) return;
        const dataUrl = sceneManager.captureScene();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `DecoHub_Capture_${Date.now()}.png`;
        a.click();
    }
</script>

<svelte:head>
    <title>Studio — DecoHub 3D Viewer</title>
    <meta name="description" content="Arrange, recolor and transform furniture in your 3D design studio." />
</svelte:head>

<div class="app-container">
    <div class="sidebar">
        <a href="/" class="back-link">← DecoHub</a>
        <h1>DecoHub Studio</h1>
        
        <!-- ── Environment ── -->
        <div class="category">
            <h2>Environment</h2>
            <div class="env-controls">
                <label class="btn-ghost upload-btn">
                    Upload Image
                    <input type="file" accept="image/*" onchange={handleEnvUpload} style="display:none">
                </label>
                <label class="btn-ghost upload-btn">
                    Camera
                    <input type="file" accept="image/*" capture="environment" onchange={handleEnvUpload} style="display:none">
                </label>
            </div>
            {#if envImage}
                <div class="env-options">
                    <select bind:value={envMode} onchange={() => updateEnvMode(envMode)}>
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="original">Original / 1:1</option>
                        <option value="stretch">Stretch</option>
                    </select>
                    <button class="remove-btn" onclick={removeEnv}>Remove</button>
                </div>
            {/if}
        </div>

        <!-- ── Catalog model list ── -->
        <div class="model-picker">
            {#each modelCategories as category}
                <div class="category">
                    <h2>{category.category}</h2>
                    {#each category.models as model}
                        <div class="model-item" class:active-item={activeObjectId === model.id} class:load-error={!!loadFailures[model.id]}>
                            <div class="model-header">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedModels.has(model.id)}
                                        onchange={() => toggleModel(model)}
                                    />
                                    {model.name}
                                </label>
                                {#if selectedModels.has(model.id)}
                                    <button
                                        class="item-delete-btn"
                                        title="Remove {model.name} from scene"
                                        onclick={(e) => { e.stopPropagation(); toggleModel(model); }}
                                        aria-label="Remove {model.name}"
                                    >🗑</button>
                                {/if}
                            </div>
                            {#if loadFailures[model.id]}
                                <div class="load-error-badge" title={loadFailures[model.id]}>⚠ Failed to load</div>
                            {/if}
                            
                            {#if selectedModels.has(model.id)}
                                <div class="color-picker">
                                    <span class="color-label">Color:</span>
                                    <div class="swatches">
                                        {#each colorPalette as color}
                                            <button 
                                                class="swatch" 
                                                class:selected={modelColors[model.id] === color.value}
                                                style="background: {color.value || 'repeating-linear-gradient(45deg, #eee, #eee 5px, #ccc 5px, #ccc 10px)'};"
                                                title={color.name}
                                                onclick={() => changeColor(model.id, color.value)}
                                                aria-label={color.name}
                                            ></button>
                                        {/each}
                                        <div class="custom-color" title="Custom Color">
                                            <input 
                                                type="color" 
                                                value={modelColors[model.id] || '#ffffff'} 
                                                oninput={(e) => customColorChanged(model.id, e)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/each}
        </div>

        <!-- ── Scene Instances (duplicates) ── -->
        {#if Object.keys(duplicateInstances).length > 0}
            <div class="category instances-section">
                <h2>Scene Instances</h2>
                {#each Object.entries(duplicateInstances) as [instId, inst]}
                    <div
                        class="model-item instance-item"
                        class:active-item={activeObjectId === instId}
                        role="button"
                        tabindex="0"
                        onclick={() => sceneManager.selectObject(instId)}
                        onkeydown={(e) => e.key === 'Enter' && sceneManager.selectObject(instId)}
                    >
                        <div class="model-header">
                            <div class="instance-label">
                                <span class="instance-icon">⧉</span>
                                {inst.label}
                            </div>
                            <button
                                class="item-delete-btn"
                                title="Delete {inst.label}"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    deleteObjectById(instId);
                                }}
                                aria-label="Delete {inst.label}"
                            >🗑</button>
                        </div>

                        <div class="color-picker">
                            <span class="color-label">Color:</span>
                            <div class="swatches">
                                {#each colorPalette as color}
                                    <button 
                                        class="swatch" 
                                        class:selected={modelColors[instId] === color.value}
                                        style="background: {color.value || 'repeating-linear-gradient(45deg, #eee, #eee 5px, #ccc 5px, #ccc 10px)'};"
                                        title={color.name}
                                        onclick={(e) => { e.stopPropagation(); changeColor(instId, color.value); }}
                                        aria-label={color.name}
                                    ></button>
                                {/each}
                                <div class="custom-color" title="Custom Color">
                                    <input 
                                        type="color" 
                                        value={modelColors[instId] || '#ffffff'} 
                                        oninput={(e) => { e.stopPropagation(); customColorChanged(instId, e); }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- ── Properties Panel ── -->
        {#if activeObjectId}
            <div class="category properties-panel">
                <div class="prop-header">
                    <h2>Selected Object</h2>
                    <button
                        class="prop-delete-btn"
                        onclick={deleteSelected}
                        title="Delete selected object from scene (Del)"
                    >
                        🗑 Delete
                    </button>
                </div>
                <div class="prop-info">
                    <strong>{labelForId(activeObjectId)}</strong>
                </div>
                <div class="prop-group">
                    <label>Position</label>
                    <div class="prop-row">
                        <span>X</span><input type="number" step="0.1" bind:value={objProps.x} oninput={updateObjProps}>
                        <span>Y</span><input type="number" step="0.1" bind:value={objProps.y} oninput={updateObjProps}>
                        <span>Z</span><input type="number" step="0.1" bind:value={objProps.z} oninput={updateObjProps}>
                    </div>
                </div>
                <div class="prop-group">
                    <label>Rotation (°)</label>
                    <div class="prop-row">
                        <span>X</span><input type="number" step="1" bind:value={objProps.rx} oninput={updateObjProps}>
                        <span>Y</span><input type="number" step="1" bind:value={objProps.ry} oninput={updateObjProps}>
                        <span>Z</span><input type="number" step="1" bind:value={objProps.z} oninput={updateObjProps}>
                    </div>
                </div>

            </div>
        {/if}
    </div>
    
    <div class="canvas-container" bind:this={canvasContainer}>
        <canvas bind:this={canvas}></canvas>
        
        <div class="overlay-controls">
            <div class="top-bar">
                {#if activeObjectId}
                    <div class="transform-tools">
                        <button class:active={transformMode === 'translate'} onclick={() => setMode('translate')} title="Move (G)">Move</button>
                        <button class:active={transformMode === 'rotate'} onclick={() => setMode('rotate')} title="Rotate (R)">Rotate</button>
                        <span class="tool-divider"></span>
                        <button class="action-btn duplicate-btn" onclick={duplicateSelected} title="Duplicate selected object">⧉ Duplicate</button>
                        <button class="action-btn delete-btn" onclick={deleteSelected} title="Delete selected object (Del)">🗑 Delete</button>
                    </div>
                {:else}
                    <div class="hint">Click an object to select it</div>
                {/if}

                <div class="right-actions">
                    <button class="events-btn" onclick={() => showEventsPanel = !showEventsPanel} title="Choose 360° environment">
                        {$activeEnvironmentId ? '🌍 Change Event' : '🌍 Choose Event'}
                    </button>
                    <button class="capture-btn" onclick={captureScene} title="Capture Image">📷 Capture</button>
                    <button class="save-btn" onclick={openSaveModal} title="Save current design">💾 Save</button>
                    <button class="designs-btn" onclick={() => { showDesignsPanel = !showDesignsPanel; loadDesignsFromStorage(); }} title="My saved designs">📂 My Designs</button>
                    <button onclick={toggleFullscreen} class="fullscreen-btn" title="Toggle Fullscreen">
                        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </button>
                </div>
            </div>
        </div>

        <!-- ── Save Modal ── -->
        {#if showSaveModal}
            <button class="modal-backdrop" onclick={cancelSave} aria-label="Close save dialog"></button>
            <div class="modal" role="dialog" aria-modal="true" aria-labelledby="save-modal-title">
                <h3 id="save-modal-title">Save Design</h3>
                <label for="design-name">Name</label>
                <input id="design-name" type="text" bind:value={saveName} placeholder="My Living Room" maxlength="60" />
                <div class="modal-actions">
                    <button class="modal-cancel" onclick={cancelSave}>Cancel</button>
                    <button class="modal-confirm" onclick={confirmSave}>Save</button>
                </div>
            </div>
        {/if}

        <!-- ── My Designs Slide Panel ── -->
        {#if showDesignsPanel}
            <div class="designs-panel">
                <div class="designs-panel-header">
                    <span>My Designs</span>
                    <button class="close-panel" onclick={() => showDesignsPanel = false}>✕</button>
                </div>
                {#if savedDesigns.length === 0}
                    <div class="designs-empty">No saved designs yet.<br/>Save your first design above.</div>
                {:else}
                    <div class="designs-list">
                        {#each savedDesigns as design (design.id)}
                            <div class="design-card">
                                <div class="design-info">
                                    <span class="design-name">{design.name}</span>
                                    <span class="design-date">{formatDate(design.createdAt)} · {design.items.length} item{design.items.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div class="design-actions">
                                    <button class="load-design-btn" onclick={() => loadDesign(design)}>Load</button>
                                    <button class="delete-design-btn" onclick={() => deleteDesign(design.id)}>✕</button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        <!-- ── Events Slide Panel ── -->
        {#if showEventsPanel}
            <div class="designs-panel events-panel">
                <div class="designs-panel-header">
                    <span>360° Environments</span>
                    <button class="close-panel" onclick={() => showEventsPanel = false}>✕</button>
                </div>
                <div class="designs-list">
                    <div class="event-card" class:active-env={$activeEnvironmentId === null}>
                        <div class="event-info">
                            <span class="design-name">Default 3D Room</span>
                            <span class="design-date">Plain background</span>
                        </div>
                        <button class="load-design-btn" onclick={() => $activeEnvironmentId = null}>Select</button>
                    </div>
                    {#each eventEnvironments as env (env.id)}
                        <div class="event-card" class:active-env={$activeEnvironmentId === env.id}>
                            <div class="event-info">
                                <span class="design-name">{env.name}</span>
                                <span class="design-date">360° HDR</span>
                            </div>
                            <button class="load-design-btn" onclick={() => $activeEnvironmentId = env.id}>Select</button>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- ── Toast notification ── -->
        {#if saveToast}
            <div class="toast">{saveToast}</div>
        {/if}
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        overflow: hidden;
    }
    
    .app-container {
        display: flex;
        height: 100vh;
        width: 100vw;
    }
    
    .sidebar {
        width: 320px;
        background: #f8f9fa;
        padding: 20px;
        box-shadow: 2px 0 10px rgba(0,0,0,0.1);
        z-index: 10;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
    }

    .back-link {
        display: inline-block;
        margin-bottom: 12px;
        font-size: 0.85rem;
        color: #7C6A5A;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
    }
    .back-link:hover { color: #C9A96E; }
    
    h1 {
        font-size: 1.5rem;
        margin-top: 0;
        color: #333;
        border-bottom: 2px solid #ddd;
        padding-bottom: 10px;
    }
    
    .category h2 {
        font-size: 1.1rem;
        color: #666;
        margin-top: 20px;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .model-item {
        margin-bottom: 15px;
        padding: 15px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        border: 2px solid transparent;
        transition: border-color 0.2s;
    }
    
    .model-item.active-item {
        border-color: #007bff;
        box-shadow: 0 0 8px rgba(0, 123, 255, 0.2);
    }

    .model-item.load-error { border-color: #dc3545; }

    .load-error-badge {
        margin-top: 8px;
        padding: 4px 8px;
        background: #fff0f0;
        color: #dc3545;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        cursor: pointer;
        font-size: 1rem;
    }
    
    .color-picker {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px dashed #eee;
    }
    
    .color-label {
        display: block;
        font-size: 0.85rem;
        color: #666;
        margin-bottom: 8px;
    }
    
    .swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    
    .swatch {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #ccc;
        cursor: pointer;
        padding: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.1s, border-color 0.1s;
    }
    .swatch:hover { transform: scale(1.1); }
    .swatch.selected {
        border-color: #007bff;
        transform: scale(1.1);
        box-shadow: 0 0 0 2px white, 0 0 0 4px #007bff;
    }
    
    .custom-color {
        width: 24px; height: 24px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #ccc;
        cursor: pointer;
        display: inline-block;
    }
    .custom-color input[type="color"] {
        padding: 0; width: 150%; height: 150%;
        margin: -25%; border: none; cursor: pointer;
    }

    .instances-section {
        border-top: 2px solid #e0e0e0;
        padding-top: 5px;
        margin-top: 10px;
    }
    .instance-item { cursor: pointer; }
    .instance-item:hover { border-color: #80bdff; }
    .instance-label {
        display: flex; align-items: center; gap: 8px;
        font-weight: 600; font-size: 1rem; color: #333;
    }
    .instance-icon { font-size: 1.1rem; color: #007bff; flex-shrink: 0; }

    /* ── Inline delete button on sidebar model cards ── */
    .model-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    .model-header label {
        flex: 1;
        min-width: 0;
    }
    .item-delete-btn {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 1rem;
        line-height: 1;
        cursor: pointer;
        color: #aaa;
        opacity: 0;
        transition: opacity 0.15s, color 0.15s, background 0.15s;
    }
    .model-item:hover .item-delete-btn,
    .model-item.active-item .item-delete-btn {
        opacity: 1;
    }
    .item-delete-btn:hover {
        color: #dc3545;
        background: #fdecea;
    }
    
    .canvas-container {
        flex: 1; position: relative;
        min-width: 0; min-height: 0; overflow: hidden;
    }
    canvas { display: block; width: 100%; height: 100%; outline: none; }
    
    .overlay-controls {
        position: absolute; top: 20px; left: 20px; right: 20px;
        pointer-events: none;
    }
    .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
    }
    .hint {
        background: rgba(0,0,0,0.5); color: white;
        padding: 8px 12px; border-radius: 4px; font-size: 0.9rem;
    }
    .transform-tools, .right-actions { pointer-events: auto; }
    .transform-tools {
        display: flex; align-items: stretch;
        background: white; border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden;
    }
    .transform-tools button {
        background: transparent; border: none;
        padding: 10px 16px; font-weight: 600;
        cursor: pointer; color: #555;
        border-right: 1px solid #eee;
        transition: background 0.2s, color 0.2s; white-space: nowrap;
    }
    .transform-tools button:last-child { border-right: none; }
    .transform-tools button:hover { background: #f0f0f0; }
    .transform-tools button.active { background: #007bff; color: white; }
    .tool-divider {
        display: block; width: 1px; background: #ddd; margin: 6px 0; flex-shrink: 0;
    }
    .action-btn { font-size: 0.9rem; }
    .duplicate-btn { color: #007bff !important; }
    .duplicate-btn:hover { background: #e8f0fe !important; color: #0056b3 !important; }
    .delete-btn { color: #dc3545 !important; }
    .delete-btn:hover { background: #fdecea !important; color: #b02a37 !important; }

    /* Right-side action buttons */
    .right-actions {
        display: flex; gap: 8px; align-items: center;
    }
    .save-btn, .designs-btn, .fullscreen-btn, .events-btn, .capture-btn {
        background: white; border: none;
        padding: 10px 14px; border-radius: 6px;
        font-weight: 600; cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); color: #333;
        transition: background 0.2s; font-size: 0.9rem;
        white-space: nowrap;
    }
    .save-btn:hover, .designs-btn:hover, .fullscreen-btn:hover, .events-btn:hover, .capture-btn:hover { background: #f0f0f0; }
    .save-btn { color: #1a7a4a; }
    .designs-btn { color: #5c4033; }
    .events-btn { color: #0056b3; }
    .capture-btn { color: #007bff; }

    /* ── Environment & Properties ── */
    .env-controls { display: flex; gap: 8px; margin-bottom: 10px; }
    .upload-btn { flex: 1; text-align: center; padding: 6px; font-size: 0.85rem; cursor: pointer; background: #C9A96E; border: 1px solid #C9A96E; color: white; border-radius: 4px; box-sizing: border-box; }
    .upload-btn:hover { background: #b8924e; border-color: #b8924e; color: white; }
    .env-options { display: flex; gap: 8px; align-items: center; }
    .env-options select { flex: 1; padding: 4px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.85rem;}
    .remove-btn { padding: 4px 8px; background: #fdecea; color: #dc3545; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
    .remove-btn:hover { background: #f5c2c7; }

    .properties-panel { background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-top: 20px; border-top: 2px solid #e0e0e0; }
    .prop-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 4px;
        margin-bottom: 12px;
    }
    .prop-header h2 {
        margin: 0;
        font-size: 1.05rem;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .prop-delete-btn {
        background: #fdecea;
        color: #dc3545;
        border: 1px solid #f5c2c7;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .prop-delete-btn:hover {
        background: #dc3545;
        color: white;
        border-color: #dc3545;
    }
    .prop-info { margin-bottom: 12px; font-size: 0.95rem; color: #333; }
    .prop-group { margin-bottom: 12px; }
    .prop-group label { display: block; font-size: 0.8rem; color: #666; margin-bottom: 4px; font-weight: 600; }
    .prop-row { display: flex; align-items: center; gap: 4px; }
    .prop-row span { font-size: 0.8rem; color: #888; font-weight: 600; }
    .prop-row input[type="number"] { width: 100%; min-width: 0; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; }


    /* ── Save Modal ── */
    .modal-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.45);
        border: none; cursor: default;
        z-index: 100; pointer-events: auto;
        padding: 0; margin: 0;
    }
    .modal {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: white; border-radius: 12px;
        padding: 28px 32px; min-width: 320px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        display: flex; flex-direction: column; gap: 14px;
        z-index: 101; pointer-events: auto;
    }
    .modal h3 { margin: 0; font-size: 1.2rem; color: #1C1917; }
    .modal label { font-size: 0.85rem; color: #7C6A5A; font-weight: 600; }
    .modal input[type="text"] {
        width: 100%; padding: 10px 12px; border: 1.5px solid #ddd;
        border-radius: 8px; font-size: 1rem; box-sizing: border-box;
        outline: none; transition: border-color 0.2s;
    }
    .modal input[type="text"]:focus { border-color: #C9A96E; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .modal-cancel {
        padding: 9px 20px; border: 1.5px solid #ddd;
        border-radius: 8px; background: white; cursor: pointer;
        font-weight: 600; color: #666; transition: background 0.2s;
    }
    .modal-cancel:hover { background: #f5f5f5; }
    .modal-confirm {
        padding: 9px 20px; border: none;
        border-radius: 8px; background: #C9A96E; cursor: pointer;
        font-weight: 700; color: white; transition: background 0.2s;
    }
    .modal-confirm:hover { background: #b8924e; }

    /* ── My Designs Panel ── */
    .designs-panel {
        position: absolute; top: 0; right: 0; bottom: 0;
        width: 300px; background: white;
        box-shadow: -4px 0 20px rgba(0,0,0,0.15);
        display: flex; flex-direction: column;
        z-index: 50; pointer-events: auto;
    }
    .designs-panel-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 18px 20px; border-bottom: 1px solid #eee;
        font-weight: 700; font-size: 1rem; color: #1C1917;
    }
    .close-panel {
        background: none; border: none; cursor: pointer;
        font-size: 1.1rem; color: #999; padding: 0 4px;
        transition: color 0.2s;
    }
    .close-panel:hover { color: #333; }
    .designs-empty {
        padding: 32px 20px; color: #999; text-align: center;
        font-size: 0.9rem; line-height: 1.6;
    }
    .designs-list { overflow-y: auto; flex: 1; padding: 12px; }
    .design-card, .event-card {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px; border: 1.5px solid #eee; border-radius: 10px;
        margin-bottom: 10px; background: #fafafa;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .design-card:hover, .event-card:hover { border-color: #C9A96E; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
    .event-card.active-env { border-color: #007bff; background: #e8f0fe; }
    .design-info, .event-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .design-name { font-weight: 700; font-size: 0.95rem; color: #1C1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .design-date { font-size: 0.78rem; color: #9e8878; }
    .design-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .load-design-btn {
        padding: 6px 12px; background: #C9A96E; color: white;
        border: none; border-radius: 6px; cursor: pointer;
        font-weight: 700; font-size: 0.82rem; transition: background 0.2s;
    }
    .load-design-btn:hover { background: #b8924e; }
    .delete-design-btn {
        padding: 6px 10px; background: #fdecea; color: #dc3545;
        border: none; border-radius: 6px; cursor: pointer;
        font-weight: 700; font-size: 0.82rem; transition: background 0.2s;
    }
    .delete-design-btn:hover { background: #f5c2c7; }

    /* ── Toast ── */
    .toast {
        position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #1C1917; color: white;
        padding: 10px 20px; border-radius: 8px;
        font-size: 0.9rem; font-weight: 600;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        pointer-events: none; z-index: 200;
        animation: toastIn 0.3s ease;
    }
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(10px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    
    @media (max-width: 768px) {
        .app-container { flex-direction: column; }
        .sidebar { width: 100%; height: auto; max-height: 40vh; padding: 15px; box-sizing: border-box; }
        .designs-panel { width: 100%; top: auto; height: 60%; }
    }
</style>
