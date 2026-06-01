const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const statusElement = document.querySelector("#status");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const directionButtons = document.querySelectorAll("[data-direction]");

const tileCount = 20;
const tileSize = canvas.width / tileCount;
const tickSpeed = 115;
const storageKey = "snake-best-score";
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let snack;
let direction;
let queuedDirection;
let score;
let bestScore = Number(localStorage.getItem(storageKey)) || 0;
let gameLoop;
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
  statusElement.textContent = "Gobble snacks and keep moving!";
  statusElement.classList.remove("game-over");
  startButton.textContent = "Restart";
  pauseButton.disabled = false;
  clearInterval(gameLoop);
  gameLoop = setInterval(tick, tickSpeed);
}

function togglePause() {
  if (!isRunning) {
    return;
  }

  isPaused = !isPaused;
  if (isPaused) {
    clearInterval(gameLoop);
    statusElement.textContent = "Paused. Press Space or Pause to resume.";
    pauseButton.textContent = "Resume";
  } else {
    statusElement.textContent = "Gobble snacks and keep moving!";
    pauseButton.textContent = "Pause";
    gameLoop = setInterval(tick, tickSpeed);
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
  snack = placeSnack();
  scoreElement.textContent = score;
  pauseButton.disabled = true;
  pauseButton.textContent = "Pause";
}

function tick() {
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

  if (nextHead.x === snack.x && nextHead.y === snack.y) {
    score += 10;
    scoreElement.textContent = score;
    updateBestScore();
    snack = placeSnack();
  } else {
    snake.pop();
  }

  drawBoard();
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

function placeSnack() {
  let position;

  do {
    position = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (
    snake.some((segment) => segment.x === position.x && segment.y === position.y)
  );

  return position;
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
  isRunning = false;
  isPaused = false;
  statusElement.textContent = `Game over! Final score: ${score}.`;
  statusElement.classList.add("game-over");
  startButton.textContent = "Play Again";
  pauseButton.disabled = true;
  drawBoard();
}

function drawBoard() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawSnack();
  drawSnake();
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3;
    context.fillStyle = index === 0 ? "#6ee7b7" : "#34d399";
    context.shadowColor =
      index === 0 ? "rgba(110, 231, 183, 0.65)" : "transparent";
    context.shadowBlur = index === 0 ? 18 : 0;
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

function roundRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
