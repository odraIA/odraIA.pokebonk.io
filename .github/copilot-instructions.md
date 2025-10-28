<!-- .github/copilot-instructions.md - guidance for AI coding agents in this repo -->
# Pokebonk (Three.js demo) — Instructions for AI coding agents

This repository is a small browser game/demo built with Three.js and FBX/GLTF assets. Use this file as the canonical, discoverable guide for automated coding agents so they can be productive quickly.

Quick context
- Single-page web app served from `index.html`.
- Main application logic in `js/pokebonk.js` (game loop, input, terrain, entities, asset loading).
- Shaders/helpers live in `js/setshaders.js` and `js/setexternalshaders.js` (simple WebGL shader helpers; legacy patterns).
- Third-party libs are in `lib/` (Three r140, FBX/GLTF loaders, physics libs). Models are under `models/`.

Essential architecture notes (what to read first)
- Read `index.html` to see which libs are loaded and the script order (Three.js, loaders, then `js/pokebonk.js`).
- `js/pokebonk.js` is the single largest file: it contains init(), render(), update(dt), asset loading (FBX/GLTF), animation mixer usage, and simple enemy/player logic. Focus on this file for most changes.
- Rendering: a single `THREE.WebGLRenderer` with a perspective main camera (`camera`) and an orthographic top camera (`cameraTop`) used as a minimap.
- Asset pipeline: FBX models are loaded with `THREE.FBXLoader` and normalized via `normalizeAndFloor()`. GLTF models use `THREE.GLTFLoader` (trees, fireball). Keep relative paths consistent with `index.html` (loader paths are relative to the page).

Project conventions and gotchas
- No build system. The app runs by opening `index.html` in a browser (or a simple static server). Changes to files load on refresh. There is no package.json.
- Asset paths are relative to the page. Loader.setPath('models/') or loader.load('models/...') appears in code — do not change to absolute paths unless you also update `index.html` or hosting.
- Animation handling: animations are loaded as FBX clips and stored in arrays keyed by descriptive names (e.g. `actions[name]`, `e_actions[...]`). Some clips are processed by `stripScaleTracks()` to remove scale tracks for consistent animation. Preserve this pattern when adding animations.
- Two-pass normalization: `normalizeAndFloor()` scales models in two passes to target heights. New character models should use this to maintain consistent in-game sizes.
- Materials: when operating on FBX/GLTF meshes, code forces sRGB on texture maps and sets `m.skinning = !!n.isSkinnedMesh`. Follow this to avoid color/animation issues.
- Performance: the terrain is generated on CPU into a large BufferGeometry (segments=400). Avoid regenerating the entire terrain every frame. Use lower `segments` for quick local testing.

Common tasks and examples
- Add a new enemy model: put assets in `models/<name>/`, load using `THREE.FBXLoader`, call `normalizeAndFloor(prefab, ENEMY_TARGET_HEIGHT)`, clone prefab in `spawnEnemies()` and attach a per-enemy `AnimationMixer`.
- Add a new GLTF prop: place under `models/`, load with `GLTFLoader`, clone via `.clone(true)` and set `castShadow/receiveShadow` as done in `loadAndPlaceTrees()`.
- Debugging animation issues: ensure textures use `map.encoding = THREE.sRGBEncoding` and that materials used for skinned meshes have `skinning=true`.

Development and run notes (how I tested locally)
- Run a static server from repo root (recommended): e.g. `npx http-server -c-1 .` or Python simple server. Open `http://localhost:8080/` (port depends on server).
- Browser must support pointer lock for first-person controls. Test in Chrome/Edge/Firefox with console open for loader errors.

Files and places to inspect for changes
- `index.html` — script load order and external deps.
- `js/pokebonk.js` — main logic (game loop, input, asset loading). Example functions to reference: `init()`, `loadTerrain()`, `addPlayer()`, `loadMewtwo()`, `spawnEnemies()`, `update(dt)`, `normalizeAndFloor()`.
- `js/setshaders.js`, `js/setexternalshaders.js` — legacy shader loader helpers (synchronous XHR/jQuery usage). Prefer modern async fetch if refactoring.
- `lib/` — vendor libraries; don't edit unless you know the upstream change implications.

What NOT to change without testing
- Loader ordering in `index.html` — changing loader order may break FBX/GLTF usage.
- Texture encodings and `skinning` flags — changing these causes visual or animation breakage.
- Terrain generation parameters (`R`, `segments`) — big jumps drastically affect memory and CPU.

Edge-cases to watch for
- Large FBX/GLTF files may fail to load in memory-constrained environments. Use smaller test assets.
- Some FBX animations have scale tracks; rely on `stripScaleTracks()` when necessary.
- `loader.load` callbacks assume assets exist; missing assets log to console and may leave variables undefined (check `mewtwoPrefab`/`mixer` guards).

If you need clarification
- Ask for which change you plan to make and I will point to the exact functions/lines in `js/pokebonk.js` to modify and tests to run.

— End of instructions —
