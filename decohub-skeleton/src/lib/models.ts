/**
 * Per-model auto-scale configuration used by the surface-relative placement system.
 *
 * targetFillRatio  — fraction of the surface's smaller dimension the model should occupy
 *                    e.g. 0.5 means the model footprint fills 50 % of the surface width.
 * minScale / maxScale — hard clamps so detection noise / huge/tiny surfaces
 *                       never produce absurd results.
 */
export interface AutoScaleConfig {
    targetFillRatio: number;
    minScale: number;
    maxScale: number;
}

/**
 * The effective "local surface size" (in Three.js metres) used when a model
 * is placed directly on the virtual floor with no object selected.
 *
 * The virtual floor is 20×20 units, but using its full extent would make every
 * model enormous. We instead treat a single grid cell (~1.5 m) as the sensible
 * local context — comparable to a typical furniture placement zone on a real floor.
 * Tune this constant to adjust how large floor-placed furniture appears by default.
 */
export const FLOOR_SURFACE_SIZE_M = 1.5;

/**
 * Height ratios expressing each furniture / decor category's height as a fraction
 * of the reference object's height (designated as `table` = 1.0).
 *
 * Example:
 *   table: 1.0
 *   chair: 0.6  (standard chair height is ~60% of table height)
 *   bench: 0.5  (backless bench or stool is ~50% of table height)
 *   vase: 0.15  (small accessory sitting on tabletop)
 */
export const heightRatios: Record<string, number> = {
    table: 1.0,
    chair: 0.6,
    bench: 0.5,
    vase: 0.15,
    coffee_table: 0.5,
    office_chair: 0.8,
    decor: 0.15,
    // Category-level fallbacks
    Tables: 1.0,
    Seating: 0.6,
    Decor: 0.15
};

export const REFERENCE_CATEGORY_KEY = 'table';
export const DEFAULT_REFERENCE_HEIGHT = 0.8;

/**
 * Reference model configuration.
 * Reference model: Glass Table (`free_glasstable.glb`).
 *   - Height: 0.90 m (measured raw GLB bounding-box height is ~0.8998 m)
 *   - Width:  1.11 m (measured raw GLB bounding-box diameter is ~1.1091 m)
 */
export const TABLE_REFERENCE_CONFIG = {
    defaultHeight: 0.90,   // Glass table bounding-box height (0.8998 m)
    glassTableWidth: 1.11  // Glass table horizontal width / diameter (1.1091 m)
};

export const DEFAULT_HEIGHT = TABLE_REFERENCE_CONFIG.defaultHeight;
export const GLASS_TABLE_WIDTH = TABLE_REFERENCE_CONFIG.glassTableWidth;

/**
 * Checks if a model represents a round table specifically.
 */
export function isRoundTable(id: string): boolean {
    const lower = id.toLowerCase();
    return lower === 'round_table' || lower.includes('round_table');
}

/**
 * Checks if a model belongs to the "Tables" category.
 */
export function isTable(id: string, category?: string): boolean {
    if (category === 'Tables') return true;
    return detectCategory(id) === 'Tables';
}

/**
 * Reference chair configuration.
 * Reference model: Plastic Chair (`plastic_chair.glb`).
 *   - Height: 0.88 m (measured raw GLB bounding-box height: ~0.8798 m)
 *   - Width:  0.64 m (measured raw GLB bounding-box width:  ~0.6419 m)
 */
export const CHAIR_REFERENCE_CONFIG = {
    defaultHeight: 0.88, // Plastic chair bounding-box height (0.8798 m)
    defaultWidth: 0.64   // Plastic chair bounding-box width (0.6419 m)
};

export const CHAIR_DEFAULT_HEIGHT = CHAIR_REFERENCE_CONFIG.defaultHeight;
export const CHAIR_DEFAULT_WIDTH = CHAIR_REFERENCE_CONFIG.defaultWidth;

/**
 * Checks if a chair model should be 2D scaled to match the plastic chair reference.
 * Targets the Flynn Dining Chair and Jelly Acrylic Chair.
 */
export function isScaledChair(id: string): boolean {
    const lower = id.toLowerCase();
    return lower.includes('flynn') || lower.includes('jelly');
}

/**
 * Checks if a model is the reference plastic chair.
 */
export function isReferenceChair(id: string): boolean {
    const lower = id.toLowerCase();
    return lower === 'plastic_chair' || lower.includes('plastic_chair');
}

export interface DecorModel {
    id: string;
    name: string;
    file: string;
    category?: string;
    categoryKey?: string;
    heightRatio?: number;
    /**
     * Approximate real-world height of this furniture piece in metres.
     * Legacy fallback when reference-relative scaling is not used.
     */
    realHeightMeters?: number;
    /** Target max dimension (in Three.js units) for auto-normalization on load.
     *  Fallback when realHeightMeters is not defined. */
    targetSize?: number;
    /** Surface-relative auto-scale configuration applied at placement time. */
    autoScale?: AutoScaleConfig;
}

export interface ModelCategory {
    category: string;
    models: DecorModel[];
}

const KNOWN_METADATA: Record<string, {
    name?: string;
    category?: string;
    categoryKey?: string;
    heightRatio?: number;
    realHeightMeters?: number;
    targetSize?: number;
    autoScale?: AutoScaleConfig;
}> = {
    // ── Tables (Reference baseline = 1.0) ────────────────────────────────────
    round_table:              { name: "Round Table",        category: "Tables", categoryKey: "table",        heightRatio: 1.0,  realHeightMeters: 0.75, autoScale: { targetFillRatio: 0.80, minScale: 0.5, maxScale: 3.0 } },
    free_glasstable:          { name: "Glass Table",        category: "Tables", categoryKey: "table",        heightRatio: 1.0,  realHeightMeters: 0.75, autoScale: { targetFillRatio: 0.80, minScale: 0.5, maxScale: 3.0 } },
    glass_waiting_room_table: { name: "Waiting Room Table", category: "Tables", categoryKey: "coffee_table", heightRatio: 0.5,  realHeightMeters: 0.50, autoScale: { targetFillRatio: 0.80, minScale: 0.5, maxScale: 3.0 } },
    coffee_table:             { name: "Coffee Table",       category: "Tables", categoryKey: "coffee_table", heightRatio: 0.5,  realHeightMeters: 0.45, autoScale: { targetFillRatio: 0.80, minScale: 0.4, maxScale: 2.5 } },
    wooden_table:             { name: "Wooden Table",       category: "Tables", categoryKey: "table",        heightRatio: 1.0,  realHeightMeters: 0.75, autoScale: { targetFillRatio: 0.80, minScale: 0.5, maxScale: 3.0 } },

    // ── Seating (Ratios: chair = 0.6, office_chair = 0.8) ────────────────────
    luxury_baroque_dining_chair:                 { name: "Baroque Dining Chair", category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.95, targetSize: 1.0, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },
    old_wooden_chair:                            { name: "Wooden Chair",          category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.90, targetSize: 1.0, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },
    set_of_2_flynn_dining_chairs_midnight_black: { name: "Flynn Dining Chairs",   category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.95, targetSize: 1.2, autoScale: { targetFillRatio: 0.60, minScale: 0.5, maxScale: 2.0 } },
    set_of_2_jelly_acrylic_chairs_clear:         { name: "Jelly Acrylic Chairs",  category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.90, targetSize: 1.2, autoScale: { targetFillRatio: 0.60, minScale: 0.5, maxScale: 2.0 } },
    dining_chair:                                { name: "Dining Chair",          category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.90, targetSize: 1.0, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },
    leather_office_chair:                        { name: "Leather Office Chair",  category: "Seating", categoryKey: "office_chair", heightRatio: 0.8, realHeightMeters: 1.15, targetSize: 1.1, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },
    office_chair:                                { name: "Office Chair",          category: "Seating", categoryKey: "office_chair", heightRatio: 0.8, realHeightMeters: 1.10, targetSize: 1.1, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },
    plastic_chair:                               { name: "Plastic Chair",         category: "Seating", categoryKey: "chair",        heightRatio: 0.6, realHeightMeters: 0.85, targetSize: 1.0, autoScale: { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 } },

    // ── Decor (Ratios: vase = 0.15, decor = 0.15) ────────────────────────────
    magnolia_in_a_vase: { name: "Magnolia in Vase", category: "Decor", categoryKey: "vase",  heightRatio: 0.15, realHeightMeters: 0.60, targetSize: 0.6, autoScale: { targetFillRatio: 0.35, minScale: 0.15, maxScale: 0.8 } },
    candle_holder:      { name: "Candle Holder",     category: "Decor", categoryKey: "decor", heightRatio: 0.15, realHeightMeters: 0.25, targetSize: 0.3, autoScale: { targetFillRatio: 0.25, minScale: 0.10, maxScale: 0.5 } },
    flowers_in_vase:    { name: "Flowers in Vase",   category: "Decor", categoryKey: "vase",  heightRatio: 0.15, realHeightMeters: 0.55, targetSize: 0.6, autoScale: { targetFillRatio: 0.35, minScale: 0.15, maxScale: 0.8 } },
    potted_flower:      { name: "Potted Flower",      category: "Decor", categoryKey: "vase",  heightRatio: 0.15, realHeightMeters: 0.45, targetSize: 0.5, autoScale: { targetFillRatio: 0.35, minScale: 0.15, maxScale: 0.8 } },
    vase_flower_pot:    { name: "Vase Flower Pot",    category: "Decor", categoryKey: "vase",  heightRatio: 0.15, realHeightMeters: 0.40, targetSize: 0.5, autoScale: { targetFillRatio: 0.30, minScale: 0.12, maxScale: 0.7 } }
};

function formatName(id: string): string {
    return id
        .replace(/^set_of_\d+_/, '')
        .replace(/^(free_|luxury_)/, '')
        .replace(/[-_]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function detectCategory(id: string): "Tables" | "Seating" | "Decor" {
    const lower = id.toLowerCase();
    if (lower.includes('chair') || lower.includes('seating') || lower.includes('bench') || lower.includes('stool') || lower.includes('sofa') || lower.includes('couch')) {
        return "Seating";
    }
    if (lower.includes('table') || lower.includes('desk')) {
        return "Tables";
    }
    return "Decor";
}

/**
 * Maps a model ID and category to a specific ratio table key.
 */
export function detectCategoryKey(id: string, category?: string): string {
    const lower = id.toLowerCase();
    if (lower.includes('coffee_table') || lower.includes('waiting_room_table')) return 'coffee_table';
    if (lower.includes('office_chair')) return 'office_chair';
    if (lower.includes('bench')) return 'bench';
    if (lower.includes('chair') || lower.includes('stool')) return 'chair';
    if (lower.includes('vase') || lower.includes('flower') || lower.includes('pot') || lower.includes('magnolia')) return 'vase';
    if (lower.includes('candle') || lower.includes('holder') || lower.includes('lamp')) return 'decor';
    if (lower.includes('table') || lower.includes('desk')) return 'table';

    if (category === 'Tables') return 'table';
    if (category === 'Seating') return 'chair';
    if (category === 'Decor') return 'vase';
    return 'decor';
}

export function getHeightRatio(categoryKeyOrId: string): number {
    return heightRatios[categoryKeyOrId] ?? heightRatios[detectCategoryKey(categoryKeyOrId)] ?? 0.5;
}

function detectTargetSize(category: string): number | undefined {
    if (category === "Seating") return 1.0;
    if (category === "Decor") return 0.5;
    return undefined;
}

/**
 * Fallback real-world height estimate for models not listed in KNOWN_METADATA.
 * Based on typical furniture dimensions by category.
 */
function detectRealHeight(category: string): number {
    if (category === "Tables")  return 0.75; // standard table height
    if (category === "Seating") return 0.90; // typical chair back height
    // Decor: small accessory default
    return 0.50;
}

/**
 * Default auto-scale config for models not explicitly listed in KNOWN_METADATA.
 * Uses conservative ratios so unknowns don't auto-scale to extreme sizes.
 */
export function getDefaultAutoScaleConfig(category: string): AutoScaleConfig {
    if (category === "Tables")  return { targetFillRatio: 0.80, minScale: 0.5, maxScale: 3.0 };
    if (category === "Seating") return { targetFillRatio: 0.50, minScale: 0.4, maxScale: 2.0 };
    // Decor (default)
    return { targetFillRatio: 0.35, minScale: 0.15, maxScale: 0.8 };
}

export function buildModelCategories(): ModelCategory[] {
    const rawModules = import.meta.glob('/static/models/*.glb', {
        eager: true,
        query: '?url',
        import: 'default'
    });

    const tables: DecorModel[] = [];
    const seating: DecorModel[] = [];
    const decor: DecorModel[] = [];

    const fileKeys = Object.keys(rawModules);

    for (const key of fileKeys) {
        const match = key.match(/\/static\/models\/(.+)\.glb$/);
        if (!match) continue;
        const filename = match[1];
        const id = filename;
        const file = key.replace(/^\/static/, '');
        const meta = KNOWN_METADATA[id] || {};

        const name = meta.name || formatName(id);
        const category = meta.category || detectCategory(id);
        const categoryKey = meta.categoryKey || detectCategoryKey(id, category);
        const heightRatio = meta.heightRatio !== undefined ? meta.heightRatio : getHeightRatio(categoryKey);
        const realHeightMeters = meta.realHeightMeters !== undefined ? meta.realHeightMeters : detectRealHeight(category);
        const targetSize = meta.targetSize !== undefined ? meta.targetSize : detectTargetSize(category);
        const autoScale = meta.autoScale ?? getDefaultAutoScaleConfig(category);

        const model: DecorModel = { id, name, file, category, categoryKey, heightRatio, realHeightMeters, targetSize, autoScale };

        if (category === "Tables") tables.push(model);
        else if (category === "Seating") seating.push(model);
        else decor.push(model);
    }

    const categories: ModelCategory[] = [];
    if (tables.length > 0) categories.push({ category: "Tables", models: tables });
    if (seating.length > 0) categories.push({ category: "Seating", models: seating });
    if (decor.length > 0) categories.push({ category: "Decor", models: decor });

    return categories;
}

export const modelCategories: ModelCategory[] = buildModelCategories();

export const colorPalette = [
    { name: 'Original', value: null },
    // Neutrals
    { name: 'White', value: '#ffffff' },
    { name: 'Off White', value: '#f5f5f5' },
    { name: 'Light Gray', value: '#d3d3d3' },
    { name: 'Gray', value: '#808080' },
    { name: 'Dark Gray', value: '#404040' },
    { name: 'Black', value: '#111111' },
    // Woods/Earth
    { name: 'Light Wood', value: '#d2b48c' },
    { name: 'Oak', value: '#a0522d' },
    { name: 'Walnut', value: '#5c4033' },
    { name: 'Mahogany', value: '#4a0404' },
    { name: 'Beige', value: '#f5f5dc' },
    // Colors
    { name: 'Red', value: '#c0392b' },
    { name: 'Orange', value: '#d35400' },
    { name: 'Yellow', value: '#f39c12' },
    { name: 'Green', value: '#27ae60' },
    { name: 'Teal', value: '#16a085' },
    { name: 'Blue', value: '#2980b9' },
    { name: 'Navy', value: '#2c3e50' },
    { name: 'Purple', value: '#8e44ad' },
    { name: 'Pink', value: '#e84393' }
];

export const getAllModels = (): DecorModel[] => {
    const all: DecorModel[] = [];
    buildModelCategories().forEach(c => all.push(...c.models));
    return all;
};
