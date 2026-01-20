// ゲーム設定
const GRID_SIZE = 10;
const MINE_COUNT = 15;

// ゲーム状態
let board = [];
let mineLocations = [];
let revealedCount = 0;
let flagCount = 0;
let gameOver = false;
let gameStarted = false;
let timerInterval = null;
let seconds = 0;

// DOM要素
const gameBoard = document.getElementById('game-board');
const flagsCountEl = document.getElementById('flags-count');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const gameMessage = document.getElementById('game-message');
const container = document.querySelector('.container');

// =====================
// 花火システム
// =====================
class Firework {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.rockets = [];
        this.running = false;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createRocket() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height,
            targetY: Math.random() * (this.canvas.height * 0.4) + 50,
            speed: 8 + Math.random() * 4,
            hue: Math.random() * 360,
            trail: []
        };
    }

    createParticles(x, y, hue) {
        const particleCount = 80 + Math.floor(Math.random() * 40);
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.015 + Math.random() * 0.01,
                hue: hue + Math.random() * 30 - 15,
                size: 2 + Math.random() * 2,
                sparkle: Math.random() > 0.5
            });
        }
    }

    update() {
        // ロケット更新
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];
            rocket.trail.push({ x: rocket.x, y: rocket.y });
            if (rocket.trail.length > 10) rocket.trail.shift();

            rocket.y -= rocket.speed;

            if (rocket.y <= rocket.targetY) {
                this.createParticles(rocket.x, rocket.y, rocket.hue);
                this.rockets.splice(i, 1);
            }
        }

        // パーティクル更新
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.08; // 重力
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.life -= p.decay;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // ロケット描画
        this.rockets.forEach(rocket => {
            // トレイル
            rocket.trail.forEach((point, index) => {
                const alpha = index / rocket.trail.length;
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
                this.ctx.fillStyle = `hsla(${rocket.hue}, 100%, 70%, ${alpha})`;
                this.ctx.fill();
            });

            // ロケット本体
            this.ctx.beginPath();
            this.ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsl(${rocket.hue}, 100%, 80%)`;
            this.ctx.fill();
        });

        // パーティクル描画
        this.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            const lightness = p.sparkle ? 70 + Math.random() * 30 : 60;
            this.ctx.fillStyle = `hsla(${p.hue}, 100%, ${lightness}%, ${p.life})`;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = `hsl(${p.hue}, 100%, 50%)`;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    animate() {
        if (!this.running) return;

        this.update();
        this.draw();

        requestAnimationFrame(() => this.animate());
    }

    start(duration = 5000) {
        this.running = true;
        this.resize();

        // 定期的にロケット発射
        const launchInterval = setInterval(() => {
            if (!this.running) {
                clearInterval(launchInterval);
                return;
            }
            const rocketCount = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < rocketCount; i++) {
                setTimeout(() => {
                    if (this.running) this.rockets.push(this.createRocket());
                }, i * 150);
            }
        }, 400);

        this.animate();

        // 指定時間後に停止
        setTimeout(() => {
            this.running = false;
            clearInterval(launchInterval);
            setTimeout(() => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }, 2000);
        }, duration);
    }
}

// 花火キャンバス作成
let fireworkCanvas = document.getElementById('fireworks-canvas');
if (!fireworkCanvas) {
    fireworkCanvas = document.createElement('canvas');
    fireworkCanvas.id = 'fireworks-canvas';
    document.body.appendChild(fireworkCanvas);
}
const firework = new Firework(fireworkCanvas);
window.addEventListener('resize', () => firework.resize());

// =====================
// ゲームロジック
// =====================

// 初期化
function initGame() {
    // 状態リセット
    board = [];
    mineLocations = [];
    revealedCount = 0;
    flagCount = 0;
    gameOver = false;
    gameStarted = false;
    seconds = 0;

    // タイマーリセット
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerEl.textContent = '0';

    // UI更新
    flagsCountEl.textContent = MINE_COUNT;
    gameMessage.textContent = '';
    gameMessage.className = 'game-message';
    gameBoard.innerHTML = '';
    container.classList.remove('shake');

    // ボード作成
    for (let row = 0; row < GRID_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            board[row][col] = {
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            };

            // セル要素作成
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            // イベントリスナー
            cell.addEventListener('click', handleCellClick);
            cell.addEventListener('contextmenu', handleRightClick);

            gameBoard.appendChild(cell);
        }
    }

    // 地雷配置
    placeMines();

    // 隣接地雷数計算
    calculateNeighborMines();
}

// 地雷配置
function placeMines() {
    mineLocations = [];
    let minesPlaced = 0;

    while (minesPlaced < MINE_COUNT) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);

        if (!board[row][col].isMine) {
            board[row][col].isMine = true;
            mineLocations.push({ row, col });
            minesPlaced++;
        }
    }
}

// 隣接地雷数計算
function calculateNeighborMines() {
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if (!board[row][col].isMine) {
                board[row][col].neighborMines = countNeighborMines(row, col);
            }
        }
    }
}

// 隣接地雷カウント
function countNeighborMines(row, col) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const newRow = row + dr;
            const newCol = col + dc;
            if (isValidCell(newRow, newCol) && board[newRow][newCol].isMine) {
                count++;
            }
        }
    }
    return count;
}

// 有効なセルか確認
function isValidCell(row, col) {
    return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

// セル要素取得
function getCellElement(row, col) {
    return gameBoard.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

// 左クリックハンドラ
function handleCellClick(e) {
    if (gameOver) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    const cell = board[row][col];

    if (cell.isRevealed || cell.isFlagged) return;

    // ゲーム開始時にタイマースタート
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }

    if (cell.isMine) {
        // 地雷を踏んだ
        revealAllMines();
        e.target.classList.add('mine-hit');
        endGame(false);
    } else {
        // セルを開く
        revealCell(row, col);
        checkWin();
    }
}

// 右クリックハンドラ（フラグ設置）
function handleRightClick(e) {
    e.preventDefault();
    if (gameOver) return;

    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    const cell = board[row][col];

    if (cell.isRevealed) return;

    // ゲーム開始時にタイマースタート
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }

    const cellElement = getCellElement(row, col);

    if (cell.isFlagged) {
        cell.isFlagged = false;
        cellElement.classList.remove('flagged');
        cellElement.textContent = '';
        flagCount--;
    } else {
        cell.isFlagged = true;
        cellElement.classList.add('flagged');
        cellElement.textContent = '🚩';
        flagCount++;
    }

    flagsCountEl.textContent = MINE_COUNT - flagCount;
}

// セルを開く（再帰的）
function revealCell(row, col) {
    if (!isValidCell(row, col)) return;

    const cell = board[row][col];
    if (cell.isRevealed || cell.isFlagged || cell.isMine) return;

    cell.isRevealed = true;
    revealedCount++;

    const cellElement = getCellElement(row, col);
    cellElement.classList.add('revealed');

    if (cell.neighborMines > 0) {
        cellElement.textContent = cell.neighborMines;
        cellElement.dataset.number = cell.neighborMines;
    } else {
        // 隣接地雷がない場合、周囲も開く
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                revealCell(row + dr, col + dc);
            }
        }
    }
}

// 全地雷を表示
function revealAllMines() {
    mineLocations.forEach(({ row, col }) => {
        const cellElement = getCellElement(row, col);
        cellElement.classList.add('mine', 'revealed');
        cellElement.textContent = '💣';
    });
}

// 勝利判定
function checkWin() {
    const totalSafeCells = GRID_SIZE * GRID_SIZE - MINE_COUNT;
    if (revealedCount === totalSafeCells) {
        endGame(true);
    }
}

// タイマー開始
function startTimer() {
    timerInterval = setInterval(() => {
        seconds++;
        timerEl.textContent = seconds;
    }, 1000);
}

// ゲーム終了
function endGame(isWin) {
    gameOver = true;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    if (isWin) {
        gameMessage.textContent = '🎉 クリア！おめでとう！ 🎉';
        gameMessage.className = 'game-message win';
        // 花火を打ち上げ
        firework.start(6000);
    } else {
        gameMessage.textContent = '💥 ゲームオーバー...';
        gameMessage.className = 'game-message lose';
        // 画面を揺らす
        container.classList.add('shake');
    }
}

// イベントリスナー
resetBtn.addEventListener('click', initGame);

// ゲーム開始
initGame();
