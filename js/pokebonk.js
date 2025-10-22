// ======== Config global ========
let renderer, scene, camera, cameraTop;

const R = 200;            // semitamaño del mapa
const segments = 400;    // subdivisión del terreno

let player, playerRadius = 0.25;
let firstPerson = false;
let sprint = false;
const baseFov = 50, sprintFov = 62;
const aimUpNormal = 1.1;      // cuánto por encima del jugador mira (modo normal)
const aimUpSprint = 1.0;      // en sprint, un pelín menos para compensar el FOV
const lookAheadNormal = 3.2;  // mira por delante (normal)
const lookAheadSprint = 4.0;  // mira por delante (sprint)
let playerHP = 5;
const playerMaxHP = 5;

// Física de salto
let vy = 0;                 // velocidad vertical
let grounded = false;       // está en el suelo
const GRAVITY = -25;        // unidades / s^2
const JUMP_SPEED = 8;       // impulso de salto

// Delta time para física
let prevTime = performance.now() / 1000;

let miniMarker;

let angulo = -Math.PI * 0.5;   // rumbo inicial (radianes). 0 => +Z
let bobT = 0;                 // tiempo para head-bob
const SPRINT_MUL = 1.7;       // multiplicador de velocidad en sprint
let prevYaw = angulo;   // para medir velocidad de giro
let bobBlend = 0;       // 0..1, suaviza entrada/salida del bob
let pitch = 0;
const maxPitch = 0.8; // ~46º

// Estabilizador cámara 1ª persona
let camY = 0;                // altura suavizada del ojo
const CAM_Y_SMOOTH = 12;     // 1/seg — mayor = sigue más al jugador
const FP_LOOK_DIST = 6;      // distancia de enfoque en FP

// ======== Árboles ========
let treesGroup = null;
let treePrefab = null;

// === Colisiones árboles ===
const treeColliders = [];    // {cx, cz, yMin, yMax, r}
const DEBUG_COLLIDERS = false;
let collidersGroup;          // (opcional visualización)

// ======== Disparo ========
const BULLET_SPEED = 28;     // unidades/seg
const BULLET_LIFETIME = 6.0; // segundos
const BULLET_RADIUS = 0.06;
let bullets = [];
let shootCooldown = 0;       // anti-spam

let playerHurtCooldown = 0;


// Movimiento / control
const p_pos = new THREE.Vector3(0, 0, 0);
const controls = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  speed: R*0.001
};

// === Perlin global con semilla fija para coherencia terreno<->sampleo ===
const NOISE_SEED = 42;            // cámbiala si quieres otro mapa
const noise = new Noise(NOISE_SEED); // requiere noisejs (Perlin2)

// ======== Charizard (FBX + anims) — estilo compañero ========
const CHAR_TARGET_HEIGHT = 1.6;

const A_IDLE = 0;
const A_RUN  = 1;
const A_PASS = 2;
const A_JUMP = 3;
const A_BACKWARDS = 4;
let currentCharAnimationIndex = A_IDLE;

let mixer = null;

// Acciones por nombre (al estilo compañero) y mapeo índice->nombre
let actions = {};            // actions['idle'|'run'|'pass'|'jump'|'back'] = AnimationAction
let animationNames = [];     // por índice -> nombre
let currentCharAction = null;

// Temporizadores para acciones puntuales
let timer_pass = 0;          // en segundos
let timer_jump = 0;          // en segundos

// Enemigos
let enemies = [];
let enemySpawnTimer = 0;
let waveNumber = 0;
const ENEMY_SPAWN_INTERVAL = 10; // segundos
const ENEMIES_PER_WAVE = 5;
const ENEMY_SPEED = 1.2; // unidades/seg
const ENEMY_HP = 3;
const ENEMY_TARGET_HEIGHT = 1.6;
const ENEMY_BAR_HEIGHT = ENEMY_TARGET_HEIGHT * 1.3; // altura de la barra

// ======= Mewtwo (FBX + anims) — estilo compañero (clips globales, acciones por instancia) ========
let mewtwoPrefab = null;           // FBX base
let mewtwoReady = false;           // Señal de que todo lo necesario cargó

const E_IDLE = 0;
const E_WALK = 1;
const E_DIE = 2;

let e_actions = {};        // clips por nombre (no acciones)
let e_animationNames = []; // mapeo índice->nombre (Idle/Walk/Die)

let loadedCount = 0;

let stats;

const DEBUG_ENEMY_HITBOX = true;
const ENEMY_HIT_RADIUS = 1.0;

const healthBarContainer = document.createElement('div');
healthBarContainer.id = 'health-bar-container';
Object.assign(healthBarContainer.style, {
  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '200px',
  height: '24px',
  backgroundColor: '#555',
  borderRadius: '12px',
  overflow: 'hidden',
  zIndex: 9999
});

const healthBar = document.createElement('div');
healthBar.id = 'health-bar';
Object.assign(healthBar.style, {
  height: '100%',
  width: '100%',
  backgroundColor: '#0f0',
  transition: 'width 0.2s ease'
});

healthBarContainer.appendChild(healthBar);
document.body.appendChild(healthBarContainer);

let score = 0;
const startTime = performance.now(); // al cargar la partida

const scoreDiv = document.createElement('div');
Object.assign(scoreDiv.style, {
  position: 'fixed',
  top: '10px',
  right: '10px',
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#fff',
  textShadow: '1px 1px 2px #000',
  zIndex: 9999
});
scoreDiv.textContent = 'Puntos: 0';
document.body.appendChild(scoreDiv);

function createLight(){
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(20, 40, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.near = 5;
  dirLight.shadow.camera.far = 100;
  scene.add(dirLight);
}

function addScore() {
  const minutes = (performance.now() - startTime) / 60000;
  score += Math.floor(10 * minutes);
  scoreDiv.textContent = `Puntos: ${score}`;
}


// Misma función de altura que usas en el terreno
function heightFunc(x, z) {
  const scale1 = 0.03;
  const scale2 = 0.12;
  const base   = noise.perlin2(x * scale1, z * scale1);
  const detail = 0.3 * noise.perlin2(x * scale2, z * scale2);
  return (base + detail) + 0.25; // altura absoluta en Y
}

// ==== Input ====
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW': controls.moveForward = true; break;
    case 'ArrowDown':
    case 'KeyS': controls.moveBackward = true; break;
    case 'ArrowLeft':
    case 'KeyA': controls.moveLeft = true; break;
    case 'ArrowRight':
    case 'KeyD': controls.moveRight = true; break;
    case 'ShiftLeft':
    case 'ShiftRight': sprint = true; break;
    case 'KeyF': firstPerson = !firstPerson; if (player) player.visible = !firstPerson; break;
    case 'Space': if (grounded) { vy = JUMP_SPEED; timer_jump=1; changeCharAnimation(A_JUMP); grounded = false; } e.preventDefault(); break;
    case 'KeyO': 
      if (!sprint && shootCooldown <= 0){
        shoot();
        timer_pass = 2;
      }
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW': controls.moveForward = false; break;
    case 'ArrowDown':
    case 'KeyS': controls.moveBackward = false; break;
    case 'ArrowLeft':
    case 'KeyA': controls.moveLeft = false; break;
    case 'ArrowRight':
    case 'KeyD': controls.moveRight = false; break;
    case 'ShiftLeft':
    case 'ShiftRight': sprint = false; break;
  }
});


// ======== Boot ========
init();
loadTerrain();
addPlayer();
addMiniMarker();
loadAndPlaceTrees(150);
loadMewtwo();
render();

// ======== Init ========
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x87b2f9)); // cielo
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();

  // Cámara principal (perspectiva)
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.layers.enable(0);
  camera.layers.disable(1);
  camera.position.set(1, 1.5, 1);

  // Minimap (orto top-down)
  const halfSize = R * 0.4; // zoom del minimapa
  cameraTop = new THREE.OrthographicCamera(-halfSize, halfSize, halfSize, -halfSize, 0.1, 500);
  cameraTop.up.set(0, 0, 1); // norte fijo (Z hacia arriba en pantalla)
  cameraTop.layers.enable(0);
  cameraTop.layers.enable(1);
  cameraTop.position.set(p_pos.x, 60, p_pos.z);
  cameraTop.lookAt(p_pos.x, 0, p_pos.z);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();

  // Luces
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(15, 25, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);

  window.addEventListener('resize', updateAspectRatio);

  // Al hacer clic en el canvas, pedir captura del cursor
  renderer.domElement.addEventListener('click', (e) => {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    } else if (e.button === 0) {
      // Botón izquierdo del ratón
      if (!sprint && shootCooldown <= 0) {
        shoot();
        timer_pass = 2;
      }
    }
  });

  // Escuchar los cambios en el pointer lock
  document.addEventListener('pointerlockchange', () => {
    const pl = document.pointerLockElement === renderer.domElement;
    if (pl) {
      document.addEventListener('mousemove', onMouseMove);
    } else {
      document.removeEventListener('mousemove', onMouseMove);
    }
  });

  stats = new Stats();
  stats.dom.style.position = 'absolute';
    stats.dom.style.bottom = '10px';
    stats.dom.style.right = '10px';
    stats.dom.style.top = 'auto';
    stats.dom.style.left = 'auto';
    document.body.appendChild(stats.dom);
}

function onMouseMove(event) {
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  const sensitivity = 0.002;

  angulo -= movementX * sensitivity;                  // yaw
  pitch  = THREE.MathUtils.clamp(                     // pitch
            pitch - movementY * sensitivity,
            -maxPitch, +maxPitch
          );
}

function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// ======== Terreno + agua ========
function loadTerrain() {
  const geometry = new THREE.BufferGeometry();

  const numVertices = (segments + 1) * (segments + 1);
  const positions = new Float32Array(numVertices * 3);
  const colors    = new Float32Array(numVertices * 3);
  const indices   = [];

  let idx = 0;
  let minY = Infinity, maxY = -Infinity;

  // Genero posiciones y almaceno alturas
  const zVals = new Float32Array(numVertices);

  for (let i = 0; i <= segments; i++) {
    const z = ((i / segments) * 2 - 1) * R; // eje Z del mundo
    for (let j = 0; j <= segments; j++) {
      const x = ((j / segments) * 2 - 1) * R;
      const y = heightFunc(x, z); // altura en Y

      const base = (i * (segments + 1) + j);
      zVals[base] = y;

      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      positions[idx]   = x;
      positions[idx+1] = y;   // Y = altura
      positions[idx+2] = z;
      idx += 3;
    }
  }

  // Colores por altura
  const colorLow  = new THREE.Color(0x4caf50); // verde
  const colorHigh = new THREE.Color(0x8d6e63); // marrón
  idx = 0;
  for (let v = 0; v < numVertices; v++) {
    const y = zVals[v];
    const t = (y - minY) / Math.max(1e-6, (maxY - minY));
    const c = colorLow.clone().lerp(colorHigh, t);
    colors[idx]   = c.r;
    colors[idx+1] = c.g;
    colors[idx+2] = c.b;
    idx += 3;
  }

  // Índices (triángulos)
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const surface  = new THREE.Mesh(geometry, material);
  surface.receiveShadow = true;
  surface.castShadow = false;
  scene.add(surface);

  // Agua (nivel Y=0)
  const waterGeometry = new THREE.PlaneGeometry(2 * R, 2 * R, 1, 1);
  const waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x3366cc,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02; // un pelín sobre 0 para evitar z-fighting
  water.receiveShadow = false;
  scene.add(water);

  // --- Retícula centrada en pantalla ---
  const cross = document.createElement('div');
  cross.id = 'reticle';
  Object.assign(cross.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    border: '2px solid #ffffff',
    borderRadius: '50%',
    boxShadow: '0 0 0 1px #000 inset',
    pointerEvents: 'none',
    opacity: '0.95',
    zIndex: '9999'
  });
  document.body.appendChild(cross);

}

function addPlayer() {
  const loader = new THREE.FBXLoader();
  loader.load('models/charizard/Charizard.fbx', function (fbx) {

    player = fbx;
    scene.add(player);
    fbx.position.set(0, 2, 0);

    // --- Normalizar altura con 2 pasadas y apoyar en el suelo ---
    normalizeAndFloor(fbx, CHAR_TARGET_HEIGHT);

    mixer = new THREE.AnimationMixer(fbx);

    // --- Mantener materiales del FBX (colores/texturas) y activar skinning ---
    fbx.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        n.material.transparent = false;
        n.material.opacity = 1.0;
        if (n.isLight || n.isCamera) {
          n.parent && n.parent.remove(n);
          return;
        }

        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => {
          if (!m) return;
          if (m.map) m.map.encoding = THREE.sRGBEncoding;
          if (n.geometry && n.geometry.attributes && n.geometry.attributes.color) {
            m.vertexColors = true;
          }
          m.skinning = !!n.isSkinnedMesh;
          m.needsUpdate = true;
          m.side = THREE.FrontSide;
          m.transparent = false;
          m.depthWrite = true;
        });

        n.frustumCulled = false; // opcional durante pruebas
      }
    });

    const ground = heightFunc(p_pos.x, p_pos.z);
    p_pos.y = ground + playerRadius;
    player.position.set(p_pos.x, p_pos.y - playerRadius, p_pos.z);
    player.rotation.y = angulo;

    // --- Animaciones (mismo patrón que tu compa) ---
    const CHAR_ANIMS = [
      { path: 'models/charizard/Idle.fbx',                  name: 'idle' },
      { path: 'models/charizard/Walking.fbx',               name: 'run' },
      { path: 'models/charizard/Yelling Out.fbx',           name: 'pass', once: true },
      { path: 'models/charizard/Jumping.fbx',               name: 'jump', once: true },
      { path: 'models/charizard/Walking Backwards.fbx',     name: 'back' }
    ];

    actions = {}; animationNames = [];
    animationNames[A_IDLE] = 'idle';
    animationNames[A_RUN]  = 'run';
    animationNames[A_PASS] = 'pass';
    animationNames[A_JUMP] = 'jump';
    animationNames[A_BACKWARDS] = 'back';

    let loadedAnimations = 0;

    CHAR_ANIMS.forEach((animInfo) => {
      loader.load(animInfo.path, function (animData) {
        if (animData.animations && animData.animations.length > 0) {
          const action = mixer.clipAction(animData.animations[0]);
          if (animInfo.once) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          actions[animInfo.name] = action;
        }
        loadedAnimations++;
        if (loadedAnimations === CHAR_ANIMS.length) {
          // Cuando estén todas, arrancamos en idle
          switchCharAnimation('idle');
        }
      }, undefined, function() {
        loadedAnimations++;
      });
    });

    console.log('✅ Charizard cargado con patrones de anim del compañero.');
  },
  undefined,
  (err) => console.error('❌ Error cargando Charizard.fbx', err));

}

function switchCharAnimation(newName) {
  const newAction = actions[newName];
  if (!newAction) return;
  if (currentCharAction !== newAction) {
    if (currentCharAction) currentCharAction.fadeOut(0.2);
    newAction.reset();
    newAction.fadeIn(0.2);
    newAction.play();
    currentCharAction = newAction;
  }
}

function stripScaleTracks(clip) {
  const filtered = clip.tracks.filter(t => !t.name.endsWith('.scale'));
  return new THREE.AnimationClip(clip.name + '_noScale', clip.duration, filtered);
}

function wrapAndNormalize(fbx, targetH) {
  // Limpia luces/cámaras del FBX
  fbx.traverse(n => { if (n.isLight || n.isCamera) n.parent && n.parent.remove(n); });

  // Calcula bbox del modelo *sin* escalar huesos
  fbx.updateMatrixWorld(true);
  const box  = new THREE.Box3().setFromObject(fbx);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = box.getCenter(new THREE.Vector3());

  // Crea contenedor y aplícale escala global
  const container = new THREE.Group();
  const s = targetH / Math.max(size.y, 1e-6);
  container.scale.setScalar(s);

  // Reposiciona el FBX para que los pies queden en y=0 dentro del contenedor
  fbx.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  fbx.name = 'MewtwoAnimatedRoot';
  container.add(fbx);
  return container;
}

function loadMewtwo() {
  const loader = new THREE.FBXLoader();
  loadedCount = 0;

  // Cargar modelo base
  loader.load('models/mewtwo/mewtwo.fbx', function (fbx) {
    mewtwoPrefab = fbx;
    normalizeAndFloor(fbx, ENEMY_TARGET_HEIGHT);

    mewtwoPrefab.traverse((n) => {
      if (n.isLight || n.isCamera) n.parent && n.parent.remove(n);
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => {
          if (m.map) m.map.encoding = THREE.sRGBEncoding;
          m.skinning = true;
          m.needsUpdate = true;
          m.side = THREE.FrontSide;
          m.transparent = false;
          m.depthWrite = true;
        });
        n.frustumCulled = false;
      }
    });
    checkIfMewtwoIsReady();
  }, undefined, (e) => console.error('❌ Error mewtwo.fbx', e));

  // Cargar animaciones como CLIPS (no acciones aún)
  const animations = [
    ['models/mewtwo/Idle.fbx', E_IDLE],
    ['models/mewtwo/Walking.fbx', E_WALK],
    ['models/mewtwo/Dying Backwards.fbx', E_DIE]
  ];

  animations.forEach(([animFile, index]) => {
    loader.load(animFile, (animData) => {
      if (animData.animations && animData.animations.length) {
        const clip = animData.animations[0];
        const name = animFile.split('/').pop().split('.').slice(0, -1).join('.');
        const clipNoScale = stripScaleTracks(clip);
        e_actions[name] = clipNoScale;       // guardamos CLIP por nombre
        e_animationNames[index] = name;      // mapeo de índice -> nombre de clip
        console.log(`✅ Mewtwo animación ${name} cargada.`);
      } else {
        console.warn('⚠️ Sin clips de animación en', animFile);
      }
      loadedCount++;
      checkIfMewtwoIsReady();
    }, undefined, (e) => console.error('❌ Error mewtwo.anim', e));
  });
}

function checkIfMewtwoIsReady() {
  const walkReady = !!e_actions[e_animationNames[E_WALK]];
  if (mewtwoPrefab && !mewtwoReady && walkReady) {
    mewtwoReady = true;
    console.log('✅ Mewtwo listo. Lanzando primera oleada.');
    spawnEnemies(waveNumber++);
    enemySpawnTimer = 0;
  }
}

// Re‐escala en 2 pasadas para garantizar altura exacta y apoya en y=0
function normalizeAndFloor(obj, targetH) {
  obj.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(obj);
  let size = new THREE.Vector3(); box.getSize(size);

  // 1ª pasada
  let s = targetH / Math.max(size.y, 1e-6);
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);

  // 2ª pasada (corrige errores por jerarquía/skin)
  box.setFromObject(obj); box.getSize(size);
  const s2 = targetH / Math.max(size.y, 1e-6);
  obj.scale.multiplyScalar(s2);
  obj.updateMatrixWorld(true);

  // Apoyar pies
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
}


function changeCharAnimation(index) {
    const name = animationNames[index];
    if (!name) return;
    switchCharAnimation(name);
    currentCharAnimationIndex = index;
}

function addMiniMarker() {
  // Triángulo isósceles apuntando +Z en su espacio local
  const w = 4.0;   // semi-ancho de la base
  const h = 4.0;   // altura
  const shape = new THREE.Shape();
  shape.moveTo(0,  h);
  shape.lineTo(-w, -h);
  shape.lineTo( w, -h);
  shape.lineTo(0,  h);

  const geom = new THREE.ShapeGeometry(shape);
  // Ponerlo plano sobre XZ (Y hacia arriba en el mundo)
  geom.rotateX(Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    side: THREE.DoubleSide,
    depthTest: false,   // para que “flote” sobre el terreno/agua en el minimapa
    depthWrite: false,
  });

  miniMarker = new THREE.Mesh(geom, mat);
  miniMarker.renderOrder = 999; // asegurar que se dibuja encima
  miniMarker.layers.set(1);     // <- SOLO capa de overlay

  // Posición inicial
  miniMarker.position.set(p_pos.x, heightFunc(p_pos.x, p_pos.z) + 0.03, p_pos.z);
  scene.add(miniMarker);
}

function approxSlope(x, z) {
  // pendiente local aproximada
  const e = 0.8;
  const h  = heightFunc(x, z);
  const hx = heightFunc(x + e, z);
  const hz = heightFunc(x, z + e);
  const dx = hx - h, dz = hz - h;
  return Math.hypot(dx, dz) / e;
}

function randomXZ() {
  const margin = 8;
  const x = THREE.MathUtils.randFloat(-R + margin, R - margin);
  const z = THREE.MathUtils.randFloat(-R + margin, R - margin);
  return { x, z };
}

function loadAndPlaceTrees(count = 20) {
  const loader = new THREE.GLTFLoader();
  // El path es relativo al HTML que carga el script:
  loader.setPath('models/');
  loader.load(
    'arbol.gltf',
    (gltf) => {
      treePrefab = gltf.scene;
      treePrefab.traverse((n) => {
        if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
      });

      treesGroup = new THREE.Group();
      treesGroup.name = 'Trees';
      scene.add(treesGroup);

      if (DEBUG_COLLIDERS) {
        collidersGroup = new THREE.Group();
        collidersGroup.name = 'TreeCollidersDebug';
        scene.add(collidersGroup);
      }

      let placed = 0, tries = 0, maxTries = count * 30;
      while (placed < count && tries < maxTries) {
        tries++;
        const { x, z } = randomXZ();
        const y = heightFunc(x, z);
        if (y <= 0.05) continue;
        if (approxSlope(x, z) > 0.6) continue;

        const dx0 = x - p_pos.x, dz0 = z - p_pos.z;
        if (Math.hypot(dx0, dz0) < 6) continue;

        const t = treePrefab.clone(true);
        t.position.set(x, y, z);
        t.rotation.y = Math.random() * Math.PI * 2;
        const s = THREE.MathUtils.randFloat(0.20, 0.5);
        t.scale.setScalar(s);

        treesGroup.add(t);

        // --- Bounding cylinder (una vez, al cargar) ---
        t.updateWorldMatrix(true, true);
        const bbox = new THREE.Box3().setFromObject(t);
        const height = bbox.max.y - bbox.min.y;
        const radius = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.5;
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        treeColliders.push({
          cx: center.x, cz: center.z,
          yMin: bbox.min.y, yMax: bbox.max.y,
          r: radius
        });

        if (DEBUG_COLLIDERS) {
          const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 16);
          const cylMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.3, depthWrite: false });
          const cyl = new THREE.Mesh(cylGeo, cylMat);
          cyl.position.set(center.x, bbox.min.y + height * 0.5, center.z);
          collidersGroup.add(cyl);
        }

        placed++;
      }
      console.log(`Colocados ${placed} árboles y ${treeColliders.length} colliders`);

          },
          undefined,
          (err) => console.error('Error cargando arbol.gltf', err)
        );
}

function resolveTreeCollisions(nextX, nextZ, nextY) {
  let nx = nextX, nz = nextZ;

  for (const c of treeColliders) {
    // chequeo vertical: esfera del jugador dentro del rango del cilindro
    if (nextY + playerRadius < c.yMin || nextY - playerRadius > c.yMax) continue;

    const dx = nx - c.cx, dz = nz - c.cz;
    const dist2 = dx*dx + dz*dz;
    const minDist = c.r + playerRadius;
    if (dist2 < minDist*minDist) {
      const dist = Math.sqrt(dist2) || 1e-6;
      const push = (minDist - dist) + 1e-3; // epsilon
      nx += (dx / dist) * push;
      nz += (dz / dist) * push;
    }
  }
  return { x: nx, z: nz };
}

function shoot() {
  if (shootCooldown > 0 || sprint) return;

  let dir = new THREE.Vector3();
  let origin;

  if (firstPerson) {
    camera.getWorldDirection(dir).normalize();
    origin = camera.position.clone();
  } else {
    dir.set(Math.sin(angulo), 0, Math.cos(angulo)).normalize();
    const forward = dir.clone();
    origin = p_pos.clone()
      .addScaledVector(forward, playerRadius + 0.35)
      .setY(p_pos.y + 0.28);

    const groundAtOrigin = heightFunc(origin.x, origin.z);
    origin.y = Math.max(origin.y, groundAtOrigin + BULLET_RADIUS + 0.02);
  }

  // --- Carga del modelo Fireball (sin luz ni emisivo) ---
  const loader = new THREE.GLTFLoader();
  const path = 'models/fireball_simple.gltf';
  loader.load(path, (gltf) => {
    const fireball = gltf.scene;
    fireball.scale.setScalar(0.01);
    fireball.position.copy(origin);
    fireball.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xff6600,
          emissive: 0xff3300,
          roughness: 0.2,
          metalness: 0.0
        });
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
    const light = new THREE.PointLight(0xff6600, 1.5, 4, 2);
    light.position.set(0, 0, 0); // se moverá con la bola
    fireball.add(light);

    scene.add(fireball);
    bullets.push({
      mesh: fireball,
      vel: dir.clone().multiplyScalar(BULLET_SPEED),
      life: BULLET_LIFETIME
    });
  });

  shootCooldown = 0.8;
}


function updateProjectiles(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // Integración
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;

    const pos = b.mesh.position;
    const groundY = heightFunc(pos.x, pos.z) + BULLET_RADIUS + 0.02;

    // --- Colisión con terreno ---
    if (pos.y <= groundY) {
      removeBullet(i);
      continue;
    }

    // --- Colisión con árboles (cilindros) ---
    if (bulletHitsTree(pos)) {
      removeBullet(i);
      continue;
    }

    // --- Límites del mapa / vida ---
    if (b.life <= 0 || Math.abs(pos.x) > R+5 || Math.abs(pos.z) > R+5 || pos.y > 200) {
      removeBullet(i);
      continue;
    }
    const dir = b.vel.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    b.mesh.quaternion.copy(quat);

    // --- Colisión con enemigos ---
    const enemyHitIndex = enemies.findIndex(e => {
      return b.mesh.position.distanceTo(e.mesh.position) < (BULLET_RADIUS + 2);
    });
    if (enemyHitIndex >= 0) {
      const enemy = enemies[enemyHitIndex];

      if (!enemy.dead) {
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          killEnemy(enemy, enemyHitIndex);
          addScore();
        }
        removeBullet(i);
      }
      continue;
    }
  }
}

function bulletHitsTree(pos) {
  for (const c of treeColliders) {
    if (pos.y < c.yMin || pos.y > c.yMax) continue;
    const dx = pos.x - c.cx, dz = pos.z - c.cz;
    if (dx*dx + dz*dz <= (c.r + BULLET_RADIUS)* (c.r + BULLET_RADIUS)) {
      return true;
    }
  }
  return false;
}


function removeBullet(index) {
  const b = bullets[index];
  if (!b) return;
  scene.remove(b.mesh);
  if (b.mesh.geometry) b.mesh.geometry.dispose();
  if (b.mesh.material) b.mesh.material.dispose();
  bullets.splice(index, 1);
}

function spawnEnemies(wave) { 
  if (!mewtwoReady || !mewtwoPrefab) {
    console.warn('⏳ Mewtwo aún no cargó; reintentará en la próxima oleada.');
    return false;
  }

  for (let i = 0; i < ENEMIES_PER_WAVE + wave; i++) {
    const { x, z } = randomXZ();
    const y = heightFunc(x, z) + 5.0; // empezar un poco arriba

    // Raíz del enemigo = Group (modelo + barra de vida)
    const enemyRoot = new THREE.Group();
    const model = THREE.SkeletonUtils.clone(mewtwoPrefab);

    model.traverse(n => {
      if (n.isMesh) { n.frustumCulled = false; n.castShadow = n.receiveShadow = true; }
      if (n.isSkinnedMesh) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => { if (m) { m.skinning = true; m.needsUpdate = true; } });
      }
    });

    const animRoot = model.getObjectByName('MewtwoAnimatedRoot') || model;

    model.position.set(0, 0, 0);
    enemyRoot.add(model);

    // Barra de vida a una altura proporcional fija
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    bar.position.set(0, ENEMY_BAR_HEIGHT, 0);
    enemyRoot.add(bar);

    // Colocar al terreno
    enemyRoot.position.set(x, y, z);

    let hitbox = null;

    if (DEBUG_ENEMY_HITBOX) {
    const hitboxGeo = new THREE.CylinderGeometry(
        ENEMY_HIT_RADIUS, ENEMY_HIT_RADIUS, ENEMY_TARGET_HEIGHT, 24
    );
    const hitboxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: false });
    hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitbox.name = 'EnemyHitbox';
    hitbox.frustumCulled = false;
    hitbox.position.set(0, ENEMY_TARGET_HEIGHT * 0.5, 0);
    enemyRoot.add(hitbox);
    }

    scene.add(enemyRoot);

    // Mixer propio + acciones por instancia (mismo patrón que compañero)
    const mixer = new THREE.AnimationMixer(animRoot);
    const enemyActions = {};
    const idleClip = e_actions[e_animationNames[E_IDLE]];
    const walkClip = e_actions[e_animationNames[E_WALK]];
    const dieClip  = e_actions[e_animationNames[E_DIE]];

    if (idleClip) {
      enemyActions.idle = mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat, Infinity);
    }
    if (walkClip) {
      enemyActions.walk = mixer.clipAction(walkClip).setLoop(THREE.LoopRepeat, Infinity);
    }
    if (dieClip) {
      enemyActions.die = mixer.clipAction(dieClip);
      enemyActions.die.setLoop(THREE.LoopOnce, 1);
      enemyActions.die.clampWhenFinished = true;
    }

    let currentAction = null;
    const play = (name) => {
      const next = enemyActions[name];
      if (!next) return;
      if (currentAction && currentAction !== next) currentAction.fadeOut(0.2);
      next.reset().fadeIn(0.2).play();
      currentAction = next;
    };

    // Por defecto, caminan
    if (enemyActions.walk) play('walk'); else if (enemyActions.idle) play('idle');

    enemies.push({
      mesh: enemyRoot,
      hp: ENEMY_HP,
      healthBar: bar,
      mixer: mixer,
      actions: enemyActions,
      playAction: play,
      currentAction: currentAction,
      dead: false,
      spinHitbox: false,
      spinSpeed: 6.0
    });
  }

  console.log(`🌊 Oleada ${wave + 1} generada con ${ENEMIES_PER_WAVE + wave} Mewtwos.`);
  return true;
}

function updateHealthBar() {
  const pct = Math.max(0, playerHP / playerMaxHP);
  const bar = document.getElementById('health-bar');
  bar.style.width = `${pct * 100}%`;
  bar.style.backgroundColor = pct < 0.3 ? '#f33' : (pct < 0.6 ? '#ff0' : '#0f0');
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.mixer.update(dt);
    if (e.dead) continue;
    if (!e || !e.mesh) {
      enemies.splice(i, 1); // eliminar enemigos corruptos
      continue;
    }

    const dir = new THREE.Vector3().subVectors(p_pos, e.mesh.position).setY(0).normalize();
    const proposedPos = e.mesh.position.clone().addScaledVector(dir, ENEMY_SPEED * dt);
    const corrected = resolveEnemyTreeCollisions(proposedPos);
    e.mesh.position.set(corrected.x, e.mesh.position.y, corrected.z);


    // Ajustar altura del enemigo al terreno
    const groundY = heightFunc(e.mesh.position.x, e.mesh.position.z);
    e.mesh.position.y = groundY;

    // Actualiza barra de vida si existe
    if (e.healthBar && e.healthBar.visible) {
      e.healthBar.position.set(0, ENEMY_BAR_HEIGHT, 0);
      e.healthBar.scale.x = Math.max(0.001, e.hp / ENEMY_HP);
      e.healthBar.material.color.set(
        e.hp <= 1 ? 0xff0000 : e.hp === 2 ? 0xffff00 : 0x00ff00
      );
      e.healthBar.lookAt(camera.position);
    }

    if (e.spinHitbox && e.hitbox) {
        e.hitbox.rotation.xa += e.spinSpeed * dt;
    }

    // Chequeo colisión jugador
    const dist = e.mesh.position.distanceTo(p_pos);
    if (dist < playerRadius + 0.3) {
      if (playerHurtCooldown <= 0) {
        console.log("💥 El jugador fue tocado por un enemigo");
        playerHP = Math.max(0, playerHP - 1);
        updateHealthBar();
        playerHurtCooldown = 1; // 1 segundo de invulnerabilidad
      }
    }
  }
}

function killEnemy(e, index) {
  if (e.dead) return;
  e.dead = true;
  if (e.actions && e.actions.die) {
    if (e.currentAction) e.currentAction.fadeOut(0.15);
    e.actions.die.reset().fadeIn(0.15).play();
    e.currentAction = e.actions.die;
  } else {
    // Fallback por si algo falló: intentar con el clip directamente
    const dieClip = e_actions[e_animationNames[E_DIE]];
    if (dieClip) {
      e.mixer.stopAllAction();
      e.mixer.clipAction(dieClip).reset().play();
    }
  }
  if (e.healthBar) { e.healthBar.visible = false; }
  if (e.hitbox) { e.spinHitbox = true; }

  setTimeout(() => {
    scene.remove(e.mesh);
    enemies.splice(index, 1);
  }, 5000);
}

function resolveEnemyTreeCollisions(pos, radius = 0.3) {
  const result = pos.clone();
  for (const c of treeColliders) {
    if (result.y + radius < c.yMin || result.y - radius > c.yMax) continue;

    const dx = result.x - c.cx, dz = result.z - c.cz;
    const dist2 = dx*dx + dz*dz;
    const minDist = c.r + radius;

    if (dist2 < minDist*minDist) {
      const dist = Math.sqrt(dist2) || 1e-6;
      const push = (minDist - dist) + 1e-3;
      result.x += (dx / dist) * push;
      result.z += (dz / dist) * push;
    }
  }
  return result;
}


// ======== Update =========
function update(dt) {
  // Dirección de mirada (en XZ)
  const forward = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
  const right   = new THREE.Vector3(forward.z, 0, -forward.x);

  angulo = THREE.MathUtils.euclideanModulo(angulo + Math.PI, Math.PI * 2) - Math.PI;

  // Desplazamiento horizontal
  const moving = (controls.moveForward || 
                  controls.moveBackward ||
                  controls.moveLeft ||
                  controls.moveRight);
   if (moving) {
      const isBackward = controls.moveBackward && !controls.moveForward;
      changeCharAnimation(isBackward ? A_BACKWARDS : A_RUN);
   } else {
      changeCharAnimation(A_IDLE);
   }

  const effSpeed = controls.speed * ((sprint && moving) ? SPRINT_MUL : 1.0);

  // calcula intento de movimiento
  let move = new THREE.Vector3();
  if (controls.moveForward)  move.addScaledVector(forward,  effSpeed);
  if (controls.moveBackward) move.addScaledVector(forward, -effSpeed);

  // desplazamiento lateral con A/D
  if (controls.moveLeft) move.addScaledVector(right, effSpeed);
  if (controls.moveRight) move.addScaledVector(right, -effSpeed);

  // nuevo XZ propuesto
  let nextX = p_pos.x + move.x;
  let nextZ = p_pos.z + move.z;

  // RESOLVER colisiones contra árboles (cilindros)
  const solved = resolveTreeCollisions(nextX, nextZ, p_pos.y);
  p_pos.x = solved.x;
  p_pos.z = solved.z;

  // Límites del mapa
  p_pos.x = THREE.MathUtils.clamp(p_pos.x, -R + 0.1, R - 0.1);
  p_pos.z = THREE.MathUtils.clamp(p_pos.z, -R + 0.1, R - 0.1);


  // ==== FÍSICA VERTICAL (salto/gravedad) ====
  const groundY = heightFunc(p_pos.x, p_pos.z) + playerRadius;

  // Integración simple
  vy += GRAVITY * dt;
  p_pos.y += vy * dt;

  // Colisión con el suelo
  if (p_pos.y <= groundY) {
    p_pos.y = groundY;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  if (player) {
    // Posición y orientación del modelo (el yaw ya lo tienes en 'angulo')
    player.position.set(p_pos.x, p_pos.y - playerRadius, p_pos.z);
    player.rotation.y = angulo;

    // Máquina de estados de animación base
    if (mixer) {
      if (timer_pass > 0) {
        timer_pass -= dt;
        if (!(sprint && moving)) {
          changeCharAnimation(A_PASS);
        } else {
          timer_pass = 0;
        }
      } else if (timer_jump > 0) {
        timer_jump -= dt;
        changeCharAnimation(A_JUMP);
      } else {
        const isBackward = controls.moveBackward && !controls.moveForward;
        changeCharAnimation(isBackward ? A_BACKWARDS : moving ? A_RUN : A_IDLE);
      }
    }

  }


  if (miniMarker) {
    // Altura pegada al suelo (no al centro del jugador)
    const yGround = heightFunc(p_pos.x, p_pos.z) + 0.03;
    miniMarker.position.set(p_pos.x, yGround, p_pos.z);

    // Orientación: el triángulo fue modelado apuntando a +Z; yaw = angulo
    miniMarker.rotation.y = angulo;
  }


  // === CÁMARAS (tu bloque TPS actual, sin cambios) ===
  if (firstPerson) {
    const movingFP = (controls.moveForward || controls.moveBackward);
    const isSprinting = sprint && movingFP;

    const targetEyeY = p_pos.y + (isSprinting ? 0.18 : 0.20);
    camY += (targetEyeY - camY) * Math.min(1, CAM_Y_SMOOTH * dt);

    const eye = new THREE.Vector3(p_pos.x, camY, p_pos.z);
    camera.position.copy(eye);

    // vector forward con pitch
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const fwd = new THREE.Vector3(Math.sin(angulo) * cp, sp, Math.cos(angulo) * cp).normalize();
    const lookTarget = eye.clone().addScaledVector(fwd, FP_LOOK_DIST);

    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(fwd, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate());
    camera.quaternion.setFromRotationMatrix(m);
    camera.lookAt(lookTarget);

    const targetFov = isSprinting ? sprintFov : baseFov;
    camera.fov += (targetFov - camera.fov) * (isSprinting ? 0.18 : 0.12);
    camera.updateProjectionMatrix();
  } else {
    // ========= TPS =========
    const isMoving = (controls.moveForward || controls.moveBackward);
    const isSprinting = sprint && isMoving;

    const normalDist = 3.5;
    const sprintDist = 1.9;

    const forward = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
    const camOff = new THREE.Vector3(-Math.sin(angulo), 0.4, -Math.cos(angulo))
                      .multiplyScalar(isSprinting ? sprintDist : normalDist);

    const lookAhead = isSprinting ? lookAheadSprint : lookAheadNormal;
    const aimUp     = isSprinting ? aimUpSprint     : aimUpNormal;

    const target = p_pos.clone().add(forward.clone().multiplyScalar(lookAhead));
    target.y += aimUp;

    const desired = p_pos.clone().add(camOff);
    desired.y = Math.max(desired.y, p_pos.y + 0.3);

    if (isSprinting) {
      camera.position.lerp(desired, 0.18);
    } else {
      camera.position.copy(desired);
    }
    
    camera.lookAt(target);

    const targetFov = isSprinting ? sprintFov : baseFov;
    camera.fov += (targetFov - camera.fov) * (isSprinting ? 0.12 : 0.18);
    camera.updateProjectionMatrix();
  }

  updateProjectiles(dt);
  shootCooldown = Math.max(0, shootCooldown - dt);

  // Minimap
  cameraTop.position.set(p_pos.x, 30, p_pos.z);
  cameraTop.lookAt(p_pos.x, 0, p_pos.z);

  playerHurtCooldown = Math.max(0, playerHurtCooldown - dt);

  enemySpawnTimer += dt;
  if (mewtwoReady && (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL)) {
    enemySpawnTimer = 0;
    if (spawnEnemies(waveNumber)) {
      waveNumber++;
    }

  }

  const reticle = document.getElementById('reticle');
  const isMoving = (controls.moveForward || controls.moveBackward);
  const isSprinting = sprint && isMoving;
  if (reticle) {
    reticle.style.display = isSprinting ? 'none' : 'block';
  }

  updateEnemies(dt);

}

// ======== Render =========
function render() {
  requestAnimationFrame(render);

  stats.begin();

  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - prevTime); // clamp para evitar saltos grandes
  prevTime = now;

  update(dt);
  if (mixer) mixer.update(dt);

  // Vista principal
  renderer.autoClear = false;
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.setClearColor(new THREE.Color(0x87b2f9));
  renderer.clear();
  renderer.render(scene, camera);

  // Minimap
  const ds = Math.min(window.innerWidth, window.innerHeight) * 0.28;
  renderer.setViewport(10, 10, ds, ds);
  renderer.setScissor(10, 10, ds, ds);
  renderer.setScissorTest(true);
  renderer.setClearColor(new THREE.Color(0xf0f7ff));
  renderer.clearDepth();
  renderer.render(scene, cameraTop);
  renderer.setScissorTest(false);

  stats.end();
}
