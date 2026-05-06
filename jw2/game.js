/**
 * Jungle Jumpers - Core Game Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const heightVal = document.getElementById('height-val');
const bananaVal = document.getElementById('banana-val');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const gameOverScreen = document.getElementById('game-over');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalHeightVal = document.getElementById('final-height');

// Game constants
const GRAVITY = 0.4;
const JUMP_FORCE = -12;
const MOVE_SPEED = 5;
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLATFORM_WIDTH = 70;
const PLATFORM_HEIGHT = 15;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let gameActive = false;
let score = 0;
let bananas = 0;
let cameraY = 0;
let platforms = [];
let items = [];
let keys = {};

class Player {
    constructor(x, y, isLocal = true) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 30;
        this.height = 30;
        this.isLocal = isLocal;
        this.color = isLocal ? '#ff9800' : '#2196f3';
    }

    update() {
        if (!this.isLocal) return;

        // Horizontal movement
        if (keys['KeyA'] || keys['ArrowLeft']) this.vx = -MOVE_SPEED;
        else if (keys['KeyD'] || keys['ArrowRight']) this.vx = MOVE_SPEED;
        else this.vx *= 0.8;

        this.x += this.vx;
        this.vy += GRAVITY;
        this.y += this.vy;

        // Screen wrap
        if (this.x + this.width < 0) this.x = CANVAS_WIDTH;
        if (this.x > CANVAS_WIDTH) this.x = -this.width;

        // Collision with platforms
        if (this.vy > 0) {
            platforms.forEach(p => {
                if (this.x < p.x + p.width &&
                    this.x + this.width > p.x &&
                    this.y + this.height > p.y &&
                    this.y + this.height < p.y + p.height + this.vy) {
                    this.y = p.y - this.height;
                    this.vy = JUMP_FORCE;
                    
                    // Bounce effect for platform
                    p.y += 5; 
                }
            });
        }

        // Collect items
        items = items.filter(item => {
            const dist = Math.hypot(this.x + this.width/2 - item.x, this.y + this.height/2 - item.y);
            if (dist < 25) {
                if (item.type === 'banana') bananas++;
                bananaVal.textContent = bananas;
                return false;
            }
            return true;
        });

        // Update score
        const currentHeight = Math.floor(-this.y / 10);
        if (currentHeight > score) {
            score = currentHeight;
            heightVal.textContent = score;
        }

        // Game Over
        if (this.y > cameraY + CANVAS_HEIGHT) {
            endGame();
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        // Simple monkey shape (circle head + body)
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - cameraY + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y - cameraY + 12, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 20, this.y - cameraY + 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y - cameraY + 12, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 20, this.y - cameraY + 12, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

let localPlayer = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
let remotePlayers = new Map();

function initPlatforms() {
    platforms = [];
    items = [];
    // Starting platform
    platforms.push({ x: CANVAS_WIDTH / 2 - 50, y: CANVAS_HEIGHT - 50, width: 100, height: PLATFORM_HEIGHT });
    
    for (let i = 0; i < 10; i++) {
        generatePlatform(CANVAS_HEIGHT - i * 100);
    }
}

function generatePlatform(y) {
    const x = Math.random() * (CANVAS_WIDTH - PLATFORM_WIDTH);
    platforms.push({ x, y, width: PLATFORM_WIDTH, height: PLATFORM_HEIGHT });
    
    if (Math.random() > 0.7) {
        items.push({ x: x + PLATFORM_WIDTH / 2, y: y - 20, type: 'banana' });
    }
}

function drawPlatforms() {
    platforms.forEach(p => {
        // Simple branch draw
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(p.x, p.y - cameraY, p.width, p.height);
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(p.x, p.y - cameraY, p.width, 5); // Green top
    });

    items.forEach(item => {
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(item.x, item.y - cameraY, 8, 0, Math.PI * 2);
        ctx.fill();
    });
}

function update() {
    if (!gameActive) return;

    localPlayer.update();

    // Camera follow
    const targetCameraY = localPlayer.y - CANVAS_HEIGHT / 2;
    if (targetCameraY < cameraY) {
        cameraY += (targetCameraY - cameraY) * 0.1;
    }

    // Generate new platforms
    while (platforms[platforms.length - 1].y > cameraY - 100) {
        generatePlatform(platforms[platforms.length - 1].y - 80 - Math.random() * 40);
    }

    // Cleanup old platforms
    platforms = platforms.filter(p => p.y < cameraY + CANVAS_HEIGHT + 100);
    items = items.filter(i => i.y < cameraY + CANVAS_HEIGHT + 100);

    // Broadcast position (hook for multiplayer.js)
    if (window.broadcastPosition) {
        window.broadcastPosition(localPlayer);
    }
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Parallax background (Vines/Trees)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for(let i = 0; i < 5; i++) {
        let xPos = (i * 100 + (-cameraY * 0.2)) % (CANVAS_WIDTH + 100) - 50;
        ctx.fillRect(xPos, 0, 10, CANVAS_HEIGHT);
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for(let i = 0; i < 3; i++) {
        let xPos = (i * 150 + (-cameraY * 0.5)) % (CANVAS_WIDTH + 150) - 75;
        ctx.fillRect(xPos, 0, 30, CANVAS_HEIGHT);
    }

    drawPlatforms();
    
    remotePlayers.forEach(p => p.draw());
    localPlayer.draw();

    if (gameActive) {
        requestAnimationFrame(() => {
            update();
            draw();
        });
    }
}

function startGame() {
    gameActive = true;
    score = 0;
    bananas = 0;
    cameraY = 0;
    heightVal.textContent = '0';
    bananaVal.textContent = '0';
    localPlayer = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100);
    initPlatforms();
    
    menu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    draw();
}

function endGame() {
    gameActive = false;
    finalHeightVal.textContent = score;
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Export for multiplayer
window.remotePlayers = remotePlayers;
window.Player = Player;
window.localPlayer = localPlayer;
