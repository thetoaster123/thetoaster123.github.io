// Ensure background music plays (handle autoplay restrictions)
window.addEventListener('DOMContentLoaded', () => {
  const bgMusic = document.getElementById('bgMusic');
  if (bgMusic) {
    // Try to play immediately
    const playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // If blocked, play on first user interaction
        const resumeMusic = () => {
          bgMusic.play();
          window.removeEventListener('mousedown', resumeMusic);
          window.removeEventListener('touchstart', resumeMusic);
        };
        window.addEventListener('mousedown', resumeMusic);
        window.addEventListener('touchstart', resumeMusic);
      });
    }
  }
});
// PumpkinCrush Game Logic
// Placeholder merge-style game inspired by Underwatermelon: Fruit Merge

// PumpkinCrush - Clean Restart
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const imageSources = [
  'assets/attachments/IMG_1792.jpeg',
  'assets/attachments/IMG_1874.jpeg',
  'assets/attachments/IMG_2081.jpeg',
  'assets/attachments/IMG_2124.jpeg',
  'assets/attachments/IMG_2145.jpeg',
  'assets/attachments/IMG_2171.jpeg',
  'assets/attachments/IMG_3231.JPG',
  'assets/attachments/IMG_1144.jpeg',
  'assets/attachments/IMG_1052.jpeg',
  'assets/attachments/IMG_0740.jpeg'
];
const images = [];


let balls = [];
let score = 0;
let comboComment = '';
let comboTimeout = null;
let dropIdx = 0;
let dropping = false;
let gameOver = false;

// Store static pumpkin emoji positions
let pumpkinPositions = [];

function preloadImages(callback) {
  let loaded = 0;
  imageSources.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      loaded++;
      images[i] = img;
      if (loaded === imageSources.length) callback();
    };
    img.onerror = () => {
      loaded++;
      // Use a placeholder if image fails
      const fallback = document.createElement('canvas');
      fallback.width = 60;
      fallback.height = 60;
      const fctx = fallback.getContext('2d');
      fctx.fillStyle = '#ccc';
      fctx.fillRect(0, 0, 60, 60);
      fctx.fillStyle = '#888';
      fctx.font = 'bold 16px Arial';
      fctx.fillText('No Img', 5, 30);
      images[i] = fallback;
      if (loaded === imageSources.length) callback();
    };
  });
}


function renderLegend() {
  const legendDiv = document.getElementById('photoLegend');
  legendDiv.innerHTML = '';
  imageSources.forEach((src, idx) => {
    let img;
    if (idx === imageSources.length - 1) {
      // Mystery for highest value
      img = document.createElement('div');
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.borderRadius = '50%';
      img.style.margin = '4px';
      img.style.display = 'inline-flex';
      img.style.alignItems = 'center';
      img.style.justifyContent = 'center';
      img.style.background = '#eee';
      img.style.fontWeight = 'bold';
      img.style.fontSize = '24px';
      img.style.color = '#888';
      img.textContent = '?';
    } else {
      img = document.createElement('img');
      img.src = src;
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
  });
}


function startGame() {
  balls = [];
  score = 0;
  // Only allow lowest 3 scoring images to be dropped
  dropIdx = [0, 1, 2][Math.floor(Math.random() * 3)];
  gameOver = false;
  comboComment = '';
  // Generate static pumpkin emoji positions
  pumpkinPositions = [];
  const pumpkinCount = Math.floor(canvas.width / 60);
  const pumpkinY = canvas.height - 40; // Align exactly at the top of the green ground
  for (let j = 0; j < pumpkinCount; j++) {
    const px = Math.random() * (canvas.width - 40) + 20;
    pumpkinPositions.push({ x: px, y: pumpkinY });
  }
  drawBoard();
}


function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw red line at top
  ctx.save();
  ctx.strokeStyle = '#ff2222';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(canvas.width, 6);
  ctx.stroke();
  ctx.restore();
  // Draw green ground
  ctx.save();
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
  ctx.restore();
  // ...existing code...

  // Draw static pumpkin emojis above the grass
  ctx.save();
  ctx.font = '32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let pos of pumpkinPositions) {
    ctx.fillText('🎃', pos.x, pos.y);
  }
  ctx.restore();
  // Draw border
  ctx.save();
  ctx.strokeStyle = '#00aa00';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  // Draw preview ball
  const minRadius = Math.round(18 * 2);
  const maxRadius = Math.round(36 * 2);
  const previewRadius = Math.round(27); // Fixed normal size for preview
  const previewImgSize = previewRadius * 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, 40, previewRadius, 0, 2 * Math.PI);
  ctx.clip();
  ctx.drawImage(images[dropIdx], canvas.width / 2 - previewImgSize / 2, 40 - previewImgSize / 2, previewImgSize, previewImgSize);
  ctx.restore();
  // ...existing code...
  // Draw balls
  balls.forEach(ball => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
    ctx.clip();
    const imgSize = ball.radius * 2 * 1.5;
    ctx.drawImage(images[ball.imgIdx], ball.x - imgSize / 2, ball.y - imgSize / 2, imgSize, imgSize);
    ctx.restore();
  });
  // Draw score
  ctx.save();
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ff9900';
  ctx.fillText('Score: ' + score, 10, 30);
  ctx.restore();

  // Draw "Made by Tom" at the bottom
  ctx.save();
  ctx.font = 'bold 18px Arial';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.fillText('Made by Tom', canvas.width / 2, canvas.height - 10);
  ctx.restore();

  // Draw combo comment if present
  if (comboComment) {
    ctx.save();
    ctx.font = 'bold 28px Arial';
    ctx.fillStyle = '#39d353';
    ctx.textAlign = 'center';
    ctx.fillText(comboComment, canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
  // Draw game over message
  if (gameOver) {
    ctx.save();
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#ff2222';
    ctx.textAlign = 'center';
    ctx.fillText('Nice work plumps!', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ff9900';
    ctx.fillText('Total Score: ' + score, canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }
}


canvas.addEventListener('mousedown', handleDrop);
canvas.addEventListener('touchstart', handleDrop);
document.getElementById('restartBtn').addEventListener('click', startGame);


function handleDrop(e) {
  if (gameOver) return;
  let clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
  const rect = canvas.getBoundingClientRect();
  const col = Math.floor((clientX - rect.left) / (canvas.width / images.length));
  dropBall(col);
}



function dropBall(col) {
  if (gameOver) return;
  // Ball size based on image index (point value)
  const minRadius = Math.round(18 * 2 * 0.75);
  const maxRadius = Math.round(36 * 2 * 0.75);
  const imgIdx = dropIdx;
  const radius = minRadius + (maxRadius - minRadius) * (imgIdx / (images.length - 1));
  const x = Math.max(radius, Math.min(col * (canvas.width / images.length) + (canvas.width / images.length) / 2, canvas.width - radius));
  let y = 80;
  // Prevent overlap on spawn
  let tries = 0;
  let maxTries = 20;
  let overlap = false;
  do {
    overlap = false;
    for (let other of balls) {
      let dx = x - other.x;
      let dy = y - other.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let minDist = radius + other.radius;
      if (dist < minDist) {
        y += minDist - dist + 2; // Move down
        overlap = true;
      }
    }
    tries++;
  } while (overlap && tries < maxTries);
  balls.push({ x, y, radius, imgIdx, vy: 0, vx: 0 });
  // Only allow lowest 3 scoring images to be dropped
  dropIdx = [0, 1, 2][Math.floor(Math.random() * 3)];
  animateBall(balls[balls.length - 1]);
}








function animateBall(ball) {
  function step() {
    if (gameOver) return;
    // Ball physics
    const gravity = 1.5;
    const bounce = 0.4; // Lower bounce
    const friction = 0.95; // Lower friction
    const rollFriction = 0.90; // Higher roll friction
    ball.vy += gravity;
    ball.y += ball.vy;
    ball.x += ball.vx;
    let stopped = false;
    // Classic elastic collision and overlap resolution
    const groundY = canvas.height - 40;
    const leftBound = 0;
    const rightBound = canvas.width;
    for (let other of balls) {
      if (other === ball) continue;
      let dx = ball.x - other.x;
      let dy = ball.y - other.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let minDist = ball.radius + other.radius;
      if (dist < minDist) {
        // Elastic collision and stacking
        let overlap = minDist - dist;
        // Cap maximum overlap correction to prevent teleporting
        const maxCorrection = Math.min(overlap, Math.max(ball.radius, other.radius) * 0.3); // Lower correction for big balls
        let nx = dx / (dist || 1);
        let ny = dy / (dist || 1);
        ball.x += nx * maxCorrection / 2;
        ball.y += ny * maxCorrection / 2 + 1; // Add buffer for gentle stacking
        other.x -= nx * maxCorrection / 2;
        other.y -= ny * maxCorrection / 2 + 1;
        // Clamp balls gently above ground
        ball.y = Math.min(ball.y, canvas.height - 40 - ball.radius + 2);
        other.y = Math.min(other.y, canvas.height - 40 - other.radius + 2);
        // Clamp both balls within bounds
        ball.x = Math.max(leftBound + ball.radius, Math.min(rightBound - ball.radius, ball.x));
        other.x = Math.max(leftBound + other.radius, Math.min(rightBound - other.radius, other.x));
        // Exchange velocities (both axes)
        let v1x = ball.vx || 0;
        let v2x = other.vx || 0;
        let v1y = ball.vy;
        let v2y = other.vy;
        ball.vx = v2x * bounce;
        other.vx = v1x * bounce;
        ball.vy = v2y * bounce;
        other.vy = v1y * bounce;
        if (ball.y < other.y && Math.abs(ball.vy) < 1) ball.vy = 0;
        if (Math.abs(nx) > 0.7 && Math.abs(ball.vx) < 0.1) ball.vx += nx * 2;
      }
    }
    // Clamp ball within bounds after physics/collision
    ball.x = Math.max(leftBound + ball.radius, Math.min(rightBound - ball.radius, ball.x));
    // Only clamp y to ground if below ground
    if (ball.y > groundY - ball.radius) ball.y = groundY - ball.radius;
    // Check collision with red line (game over)
    if (ball.y - ball.radius < 12) {
      gameOver = true;
      drawBoard();
      return;
    }
    // Check collision with ground
    const floorY = canvas.height - 40 - ball.radius;
    if (ball.y > floorY) {
      ball.y = floorY;
      ball.vy = -ball.vy * bounce;
      if (Math.abs(ball.vy) < 1) ball.vy = 0;
      if (Math.abs(ball.vx) > 0.1) ball.vx *= rollFriction;
      else ball.vx = 0;
      if (Math.abs(ball.vy) < 1 && Math.abs(ball.vx) < 0.1) stopped = true;
    }
    // Wall collision (never let balls go through borders)
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      if (ball.vx < 0) ball.vx = -ball.vx * bounce;
    }
    if (ball.x + ball.radius > canvas.width) {
      ball.x = canvas.width - ball.radius;
      if (ball.vx > 0) ball.vx = -ball.vx * bounce;
    }
    // Ball-ball collision and merging
    for (let other of balls) {
      if (other === ball) continue;
      let dx = ball.x - other.x;
      let dy = ball.y - other.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let minDist = ball.radius + other.radius;
      if (dist < minDist) {
        // Merge if same type (basic), only if both balls still exist and balls.length >= 2
        if (
          ball.imgIdx === other.imgIdx &&
          ball.imgIdx < images.length - 1 &&
          balls.includes(ball) && balls.includes(other) && balls.length >= 2
        ) {
          const minRadius = Math.round(18 * 2 * 0.75);
          const maxRadius = Math.round(36 * 2 * 0.75);
          const newIdx = ball.imgIdx + 1;
          const newRadius = minRadius + (maxRadius - minRadius) * (newIdx / (images.length - 1));
          const groundY = canvas.height - 40 - newRadius;
          const newBall = {
            x: (ball.x + other.x) / 2,
            y: groundY,
            radius: newRadius,
            imgIdx: newIdx,
            vy: 0,
            vx: 0
          };
          balls.splice(balls.indexOf(ball), 1);
          balls.splice(balls.indexOf(other), 1);
          balls.push(newBall);
          const points = (newIdx + 1) * 10 + (newIdx > 6 ? 40 : newIdx > 2 ? 20 : 0);
          score += points;
          drawBoard();
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
              'plum plum PLUM!'
            ];
            comboComment = comments[Math.floor(Math.random() * comments.length)];
            if (comboTimeout) clearTimeout(comboTimeout);
            comboTimeout = setTimeout(() => {
              comboComment = '';
              drawBoard();
            }, 2000);
          }
          animateBall(newBall); // Animate merged ball
          return;
        }
        // Basic elastic collision
        let overlap = minDist - dist;
        let nx = dx / (dist || 1);
        let ny = dy / (dist || 1);
        ball.x += nx * overlap / 2;
        ball.y += ny * overlap / 2;
        other.x -= nx * overlap / 2;
        other.y -= ny * overlap / 2;
      }
    }
    ball.vy *= friction;
    drawBoard();
    if (!stopped) {
      requestAnimationFrame(step);
    }
  }
  step();z
}

preloadImages(() => {
  startGame();
  renderLegend();
});
