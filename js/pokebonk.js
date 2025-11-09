// ===== Estructura general del juego (THREE.js) =====
// Este archivo configura render, camaras, terreno, jugador, enemigos y bucles de juego.
// Comentarios en estilo impersonal y sin acentos.


// ==== Render y escena ====
let renderer;
let scene;
let camera;
let cameraTop;


// ==== Parametros de terreno y mundo ====
const R = 200;                 
const segments = 400;          


// ==== Estado del jugador ====
let player;
const playerRadius = 0.25;     
let firstPerson = false;       
let sprint = false;            
const baseFov = 50;
const sprintFov = 62;          
const aimUpNormal = 1.1;       
const aimUpSprint = 1.0;       
const lookAheadNormal = 3.2;   
const lookAheadSprint = 4.0;   
let playerHP = 5;
const playerMaxHP = 5;


// ==== Fisica vertical (salto, gravedad) ====
let vy = 0;                    
let grounded = false;          
const GRAVITY = -25;           
const JUMP_SPEED = 8;          


// Tiempo previo para delta time
let prevTime = performance.now() / 1000;


// Marcador del minimapa
let miniMarker;


// Orientacion de camara/jugador
let angulo = -Math.PI * 0.5;   
let pitch = 0;                 
const maxPitch = 0.8;          


// Suavizado de altura de camara en primera persona
let camY = 0;                  
const CAM_Y_SMOOTH = 12;       
const FP_LOOK_DIST = 6;        


// ==== Arboles y colisiones cilidricas ====
let treesGroup = null;
let treePrefab = null;
const treeColliders = [];      
const DEBUG_COLLIDERS = false; 
let collidersGroup;            


// ==== Proyectiles ====
const BULLET_SPEED = 28;       
const BULLET_LIFETIME = 6.0;   
const BULLET_RADIUS = 0.06;    
let bullets = [];              
let shootCooldown = 0;         


// Ventana de invulnerabilidad del jugador
let playerHurtCooldown = 0;


// Posicion del jugador y bandera de controles
const p_pos = new THREE.Vector3(0, 0, 0); 
const controls = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  speed: R * 0.001            
};


// Perlin global con semilla fija para reproducibilidad del terreno
const NOISE_SEED = 42;                 
const noise = new Noise(NOISE_SEED);   


// ==== Animaciones del jugador (Charizard) ====
const CHAR_TARGET_HEIGHT = 1.6;        

const A_IDLE = 0;
const A_RUN = 1;
const A_PASS = 2;
const A_JUMP = 3;
const A_BACKWARDS = 4;

let mixer = null;                       
let actions = {};                       
let animationNames = [];                
let currentCharAction = null;           


let timer_pass = 0;                     
let timer_jump = 0;                     


// ==== Enemigos y oleadas ====
let enemies = [];
let enemySpawnTimer = 0;
let waveNumber = 0;
const ENEMY_SPAWN_INTERVAL = 10;        
const ENEMIES_PER_WAVE = 5;             
const ENEMY_SPEED = 1.2;                
const ENEMY_HP = 3;                     
const ENEMY_TARGET_HEIGHT = 1.6;        
const ENEMY_BAR_HEIGHT = ENEMY_TARGET_HEIGHT * 1.3; 


// ==== Modelo base y clips de Mewtwo ====
let mewtwoPrefab = null;                
let mewtwoReady = false;                

const E_IDLE = 0;
const E_WALK = 1;
const E_DIE = 2;

let e_actions = {};                     
let e_animationNames = [];              

let stats;                              

const DEBUG_ENEMY_HITBOX = false;        
const ENEMY_HIT_RADIUS = 1.0;           


// ==== UI: vida y puntuacion ====
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
const startTime = performance.now();    

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


// Utilidad: alias a clamp
const clamp = THREE.MathUtils.clamp;

// Calcula y acumula puntuacion por tiempo
function addScore() {
  
  const minutes = (performance.now() - startTime) / 60000;
  score += Math.floor(10 * minutes);
  scoreDiv.textContent = `Puntos: ${score}`;
}

// Funcion de altura del terreno basada en ruido Perlin
function heightFunc(x, z) {

  const scale1 = 0.05;
  const scale2 = 0.2;
  const base = noise.perlin2(x * scale1, z * scale1);
  const detail = 0.35 * noise.perlin2(x * scale2, z * scale2);
  return 3.0 * (base + detail) + 0.25;
}


// Entradas de teclado: movimiento, vista, salto y disparo
document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      controls.moveForward = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      controls.moveBackward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      controls.moveLeft = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      controls.moveRight = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      sprint = true;
      break;
    case 'KeyF':
      
      firstPerson = !firstPerson;
      if (player) {
        player.visible = !firstPerson;
      }
      break;
    case 'Space':
      
      if (grounded) {
        vy = JUMP_SPEED;
        timer_jump = 1;
        changeCharAnimation(A_JUMP);
        grounded = false;
      }
      e.preventDefault();
      break;
    case 'KeyO':
      
      if (!sprint && shootCooldown <= 0) {
        shoot();
        timer_pass = 2;
      }
      break;
  }
});

// Soltado de teclas
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      controls.moveForward = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      controls.moveBackward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      controls.moveLeft = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      controls.moveRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      sprint = false;
      break;
  }
});


// Secuencia de arranque
init();
loadTerrain();
addPlayer();
addMiniMarker();
loadAndPlaceTrees(150);
loadMewtwo();
render();


// Inicializa renderer, escena, camaras, luces y pointer lock
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x87b2f9));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('container').appendChild(renderer.domElement);

  scene = new THREE.Scene();

  const skyboxLoader = new THREE.CubeTextureLoader();
  skyboxLoader.setPath('images/');
  const skybox = skyboxLoader.load([
    'positive_x.bmp',
    'negative_x.bmp',
    'positive_y.bmp',
    'negative_y.bmp',
    'positive_z.bmp',
    'negative_z.bmp'
  ]);
  scene.background = skybox;
  scene.environment = skybox;

  
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(baseFov, aspect, 0.1, 1000);
  camera.layers.enable(0);
  camera.layers.disable(1);
  camera.position.set(1, 1.5, 1);

  
  const halfSize = R * 0.4;
  cameraTop = new THREE.OrthographicCamera(-halfSize, halfSize, halfSize, -halfSize, 0.1, 500);
  cameraTop.up.set(0, 0, 1);
  cameraTop.layers.enable(0);
  cameraTop.layers.enable(1);
  cameraTop.position.set(p_pos.x, 60, p_pos.z);
  cameraTop.lookAt(p_pos.x, 0, p_pos.z);

  
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(15, 25, 10);
  dir.target.position.set(0, 0, 0);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const shadowCam = dir.shadow.camera;
  const shadowRange = 80;
  shadowCam.left = -shadowRange;
  shadowCam.right = shadowRange;
  shadowCam.top = shadowRange;
  shadowCam.bottom = -shadowRange;
  shadowCam.near = 0.5;
  shadowCam.far = 250;
  dir.shadow.bias = -0.0005;
  dir.shadow.normalBias = 0.02;
  scene.add(dir);
  scene.add(dir.target);

  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);

  window.addEventListener('resize', updateAspectRatio);

  
  renderer.domElement.addEventListener('click', (e) => {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    } else if (e.button === 0) {
      
      if (!sprint && shootCooldown <= 0) {
        shoot();
        timer_pass = 2;
      }
    }
  });

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) {
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

// Mouse look: actualiza yaw y pitch
function onMouseMove(event) {
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;

  const sensitivity = 0.002; 

  angulo -= movementX * sensitivity;                  
  pitch = clamp(pitch - movementY * sensitivity, -maxPitch, +maxPitch); 
}

// Ajuste de viewport y proyeccion en resize
function updateAspectRatio() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}


// Genera malla de terreno, colores por altura y plano de agua
function loadTerrain() {
  const geometry = new THREE.BufferGeometry();

  const numVertices = (segments + 1) * (segments + 1);
  const positions = new Float32Array(numVertices * 3);
  const colors = new Float32Array(numVertices * 3);
  const indices = [];

  let idx = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  
  const yVals = new Float32Array(numVertices);

  for (let i = 0; i <= segments; i++) {
    const z = ((i / segments) * 2 - 1) * R;
    for (let j = 0; j <= segments; j++) {
      const x = ((j / segments) * 2 - 1) * R;
      const y = heightFunc(x, z);

      const base = (i * (segments + 1) + j);
      yVals[base] = y;

      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      idx += 3;
    }
  }

  
  const colorLow = new THREE.Color(0x4caf50);
  const colorHigh = new THREE.Color(0x8d6e63);
  idx = 0;
  for (let v = 0; v < numVertices; v++) {
    const y = yVals[v];
    const t = (y - minY) / Math.max(1e-6, (maxY - minY));
    const c = colorLow.clone().lerp(colorHigh, t);
    colors[idx] = c.r;
    colors[idx + 1] = c.g;
    colors[idx + 2] = c.b;
    idx += 3;
  }

  
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
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const surface = new THREE.Mesh(geometry, material);
  surface.receiveShadow = true;
  surface.castShadow = false;
  scene.add(surface);

  
  const waterGeometry = new THREE.PlaneGeometry(2 * R, 2 * R, 1, 1);
  const waterMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02; 
  scene.add(water);

  
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


// Carga modelo del jugador y prepara animaciones
function addPlayer() {
  const loader = new THREE.FBXLoader();

  loader.load('models/charizard/Charizard.fbx', (fbx) => {
    player = fbx;
    scene.add(player);
    fbx.position.set(0, 2, 0);

    
    normalizeAndFloor(fbx, CHAR_TARGET_HEIGHT);

    mixer = new THREE.AnimationMixer(fbx);

    
    fbx.traverse((n) => {
      
      if (n.isLight || n.isCamera) {
        if (n.parent) n.parent.remove(n);
        return;
      }
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          if (!m) return;
          if (m.map) m.map.encoding = THREE.sRGBEncoding;
          if (n.geometry && n.geometry.attributes && n.geometry.attributes.color) m.vertexColors = true;
          m.skinning = !!n.isSkinnedMesh;
          m.needsUpdate = true;
          m.side = THREE.FrontSide;
          m.transparent = false;
          m.depthWrite = true;
        });
        n.frustumCulled = false;
      }
    });

    const ground = heightFunc(p_pos.x, p_pos.z);
    p_pos.y = ground + playerRadius;
    player.position.set(p_pos.x, p_pos.y - playerRadius, p_pos.z);
    player.rotation.y = angulo;

    
    const CHAR_ANIMS = [
      { path: 'models/charizard/Idle.fbx', name: 'idle' },
      { path: 'models/charizard/Walking.fbx', name: 'run' },
      { path: 'models/charizard/Yelling Out.fbx', name: 'pass', once: true },
      { path: 'models/charizard/Jumping.fbx', name: 'jump', once: true },
      { path: 'models/charizard/Walking Backwards.fbx', name: 'back' }
    ];

    actions = {};
    animationNames = [];
    animationNames[A_IDLE] = 'idle';
    animationNames[A_RUN] = 'run';
    animationNames[A_PASS] = 'pass';
    animationNames[A_JUMP] = 'jump';
    animationNames[A_BACKWARDS] = 'back';

    let loadedAnimations = 0;
    CHAR_ANIMS.forEach((animInfo) => {
      loader.load(animInfo.path, (animData) => {
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
          switchCharAnimation('idle');
        }
      }, undefined, () => {
        loadedAnimations++;
      });
    });

    console.log('✅ Charizard cargado (jugador listo).');
  }, undefined, (err) => {
    console.error('❌ Error cargando Charizard.fbx', err);
  });
}

function switchCharAnimation(newName) {
  const newAction = actions[newName];
  if (!newAction) {
    return;
  }
  if (currentCharAction !== newAction) {
    if (currentCharAction) {
      currentCharAction.fadeOut(0.2);
    }
    newAction.reset();
    newAction.fadeIn(0.2);
    newAction.play();
    currentCharAction = newAction;
  }
}

function changeCharAnimation(index) {
  const name = animationNames[index];
  if (name) {
    switchCharAnimation(name);
  }
}

// Elimina pistas .scale de un clip de animacion problematico
function stripScaleTracks(clip) {
  
  const filtered = clip.tracks.filter((t) => !t.name.endsWith('.scale'));
  return new THREE.AnimationClip(clip.name + '_noScale', clip.duration, filtered);
}

// Normaliza altura del modelo a targetH y apoya en y=0
function normalizeAndFloor(obj, targetH) {
  
  obj.updateMatrixWorld(true);

  const box1 = new THREE.Box3().setFromObject(obj);
  const size1 = new THREE.Vector3();
  box1.getSize(size1);
  const s1 = targetH / Math.max(size1.y, 1e-6);
  obj.scale.multiplyScalar(s1);
  obj.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(obj);
  const size2 = new THREE.Vector3();
  box2.getSize(size2);
  const s2 = targetH / Math.max(size2.y, 1e-6);
  obj.scale.multiplyScalar(s2);
  obj.updateMatrixWorld(true);

  const box3 = new THREE.Box3().setFromObject(obj);
  const c = box3.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, box3.min.y, c.z));
}


// Carga prefab de Mewtwo y clips de animacion
function loadMewtwo() {
  const loader = new THREE.FBXLoader();

  
  loader.load('models/mewtwo/mewtwo.fbx', (fbx) => {
    mewtwoPrefab = fbx;
    normalizeAndFloor(fbx, ENEMY_TARGET_HEIGHT);

    const toRemove = [];

    mewtwoPrefab.traverse((n) => {
      if (n.isLight || n.isCamera) {
        toRemove.push(n);
        return;
      }
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          if (m) {
            m.skinning = true;
            m.needsUpdate = true;
          }
        });
        n.frustumCulled = false;
      }
    });

    toRemove.forEach((n) => n.removeFromParent());

    checkIfMewtwoIsReady();
  }, undefined, (e) => {
    console.error('❌ Error mewtwo.fbx', e);
  });

  
  const animations = [
    ['models/mewtwo/Idle.fbx', E_IDLE],
    ['models/mewtwo/Walking.fbx', E_WALK],
    ['models/mewtwo/Dying Backwards.fbx', E_DIE]
  ];

  animations.forEach(([animFile, index]) => {
    loader.load(animFile, (animData) => {
      if (animData.animations && animData.animations.length) {
        const clipNoScale = stripScaleTracks(animData.animations[0]);
        const name = animFile.split('/').pop().split('.').slice(0, -1).join('.');
        e_actions[name] = clipNoScale;      
        e_animationNames[index] = name;     
        console.log(`✅ Mewtwo animacion ${name} cargada.`);
      } else {
        console.warn('⚠️ Sin clips de animacion en', animFile);
      }
      checkIfMewtwoIsReady();
    }, undefined, (e) => {
      console.error('❌ Error mewtwo.anim', e);
    });
  });
}

// Verifica si modelo y clip clave estan listos para spawnear
function checkIfMewtwoIsReady() {
  const walkReady = !!e_actions[e_animationNames[E_WALK]];
  if (mewtwoPrefab && !mewtwoReady && walkReady) {
    mewtwoReady = true;
    console.log('✅ Mewtwo listo. Lanzo la primera oleada.');
    spawnEnemies(waveNumber);
    waveNumber += 1;
    enemySpawnTimer = 0;
  }
}


// Crea marcador para el minimapa (triangulo sobre XZ)
function addMiniMarker() {
  
  const w = 4.0;
  const h = 4.0;

  const shape = new THREE.Shape();
  shape.moveTo(0, h);
  shape.lineTo(-w, -h);
  shape.lineTo(w, -h);
  shape.lineTo(0, h);

  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(Math.PI / 2); 

  const mat = new THREE.MeshBasicMaterial({
    color: 0xff5533,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });

  miniMarker = new THREE.Mesh(geom, mat);
  miniMarker.renderOrder = 999; 
  miniMarker.layers.set(1);     

  miniMarker.position.set(p_pos.x, heightFunc(p_pos.x, p_pos.z) + 0.03, p_pos.z);
  scene.add(miniMarker);
}

// Aproxima la pendiente local via diferencias finitas
function approxSlope(x, z) {
  
  const e = 0.8;
  const h = heightFunc(x, z);
  const hx = heightFunc(x + e, z);
  const hz = heightFunc(x, z + e);
  const dx = hx - h;
  const dz = hz - h;
  return Math.hypot(dx, dz) / e;
}

// Punto aleatorio dentro de margenes del mapa
function randomXZ() {
  
  const margin = 8;
  const x = THREE.MathUtils.randFloat(-R + margin, R - margin);
  const z = THREE.MathUtils.randFloat(-R + margin, R - margin);
  return { x, z };
}


// Instancia arboles y registra colisionadores cilindricos
function loadAndPlaceTrees(count = 20) {
  const loader = new THREE.GLTFLoader();
  loader.setPath('models/');
  loader.load('arbol.gltf', (gltf) => {
    treePrefab = gltf.scene;
    treePrefab.traverse((n) => {
      if (n.isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });

    treesGroup = new THREE.Group();
    treesGroup.name = 'Trees';
    scene.add(treesGroup);

    if (DEBUG_COLLIDERS) {
      collidersGroup = new THREE.Group();
      collidersGroup.name = 'TreeCollidersDebug';
      scene.add(collidersGroup);
    }

    let placed = 0;
    let tries = 0;
    const maxTries = count * 30;

    while (placed < count && tries < maxTries) {
      tries += 1;
      const { x, z } = randomXZ();
      const y = heightFunc(x, z);

      if (y <= 0.05) {
        continue; 
      }
      if (approxSlope(x, z) > 0.6) {
        continue; 
      }

      const dx0 = x - p_pos.x;
      const dz0 = z - p_pos.z;
      if (Math.hypot(dx0, dz0) < 6) {
        continue; 
      }

      const t = treePrefab.clone(true);
      const baseScale = THREE.MathUtils.randFloat(0.2, 0.55);
      const heightStretch = THREE.MathUtils.randFloat(0.85, 1.35);
      const scaleVec = new THREE.Vector3(baseScale, baseScale * heightStretch, baseScale);
      const yaw = Math.random() * Math.PI * 2;
      const tiltX = THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(4));
      const tiltZ = THREE.MathUtils.degToRad(THREE.MathUtils.randFloatSpread(4));
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ'));
      const position = new THREE.Vector3(x, y, z);
      const matrix = new THREE.Matrix4().compose(position, rotation, scaleVec);

      t.matrixAutoUpdate = false;
      t.matrix.copy(matrix);

      treesGroup.add(t);


      t.updateWorldMatrix(true, true);
      const bbox = new THREE.Box3().setFromObject(t);
      const height = bbox.max.y - bbox.min.y;
      const radius = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.5;
      const center = new THREE.Vector3();
      bbox.getCenter(center);

      treeColliders.push({
        cx: center.x,
        cz: center.z,
        yMin: bbox.min.y,
        yMax: bbox.max.y,
        r: radius
      });

      if (DEBUG_COLLIDERS) {
        const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 16);
        const cylMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.3, depthWrite: false });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.set(center.x, bbox.min.y + height * 0.5, center.z);
        collidersGroup.add(cyl);
      }

      placed += 1;
    }

    console.log(`🌳 Colocados ${placed} arboles y ${treeColliders.length} colliders`);
  }, undefined, (err) => {
    console.error('Error cargando arbol.gltf', err);
  });
}

// Resuelve penetracion jugador-cilindro via empuje radial
function resolveTreeCollisions(nextX, nextZ, nextY) {
  
  let nx = nextX;
  let nz = nextZ;

  for (const c of treeColliders) {
    if (nextY + playerRadius < c.yMin || nextY - playerRadius > c.yMax) {
      continue;
    }

    const dx = nx - c.cx;
    const dz = nz - c.cz;
    const minDist = c.r + playerRadius;
    const dist2 = dx * dx + dz * dz;

    if (dist2 < minDist * minDist) {
      const dist = Math.sqrt(dist2) || 1e-6;
      const push = (minDist - dist) + 1e-3; 
      nx += (dx / dist) * push;
      nz += (dz / dist) * push;
    }
  }

  return { x: nx, z: nz };
}


// Dispara una bola con GLTF, luz puntual y fisica simple
function shoot() {
  if (shootCooldown > 0 || sprint) {
    return; 
  }

  let dir = new THREE.Vector3();
  let origin;

  if (firstPerson) {
    
    camera.getWorldDirection(dir).normalize();
    origin = camera.position.clone();
  } else {
    
    dir.set(Math.sin(angulo), 0, Math.cos(angulo)).normalize();
    const forward = dir.clone();
    origin = p_pos.clone();
    origin.addScaledVector(forward, playerRadius + 0.35);
    origin.setY(p_pos.y + 0.28);

    const groundAtOrigin = heightFunc(origin.x, origin.z);
    origin.y = Math.max(origin.y, groundAtOrigin + BULLET_RADIUS + 0.02);
  }

  
  const loader = new THREE.GLTFLoader();
  loader.load('models/fireball_simple.gltf', (gltf) => {
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
    light.position.set(0, 0, 0);
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

// Test de impacto de proyectil con arboles
function bulletHitsTree(pos) {
  
  for (const c of treeColliders) {
    if (pos.y < c.yMin || pos.y > c.yMax) {
      continue;
    }

    const dx = pos.x - c.cx;
    const dz = pos.z - c.cz;
    const rr = (c.r + BULLET_RADIUS);
    if (dx * dx + dz * dz <= rr * rr) {
      return true;
    }
  }
  return false;
}

// Elimina proyectil y libera recursos
function removeBullet(index) {
  const b = bullets[index];
  if (!b) {
    return;
  }

  
  b.mesh.traverse((n) => {
    if (n.isMesh) {
      if (n.geometry) {
        n.geometry.dispose();
      }
      if (Array.isArray(n.material)) {
        n.material.forEach((m) => m && m.dispose());
      } else if (n.material) {
        n.material.dispose();
      }
    }
    if (n.isLight && n.dispose) {
      n.dispose();
    }
  });

  scene.remove(b.mesh);
  bullets.splice(index, 1);
}

// Integra proyectiles y gestiona colisiones y vida
function updateProjectiles(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;

    const pos = b.mesh.position;
    const groundY = heightFunc(pos.x, pos.z) + BULLET_RADIUS + 0.02;

    
    if (pos.y <= groundY) {
      removeBullet(i);
      continue;
    }

    
    if (bulletHitsTree(pos)) {
      removeBullet(i);
      continue;
    }

    
    if (b.life <= 0 || Math.abs(pos.x) > R + 5 || Math.abs(pos.z) > R + 5 || pos.y > 200) {
      removeBullet(i);
      continue;
    }

    
    const dir = b.vel.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    b.mesh.quaternion.copy(quat);

    
    const hitIndex = enemies.findIndex((e) => {
      return b.mesh.position.distanceTo(e.mesh.position) < (BULLET_RADIUS + 2);
    });

    if (hitIndex >= 0) {
      const enemy = enemies[hitIndex];

      if (!enemy.dead) {
        enemy.hp -= 1;
        if (enemy.hp <= 0) {
          killEnemy(enemy, hitIndex);
          addScore();
        }
        removeBullet(i);
      }
    }
  }
}

function forceVisible(root) {
  root.traverse((n) => {
    n.visible = true;
    if (n.layers && n.layers.set) n.layers.set(0);  // Asegura capa 0 (main camera ve capa 0)
    if (n.isMesh) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        if (!m) continue;
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.depthTest = true;
        m.side = THREE.FrontSide;
        if (m.map) m.map.encoding = THREE.sRGBEncoding;
        m.skinning = !!n.isSkinnedMesh;
        m.needsUpdate = true;
      }
      n.frustumCulled = false;
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
}

function renormalizeInstance(obj, targetH) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (!isFinite(size.y) || size.y < 1e-4) return; // nada que hacer si no mide

  const s = targetH / size.y;
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);
}


// Crea enemigos para una oleada, con mixer y acciones
function spawnEnemies(wave) {
  if (!mewtwoReady || !mewtwoPrefab) {
    console.warn('⏳ Mewtwo aun no cargo; reintento en la proxima ola.');
    return false;
  }

  for (let i = 0; i < ENEMIES_PER_WAVE + wave; i++) {
    const { x, z } = randomXZ();
    const y = heightFunc(x, z) + 5.0; // cae al suelo luego en update

    // Raiz del enemigo
    const enemyRoot = new THREE.Group();

    // ⚠️ Clonar el prefab ya normalizado
    const model = THREE.SkeletonUtils.clone(mewtwoPrefab);
    forceVisible(model);
    renormalizeInstance(model, ENEMY_TARGET_HEIGHT);

    // Ajustes de render
    model.traverse((n) => {
      if (n.isMesh) {
        n.frustumCulled = false;
        n.castShadow = true;
        n.receiveShadow = true;
      }
      if (n.isSkinnedMesh) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => { if (m) { m.skinning = true; m.needsUpdate = true; } });
      }
    });

    // Añadir modelo y UI de vida
    enemyRoot.add(model);

    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    );
    bar.position.set(0, ENEMY_BAR_HEIGHT, 0);
    enemyRoot.add(bar);

    // 📌 POSICIONAR el enemigo en el punto de spawn
    enemyRoot.position.set(x, y, z);

    // (opcional) que mire hacia el jugador desde el inicio
    enemyRoot.lookAt(p_pos.x, enemyRoot.position.y, p_pos.z);

    scene.add(enemyRoot);

    // 🎬 Mixer y acciones
    // Usar como root el propio modelo (contiene todos los huesos)
    const animRoot = model;
    const mixer = new THREE.AnimationMixer(animRoot);
    const enemyActions = {};

    const idleClip = e_actions[e_animationNames[E_IDLE]];
    const walkClip = e_actions[e_animationNames[E_WALK]];
    const dieClip  = e_actions[e_animationNames[E_DIE]];

    if (idleClip) enemyActions.idle = mixer.clipAction(idleClip).setLoop(THREE.LoopRepeat, Infinity);
    if (walkClip) enemyActions.walk = mixer.clipAction(walkClip).setLoop(THREE.LoopRepeat, Infinity);
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
      next.reset(); next.fadeIn(0.2); next.play();
      currentAction = next;
    };

    // ✅ Arrancar directamente la animación de caminar
    if (enemyActions.walk) {
      play('walk');
    } else if (enemyActions.idle) {
      play('idle');
    }

    enemies.push({
      mesh: enemyRoot,
      hp: ENEMY_HP,
      healthBar: bar,
      mixer,
      actions: enemyActions,
      playAction: play,
      currentAction,
      dead: false,
      hitbox: null,
      spinHitbox: false,
      spinSpeed: 6.0
    });
  }

  console.log(`🌊 Oleada ${wave + 1} con ${ENEMIES_PER_WAVE + wave} Mewtwos.`);
  return true;
}


// Actualiza barra de vida del jugador
function updateHealthBar() {
  
  const pct = Math.max(0, playerHP / playerMaxHP);
  const bar = document.getElementById('health-bar');
  bar.style.width = `${pct * 100}%`;
  bar.style.backgroundColor = pct < 0.3 ? '#f33' : (pct < 0.6 ? '#ff0' : '#0f0');
}

// Resuelve colision enemigo-arbol con mismo algoritmo
function resolveEnemyTreeCollisions(pos, radius = 0.3) {
  
  const result = pos.clone();

  for (const c of treeColliders) {
    if (result.y + radius < c.yMin || result.y - radius > c.yMax) {
      continue;
    }

    const dx = result.x - c.cx;
    const dz = result.z - c.cz;
    const minDist = c.r + radius;
    const dist2 = dx * dx + dz * dz;

    if (dist2 < minDist * minDist) {
      const dist = Math.sqrt(dist2) || 1e-6;
      const push = (minDist - dist) + 1e-3;
      result.x += (dx / dist) * push;
      result.z += (dz / dist) * push;
    }
  }

  return result;
}

// Avanza IA simple: seguir jugador, ajustar altura y UI
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    e.mixer.update(dt);

    if (e.dead) {
      continue;
    }

    if (!e || !e.mesh) {
      enemies.splice(i, 1);
      continue;
    }


    const dir = new THREE.Vector3().subVectors(p_pos, e.mesh.position).setY(0).normalize();
    e.mesh.lookAt(p_pos.x, e.mesh.position.y, p_pos.z);
    const proposedPos = e.mesh.position.clone().addScaledVector(dir, ENEMY_SPEED * dt);
    const corrected = resolveEnemyTreeCollisions(proposedPos);
    e.mesh.position.set(corrected.x, e.mesh.position.y, corrected.z);

    
    const groundY = heightFunc(e.mesh.position.x, e.mesh.position.z);
    e.mesh.position.y = groundY;


    if (e.healthBar && e.healthBar.visible) {
      e.healthBar.position.set(0, ENEMY_BAR_HEIGHT, 0);
      e.healthBar.scale.x = Math.max(0.001, e.hp / ENEMY_HP);
      e.healthBar.material.color.set(e.hp <= 1 ? 0xff0000 : e.hp === 2 ? 0xffff00 : 0x00ff00);
      e.healthBar.lookAt(camera.position);
    }


    if (DEBUG_ENEMY_HITBOX && e.spinHitbox && e.hitbox) {
      e.hitbox.rotation.y += e.spinSpeed * dt;
    }


    const dist = e.mesh.position.distanceTo(p_pos);
    if (dist < playerRadius + 0.3) {
      if (playerHurtCooldown <= 0) {
        console.log('💥 El jugador fue tocado por un enemigo');
        playerHP = Math.max(0, playerHP - 1);
        updateHealthBar();
        playerHurtCooldown = 1; 
      }
    }
  }
}

// Maneja muerte: animacion, ocultar barra y limpieza diferida
function killEnemy(e, index) {
  if (e.dead) {
    return;
  }

  e.dead = true;

  if (e.actions && e.actions.die) {
    if (e.currentAction) {
      e.currentAction.fadeOut(0.15);
    }
    e.actions.die.reset();
    e.actions.die.fadeIn(0.15);
    e.actions.die.play();
    e.currentAction = e.actions.die;
  } else {
    
    const dieClip = e_actions[e_animationNames[E_DIE]];
    if (dieClip) {
      e.mixer.stopAllAction();
      e.mixer.clipAction(dieClip).reset().play();
    }
  }

  if (e.healthBar) {
    e.healthBar.visible = false;
  }

  if (e.hitbox) {
    e.spinHitbox = true;
  }

  
  setTimeout(() => {
    scene.remove(e.mesh);
    enemies.splice(index, 1);
  }, 5000);
}


// Bucle de actualizacion: input, fisica, camaras, spawner
function update(dt) {
  
  const forward = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  
  angulo = THREE.MathUtils.euclideanModulo(angulo + Math.PI, Math.PI * 2) - Math.PI;

  
  const moving = (
    controls.moveForward ||
    controls.moveBackward ||
    controls.moveLeft ||
    controls.moveRight
  );

  const isBackwardOnly = controls.moveBackward && !controls.moveForward;
  const isSprinting = sprint && moving;
  const effSpeed = controls.speed * (isSprinting ? 1.7 : 1.0);

  let move = new THREE.Vector3();

  if (controls.moveForward) {
    move.addScaledVector(forward, effSpeed);
  }
  if (controls.moveBackward) {
    move.addScaledVector(forward, -effSpeed);
  }
  if (controls.moveLeft) {
    move.addScaledVector(right, effSpeed);
  }
  if (controls.moveRight) {
    move.addScaledVector(right, -effSpeed);
  }

  let nextX = p_pos.x + move.x;
  let nextZ = p_pos.z + move.z;

  
  const solved = resolveTreeCollisions(nextX, nextZ, p_pos.y);
  p_pos.x = solved.x;
  p_pos.z = solved.z;

  
  p_pos.x = clamp(p_pos.x, -R + 0.1, R - 0.1);
  p_pos.z = clamp(p_pos.z, -R + 0.1, R - 0.1);

  
  const groundY = heightFunc(p_pos.x, p_pos.z) + playerRadius;
  vy += GRAVITY * dt;
  p_pos.y += vy * dt;

  if (p_pos.y <= groundY) {
    p_pos.y = groundY;
    vy = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  
  if (player) {
    player.position.set(p_pos.x, p_pos.y - playerRadius, p_pos.z);
    player.rotation.y = angulo;

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
        changeCharAnimation(isBackwardOnly ? A_BACKWARDS : (moving ? A_RUN : A_IDLE));
      }
    }
  }

  
  if (miniMarker) {
    const yGround = heightFunc(p_pos.x, p_pos.z) + 0.03;
    miniMarker.position.set(p_pos.x, yGround, p_pos.z);
    miniMarker.rotation.y = angulo;
  }

  
  const movingForFP = controls.moveForward || controls.moveBackward;
  const sprintingFP = sprint && movingForFP;

  if (firstPerson) {
    const targetEyeY = p_pos.y + (sprintingFP ? 0.18 : 0.20);
    camY += (targetEyeY - camY) * Math.min(1, CAM_Y_SMOOTH * dt);

    const eye = new THREE.Vector3(p_pos.x, camY, p_pos.z);
    camera.position.copy(eye);

    
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const fwd = new THREE.Vector3(Math.sin(angulo) * cp, sp, Math.cos(angulo) * cp).normalize();
    const lookTarget = eye.clone().addScaledVector(fwd, FP_LOOK_DIST);

    
    const worldUp = new THREE.Vector3(0, 1, 0);
    const rightVec = new THREE.Vector3().crossVectors(fwd, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(rightVec, fwd).normalize();
    const m = new THREE.Matrix4().makeBasis(rightVec, up, fwd.clone().negate());
    camera.quaternion.setFromRotationMatrix(m);
    camera.lookAt(lookTarget);

    const targetFov = sprintingFP ? sprintFov : baseFov;
    camera.fov += (targetFov - camera.fov) * (sprintingFP ? 0.18 : 0.12);
    camera.updateProjectionMatrix();
  } else {
    
    const normalDist = 3.5;
    const sprintDist = 1.9;

    const camOff = new THREE.Vector3(-Math.sin(angulo), 0.4, -Math.cos(angulo));
    camOff.multiplyScalar(isSprinting ? sprintDist : normalDist);

    const lookAhead = isSprinting ? lookAheadSprint : lookAheadNormal;
    const aimUp = isSprinting ? aimUpSprint : aimUpNormal;

    const target = p_pos.clone();
    const forwardVec = new THREE.Vector3(Math.sin(angulo), 0, Math.cos(angulo));
    target.add(forwardVec.multiplyScalar(lookAhead));
    target.y += aimUp;

    const desired = p_pos.clone();
    desired.add(camOff);
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

  
  cameraTop.position.set(p_pos.x, 30, p_pos.z);
  cameraTop.lookAt(p_pos.x, 0, p_pos.z);

  
  playerHurtCooldown = Math.max(0, playerHurtCooldown - dt);

  
  enemySpawnTimer += dt;
  if (mewtwoReady && (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL)) {
    enemySpawnTimer = 0;
    if (spawnEnemies(waveNumber)) {
      waveNumber += 1;
    }
  }

  
  const reticle = document.getElementById('reticle');
  if (reticle) {
    reticle.style.display = (isSprinting ? 'none' : 'block');
  }

  
  updateEnemies(dt);
}


// Bucle de render: frame, viewports y minimapa
function render() {
  requestAnimationFrame(render);

  stats.begin();

  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - prevTime); 
  prevTime = now;

  update(dt);
  if (mixer) {
    mixer.update(dt);
  }

  
  renderer.autoClear = false;
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.setClearColor(new THREE.Color(0x87b2f9));
  renderer.clear();
  renderer.render(scene, camera);

  
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
