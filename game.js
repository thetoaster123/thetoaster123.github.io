// Ensure background music plays (handle autoplay restrictions)
window.addEventListener('DOMContentLoaded', () => {
  const bgMusic = document.getElementById('bgMusic');
  if (!bgMusic) return;

  const playPromise = bgMusic.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      const resumeMusic = () => {
        bgMusic.play();
        window.removeEventListener('mousedown', resumeMusic);
        window.removeEventListener('touchstart', resumeMusic);
      };
      window.addEventListener('mousedown', resumeMusic);
      window.addEventListener('touchstart', resumeMusic);
    });
  }
});

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const imageSources = [
  'IMG_1792.jpeg',
  'IMG_1874.jpeg',
  'IMG_2081.jpeg',
  'IMG_2124.jpeg',
  'IMG_2145.jpeg',
  'IMG_2171.jpeg',
  'IMG_3231.JPG',
  'IMG_1144.jpeg',
  'IMG_1052.jpeg',
  'IMG_0740.jpeg'
];

const PHYSICS_STEP_MS = 1000 / 60;
const PHYSICS_DT = PHYSICS_STEP_MS / 1000;
const MAX_FRAME_DELTA_MS = 34;
const MAX_STEPS_PER_FRAME = 3;
const HASH_CELL_SIZE = 96;

const GRAVITY = 1450;
const BOUNCE = 0.35;
const AIR_DRAG = 0.997;
const ROLL_FRICTION = 0.985;
const SLEEP_VX_THRESHOLD = 8;
const SLEEP_VY_THRESHOLD = 8;

const FLOOR_HEIGHT = 40;
const TOP_LOSS_LINE = 12;
const PREVIEW_RADIUS = 27;

const MIN_RADIUS = Math.round(18 * 2 * 0.75);
const MAX_RADIUS = Math.round(36 * 2 * 0.75);

const images = [];
const ballSprites = [];
let previewSprites = [];

let balls = [];
let score = 0;
let comboComment = '';
let comboTimeout = null;
let dropIdx = 0;
let gameOver = false;
let pumpkinPositions = [];

let rafId = null;
let lastFrameTime = 0;
let physicsAccumulator = 0;
let ballIdCounter = 1;

let staticLayer = null;

function radiusForIdx(imgIdx) {
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * (imgIdx / (images.length - 1));
}

function preloadImages(callback) {
  let loaded = 0;

  imageSources.forEach((src, i) => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      images[i] = img;
      loaded += 1;
      if (loaded === imageSources.length) callback();
    };

    img.onerror = () => {
      const fallback = document.createElement('canvas');
      fallback.width = 60;
      fallback.height = 60;
      const fctx = fallback.getContext('2d');
      fctx.fillStyle = '#cccccc';
      fctx.fillRect(0, 0, 60, 60);
      fctx.fillStyle = '#888888';
      fctx.font = 'bold 16px Arial';
      fctx.fillText('No Img', 5, 34);
      images[i] = fallback;
      loaded += 1;
      if (loaded === imageSources.length) callback();
    };
  });
}

function createCircularSprite(sourceImage, radius, zoomScale) {
  const size = Math.ceil(radius * 2);
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;

  const sctx = sprite.getContext('2d');
  sctx.clearRect(0, 0, size, size);
  sctx.save();
  sctx.beginPath();
  sctx.arc(radius, radius, radius, 0, Math.PI * 2);
  sctx.clip();

  const drawSize = size * zoomScale;
  const drawOffset = (size - drawSize) / 2;
  sctx.drawImage(sourceImage, drawOffset, drawOffset, drawSize, drawSize);
  sctx.restore();

  return sprite;
}

function buildSpriteCaches() {
  for (let i = 0; i < images.length; i += 1) {
    ballSprites[i] = createCircularSprite(images[i], radiusForIdx(i), 1.5);
  }

  previewSprites = images.map((img) => createCircularSprite(img, PREVIEW_RADIUS, 1.0));
}

function buildStaticLayer() {
  staticLayer = document.createElement('canvas');
  staticLayer.width = canvas.width;
  staticLayer.height = canvas.height;

  const sctx = staticLayer.getContext('2d');
  sctx.clearRect(0, 0, canvas.width, canvas.height);

  sctx.save();
  sctx.strokeStyle = '#ff2222';
  sctx.lineWidth = 6;
  sctx.beginPath();
  sctx.moveTo(0, 6);
  sctx.lineTo(canvas.width, 6);
  sctx.stroke();
  sctx.restore();

  sctx.save();
  sctx.fillStyle = '#00ff00';
  sctx.fillRect(0, canvas.height - FLOOR_HEIGHT, canvas.width, FLOOR_HEIGHT);
  sctx.restore();

  sctx.save();
  sctx.font = '32px Arial';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  for (let i = 0; i < pumpkinPositions.length; i += 1) {
    const pos = pumpkinPositions[i];
    sctx.fillText('🎃', pos.x, pos.y);
  }
  sctx.restore();

  sctx.save();
  sctx.strokeStyle = '#00aa00';
  sctx.lineWidth = 4;
  sctx.strokeRect(0, 0, canvas.width, canvas.height);
  sctx.restore();

  sctx.save();
  sctx.font = 'bold 18px Arial';
  sctx.fillStyle = '#333333';
  sctx.textAlign = 'center';
  sctx.fillText('Made by Tom', canvas.width / 2, canvas.height - 10);
  sctx.restore();
}

function renderLegend() {
  const legendDiv = document.getElementById('photoLegend');
  legendDiv.innerHTML = '';

  for (let idx = 0; idx < imageSources.length; idx += 1) {
    let img;

    if (idx === imageSources.length - 1) {
      img = document.createElement('div');
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.borderRadius = '50%';
      img.style.margin = '4px';
      img.style.display = 'inline-flex';
      img.style.alignItems = 'center';
      img.style.justifyContent = 'center';
      img.style.background = '#eeeeee';
      img.style.fontWeight = 'bold';
      img.style.fontSize = '24px';
      img.style.color = '#888888';
      img.textContent = '?';
    } else {
      img = document.createElement('img');
      img.src = imageSources[idx];
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.borderRadius = '50%';
      img.style.margin = '4px';
    }

    legendDiv.appendChild(img);

    const value = document.createElement('span');
    value.textContent = ` = ${10 * (idx + 1) + (idx > 6 ? 40 : idx > 2 ? 20 : 0)} pts`;
    value.style.marginRight = '16px';
    legendDiv.appendChild(value);
  }
}

function randomDropIdx() {
  const lowPool = [0, 1, 2];
  return lowPool[Math.floor(Math.random() * lowPool.length)];
}

function createBall(x, y, imgIdx) {
  return {
    id: ballIdCounter++,
    x,
    y,
    vx: 0,
    vy: 0,
    imgIdx,
    radius: radiusForIdx(imgIdx),
    sleeping: false
  };
}

function startGame() {
  balls = [];
  score = 0;
  comboComment = '';
  gameOver = false;
  dropIdx = randomDropIdx();
  ballIdCounter = 1;

  pumpkinPositions = [];
  const pumpkinCount = Math.floor(canvas.width / 60);
  const pumpkinY = canvas.height - FLOOR_HEIGHT;
  for (let j = 0; j < pumpkinCount; j += 1) {
    pumpkinPositions.push({
      x: Math.random() * (canvas.width - 40) + 20,
      y: pumpkinY
    });
  }

  buildStaticLayer();
  render();
}

function handleDrop(event) {
  if (gameOver) return;

  const point = event.touches && event.touches.length ? event.touches[0] : event;
  const rect = canvas.getBoundingClientRect();
  const relX = point.clientX - rect.left;

  const colWidth = canvas.width / images.length;
  const col = Math.max(0, Math.min(images.length - 1, Math.floor(relX / colWidth)));
  dropBall(col);
}

function dropBall(col) {
  if (gameOver) return;

  const imgIdx = dropIdx;
  const radius = radiusForIdx(imgIdx);
  const colWidth = canvas.width / images.length;
  const x = Math.max(
    radius,
    Math.min(col * colWidth + colWidth / 2, canvas.width - radius)
  );

  let y = 80;
  for (let t = 0; t < 16; t += 1) {
    let hasOverlap = false;

    for (let i = 0; i < balls.length; i += 1) {
      const other = balls[i];
      const dx = x - other.x;
      const dy = y - other.y;
      const minDist = radius + other.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 1;
        y += (minDist - dist) + 1;
        hasOverlap = true;
      }
    }

    if (!hasOverlap) break;
  }

  const floorY = canvas.height - FLOOR_HEIGHT - radius;
  y = Math.min(y, floorY);

  balls.push(createBall(x, y, imgIdx));
  dropIdx = randomDropIdx();
}

function hashKey(cx, cy) {
  return `${cx},${cy}`;
}

function buildSpatialHash() {
  const hash = new Map();

  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    const cellX = Math.floor(ball.x / HASH_CELL_SIZE);
    const cellY = Math.floor(ball.y / HASH_CELL_SIZE);
    const key = hashKey(cellX, cellY);

    if (!hash.has(key)) hash.set(key, []);
    hash.get(key).push(i);
  }

  return hash;
}

function resolveWorldBounds(ball) {
  const floorY = canvas.height - FLOOR_HEIGHT - ball.radius;

  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    if (ball.vx < 0) ball.vx = -ball.vx * BOUNCE;
    ball.sleeping = false;
  }

  if (ball.x + ball.radius > canvas.width) {
    ball.x = canvas.width - ball.radius;
    if (ball.vx > 0) ball.vx = -ball.vx * BOUNCE;
    ball.sleeping = false;
  }

  if (ball.y > floorY) {
    ball.y = floorY;
    if (ball.vy > 0) ball.vy = -ball.vy * BOUNCE;
    ball.vx *= ROLL_FRICTION;
    if (Math.abs(ball.vy) < SLEEP_VY_THRESHOLD) ball.vy = 0;
    ball.sleeping = false;
  }
}

function solveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minDist = a.radius + b.radius;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) return false;

  const dist = Math.sqrt(distSq) || 0.0001;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  const separation = overlap * 0.5;
  a.x -= nx * separation;
  a.y -= ny * separation;
  b.x += nx * separation;
  b.y += ny * separation;

  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  if (velAlongNormal < 0) {
    const impulse = -(1 + BOUNCE) * velAlongNormal * 0.5;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }

  a.sleeping = false;
  b.sleeping = false;
  return true;
}

function handleMergePair(a, b, pendingRemoval, additions) {
  if (a.imgIdx !== b.imgIdx || a.imgIdx >= images.length - 1) return false;

  pendingRemoval.add(a.id);
  pendingRemoval.add(b.id);

  const newIdx = a.imgIdx + 1;
  const newRadius = radiusForIdx(newIdx);
  const floorY = canvas.height - FLOOR_HEIGHT - newRadius;

  additions.push({
    x: (a.x + b.x) * 0.5,
    y: Math.min((a.y + b.y) * 0.5, floorY),
    imgIdx: newIdx
  });

  const points = (newIdx + 1) * 10 + (newIdx > 6 ? 40 : newIdx > 2 ? 20 : 0);
  score += points;

  if (points >= 70) {
    const comments = [
      'Nice work!',
      'Go plumps!',
      'Go pumpkin!',
      'Awesome combo!',
      'Pumpkin power!',
      'That was juicy!',
      'Combo master!',
      'Go plumpy!',
      '#sweetman',
      'Go jessica!',
      'plum plum PLUM!',
      'Jessica-level combo!',
      'Jessica says send it!',
      'Pumpkin train incoming!',
      'Pumpkin stack attack!',
      'Pumpkin legend energy!',
      'Pumpkin party mode!',
      'Pumpkin to the moon!',
      'Absolute pumpkin cinema!',
      '#sweetman approved!',
      '#sweetman certified combo!',
      '#sweetman momentum!',
      '#sweetman no brakes!',
      '#paddington powers activated!',
      '#paddington with the carry!',
      '#paddington combo report!',
      '#paddington undefeated!',
      'Acai bowl buff active!',
      'Acai bowl energy spike!',
      'Extra granola combo!',
      'Berry smooth merge!',
      'Acai bowl MVP!',
      'Marianara drip unlocked!',
      'Marianara mode: simmering!',
      'Spicy marianara combo!',
      'Double marianara special!',
      'Marinara Chilli Prawn Pasta!',
      'Ollie approves this combo!',
      'Coco says keep merging!',
      'Ollie and Coco power-up!',
      'Combo zoomies for Ollie!',
      'Coco-level clutch move!',
      'Ollie x Coco unstoppable!',
      'Mt Coolum momentum!',
      'Mt Coolum altitude gained!',
      'Peak Mt Coolum gameplay!',
      'Mt Coolum summit combo!',
      'Coolum climb complete!',
      'Jessica x Pumpkin crossover!',
      'Pumpkin + acai synergy!',
      'Sweetman signal detected!',
      'Paddington pressure applied!',
      'This merge has flavor!',
      'That one was delicious!',
      'Certified juicy mechanics!',
      'Sky full of pumpkins!',
      'Ballin through Brisbane!',
      'No crumbs left behind!',
      'Merge machine online!',
      'Keep cooking!',
      'That was CLEAN!',
      'Monster merge!',
      'Combo storm!',
      'Big pumpkin business!',
      'Flavor combo achieved!',
      'You are unstoppable!'
    ];

    comboComment = comments[Math.floor(Math.random() * comments.length)];
    if (comboTimeout) clearTimeout(comboTimeout);
    comboTimeout = setTimeout(() => {
      comboComment = '';
    }, 2000);
  }

  return true;
}

function stepPhysics() {
  if (gameOver) return;

  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];

    if (ball.sleeping) continue;

    ball.vy += GRAVITY * PHYSICS_DT;
    ball.vx *= AIR_DRAG;
    ball.vy *= AIR_DRAG;

    ball.x += ball.vx * PHYSICS_DT;
    ball.y += ball.vy * PHYSICS_DT;

    resolveWorldBounds(ball);

    if (
      ball.y >= (canvas.height - FLOOR_HEIGHT - ball.radius - 0.5) &&
      Math.abs(ball.vx) < SLEEP_VX_THRESHOLD &&
      Math.abs(ball.vy) < SLEEP_VY_THRESHOLD
    ) {
      ball.vx = 0;
      ball.vy = 0;
      ball.sleeping = true;
    }
  }

  const hash = buildSpatialHash();
  const pendingRemoval = new Set();
  const additions = [];

  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (pendingRemoval.has(a.id)) continue;

    const cellX = Math.floor(a.x / HASH_CELL_SIZE);
    const cellY = Math.floor(a.y / HASH_CELL_SIZE);

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const key = hashKey(cellX + ox, cellY + oy);
        const bucket = hash.get(key);
        if (!bucket) continue;

        for (let bIdx = 0; bIdx < bucket.length; bIdx += 1) {
          const j = bucket[bIdx];
          if (j <= i) continue;

          const b = balls[j];
          if (pendingRemoval.has(b.id)) continue;

          if (!solveCollision(a, b)) continue;

          if (handleMergePair(a, b, pendingRemoval, additions)) {
            break;
          }

          resolveWorldBounds(a);
          resolveWorldBounds(b);
        }

        if (pendingRemoval.has(a.id)) break;
      }
      if (pendingRemoval.has(a.id)) break;
    }
  }

  if (pendingRemoval.size > 0 || additions.length > 0) {
    const survivors = [];

    for (let i = 0; i < balls.length; i += 1) {
      if (!pendingRemoval.has(balls[i].id)) survivors.push(balls[i]);
    }

    for (let i = 0; i < additions.length; i += 1) {
      const merged = additions[i];
      survivors.push(createBall(merged.x, merged.y, merged.imgIdx));
    }

    balls = survivors;
  }

  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    if (ball.y - ball.radius < TOP_LOSS_LINE) {
      gameOver = true;
      break;
    }
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0);
  }

  const preview = previewSprites[dropIdx];
  if (preview) {
    ctx.drawImage(preview, canvas.width / 2 - PREVIEW_RADIUS, 40 - PREVIEW_RADIUS);
  }

  for (let i = 0; i < balls.length; i += 1) {
    const ball = balls[i];
    const sprite = ballSprites[ball.imgIdx];
    if (!sprite) continue;
    ctx.drawImage(sprite, ball.x - ball.radius, ball.y - ball.radius);
  }

  ctx.save();
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ff9900';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 10, 30);
  ctx.restore();

  if (comboComment) {
    ctx.save();
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#39d353';
    ctx.textAlign = 'center';
    ctx.fillText(comboComment, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }

  if (gameOver) {
    ctx.save();
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff2222';
    ctx.textAlign = 'center';
    ctx.fillText('Nice work plumps!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ff9900';
    ctx.fillText(`Total Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }
}

function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;

  const frameDelta = Math.min(MAX_FRAME_DELTA_MS, timestamp - lastFrameTime);
  lastFrameTime = timestamp;
  physicsAccumulator += frameDelta;

  let substeps = 0;
  while (physicsAccumulator >= PHYSICS_STEP_MS && substeps < MAX_STEPS_PER_FRAME) {
    stepPhysics();
    physicsAccumulator -= PHYSICS_STEP_MS;
    substeps += 1;
  }

  if (physicsAccumulator > PHYSICS_STEP_MS * 2) {
    physicsAccumulator = PHYSICS_STEP_MS;
  }

  render();
  rafId = requestAnimationFrame(gameLoop);
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  lastFrameTime = 0;
  physicsAccumulator = 0;
  rafId = requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousedown', handleDrop);
canvas.addEventListener('touchstart', handleDrop, { passive: true });
document.getElementById('restartBtn').addEventListener('click', startGame);

preloadImages(() => {
  buildSpriteCaches();
  renderLegend();
  startGame();
  startLoop();
});
