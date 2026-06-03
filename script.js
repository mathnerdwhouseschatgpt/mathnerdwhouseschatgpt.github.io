const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const comboElement = document.querySelector("#combo-count");
const frenzyMeterElement = document.querySelector("#frenzy-meter");
const frenzyBanner = document.querySelector("#frenzy-banner");
const statusElement = document.querySelector("#status");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const directionButtons = document.querySelectorAll("[data-direction]");

const tileCount = 20;
const tileSize = canvas.width / tileCount;
const gridColor = "rgba(148, 163, 184, 0.12)";
const tickSpeed = 115;
const storageKey = "snake-best-score";
const powerUpLifetime = 6500;
const frenzyDuration = 8000;
const snacksPerPowerUp = 4;
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let snack;
let powerUp;
let direction;
let queuedDirection;
let score;
let combo;
let snacksEaten;
let frenzyUntil;
let particles;
let bestScore = Number(localStorage.getItem(storageKey)) || 0;
let gameLoop;
let meterLoop;
let isRunning = false;
let isPaused = false;

bestScoreElement.textContent = bestScore;
resetGame();
drawBoard();

startButton.addEventListener("click", () => startGame(true));
pauseButton.addEventListener("click", togglePause);
directionButtons.forEach((button) => {
  button.addEventListener("click", () => queueDirection(button.dataset.direction));
});

document.addEventListener("keydown", (event) => {
  const keyDirections = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }

  const nextDirection = keyDirections[event.key];
  if (!nextDirection) {
    return;
  }

  event.preventDefault();

  if (!isRunning) {
    startGame();
  }

  queueDirection(nextDirection);
});

function startGame(forceRestart = false) {
  if (forceRestart || !isRunning) {
    clearInterval(gameLoop);
    resetGame();
  } else if (!isPaused) {
    return;
  }

  isRunning = true;
  isPaused = false;
  statusElement.textContent = "Gobble snacks and chase bonus stars!";
  statusElement.classList.remove("game-over");
  startButton.textContent = "Restart";
  pauseButton.disabled = false;
  clearInterval(gameLoop);
  clearInterval(meterLoop);
  gameLoop = setInterval(tick, tickSpeed);
  meterLoop = setInterval(updateFrenzyMeter, 200);
  updateFrenzyMeter();
}

function togglePause() {
  if (!isRunning) {
    return;
  }

  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(gameLoop);
    clearInterval(meterLoop);
    statusElement.textContent = "Paused. Press Space or Pause to resume.";
    pauseButton.textContent = "Resume";
  } else {
    statusElement.textContent = "Gobble snacks and chase bonus stars!";
    pauseButton.textContent = "Pause";
    gameLoop = setInterval(tick, tickSpeed);
    meterLoop = setInterval(updateFrenzyMeter, 200);
  }
}

function resetGame() {
  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  direction = directions.right;
  queuedDirection = directions.right;
  score = 0;
  combo = 1;
  snacksEaten = 0;
  frenzyUntil = 0;
  particles = [];
  powerUp = null;
  snack = placeSnack();
  scoreElement.textContent = score;
  comboElement.textContent = `x${combo}`;
  frenzyMeterElement.textContent = "Ready";
  frenzyBanner.classList.remove("is-active");
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";
}

function tick() {
  expirePowerUps();
  direction = queuedDirection;
  const head = snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (hasCollision(nextHead)) {
    endGame();
    return;
  }

  snake.unshift(nextHead);

  if (powerUp && nextHead.x === powerUp.x && nextHead.y === powerUp.y) {
    collectPowerUp(nextHead);
  } else if (nextHead.x === snack.x && nextHead.y === snack.y) {
    collectSnack(nextHead);
  } else {
    snake.pop();
  }

  updateParticles();
  drawBoard();
}

function collectSnack(position) {
  snacksEaten += 1;
  combo += 1;
  score += isFrenzyActive() ? 20 : 10;
  scoreElement.textContent = score;
  comboElement.textContent = `x${combo}`;
  updateBestScore();
  burstParticles(position, isFrenzyActive() ? "#c084fc" : "#fb7185");
  snack = placeSnack();

  if (snacksEaten % snacksPerPowerUp === 0) {
    powerUp = placeSnack({ expiresAt: Date.now() + powerUpLifetime });
    statusElement.textContent = "A bonus star appeared. Grab it for Frenzy!";
  }
}

function collectPowerUp(position) {
  combo += 2;
  score += 30;
  powerUp = null;
  frenzyUntil = Date.now() + frenzyDuration;
  scoreElement.textContent = score;
  comboElement.textContent = `x${combo}`;
  updateBestScore();
  burstParticles(position, "#facc15", 18);
  statusElement.textContent = "Frenzy mode! Snacks are worth double points.";
  frenzyBanner.classList.add("is-active");
  updateFrenzyMeter();
}

function queueDirection(name) {
  const nextDirection = directions[name];
  if (!nextDirection || isOpposite(nextDirection, direction)) {
    return;
  }

  queuedDirection = nextDirection;
}

function isOpposite(nextDirection, currentDirection) {
  return (
    nextDirection.x + currentDirection.x === 0 &&
    nextDirection.y + currentDirection.y === 0
  );
}

function hasCollision(position) {
  const hitWall =
    position.x < 0 ||
    position.x >= tileCount ||
    position.y < 0 ||
    position.y >= tileCount;
  const hitSnake = snake.some(
    (segment) => segment.x === position.x && segment.y === position.y,
  );

  return hitWall || hitSnake;
}

function placeSnack(extra = {}) {
  let position;

  do {
    position = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
      ...extra,
    };
  } while (isOccupied(position));

  return position;
}

function isOccupied(position) {
  const onSnake = snake.some(
    (segment) => segment.x === position.x && segment.y === position.y,
  );
  const onSnack = snack && snack.x === position.x && snack.y === position.y;
  const onPowerUp = powerUp && powerUp.x === position.x && powerUp.y === position.y;

  return onSnake || onSnack || onPowerUp;
}

function expirePowerUps() {
  if (powerUp && Date.now() > powerUp.expiresAt) {
    powerUp = null;
    statusElement.textContent = "The bonus star vanished. Keep hunting snacks!";
  }

  if (frenzyUntil && !isFrenzyActive()) {
    frenzyUntil = 0;
    frenzyBanner.classList.remove("is-active");
  }

  updateFrenzyMeter();
}

function updateFrenzyMeter() {
  if (isFrenzyActive()) {
    const seconds = Math.ceil((frenzyUntil - Date.now()) / 1000);
    frenzyMeterElement.textContent = `${seconds}s`;
    return;
  }

  if (powerUp) {
    const seconds = Math.ceil((powerUp.expiresAt - Date.now()) / 1000);
    frenzyMeterElement.textContent = `⭐ ${Math.max(seconds, 0)}s`;
    return;
  }

  frenzyMeterElement.textContent = "Ready";
}

function isFrenzyActive() {
  return Date.now() < frenzyUntil;
}

function updateBestScore() {
  if (score <= bestScore) {
    return;
  }

  bestScore = score;
  bestScoreElement.textContent = bestScore;
  localStorage.setItem(storageKey, bestScore);
}

function endGame() {
  clearInterval(gameLoop);
  clearInterval(meterLoop);
  isRunning = false;
  isPaused = false;
  statusElement.textContent = `Game over! Final score: ${score}. Max combo: x${combo}.`;
  statusElement.classList.add("game-over");
  frenzyBanner.classList.remove("is-active");
  startButton.textContent = "Play Again";
  pauseButton.disabled = true;
  drawBoard();
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawSnack();
  drawPowerUp();
  drawSnake();
  drawParticles();
}

function drawGrid() {
  context.save();
  context.strokeStyle = gridColor;
  context.lineWidth = 1;
  context.beginPath();

  for (let index = 0; index <= tileCount; index += 1) {
    const position = index * tileSize + 0.5;
    context.moveTo(position, 0);
    context.lineTo(position, canvas.height);
    context.moveTo(0, position);
    context.lineTo(canvas.width, position);
  }

  context.stroke();
  context.restore();
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3;
    const isHead = index === 0;
    context.fillStyle = getSnakeColor(index);
    context.shadowColor = isHead
      ? "rgba(110, 231, 183, 0.65)"
      : "rgba(192, 132, 252, 0.25)";
    context.shadowBlur = isHead || isFrenzyActive() ? 18 : 0;
    roundRect(
      segment.x * tileSize + inset,
      segment.y * tileSize + inset,
      tileSize - inset * 2,
      tileSize - inset * 2,
      6,
    );
    context.fill();
  });
  context.shadowBlur = 0;
}

function getSnakeColor(index) {
  if (!isFrenzyActive()) {
    return index === 0 ? "#6ee7b7" : "#34d399";
  }

  const colors = ["#facc15", "#c084fc", "#6ee7b7", "#60a5fa"];
  return colors[index % colors.length];
}

function drawSnack() {
  const centerX = snack.x * tileSize + tileSize / 2;
  const centerY = snack.y * tileSize + tileSize / 2;
  context.fillStyle = "#fb7185";
  context.shadowColor = "rgba(251, 113, 133, 0.75)";
  context.shadowBlur = 18;
  context.beginPath();
  context.arc(centerX, centerY, tileSize * 0.34, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
}

function drawPowerUp() {
  if (!powerUp) {
    return;
  }

  const centerX = powerUp.x * tileSize + tileSize / 2;
  const centerY = powerUp.y * tileSize + tileSize / 2;
  const pulse = Math.sin(Date.now() / 130) * 0.08 + 1;
  context.save();
  context.translate(centerX, centerY);
  context.scale(pulse, pulse);
  context.fillStyle = "#facc15";
  context.shadowColor = "rgba(250, 204, 21, 0.85)";
  context.shadowBlur = 20;
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? tileSize * 0.42 : tileSize * 0.18;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fill();
  context.restore();
  context.shadowBlur = 0;
}

function burstParticles(position, color, amount = 10) {
  const originX = position.x * tileSize + tileSize / 2;
  const originY = position.y * tileSize + tileSize / 2;

  for (let index = 0; index < amount; index += 1) {
    const angle = (Math.PI * 2 * index) / amount;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * (1.6 + Math.random() * 1.8),
      vy: Math.sin(angle) * (1.6 + Math.random() * 1.8),
      life: 18 + Math.random() * 12,
      color,
    });
  }
}

function updateParticles() {
  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx,
      y: particle.y + particle.vy,
      life: particle.life - 1,
    }))
    .filter((particle) => particle.life > 0);
}

function drawParticles() {
  particles.forEach((particle) => {
    context.globalAlpha = Math.min(particle.life / 20, 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
}

function roundRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
