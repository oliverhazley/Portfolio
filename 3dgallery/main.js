// Global variables
let scene, camera, renderer, controls;
let ball, sky, sun;
let platforms = [];
let movingPlatforms = [];
let obstacles = [];
let portal;
let platformLights = [];
let collectibles = [];
let trailParticles = [];
let isGameOver = false;
let velocity = { x: 0, y: 0, z: 0 };
let jumpSpeed = 0.15;
let gravity = 0.01;
let keys = {};
let currentColor = 0x00ffff;
let lives = 3;
let runCounter = 0;
let score = 0;

// HUD Elements
let runCounterElement = document.getElementById('run-counter');
let livesCounterElement = document.getElementById('lives-counter');
let scoreElement = document.getElementById('score-counter');

// Mobile Controls
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let joystickManager, jumpButton;

// Initialize the game
function init() {
  // Create Scene
  scene = new THREE.Scene();

  // Create Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  // Create Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; // Enable shadows
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // Add Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI / 2;
  controls.target.set(0, 1, 0); // Camera looks at the ball's initial position

  // Add Event Listener for Window Resize
  window.addEventListener('resize', onWindowResize, false);

  // Create the Ball
  createBall();

  // Create the Platforms
  createPlatforms();

  // Create the End Portal
  createEndPortal();

  // Add Lights
  addLights();

  // Add trail effect
  createTrailEffect();

  // Add Skybox with Sun Shader
  createSky();

  // Add Event Listeners for controls
  window.addEventListener('keydown', onKeyDown, false);
  window.addEventListener('keyup', onKeyUp, false);

  // Update HUD
  updateHUD();

  // Initialize Mobile Controls if on mobile
  if (isMobile) {
    createMobileControls();
  }

  // Start Game Loop
  animate();
}

// Create Ball Function
function createBall() {
  const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.castShadow = true;
  scene.add(ball);
}

// Add Lights Function
function addLights() {
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true; // Enable shadows for the light
  scene.add(directionalLight);
}

// Handle Window Resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Create Platforms along a Curve
function createPlatforms() {
  // Remove old platforms and lights
  platforms.forEach(platform => scene.remove(platform.mesh));
  platformLights.forEach(light => scene.remove(light));
  movingPlatforms.forEach(platform => scene.remove(platform.mesh));
  obstacles.forEach(obstacle => scene.remove(obstacle));
  collectibles.forEach(collectible => scene.remove(collectible));
  platforms = [];
  platformLights = [];
  movingPlatforms = [];
  obstacles = [];
  collectibles = [];

  const neonMaterial = new THREE.MeshStandardMaterial({
    color: currentColor,
    emissive: currentColor,
    emissiveIntensity: 0.5,
    metalness: 0.1,
    roughness: 0.3,
  });

  // Generate random control points for the curve
  let controlPoints = [];
  let numPoints = 20; // Number of control points
  let x = 0;
  let z = 0;

  for (let i = 0; i < numPoints; i++) {
    x += (Math.random() - 0.5) * 5; // Smaller random x offset

    // Introduce occasional larger gaps
    let gapChance = Math.random();
    if (gapChance < 0.2) {
      z -= Math.random() * 5 + 5; // Larger gap
    } else {
      z -= Math.random() * 5 + 2; // Normal gap
    }

    controlPoints.push(new THREE.Vector3(x, 0, z));
  }

  // Create the curve
  const curve = new THREE.CatmullRomCurve3(controlPoints);
  const curvePoints = curve.getPoints(200); // Get points along the curve

  // Place platforms along the curve
  let platformSpacing = 10; // Decreased spacing for smaller gaps
  for (let i = 0; i < curvePoints.length; i += platformSpacing) {
    const position = curvePoints[i];

    const platformGeometry = new THREE.BoxGeometry(4, 0.5, 2);
    const platformMesh = new THREE.Mesh(platformGeometry, neonMaterial);
    platformMesh.position.copy(position);
    platformMesh.receiveShadow = true;

    // Align the platform with the curve direction
    if (i + 1 < curvePoints.length) {
      const nextPosition = curvePoints[i + 1];
      const direction = nextPosition.clone().sub(position).normalize();
      const angle = Math.atan2(direction.x, direction.z);
      platformMesh.rotation.y = angle;
    }

    // Decide randomly if this platform is moving
    let isMoving = Math.random() < 0.2; // 20% chance to be a moving platform

    if (isMoving) {
      let amplitude = Math.random() * 4 + 2; // Movement amplitude
      let speed = Math.random() * 0.02 + 0.01; // Movement speed
      movingPlatforms.push({
        mesh: platformMesh,
        initialPosition: position.clone(),
        amplitude: amplitude,
        speed: speed,
        phase: Math.random() * Math.PI * 2,
      });
    } else {
      platforms.push({ mesh: platformMesh });
    }

    scene.add(platformMesh);

    // Add glowing light around each platform
    const platformLight = new THREE.PointLight(currentColor, 0.5, 10);
    platformLight.position.set(position.x, position.y + 1, position.z);
    platformLights.push(platformLight);
    scene.add(platformLight);

    // Add obstacles on some platforms
    if (Math.random() < 0.3 && !isMoving) {
      createObstacle(platformMesh.position);
    }

    // Add collectibles on some platforms
    if (Math.random() < 0.3) {
      createCollectible(platformMesh.position);
    }
  }

  // Start the ball on the first platform
  ball.position.set(
    platforms[0].mesh.position.x,
    platforms[0].mesh.position.y + 0.75,
    platforms[0].mesh.position.z
  );
  controls.target.copy(ball.position); // Update camera target to the ball's new position
}

// Create Moving Obstacles
function createObstacle(position) {
  const obstacleGeometry = new THREE.BoxGeometry(1, 1, 0.2);
  const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  obstacle.position.set(position.x, position.y + 1, position.z);
  obstacle.castShadow = true;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

// Create Collectibles
function createCollectible(position) {
  const collectibleGeometry = new THREE.IcosahedronGeometry(0.3, 0);
  const collectibleMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
  collectible.position.set(position.x, position.y + 1, position.z);
  collectible.castShadow = true;
  scene.add(collectible);
  collectibles.push(collectible);
}

// Create the End Portal
function createEndPortal() {
  if (portal) {
    scene.remove(portal); // Remove the old portal
  }
  const portalGeometry = new THREE.TorusGeometry(1, 0.2, 16, 100);
  const portalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  portal = new THREE.Mesh(portalGeometry, portalMaterial);
  const lastPlatform = platforms[platforms.length - 1].mesh;
  portal.position.set(
    lastPlatform.position.x,
    lastPlatform.position.y + 1.5,
    lastPlatform.position.z
  );
  portal.rotation.x = Math.PI / 2;
  scene.add(portal);
}

// Handle Keyboard Inputs
function onKeyDown(event) {
  keys[event.key.toLowerCase()] = true;

  if (isGameOver && event.key.toLowerCase() === 'r') {
    restartGame();
  }
}

function onKeyUp(event) {
  keys[event.key.toLowerCase()] = false;
}

// Create Trail Effect for Ball
function createTrailEffect() {
  const trailMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const trailGeometry = new THREE.SphereGeometry(0.1, 8, 8);

  for (let i = 0; i < 20; i++) {
    const particle = new THREE.Mesh(trailGeometry, trailMaterial);
    particle.visible = false;
    scene.add(particle);
    trailParticles.push(particle);
  }
}

// Update Trail Effect
function updateTrailEffect() {
  for (let i = trailParticles.length - 1; i > 0; i--) {
    trailParticles[i].position.copy(trailParticles[i - 1].position);
    trailParticles[i].visible = true;
  }
  trailParticles[0].position.copy(ball.position);
}

// Create Sky with Sun Shader
function createSky() {
  sky = new THREE.Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  sun = new THREE.Vector3();

  const uniforms = sky.material.uniforms;
  uniforms['turbidity'].value = 10;
  uniforms['rayleigh'].value = 3;
  uniforms['mieCoefficient'].value = 0.005;
  uniforms['mieDirectionalG'].value = 0.7;

  const parameters = {
    elevation: 2,
    azimuth: 180,
  };

  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
  const theta = THREE.MathUtils.degToRad(parameters.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);

  uniforms['sunPosition'].value.copy(sun);

  renderer.toneMappingExposure = 0.5;
  renderer.render(scene, camera);
}

// Update Ball Position and Camera
function updateBall() {
  // Update moving platforms
  movingPlatforms.forEach(platform => {
    platform.phase += platform.speed;
    platform.mesh.position.x = platform.initialPosition.x + Math.sin(platform.phase) * platform.amplitude;
  });

  // Rotate obstacles
  obstacles.forEach(obstacle => {
    obstacle.rotation.y += 0.05;
  });

  // Update collectibles
  collectibles.forEach(collectible => {
    collectible.rotation.y += 0.05;
  });

  // Handle Input
  let moveSpeed = 0.02; // Adjusted speed

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; // Ignore vertical movement for forward direction
  forward.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

  // Reset horizontal velocity
  velocity.x *= 0.9;
  velocity.z *= 0.9;

  if (isMobile) {
    handleMobileInput(forward, right, moveSpeed);
  } else {
    handleKeyboardInput(forward, right, moveSpeed);
  }

  // Apply gravity
  velocity.y -= gravity;

  // Update ball position
  ball.position.x += velocity.x;
  ball.position.z += velocity.z;
  ball.position.y += velocity.y;

  // Collision detection with platforms
  let onPlatform = false;
  platforms.concat(movingPlatforms).forEach(platformObj => {
    const platform = platformObj.mesh;
    // Create bounding boxes for the ball and platform
    const ballBox = new THREE.Box3().setFromObject(ball);
    const platformBox = new THREE.Box3().setFromObject(platform);

    if (ballBox.intersectsBox(platformBox)) {
      if (velocity.y <= 0) {
        ball.position.y = platformBox.max.y + 0.5; // Adjust for ball radius
        velocity.y = 0;
        onPlatform = true;
      }
    }
  });

  // Collision detection with obstacles
  obstacles.forEach(obstacle => {
    const ballBox = new THREE.Box3().setFromObject(ball);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);

    if (ballBox.intersectsBox(obstacleBox)) {
      // Lose a life when hitting an obstacle
      gameOver();
    }
  });

  // Collectibles collection
  collectibles = collectibles.filter(collectible => {
    const ballBox = new THREE.Box3().setFromObject(ball);
    const collectibleBox = new THREE.Box3().setFromObject(collectible);

    if (ballBox.intersectsBox(collectibleBox)) {
      // Increase score
      score += 10;
      updateHUD();
      scene.remove(collectible);
      return false; // Remove from array
    }
    return true;
  });

  // Check if ball reaches end portal
  const endPortalPosition = portal.position.clone();
  if (ball.position.distanceTo(endPortalPosition) < 1) {
    currentColor = Math.random() * 0xffffff; // Change platform color
    runCounter++; // Increment run counter
    updateHUD(); // Update HUD display
    createPlatforms(); // Generate new track
    createEndPortal(); // Create new end portal
  }

  // Check for falling off
  if (ball.position.y < -10) {
    gameOver();
  }

  // Update the trail effect
  updateTrailEffect();

  // Camera should follow the ball from behind and reset orientation
  const cameraOffset = new THREE.Vector3(0, 5, 10);
  const desiredCameraPosition = ball.position.clone().add(cameraOffset);

  // Smoothly interpolate camera position
  camera.position.lerp(desiredCameraPosition, 0.1);

  // Reset camera orientation to face the ball
  camera.lookAt(ball.position);

  // Update controls target
  controls.target.copy(ball.position);
  controls.update();
}

// Handle Keyboard Input
function handleKeyboardInput(forward, right, moveSpeed) {
  if (keys['arrowup']) {
    velocity.x += forward.x * moveSpeed;
    velocity.z += forward.z * moveSpeed;
  }
  if (keys['arrowdown']) {
    velocity.x -= forward.x * moveSpeed;
    velocity.z -= forward.z * moveSpeed;
  }
  if (keys['arrowleft']) {
    velocity.x -= right.x * moveSpeed;
    velocity.z -= right.z * moveSpeed;
  }
  if (keys['arrowright']) {
    velocity.x += right.x * moveSpeed;
    velocity.z += right.z * moveSpeed;
  }
  if (keys[' ']) {
    if (velocity.y === 0) {
      velocity.y = jumpSpeed;
    }
  }
}

// Handle Mobile Input
function handleMobileInput(forward, right, moveSpeed) {
  if (joystickData) {
    const angle = joystickData.angle.radian;
    const force = joystickData.force;

    // Calculate direction based on joystick angle
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    velocity.x += (forward.x * dirY + right.x * dirX) * moveSpeed * force;
    velocity.z += (forward.z * dirY + right.z * dirX) * moveSpeed * force;
  }
}

let joystickData = null;

// Initialize Mobile Controls
function createMobileControls() {
  // Create a joystick manager using NippleJS
  joystickManager = nipplejs.create({
    zone: document.body,
    mode: 'static',
    position: { left: '60px', bottom: '60px' },
    color: 'cyan',
    size: 100,
    restOpacity: 0.5,
    opacity: 0.8,
  });

  joystickManager.on('move', (evt, data) => {
    joystickData = data;
  });

  joystickManager.on('end', () => {
    joystickData = null;
    velocity.x = 0;
    velocity.z = 0;
  });

  // Create Jump Button
  jumpButton = document.createElement('div');
  jumpButton.id = 'jump-button';
  jumpButton.innerText = 'Jump';
  document.body.appendChild(jumpButton);

  jumpButton.addEventListener('touchstart', () => {
    if (velocity.y === 0) {
      velocity.y = jumpSpeed;
    }
  });
}

// Game Loop
function animate() {
  if (!isGameOver) {
    updateBall();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Game Over
function gameOver() {
  lives--;
  updateHUD();

  if (lives <= 0) {
    // Reset game
    isGameOver = true;
    runCounter = 0;
    lives = 3;
    score = 0;
    updateHUD();
    document.getElementById('game-over').innerText = 'Game Over! Press R to Restart';
    document.getElementById('game-over').style.display = 'block';
  } else {
    // Restart from current level
    ball.position.set(
      platforms[0].mesh.position.x,
      platforms[0].mesh.position.y + 0.75,
      platforms[0].mesh.position.z
    );
    velocity = { x: 0, y: 0, z: 0 };
  }
}

// Restart Game
function restartGame() {
  isGameOver = false;
  document.getElementById('game-over').style.display = 'none';
  ball.position.set(
    platforms[0].mesh.position.x,
    platforms[0].mesh.position.y + 0.75,
    platforms[0].mesh.position.z
  );
  velocity = { x: 0, y: 0, z: 0 };
  controls.target.copy(ball.position); // Reset camera target to ball's new position
}

// Update HUD
function updateHUD() {
  runCounterElement.innerText = `Runs Completed: ${runCounter}`;
  livesCounterElement.innerText = `Lives: ${lives}`;
  if (scoreElement) {
    scoreElement.innerText = `Score: ${score}`;
  }
}

// Initialize the Game
init();
