# DecoHub

Web-based 3D furniture/decoration staging app — SvelteKit + Three.js.

This repo is a **skeleton**: folder structure, empty modules, and route stubs
are already in place so all 8 of us can build our parts in parallel without
stepping on each other's files. Each file below says who owns it.

---

## 1. Getting the repo onto your machine

```bash
git clone <REPO_URL>
cd decohub
npm install
npm run dev
```

This opens the dev server (usually `http://localhost:5173`).

## 2. Branch workflow (do this, don't push straight to main)

```bash
git checkout -b feature/<your-name>-<your-part>
# e.g. git checkout -b feature/henry-scene-core

# ...do your work...

git add .
git commit -m "Add: <short description>"
git push -u origin feature/<your-name>-<your-part>
```

Then open a Pull Request into `main` on GitHub so someone else can glance
over it before it merges. This avoids two people's work colliding directly
on `main`.

## 3. Pull before you start each session

```bash
git checkout main
git pull
git checkout feature/<your-name>-<your-part>
git merge main
```

Keeps your branch up to date with everyone else's merged work.

---

## Collaborator breakdown

| # | Collaborator | Owns | Key files |
|---|---|---|---|
| 1 | Landing Page & UI Shell | Home page, hero, nav, "Start Designing" CTA | `src/routes/+page.svelte`, shared UI in `src/lib/components/` |
| 2 | 3D Scene Core | Three.js scene/camera/renderer/lighting setup, render loop, resize handling | `src/routes/studio/+page.svelte`, `src/lib/three/scene.js`, `src/lib/stores/scene-store.js` |
| 3 | Model Library & Loading | GLTFLoader, categorisation (tables/seating/decor), model sidebar UI | `src/lib/three/model-loader.js`, `src/lib/components/ModelSidebar.svelte`, `static/models/` |
| 4 | Selection & Transform Controls | Click-to-select (raycasting), move/rotate/scale, duplicate/delete with disposal | `src/lib/three/transform-controls.js` |
| 5 | Colour Customisation | Per-instance material cloning, preset swatches, custom colour picker | `src/lib/three/colour-customisation.js`, `src/lib/components/ColourPanel.svelte` |
| 6 | Camera Controls & Fullscreen | OrbitControls (orbit/zoom/pan), fullscreen toggle | `src/lib/three/camera-controls.js` |
| 7 | Save/Load & Presets | Scene serialisation to localStorage, presets panel loading full interactive scenes | `src/lib/three/scene-storage.js`, `src/lib/components/PresetsPanel.svelte` |
| 8 | Auth, Testing & Deployment | Sign up/login/logout, gating `/studio`, cross-feature testing pass, deployment | `src/routes/login/+page.svelte` |

Every file that's "yours" above has a `TODO (Collaborator N)` comment block
at the top explaining exactly what goes there and which other files it
needs to talk to. Read that comment before you start.

## Folder structure

```
decohub/
├── src/
│   ├── routes/
│   │   ├── +page.svelte          # Collaborator 1
│   │   ├── studio/+page.svelte   # Collaborator 2
│   │   └── login/+page.svelte    # Collaborator 8
│   ├── lib/
│   │   ├── three/
│   │   │   ├── scene.js               # Collaborator 2
│   │   │   ├── model-loader.js        # Collaborator 3
│   │   │   ├── transform-controls.js  # Collaborator 4
│   │   │   ├── colour-customisation.js# Collaborator 5
│   │   │   ├── camera-controls.js     # Collaborator 6
│   │   │   └── scene-storage.js       # Collaborator 7
│   │   ├── components/
│   │   │   ├── ModelSidebar.svelte    # Collaborator 3
│   │   │   ├── ColourPanel.svelte     # Collaborator 5
│   │   │   └── PresetsPanel.svelte    # Collaborator 7
│   │   └── stores/
│   │       └── scene-store.js         # shared — set by Collaborator 2
│   └── app.html
├── static/
│   └── models/
│       ├── tables/    # Collaborator 3 drops .glb files here
│       ├── seating/
│       └── decor/
├── package.json
├── svelte.config.js
└── vite.config.js
```

## Notes to avoid inconveniences

- **Don't rename shared files** (`scene.js`, `scene-store.js`) without telling
  everyone — other people's modules import from them by that exact path.
- **Collaborator 2 goes first** where possible — the scene needs to exist
  before models can be loaded into it, before transform controls can attach
  to anything, before camera controls have a camera to control. Everyone
  else can build against the store/exports even before Collaborator 2 is
  fully done, since the function signatures are already stubbed.
- Put your actual `.glb` model files under `static/models/<category>/` —
  don't commit huge binaries straight to `main` without checking with
  Collaborator 3 first.
- Run `npm run dev` before every push to make sure you haven't broken the
  build for everyone else.
