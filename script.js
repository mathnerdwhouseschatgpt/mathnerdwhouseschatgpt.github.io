const canvas = document.querySelector("#pool-table");
const ctx = canvas.getContext("2d");
const shotsEl = document.querySelector("#shots");
const ballsLeftEl = document.querySelector("#balls-left");
const statusEl = document.querySelector("#status");
const resetButton = document.querySelector("#reset");

const TABLE = {
  width: canvas.width,
  height: canvas.height,
  rail: 42,
  pocketRadius: 30,
};

const BALL_RADIUS = 13;
const FRICTION = 0.986;
const STOP_SPEED = 0.045;
const MAX_POWER = 28;
const colors = [
  "#f5c542",
  "#2456d6",
  "#e0352f",
  "#7c3db8",
  "#f97316",
  "#16a34a",
  "#7f1d1d",
  "#111827",
  "#f5c542",
  "#2456d6",
  "#e0352f",
  "#7c3db8",
  "#f97316",
  "#16a34a",
  "#7f1d1d",
];

let balls = [];
let shots = 0;
let gameOver = false;
let aiming = false;
let aimPoint = null;
let cueBall;

const pockets = [
  { x: TABLE.rail, y: TABLE.rail },
  { x: TABLE.width / 2, y: TABLE.rail - 4 },
  { x: TABLE.width - TABLE.rail, y: TABLE.rail },
  { x: TABLE.rail, y: TABLE.height - TABLE.rail },
  { x: TABLE.width / 2, y: TABLE.height - TABLE.rail + 4 },
  { x: TABLE.width - TABLE.rail, y: TABLE.height - TABLE.rail },
];

function createBall(x, y, number, striped = false) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    number,
    striped,
    sunk: false,
    radius: BALL_RADIUS,
    color: number === 0 ? "#f8fafc" : colors[number - 1],
  };
}

function rackBalls() {
  const rack = [];
  const startX = 670;
  const startY = TABLE.height / 2;
  const spacing = BALL_RADIUS * 2.08;
  const numbers = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let index = 0;

  for (let col = 0; col < 5; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const x = startX + col * spacing;
      const y = startY + (row - col / 2) * spacing;
      const number = numbers[index];
      rack.push(createBall(x, y, number, number > 8));
      index += 1;
    }
  }

  return rack;
}

function resetGame() {
  shots = 0;
  gameOver = false;
  aiming = false;
  aimPoint = null;
  cueBall = createBall(250, TABLE.height / 2, 0);
  balls = [cueBall, ...rackBalls()];
  updateHud("Line up the break!");
}

function updateHud(message) {
  const remaining = balls.filter((ball) => ball.number > 0 && !ball.sunk).length;
  shotsEl.textContent = shots;
  ballsLeftEl.textContent = remaining;
  if (message) {
    statusEl.textContent = message;
  } else if (remaining === 0) {
    statusEl.textContent = `Table cleared in ${shots} shots!`;
  } else if (ballsMoving()) {
    statusEl.textContent = "Balls in motion...";
  } else {
    statusEl.textContent = "Drag from the cue ball to shoot.";
  }
}

function ballsMoving() {
  return balls.some((ball) => !ball.sunk && Math.hypot(ball.vx, ball.vy) > STOP_SPEED);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return {
    x: ((source.clientX - rect.left) / rect.width) * canvas.width,
    y: ((source.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function canShoot(point) {
  return !gameOver && !ballsMoving() && !cueBall.sunk && distance(point, cueBall) <= cueBall.radius * 2.5;
}

function startAim(event) {
  const point = canvasPoint(event);
  if (!canShoot(point)) return;
  event.preventDefault();
  aiming = true;
  aimPoint = point;
}

function moveAim(event) {
  if (!aiming) return;
  event.preventDefault();
  aimPoint = canvasPoint(event);
}

function shoot(event) {
  if (!aiming || !aimPoint) return;
  event.preventDefault();
  const pullX = cueBall.x - aimPoint.x;
  const pullY = cueBall.y - aimPoint.y;
  const pullDistance = Math.min(Math.hypot(pullX, pullY), 170);

  if (pullDistance > 6) {
    const angle = Math.atan2(pullY, pullX);
    const power = (pullDistance / 170) * MAX_POWER;
    cueBall.vx = Math.cos(angle) * power;
    cueBall.vy = Math.sin(angle) * power;
    shots += 1;
    updateHud("Nice shot!");
  }

  aiming = false;
  aimPoint = null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveBallCollision(a, b) {
  if (a.sunk || b.sunk) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.radius + b.radius;

  if (dist === 0 || dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (minDist - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;

  const tx = -ny;
  const ty = nx;
  const dpTanA = a.vx * tx + a.vy * ty;
  const dpTanB = b.vx * tx + b.vy * ty;
  const dpNormA = a.vx * nx + a.vy * ny;
  const dpNormB = b.vx * nx + b.vy * ny;

  a.vx = tx * dpTanA + nx * dpNormB;
  a.vy = ty * dpTanA + ny * dpNormB;
  b.vx = tx * dpTanB + nx * dpNormA;
  b.vy = ty * dpTanB + ny * dpNormA;
}

function keepOnTable(ball) {
  if (ball.sunk) return;
  const left = TABLE.rail + ball.radius;
  const right = TABLE.width - TABLE.rail - ball.radius;
  const top = TABLE.rail + ball.radius;
  const bottom = TABLE.height - TABLE.rail - ball.radius;

  if (ball.x < left) {
    ball.x = left;
    ball.vx *= -0.86;
  } else if (ball.x > right) {
    ball.x = right;
    ball.vx *= -0.86;
  }

  if (ball.y < top) {
    ball.y = top;
    ball.vy *= -0.86;
  } else if (ball.y > bottom) {
    ball.y = bottom;
    ball.vy *= -0.86;
  }
}

function checkPockets(ball) {
  if (ball.sunk) return;
  for (const pocket of pockets) {
    if (distance(ball, pocket) < TABLE.pocketRadius) {
      ball.sunk = true;
      ball.vx = 0;
      ball.vy = 0;
      handlePocketed(ball);
      return;
    }
  }
}

function handlePocketed(ball) {
  if (ball.number === 0) {
    setTimeout(() => {
      cueBall.sunk = false;
      cueBall.x = 250;
      cueBall.y = TABLE.height / 2;
      updateHud("Scratch! Cue ball is back in hand.");
    }, 350);
    return;
  }

  const remaining = balls.filter((candidate) => candidate.number > 0 && !candidate.sunk).length;
  if (ball.number === 8 && remaining > 0) {
    gameOver = true;
    updateHud("8-ball sunk early. Reset to try again!");
  } else if (remaining === 0) {
    gameOver = true;
    updateHud(`Rack cleared in ${shots} shots!`);
  } else {
    updateHud(`${ball.number}-ball pocketed!`);
  }
}

function updatePhysics() {
  for (const ball of balls) {
    if (ball.sunk) continue;
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    if (Math.hypot(ball.vx, ball.vy) < STOP_SPEED) {
      ball.vx = 0;
      ball.vy = 0;
    }

    keepOnTable(ball);
    checkPockets(ball);
  }

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      resolveBallCollision(balls[i], balls[j]);
    }
  }
}

function drawTable() {
  const gradient = ctx.createRadialGradient(500, 280, 60, 500, 280, 580);
  gradient.addColorStop(0, "#109767");
  gradient.addColorStop(1, "#075d43");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, TABLE.width, TABLE.height);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let x = 90; x < TABLE.width; x += 70) {
    ctx.fillRect(x, TABLE.rail, 1.5, TABLE.height - TABLE.rail * 2);
  }

  ctx.fillStyle = "#050505";
  for (const pocket of pockets) {
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, TABLE.pocketRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 2;
  ctx.strokeRect(TABLE.rail, TABLE.rail, TABLE.width - TABLE.rail * 2, TABLE.height - TABLE.rail * 2);
}

function drawBall(ball) {
  if (ball.sunk) return;
  const highlight = ctx.createRadialGradient(ball.x - 5, ball.y - 6, 2, ball.x, ball.y, ball.radius + 3);
  highlight.addColorStop(0, "#ffffff");
  highlight.addColorStop(0.18, ball.color);
  highlight.addColorStop(1, "#111827");

  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  if (ball.striped) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(ball.x - ball.radius, ball.y - 5, ball.radius * 2, 10);
    ctx.restore();
  }

  if (ball.number > 0) {
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.font = "bold 8px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.number, ball.x, ball.y + 0.4);
  }
}

function drawAimGuide() {
  if (!aiming || !aimPoint || ballsMoving()) return;
  const dx = cueBall.x - aimPoint.x;
  const dy = cueBall.y - aimPoint.y;
  const pullDistance = Math.min(Math.hypot(dx, dy), 170);
  const angle = Math.atan2(dy, dx);
  const guideLength = 90 + pullDistance * 1.45;

  ctx.strokeStyle = "rgba(255, 246, 214, 0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 8]);
  ctx.beginPath();
  ctx.moveTo(cueBall.x, cueBall.y);
  ctx.lineTo(cueBall.x + Math.cos(angle) * guideLength, cueBall.y + Math.sin(angle) * guideLength);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cueBall.x - Math.cos(angle) * 18, cueBall.y - Math.sin(angle) * 18);
  ctx.lineTo(aimPoint.x, aimPoint.y);
  ctx.stroke();
}

function draw() {
  drawTable();
  for (const ball of balls) {
    drawBall(ball);
  }
  drawAimGuide();
}

function loop() {
  updatePhysics();
  draw();
  if (!ballsMoving() && !gameOver && !aiming) {
    updateHud();
  }
  requestAnimationFrame(loop);
}

canvas.addEventListener("mousedown", startAim);
canvas.addEventListener("mousemove", moveAim);
window.addEventListener("mouseup", shoot);
canvas.addEventListener("touchstart", startAim, { passive: false });
canvas.addEventListener("touchmove", moveAim, { passive: false });
window.addEventListener("touchend", shoot, { passive: false });
resetButton.addEventListener("click", resetGame);

resetGame();
loop();
