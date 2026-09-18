# DecoHub 3D Viewer

DecoHub 3D Viewer is a pure client-side 3D web application that allows users to seamlessly pick, recolor, position, and view various decor models in a single interactive Three.js environment.

## Tools & Technologies Used
- **SvelteKit** & **Svelte 5** (UI framework)
- **TypeScript** (Strong typing and tooling)
- **Three.js** v0.160+ (3D rendering and model loading)
- **Vite** (Build tool)

## Features
- **Categorized Model Picking**: Select from a growing library of 3D models organized into Tables, Seating, and Decor.
- **Advanced Coloring**: Use a broad palette of 20+ preset colors, or use a custom color picker to exactly match any hue you desire.
- **Full Scene Composition**: Utilize native Three.js `TransformControls`. Click any object to select it, then freely Move (G), Rotate (R), and Scale (S) the object within your environment.
- **Fullscreen Presentation Mode**: Expand the 3D canvas to your entire viewport with a native fullscreen integration—perfect for presentations without sacrificing interactivity.
- **Interactive 3D Viewing**: Full support for orbiting, panning, and zooming around the scene with responsive canvas sizing.

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local URL (usually `http://localhost:5173`).

## Project Structure
- `src/routes/+page.svelte` - Main Svelte UI (Sidebar, swatches, transform buttons, and fullscreen logic).
- `src/lib/Scene.ts` - Core Three.js engine (Model loading, raycasting selection, `TransformControls` implementation, layout, and colors).
- `src/lib/models.ts` - Central model categorization data and color swatches map.
- `static/models/` - Source for all `.glb` assets used in the application.

## Controls Guide
- **Left-Click & Drag (Background)**: Orbit camera.
- **Right-Click & Drag (Background)**: Pan camera.
- **Scroll Wheel**: Zoom camera.
- **Left-Click (Object)**: Select object to activate Transform Controls.
- **Transform Modes**:
  - `G` Key or "Move" Button: Translate selected object along X, Y, Z axes.
  - `R` Key or "Rotate" Button: Rotate selected object.
  - `S` Key or "Scale" Button: Scale selected object.

## Model Credits
- **Wooden Table**: [Add License/Source Info]
- **Coffee Table**: [Add License/Source Info]
- **Dining Chair**: [Add License/Source Info]
- **Office Chair**: [Add License/Source Info]
- **Leather Office Chair**: [Add License/Source Info]
- **Plastic Chair**: [Add License/Source Info]
- **Potted Flower**: [Add License/Source Info]
- **Flowers in Vase**: [Add License/Source Info]
- **Vase Flower Pot**: [Add License/Source Info]

## Future Improvements
- **Collision & Snapping**: Enable objects to automatically snap to surfaces (like placing a flower pot perfectly onto a table) instead of floating.
- **Persistence**: Save scene layouts, coordinates, and color settings to `localStorage` or via a URL hash to share room builds with others.
- **Advanced Texturing**: Go beyond solid colors by offering real PBR material swapping (e.g., swapping wood grains for metal finishes).
