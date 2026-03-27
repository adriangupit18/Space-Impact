/**
 * SPACE IMPACT - A Complete 2D Side-Scrolling Shooter Game
 * ==========================================================
 * 
 * HTML TEMPLATE:
 * ============================================================
 * <!DOCTYPE html>
 * <html lang="en">
 * <head>
 *     <meta charset="UTF-8">
 *     <meta name="viewport" content="width=device-width, initial-scale=1.0">
 *     <title>Space Impact</title>
 *     <link rel="stylesheet" href="style.css">
 * </head>
 * <body>
 *     <canvas id="gameCanvas" width="800" height="500"></canvas>
 *     <script src="game.js"></script>
 * </body>
 * </html>
 * 
 * CSS TEMPLATE (style.css):
 * ============================================================
 * * {
 *     margin: 0;
 *     padding: 0;
 *     box-sizing: border-box;
 * }
 * 
 * body {
 *     display: flex;
 *     justify-content: center;
 *     align-items: center;
 *     height: 100vh;
 *     background: #000;
 *     font-family: Arial, sans-serif;
 * }
 * 
 * canvas {
 *     display: block;
 *     border: 2px solid #00ff00;
 *     background: #000;
 * }
 * 
 * @media (max-width: 600px) {
 *     canvas {
 *         max-width: 100vw;
 *         max-height: 100vh;
 *     }
 * }
 */

// ============================================================
// ASSET & ANIMATION SYSTEM
// ============================================================

/**
 * AssetManager - Loads and manages game assets
 */
class AssetManager {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = 0;
    }
    
    load(name, path) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this.loadedCount++;
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load asset: ${name}`);
                resolve(null);
            };
            img.src = path;
            this.totalCount++;
        });
    }
    
    loadAll(assets) {
        const promises = Object.entries(assets).map(([name, path]) => 
            this.load(name, path)
        );
        return Promise.all(promises);
    }
    
    get(name) {
        return this.images[name] || null;
    }
    
    isLoaded() {
        return this.loadedCount > 0 && this.loadedCount === this.totalCount;
    }
}

/**
 * AnimatedSprite - Handles sprite animation from spritesheets
 */
class AnimatedSprite {
    constructor(image, frameWidth, frameHeight, totalFrames, fps = 10) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.totalFrames = totalFrames;
        this.fps = fps;
        this.frameDuration = 1000 / fps;
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
        this.loop = true;
    }
    
    update(deltaTime) {
        if (!this.isPlaying || !this.image) return;
        
        this.elapsedTime += deltaTime;
        
        while (this.elapsedTime >= this.frameDuration) {
            this.elapsedTime -= this.frameDuration;
            this.currentFrame++;
            
            if (this.currentFrame >= this.totalFrames) {
                if (this.loop) {
                    this.currentFrame = 0;
                } else {
                    this.isPlaying = false;
                    this.currentFrame = this.totalFrames - 1;
                }
            }
        }
    }
    
    draw(ctx, x, y, width, height, rotation = 0) {
        if (!this.image) return;
        
        ctx.save();
        ctx.translate(x, y);
        if (rotation) ctx.rotate(rotation);
        
        const colsPerRow = Math.ceil(this.image.width / this.frameWidth);
        const col = this.currentFrame % colsPerRow;
        const row = Math.floor(this.currentFrame / colsPerRow);
        const sx = col * this.frameWidth;
        const sy = row * this.frameHeight;
        
        ctx.drawImage(
            this.image,
            sx, sy, this.frameWidth, this.frameHeight,
            -width / 2, -height / 2, width, height
        );
        
        ctx.restore();
    }
    
    reset() {
        this.currentFrame = 0;
        this.elapsedTime = 0;
        this.isPlaying = true;
    }
}

// ============================================================
// GAME CLASSES
// ============================================================

/**
 * InputHandler - Manages keyboard and touch input
 */
class InputHandler {
    constructor() {
        this.keys = {};
        this.touchStart = null;
        this.touchEnd = null;
        this.touchActive = false;
        this.isMobile =
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            ('ontouchstart' in window) ||
            ((navigator.maxTouchPoints || 0) > 0);
        this.showVirtualControls = this.isMobile;
        this.gameplayTouchControlsEnabled = false;
        this.canvasRect = { left: 0, top: 0, width: 800, height: 500 };
        this.tapPoints = [];

        this.joystick = {
            active: false,
            touchId: null,
            baseX: 120,
            baseY: 410,
            knobX: 120,
            knobY: 410,
            radius: 46,
            knobRadius: 18,
            deadZone: 0.12,
            sensitivity: 1,
            dx: 0,
            dy: 0
        };

        this.fireButton = {
            active: false,
            touchId: null,
            x: 700,
            y: 410,
            radius: 42
        };

        this.sensitivitySlider = {
            active: false,
            touchId: null,
            x1: 560,
            x2: 760,
            y: 58,
            value: 0.5
        };
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        // Touch controls
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Mouse click support for UI buttons.
        document.addEventListener('click', (e) => {
            const p = this.toCanvasSpace(e.clientX, e.clientY);
            this.tapPoints.push(p);
            if (this.tapPoints.length > 6) this.tapPoints.shift();
        });
    }

    setCanvasRect(rect) {
        this.canvasRect = rect;
        this.joystick.baseX = rect.width * 0.16;
        this.joystick.baseY = rect.height * 0.82;
        if (!this.joystick.active) {
            this.joystick.knobX = this.joystick.baseX;
            this.joystick.knobY = this.joystick.baseY;
        }
        this.fireButton.x = rect.width * 0.88;
        this.fireButton.y = rect.height * 0.82;
        this.sensitivitySlider.x1 = rect.width * 0.64;
        this.sensitivitySlider.x2 = rect.width * 0.94;
        this.sensitivitySlider.y = rect.height * 0.12;
    }

    setVirtualControlsVisible(visible) {
        this.showVirtualControls = visible;
    }

    setGameplayTouchControlsEnabled(enabled) {
        this.gameplayTouchControlsEnabled = !!enabled;

        // If controls are disabled (menu screens), release active touch controls.
        if (!this.gameplayTouchControlsEnabled) {
            this.joystick.active = false;
            this.joystick.touchId = null;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
            this.joystick.knobX = this.joystick.baseX;
            this.joystick.knobY = this.joystick.baseY;

            this.fireButton.active = false;
            this.fireButton.touchId = null;

            this.sensitivitySlider.active = false;
            this.sensitivitySlider.touchId = null;
        }
    }

    toCanvasSpace(clientX, clientY) {
        return {
            x: clientX - this.canvasRect.left,
            y: clientY - this.canvasRect.top
        };
    }

    updateJoystickFromPoint(x, y) {
        const dx = x - this.joystick.baseX;
        const dy = y - this.joystick.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const clamped = Math.min(dist, this.joystick.radius);
        const nx = dx / dist;
        const ny = dy / dist;

        this.joystick.knobX = this.joystick.baseX + nx * clamped;
        this.joystick.knobY = this.joystick.baseY + ny * clamped;
        this.joystick.dx = nx * (clamped / this.joystick.radius);
        this.joystick.dy = ny * (clamped / this.joystick.radius);
    }

    updateSensitivitySliderFromX(x) {
        const minX = this.sensitivitySlider.x1;
        const maxX = this.sensitivitySlider.x2;
        const clampedX = Math.max(minX, Math.min(maxX, x));
        this.sensitivitySlider.value = (clampedX - minX) / (maxX - minX);
        this.joystick.sensitivity = 0.6 + this.sensitivitySlider.value * 0.9;
    }

    applyDeadZone(v) {
        const a = Math.abs(v);
        const dz = this.joystick.deadZone;
        if (a <= dz) return 0;
        const normalized = (a - dz) / (1 - dz);
        return Math.sign(v) * normalized;
    }

    handleTouchStart(e) {
        const useGameplayTouchControls = this.showVirtualControls && this.gameplayTouchControlsEnabled;

        if (e.touches && e.touches.length > 0) {
            this.isMobile = true;
            this.showVirtualControls = true;
        }
        if (useGameplayTouchControls) e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const p = this.toCanvasSpace(touch.clientX, touch.clientY);

            if (
                useGameplayTouchControls &&
                !this.sensitivitySlider.active &&
                p.y >= this.sensitivitySlider.y - 20 &&
                p.y <= this.sensitivitySlider.y + 20 &&
                p.x >= this.sensitivitySlider.x1 - 20 &&
                p.x <= this.sensitivitySlider.x2 + 20
            ) {
                this.sensitivitySlider.active = true;
                this.sensitivitySlider.touchId = touch.identifier;
                this.updateSensitivitySliderFromX(p.x);
                continue;
            }

            if (
                useGameplayTouchControls &&
                !this.joystick.active &&
                p.x < this.canvasRect.width * 0.5
            ) {
                // Floating joystick: lock base where the thumb first touches.
                this.joystick.baseX = p.x;
                this.joystick.baseY = p.y;
                this.joystick.knobX = p.x;
                this.joystick.knobY = p.y;
                this.joystick.active = true;
                this.joystick.touchId = touch.identifier;
                this.updateJoystickFromPoint(p.x, p.y);
                continue;
            }

            if (
                useGameplayTouchControls &&
                !this.fireButton.active &&
                p.x >= this.canvasRect.width * 0.5
            ) {
                // Floating fire button: any right-half touch starts firing.
                this.fireButton.x = p.x;
                this.fireButton.y = p.y;
                this.fireButton.active = true;
                this.fireButton.touchId = touch.identifier;
                continue;
            }

            this.touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
            this.touchActive = true;
        }
    }

    handleTouchMove(e) {
        const useGameplayTouchControls = this.showVirtualControls && this.gameplayTouchControlsEnabled;
        if (useGameplayTouchControls) e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const p = this.toCanvasSpace(touch.clientX, touch.clientY);

            if (this.sensitivitySlider.active && touch.identifier === this.sensitivitySlider.touchId) {
                this.updateSensitivitySliderFromX(p.x);
                continue;
            }

            if (this.joystick.active && touch.identifier === this.joystick.touchId) {
                this.updateJoystickFromPoint(p.x, p.y);
                continue;
            }

            if (this.fireButton.active && touch.identifier === this.fireButton.touchId) {
                this.fireButton.x = p.x;
                this.fireButton.y = p.y;
                continue;
            }

            this.touchEnd = { x: touch.clientX, y: touch.clientY };
        }
    }

    handleTouchEnd(e) {
        const useGameplayTouchControls = this.showVirtualControls && this.gameplayTouchControlsEnabled;
        if (useGameplayTouchControls) e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const p = this.toCanvasSpace(touch.clientX, touch.clientY);
            let releasedControl = false;

            if (this.joystick.active && touch.identifier === this.joystick.touchId) {
                this.joystick.active = false;
                this.joystick.touchId = null;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                this.joystick.knobX = this.joystick.baseX;
                this.joystick.knobY = this.joystick.baseY;
                releasedControl = true;
            }

            if (this.fireButton.active && touch.identifier === this.fireButton.touchId) {
                this.fireButton.active = false;
                this.fireButton.touchId = null;
                this.fireButton.x = this.canvasRect.width * 0.88;
                this.fireButton.y = this.canvasRect.height * 0.82;
                releasedControl = true;
            }

            if (this.sensitivitySlider.active && touch.identifier === this.sensitivitySlider.touchId) {
                this.sensitivitySlider.active = false;
                this.sensitivitySlider.touchId = null;
                releasedControl = true;
            }

            if (!releasedControl) {
                this.tapPoints.push(p);
                if (this.tapPoints.length > 6) this.tapPoints.shift();
            }
        }

        if (e.touches.length === 0) {
            this.touchActive = false;
            this.touchStart = null;
            this.touchEnd = null;
        }
    }
    
    isKeyPressed(key) {
        return this.keys[key] || false;
    }
    
    isSpacePressed() {
        return this.keys[' '] || false;
    }
    
    isEnterPressed() {
        return this.keys['Enter'] || false;
    }
    
    getTouchInput(canvasWidth, canvasHeight) {
        if (this.showVirtualControls) {
            const x = this.applyDeadZone(this.joystick.dx);
            const y = this.applyDeadZone(this.joystick.dy);
            // Curved response gives finer control near center while still allowing max speed.
            const curveX = Math.sign(x) * Math.pow(Math.abs(x), 1.35);
            const curveY = Math.sign(y) * Math.pow(Math.abs(y), 1.35);
            return {
                moveY: curveY * 5 * this.joystick.sensitivity,
                moveX: curveX * 5 * this.joystick.sensitivity,
                shoot: this.fireButton.active
            };
        }

        if (!this.touchActive || !this.touchStart) {
            return { moveY: 0, moveX: 0, shoot: false };
        }
        
        const touchX = this.touchStart.x;
        const touchY = this.touchStart.y;
        const moveY = 0;
        
        // Left half = move up/down
        let verticalDelta = 0;
        if (this.touchEnd && touchX < canvasWidth / 2) {
            verticalDelta = this.touchEnd.y - this.touchStart.y;
        }
        
        // Right half = shoot
        const shoot = touchX > canvasWidth / 2;
        
        return {
            moveY: verticalDelta * 0.5,
            moveX: 0,
            shoot: shoot
        };
    }

    drawMobileControls(ctx) {
        if (!this.showVirtualControls) return;

        ctx.save();

        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#143746';
        ctx.beginPath();
        ctx.arc(this.joystick.baseX, this.joystick.baseY, this.joystick.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(150,230,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = this.joystick.active ? '#73ddff' : '#a6efff';
        ctx.beginPath();
        ctx.arc(this.joystick.knobX, this.joystick.knobY, this.joystick.knobRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = this.fireButton.active ? 0.92 : 0.55;
        ctx.fillStyle = this.fireButton.active ? '#ff764f' : '#ff9c83';
        ctx.beginPath();
        ctx.arc(this.fireButton.x, this.fireButton.y, this.fireButton.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,230,195,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#31180c';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FIRE', this.fireButton.x, this.fireButton.y + 6);

        // Sensitivity slider
        const sliderX = this.sensitivitySlider.x1;
        const sliderW = this.sensitivitySlider.x2 - this.sensitivitySlider.x1;
        const knobX = sliderX + sliderW * this.sensitivitySlider.value;

        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = 'rgba(160,240,255,0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.sensitivitySlider.x1, this.sensitivitySlider.y);
        ctx.lineTo(this.sensitivitySlider.x2, this.sensitivitySlider.y);
        ctx.stroke();

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = this.sensitivitySlider.active ? '#9ceeff' : '#d0f7ff';
        ctx.beginPath();
        ctx.arc(knobX, this.sensitivitySlider.y, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#d6f8ff';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`SENS ${this.joystick.sensitivity.toFixed(2)}x`, (this.sensitivitySlider.x1 + this.sensitivitySlider.x2) / 2, this.sensitivitySlider.y - 12);

        ctx.restore();
    }

    consumeTapInRect(rect) {
        if (!rect) return false;
        for (let i = 0; i < this.tapPoints.length; i++) {
            const p = this.tapPoints[i];
            if (
                p.x >= rect.x &&
                p.x <= rect.x + rect.width &&
                p.y >= rect.y &&
                p.y <= rect.y + rect.height
            ) {
                this.tapPoints.splice(i, 1);
                return true;
            }
        }
        return false;
    }
}

/**
 * SoundManager - Manages game audio (simulation with Web Audio API)
 */
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.masterVolume = 0.3;
        this.isMuted = false;
        
        try {
            const audioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new audioContext();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    /**
     * Play a simple synthesized sound
     */
    playSound(type, duration = 0.1, frequency = 440) {
        if (!this.audioContext || this.isMuted) return;
        
        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            
            gain.gain.setValueAtTime(this.masterVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
            
            osc.frequency.setValueAtTime(frequency, now);
            
            if (type === 'shoot') {
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + duration);
                osc.type = 'square';
            } else if (type === 'explosion') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + duration);
            } else if (type === 'powerup') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.5);
            }
            
            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            // Silently fail if audio context has issues
        }
    }
    
    shoot() {
        this.playSound('shoot', 0.05, 400);
    }
    
    explosion() {
        this.playSound('explosion', 0.2, 150);
    }
    
    powerup() {
        this.playSound('powerup', 0.3, 800);
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
    }
}

/**
 * Star - Background scrolling star
 */
class Star {
    constructor(x, y, radius = 1, opacity = 0.8) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.opacity = opacity;
        this.vx = -2; // Scroll speed
    }
    
    update() {
        this.x += this.vx;
    }
    
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    isOffScreen(canvasWidth) {
        return this.x < -10;
    }
}

/**
 * Explosion - Particle explosion effect
 */
class Explosion {
    constructor(x, y, particleCount = 12) {
        this.x = x;
        this.y = y;
        this.particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = 3 + Math.random() * 4;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                life: 1,
                size: 2 + Math.random() * 2
            });
        }
        
        this.life = 1;
    }
    
    update() {
        this.life -= 0.05;
        
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravity
            p.life -= 0.05;
        });
    }
    
    draw(ctx) {
        this.particles.forEach(p => {
            if (p.life > 0) {
                ctx.fillStyle = `rgba(255, 150, 0, ${p.life})`;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        });
    }
    
    isAlive() {
        return this.life > 0;
    }
}

/**
 * PowerUp - Power-up item dropped by enemies
 */
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'rapid-fire', 'shield', 'life', 'dual-shot', 'triple-shot', 'laser'
        this.width = 20;
        this.height = 20;
        this.vy = 0;
        this.vx = -1.1;
        this.rotation = 0;
        this.rotationSpeed = 0.1;
    }
    
    update() {
        // Loot drifts left like enemies.
        this.x += this.vx;
        this.rotation += this.rotationSpeed;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw based on type
        if (this.type === 'rapid-fire') {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(-10, -10, 20, 20);
            ctx.fillStyle = '#000';
            ctx.fillRect(-5, -5, 3, 10);
            ctx.fillRect(2, -5, 3, 10);
        } else if (this.type === 'shield') {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.type === 'life') {
            ctx.fillStyle = '#ff0080';
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(-5, -3);
            ctx.lineTo(-3, 5);
            ctx.lineTo(0, 2);
            ctx.lineTo(3, 5);
            ctx.lineTo(5, -3);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'dual-shot') {
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(-8, -10, 16, 20);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(-4, -8, 3, 5);
            ctx.fillRect(1, -8, 3, 5);
        } else if (this.type === 'triple-shot') {
            ctx.fillStyle = '#ff3300';
            ctx.fillRect(-10, -10, 20, 20);
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(-6, -6, 3, 4);
            ctx.fillRect(0, -6, 3, 4);
            ctx.fillRect(4, -6, 3, 4);
        } else if (this.type === 'laser') {
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-8, -12, 16, 24);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(-6, -10, 12, 20);
            ctx.fillRect(-2, -14, 4, 28);
        }
        
        ctx.restore();
    }
    
    isOffScreen(canvasWidth, canvasHeight) {
        return this.x < -30 || this.y > canvasHeight + 20 || this.y < -20;
    }
}

/**
 * Bullet - Player projectile
 */
class Bullet {
    constructor(x, y, assetManager = null, type = 'zapper') {
        this.x = x;
        this.y = y;
        this.vx = 8;
        this.width = 8;
        this.height = 3;
        this.assetManager = assetManager;
        this.type = type;
        this.animatedSprite = null;
        this.trail = [];
        this.maxTrail = this.type === 'laser' ? 8 : this.type === 'rocket' ? 7 : this.type === 'auto' ? 4 : 5;

        if (this.type === 'laser') {
            this.width = 28;
            this.height = 12;
        } else if (this.type === 'auto') {
            this.width = 20;
            this.height = 10;
        } else if (this.type === 'rocket') {
            this.width = 26;
            this.height = 12;
        } else {
            this.width = 22;
            this.height = 10;
        }

        // Use weapon-specific projectile assets.
        if (assetManager) {
            const spriteByType = {
                laser: 'bulletBigGun',
                rocket: 'bulletRocket',
                auto: 'bulletAutoCannon',
                zapper: 'bulletZapper'
            };
            const spriteKey = spriteByType[this.type] || 'bulletZapper';
            const bulletImage = assetManager.get(spriteKey);
            if (bulletImage) {
                const frameConfig = {
                    // Counts tuned to provided Foozle strips for visible animation.
                    zapper: { totalFrames: 8, fps: 14 },
                    auto: { totalFrames: 4, fps: 12 },
                    laser: { totalFrames: 10, fps: 14 },
                    rocket: { totalFrames: 10, fps: 10 }
                };
                const cfg = frameConfig[this.type] || frameConfig.zapper;
                const frameWidth = Math.max(1, Math.floor(bulletImage.width / cfg.totalFrames));
                const frameHeight = bulletImage.height;
                this.animatedSprite = new AnimatedSprite(
                    bulletImage,
                    frameWidth,
                    frameHeight,
                    cfg.totalFrames,
                    cfg.fps
                );
            }
        }
    }
    
    update() {
        this.trail.push({ x: this.x, y: this.y, life: 1 });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].life -= this.type === 'auto' ? 0.3 : 0.2;
        }
        this.trail = this.trail.filter((p) => p.life > 0);

        this.x += this.vx;
        if (this.animatedSprite) {
            this.animatedSprite.update(16.67); // ~60fps
        }
    }
    
    draw(ctx) {
        if (this.trail.length) {
            ctx.save();
            if (this.type === 'laser') {
                for (let i = 0; i < this.trail.length; i++) {
                    const p = this.trail[i];
                    ctx.strokeStyle = `rgba(90,255,255,${0.08 + p.life * 0.25})`;
                    ctx.lineWidth = Math.max(1, this.height * (0.15 + p.life * 0.22));
                    ctx.beginPath();
                    ctx.moveTo(p.x - this.width * (0.25 + (1 - p.life) * 0.6), p.y);
                    ctx.lineTo(p.x + this.width * 0.35, p.y);
                    ctx.stroke();
                }
            } else if (this.type === 'rocket') {
                for (let i = 0; i < this.trail.length; i++) {
                    const p = this.trail[i];
                    const flicker = (Math.sin((i + this.x) * 0.45) + 1) * 0.5;
                    ctx.fillStyle = `rgba(255,${110 + Math.floor(flicker * 80)},40,${0.08 + p.life * 0.28})`;
                    ctx.beginPath();
                    ctx.ellipse(
                        p.x - this.width * (0.35 + (1 - p.life) * 0.4),
                        p.y,
                        this.width * (0.1 + p.life * 0.13),
                        this.height * (0.16 + p.life * 0.18),
                        0,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            } else {
                for (let i = 0; i < this.trail.length; i++) {
                    const p = this.trail[i];
                    const color = this.type === 'auto' ? '255,230,120' : '120,255,140';
                    ctx.fillStyle = `rgba(${color},${0.05 + p.life * 0.2})`;
                    ctx.beginPath();
                    ctx.arc(
                        p.x - this.width * (0.15 + (1 - p.life) * 0.45),
                        p.y,
                        Math.max(1, this.height * (0.16 + p.life * 0.2)),
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        if (this.animatedSprite) {
            const drawWidth = this.width;
            const drawHeight = this.height;
            this.animatedSprite.draw(ctx, this.x, this.y, drawWidth, drawHeight);

            // Extra glow to keep bullets visible against dark background.
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = this.type === 'laser' ? 'rgba(100,255,255,0.55)' : 'rgba(120,255,120,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - drawWidth * 0.45, this.y);
            ctx.lineTo(this.x + drawWidth * 0.45, this.y);
            ctx.stroke();
            ctx.restore();
        } else {
            // Fallback to canvas drawing
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
            
            // Draw glow effect
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        }
    }
    
    isOffScreen(canvasWidth) {
        return this.x > canvasWidth + 10;
    }
}

/**
 * EnemyBullet - Enemy projectile
 */
class EnemyBullet {
    constructor(x, y, targetX, targetY, speed = 2.4, mode = 'aimed', bulletType = 'standard', assetManager = null) {
        this.x = x;
        this.y = y;
        this.width = 18;
        this.height = 10;
        this.bulletType = bulletType;
        this.animatedSprite = null;
        this.trail = [];
        this.maxTrail = bulletType === 'heavy' ? 8 : 5;

        if (mode === 'straight') {
            this.vx = -speed;
            this.vy = 0;
        } else if (mode === 'kamikaze') {
            this.vx = -speed;
            this.vy = Math.max(-speed * 0.6, Math.min(speed * 0.6, (targetY - y) * 0.04));
        } else {
            const dx = targetX - x;
            const dy = targetY - y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            this.vx = (dx / distance) * speed;
            this.vy = (dy / distance) * speed;
        }

        if (assetManager) {
            const spriteKey = bulletType === 'heavy' ? 'bulletRocket' : 'bulletAutoCannon';
            const bulletImage = assetManager.get(spriteKey);
            if (bulletImage) {
                const frames = bulletType === 'heavy' ? 10 : 4;
                const frameWidth = Math.max(1, Math.floor(bulletImage.width / frames));
                this.animatedSprite = new AnimatedSprite(
                    bulletImage,
                    frameWidth,
                    bulletImage.height,
                    frames,
                    bulletType === 'heavy' ? 10 : 12
                );
            }
        }
    }
    
    update() {
        this.trail.push({ x: this.x, y: this.y, life: 1 });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].life -= this.bulletType === 'heavy' ? 0.16 : 0.24;
        }
        this.trail = this.trail.filter((p) => p.life > 0);

        this.x += this.vx;
        this.y += this.vy;
        if (this.animatedSprite) {
            this.animatedSprite.update(16.67);
        }
    }
    
    draw(ctx) {
        if (this.trail.length) {
            ctx.save();
            const angle = Math.atan2(this.vy, this.vx);
            for (let i = 0; i < this.trail.length; i++) {
                const p = this.trail[i];
                const spread = this.bulletType === 'heavy' ? 0.22 : 0.14;
                ctx.strokeStyle = this.bulletType === 'heavy'
                    ? `rgba(255,120,60,${0.08 + p.life * 0.3})`
                    : `rgba(255,170,120,${0.05 + p.life * 0.22})`;
                ctx.lineWidth = Math.max(1, (this.height * (0.18 + p.life * spread)));
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(
                    p.x - Math.cos(angle) * this.width * (0.35 + (1 - p.life) * 0.7),
                    p.y - Math.sin(angle) * this.width * (0.35 + (1 - p.life) * 0.7)
                );
                ctx.stroke();
            }
            ctx.restore();
        }

        if (this.animatedSprite) {
            const rotation = Math.atan2(this.vy, this.vx);
            this.animatedSprite.draw(ctx, this.x, this.y, this.width, this.height, rotation);

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(255,140,100,0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - this.width * 0.45, this.y);
            ctx.lineTo(this.x + this.width * 0.45, this.y);
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
            ctx.fill();

            // Glow effect
            ctx.strokeStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    isOffScreen(canvasWidth, canvasHeight) {
        return this.x < -10 || this.y < -10 || this.y > canvasHeight + 10;
    }
}

/**
 * Enemy - Basic enemy ship
 */
class Enemy {
    constructor(x, y, assetManager = null, spriteName = 'shipDamaged', pattern = 'straight', playerRef = null, groupIndex = 0, enemyClass = 'normal') {
        this.x = x;
        this.y = y;
        this.pattern = pattern;
        this.enemyClass = enemyClass;
        this.playerRef = playerRef;
        this.groupIndex = groupIndex;
        this.groupPhase =
         groupIndex * 0.8;
        this.speedX = 1.8 + Math.random() * 1.1;
        this.speedY = 0.8 + Math.random() * 0.8;
        this.amplitude = 18 + Math.random() * 35;
        this.frequency = 0.03 + Math.random() * 0.03;
        this.initialY = y;
        this.time = 0;
        this.width = 40; // Larger
        this.height = 32;
        this.fireRate = 70 + Math.random() * 45;
        this.bulletSpeed = 3 + Math.random() * 1.2;
        this.bulletType = Math.random() < 0.2 ? 'heavy' : 'standard';
        this.shootCounter = Math.random() * this.fireRate;
        this.shootInterval = this.fireRate + Math.random() * 30;
        this.attackPattern = 0;
        this.health = 1;
        this.assetManager = assetManager;
        this.spriteName = spriteName;
        this.shipSprite = assetManager ? assetManager.get(spriteName) : null;
        this.renderWidth = 58;
        this.renderHeight = 58;

        // Class tuning controls behavior diversity while keeping durability unchanged.
        if (this.enemyClass === 'sniper') {
            this.fireRate = 95 + Math.random() * 30;
            this.bulletSpeed = 4.8;
            this.bulletType = 'standard';
            this.speedX *= 0.85;
            this.renderWidth = 52;
            this.renderHeight = 52;
        } else if (this.enemyClass === 'charger') {
            this.speedX *= 1.45;
            this.fireRate = 85 + Math.random() * 20;
            this.bulletSpeed = 3.6;
            this.bulletType = 'standard';
            this.renderWidth = 62;
            this.renderHeight = 62;
        } else if (this.enemyClass === 'drifter') {
            this.amplitude *= 1.25;
            this.frequency *= 0.75;
            this.fireRate = 80 + Math.random() * 25;
            this.bulletType = 'standard';
        } else if (this.enemyClass === 'eliteWave3') {
            // Wave 3 elite: stronger behavior, boss-like pressure, same HP as normal.
            this.pattern = 'bossLike';
            this.speedX = 2.1 + Math.random() * 0.8;
            this.speedY = 1.3 + Math.random() * 0.8;
            this.amplitude = 42 + Math.random() * 28;
            this.frequency = 0.05 + Math.random() * 0.03;
            this.fireRate = 34 + Math.random() * 14;
            this.bulletSpeed = 4.9;
            this.bulletType = 'standard';
            this.renderWidth = 66;
            this.renderHeight = 66;
        }
    }
    
    update(player) {
        this.time++;
        this.x -= this.speedX;

        if (this.pattern === 'zigzag') {
            this.y += Math.sign(Math.sin(this.time * this.frequency * 8)) * this.speedY;
        } else if (this.pattern === 'sine') {
            this.y = this.initialY + Math.sin(this.time * this.frequency) * this.amplitude;
        } else if (this.pattern === 'kamikaze') {
            const target = player || this.playerRef;
            if (target) {
                const dy = target.y - this.y;
                this.y += Math.max(-this.speedY, Math.min(this.speedY, dy * 0.05));
            }
        } else if (this.pattern === 'wave') {
            this.y = this.initialY + Math.sin(this.time * this.frequency + this.groupPhase) * this.amplitude;
        } else if (this.pattern === 'arc') {
            this.y = this.initialY
                + Math.sin(this.time * this.frequency * 0.9) * this.amplitude * 0.7
                + Math.cos(this.time * this.frequency * 1.7) * this.amplitude * 0.28;
        } else if (this.pattern === 'dash') {
            if (this.time % 90 < 24) {
                this.x -= this.speedX * 1.55;
            }
            this.y += Math.sin(this.time * this.frequency * 3.2) * this.speedY;
        } else if (this.pattern === 'bossLike') {
            this.y = this.initialY + Math.sin(this.time * this.frequency) * this.amplitude;
            this.x += Math.sin(this.time * this.frequency * 0.9) * 0.7;
        }
        
        // Keep in bounds vertically
        if (this.y < 0) this.y = 0;
        if (this.y > 500) this.y = 500;
        
        this.shootCounter++;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Base asset faces up; rotate so enemies face left while moving left.
        ctx.rotate(-Math.PI / 2);

        if (this.shipSprite) {
            ctx.drawImage(this.shipSprite, -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
        } else {
            // Enemy ship body (fallback)
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(-18, 12);
            ctx.lineTo(-8, 8);
            ctx.lineTo(8, 8);
            ctx.lineTo(18, 12);
            ctx.closePath();
            ctx.fill();

            // Enemy cockpit
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(-3, -2, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    shouldShoot() {
        return this.shootCounter > this.shootInterval;
    }
    
    resetShootCounter() {
        this.shootCounter = 0;
        this.shootInterval = this.fireRate + Math.random() * 30;
    }

    getShotPattern(playerX, playerY) {
        const startX = this.x - 10;
        const startY = this.y;

        if (this.enemyClass === 'eliteWave3') {
            const shots = [];
            if (this.attackPattern === 0) {
                // Boss-like spread volley.
                for (let i = -2; i <= 2; i++) {
                    shots.push({
                        x: startX,
                        y: startY + i * 8,
                        targetX: playerX - 50,
                        targetY: playerY + i * 16,
                        speed: this.bulletSpeed,
                        mode: 'aimed',
                        bulletType: 'standard'
                    });
                }
            } else {
                // Boss-like triple pressure lane.
                for (let i = -1; i <= 1; i++) {
                    shots.push({
                        x: startX,
                        y: startY + i * 14,
                        targetX: playerX,
                        targetY: playerY,
                        speed: this.bulletSpeed + 0.35,
                        mode: 'straight',
                        bulletType: 'standard'
                    });
                }
            }
            this.attackPattern = (this.attackPattern + 1) % 2;
            return shots;
        }

        if (this.enemyClass === 'sniper') {
            return [{
                x: startX,
                y: startY,
                targetX: playerX,
                targetY: playerY,
                speed: this.bulletSpeed,
                mode: 'aimed',
                bulletType: 'standard'
            }];
        }

        return [{
            x: startX,
            y: startY,
            targetX: playerX,
            targetY: playerY,
            speed: this.bulletSpeed,
            mode: this.pattern === 'kamikaze' ? 'kamikaze' : 'straight',
            bulletType: this.bulletType
        }];
    }
    
    isOffScreen(canvasWidth) {
        return this.x < -30;
    }
}

/**
 * Boss - Boss enemy
 */
class Boss {
    constructor(x, y, level = 1, assetManager = null) {
        this.x = x;
        this.y = y;
        this.vx = -1.5;
        this.width = 80; // Larger
        this.height = 65;
        this.level = level;
        const baseHealth = 50 + (level - 1) * 25;
        this.maxHealth = baseHealth;
        this.health = baseHealth;
        this.shootCounter = 0;
        this.pattern = 0;
        this.attackPhase = 0;
        this.assetManager = assetManager;
        this.engineSprite = null;
        
        // Try to load engine effect sprite
        if (assetManager && assetManager.get('engineBurst')) {
            this.engineSprite = new AnimatedSprite(
                assetManager.get('engineBurst'),
                32, 32, 14, 12
            );
        }
    }
    
    update() {
        this.x += this.vx;
        
        // Bob up and down
        this.y = 250 + Math.sin(this.attackPhase * 0.05) * 100;
        
        this.shootCounter++;
        this.attackPhase++;
        
        if (this.engineSprite) {
            this.engineSprite.update(16.67);
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Draw engine effect if available
        if (this.engineSprite) {
            this.engineSprite.draw(ctx, -40, 0, 32, 32);
        }
        
        // Boss body (larger)
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(-40, 30);
        ctx.lineTo(0, 20);
        ctx.lineTo(40, 30);
        ctx.closePath();
        ctx.fill();
        
        // Boss details
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(-20, -15, 15, 20);
        ctx.fillRect(5, -15, 15, 20);
        
        // Boss eyes
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(-12, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    shouldShoot() {
        return this.shootCounter > 20;
    }
    
    resetShootCounter() {
        this.shootCounter = 0;
    }
    
    getBulletPattern(playerX, playerY) {
        // Multiple bullet patterns
        const bullets = [];
        const startX = this.x + 20;
        const startY = this.y;
        
        if (this.pattern === 0) {
            // Straight line pattern
            for (let i = -1; i <= 1; i++) {
                bullets.push({ x: startX, y: startY + i * 15, targetX: playerX, targetY: playerY });
            }
        } else if (this.pattern === 1) {
            // Spread pattern
            for (let i = -2; i <= 2; i++) {
                const angleOffset = i * 15;
                bullets.push({ x: startX, y: startY + angleOffset, targetX: playerX + Math.random() * 100 - 50, targetY: playerY });
            }
        }
        
        this.pattern = (this.pattern + 1) % 2;
        return bullets;
    }
    
    isOffScreen(canvasWidth) {
        return this.x < -100;
    }
    
    takeDamage(damage) {
        this.health -= damage;
    }
    
    isAlive() {
        return this.health > 0;
    }
}

/**
 * Player - Player ship
 */
class Player {
    constructor(x, y, assetManager = null) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 40;
        this.height = 32;
        this.renderWidth = 58;
        this.renderHeight = 58;
        this.speed = 4;
        this.lives = 3;
        this.maxShield = 0;
        this.shield = 0;
        this.shootCooldown = 0;
        this.shootInterval = 10;
        this.rapidFireActive = false;
        this.rapidFireDuration = 0;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        
        // Weapon upgrades
        this.dualShotActive = false;
        this.dualShotDuration = 0;
        this.tripleShotActive = false;
        this.tripleShotDuration = 0;
        this.laserActive = false;
        this.laserDuration = 0;
        
        // Ship rotation for direction
        this.rotation = 0;
        
        // Asset management
        this.assetManager = assetManager;
        this.shipSprite = null;
        this.engineSprite = null;
        
        // Try to load ship sprite
        if (assetManager && assetManager.get('shipFull')) {
            this.shipSprite = assetManager.get('shipFull');
        }

        this.shipSpriteSlight = assetManager ? assetManager.get('shipSlight') : null;
        this.shipSpriteDamaged = assetManager ? assetManager.get('shipDamaged') : null;
        this.shipSpriteVeryDamaged = assetManager ? assetManager.get('shipVeryDamaged') : null;
        this.weaponSpriteZapper = assetManager ? assetManager.get('weaponZapper') : null;
        this.weaponSpriteAuto = assetManager ? assetManager.get('weaponAutoCannon') : null;
        this.weaponSpriteBig = assetManager ? assetManager.get('weaponBigGun') : null;
        this.shieldSpriteRound = assetManager ? assetManager.get('shieldRound') : null;
        this.shieldSpriteInv = assetManager ? assetManager.get('shieldInv') : null;
        this.shieldSpriteFront = assetManager ? assetManager.get('shieldFront') : null;
        this.shieldSpriteFrontSide = assetManager ? assetManager.get('shieldFrontSide') : null;
        
        // Try to load engine effect
        if (assetManager && assetManager.get('engineBurst')) {
            this.engineSprite = new AnimatedSprite(
                assetManager.get('engineBurst'),
                32, 32, 14, 12
            );
        }
    }
    
    update(inputHandler, canvasHeight, canvasWidth) {
        // 4-directional movement
        this.vx = 0;
        this.vy = 0;
        
        // Keyboard input for movement
        if (inputHandler.isKeyPressed('ArrowUp') || inputHandler.isKeyPressed('w')) {
            this.vy = -this.speed;
            this.rotation = -Math.PI / 2;
        }
        if (inputHandler.isKeyPressed('ArrowDown') || inputHandler.isKeyPressed('s')) {
            this.vy = this.speed;
            this.rotation = Math.PI / 2;
        }
        if (inputHandler.isKeyPressed('ArrowLeft') || inputHandler.isKeyPressed('a')) {
            this.vx = -this.speed;
            this.rotation = Math.PI;
        }
        if (inputHandler.isKeyPressed('ArrowRight') || inputHandler.isKeyPressed('d')) {
            this.vx = this.speed;
            this.rotation = 0;
        }
        
        // Diagonal movement - update rotation based on direction
        if (this.vx !== 0 && this.vy !== 0) {
            if (this.vx < 0 && this.vy < 0) this.rotation = -3 * Math.PI / 4;
            else if (this.vx > 0 && this.vy < 0) this.rotation = -Math.PI / 4;
            else if (this.vx < 0 && this.vy > 0) this.rotation = 3 * Math.PI / 4;
            else if (this.vx > 0 && this.vy > 0) this.rotation = Math.PI / 4;
        }
        
        // Touch input
        const touch = inputHandler.getTouchInput(canvasWidth, canvasHeight);
        if (touch.moveX !== 0) {
            this.vx = touch.moveX;
        }
        if (touch.moveY !== 0) {
            this.vy = touch.moveY;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Boundary check
        if (this.x - this.width / 2 < 0) this.x = this.width / 2;
        if (this.x + this.width / 2 > canvasWidth) this.x = canvasWidth - this.width / 2;
        if (this.y - this.height / 2 < 0) this.y = this.height / 2;
        if (this.y + this.height / 2 > canvasHeight) this.y = canvasHeight - this.height / 2;
        
        // Update cooldowns
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.rapidFireDuration > 0) {
            this.rapidFireDuration--;
            this.rapidFireActive = true;
            this.shootInterval = 5;
        } else {
            this.rapidFireActive = false;
            this.shootInterval = 10;
        }
        
        if (this.dualShotDuration > 0) this.dualShotDuration--;
        else this.dualShotActive = false;
        
        if (this.tripleShotDuration > 0) this.tripleShotDuration--;
        else this.tripleShotActive = false;
        
        if (this.laserDuration > 0) this.laserDuration--;
        else this.laserActive = false;
        
        // Shield effects
        if (this.shield > 0) {
            this.shield--;
        }
        
        // Invulnerability
        if (this.invulnerableTime > 0) {
            this.invulnerableTime--;
        } else {
            this.invulnerable = false;
        }
        
        // Update engine animation
        if (this.engineSprite) {
            this.engineSprite.update(16.67); // ~60fps
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Base asset faces up; rotate so ship nose points right.
        ctx.rotate(Math.PI / 2);
        
        // Invulnerability flicker
        if (this.invulnerable && Math.floor(this.invulnerableTime / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Draw ship sprite if available
        const stateSprite = this.lives >= 3
            ? (this.shipSprite || this.shipSpriteSlight || this.shipSpriteDamaged || this.shipSpriteVeryDamaged)
            : this.lives === 2
                ? (this.shipSpriteSlight || this.shipSpriteDamaged || this.shipSprite)
                : (this.shipSpriteVeryDamaged || this.shipSpriteDamaged || this.shipSprite);

        if (stateSprite) {
            ctx.drawImage(stateSprite, -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
        } else {
            // Fallback to canvas drawing
            // Player ship body (larger)
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.moveTo(15, -12);
            ctx.lineTo(-15, -8);
            ctx.lineTo(-12, 0);
            ctx.lineTo(-15, 8);
            ctx.lineTo(15, 12);
            ctx.lineTo(12, 0);
            ctx.closePath();
            ctx.fill();
            
            // Cockpit
            ctx.fillStyle = '#00aa00';
            ctx.beginPath();
            ctx.arc(3, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Show mounted weapon art based on active pickup.
        if (this.laserActive && this.weaponSpriteBig) {
            ctx.drawImage(this.weaponSpriteBig, -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
        } else if ((this.tripleShotActive || this.dualShotActive) && this.weaponSpriteAuto) {
            ctx.drawImage(this.weaponSpriteAuto, -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
        } else if (this.weaponSpriteZapper) {
            ctx.drawImage(this.weaponSpriteZapper, -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
        }
        
        // Draw engine effect if available
        if (this.engineSprite) {
            this.engineSprite.draw(ctx, -12, 0, 24, 24);
        }
        
        // Laser upgrade effect
        if (this.laserActive) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(15, -5);
            ctx.lineTo(20, -5);
            ctx.moveTo(15, 5);
            ctx.lineTo(20, 5);
            ctx.stroke();
        }
        
        // Shield effect
        if (this.shield > 0) {
            const shieldSprite = this.invulnerable
                ? (this.shieldSpriteInv || this.shieldSpriteFrontSide || this.shieldSpriteRound)
                : (this.shieldSpriteFrontSide || this.shieldSpriteFront || this.shieldSpriteRound);
            if (shieldSprite) {
                ctx.globalAlpha = 0.92;
                ctx.drawImage(shieldSprite, -32, -32, 64, 64);
                ctx.globalAlpha = 1;
            } else {
                ctx.strokeStyle = `rgba(0, 255, 255, ${Math.sin(this.shield / 10) * 0.5 + 0.5})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 30, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
    
    canShoot() {
        return this.shootCooldown <= 0;
    }
    
    shoot() {
        this.shootCooldown = this.shootInterval;
    }
    
    activateShield(duration) {
        this.shield = duration;
        this.maxShield = duration;
    }
    
    activateRapidFire(duration) {
        this.rapidFireDuration = duration;
    }
    
    activateDualShot(duration) {
        this.dualShotActive = true;
        this.dualShotDuration = duration;
    }
    
    activateTripleShot(duration) {
        this.tripleShotActive = true;
        this.tripleShotDuration = duration;
    }
    
    activateLaser(duration) {
        this.laserActive = true;
        this.laserDuration = duration;
    }
    
    activateInvulnerability(duration) {
        this.invulnerable = true;
        this.invulnerableTime = duration;
    }
    
    takeDamage() {
        if (this.shield > 0) {
            this.shield = 0;
            return false;
        }
        if (!this.invulnerable) {
            this.lives--;
            this.activateInvulnerability(120);
            return true;
        }
        return false;
    }
    
    isAlive() {
        return this.lives > 0;
    }
}

/**
 * Game - Main game engine
 */
class Game {
    constructor(canvasId, gameMode = 'story') {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.canvasWidth = this.canvas.width;
        this.canvasHeight = this.canvas.height;
        this.baseWidth = 800;
        this.baseHeight = 500;
        
        this.gameMode = gameMode; // 'story' or 'endless'
        this.gameState = 'loading'; // loading, start, playing, gameOver, bossWarn, modeSelect
        this.score = 0;
        this.level = 1;
        this.wave = 1;
        this.wavesPerLevel = 3;
        this.bossLevelInterval = 10;
        this.waveMultiplier = 1;
        this.bossActive = false;
        
        // Asset manager
        this.assetManager = new AssetManager();
        
        // Initialize managers
        this.inputHandler = new InputHandler();
        this.soundManager = new SoundManager();

        // Responsive/mobile setup
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => this.resizeCanvas());
        
        // Game objects
        this.player = new Player(80, this.canvasHeight / 2, this.assetManager);
        this.bullets = [];
        this.enemies = [];
        this.enemyBullets = [];
        this.explosions = [];
        this.powerUps = [];
        this.stars = this.generateStars(100);
        this.boss = null;
        
        // Spawn control
        this.spawnCounter = 0;
        this.spawnInterval = 72;
        this.baseSpawnInterval = 72;
        this.enemiesToSpawn = 0;
        this.waveEnemiesSpawned = 0;
        this.waveStarted = false;
        this.wave3EliteSpawned = false;
        
        // Screen state
        this.screenShake = 0;
        this.bossWarningTimer = 0;
        this.bossWarningText = 'BOSS INCOMING!';
        this.laserBeamRect = null;
        this.startButtonRect = null;
        this.modeStoryButtonRect = null;
        this.modeEndlessButtonRect = null;
        this.gameOverButtonRect = null;
        
        // Game loop
        this.lastTime = Date.now();
        this.deltaTime = 0;
        this.frameCount = 0;
        this.enterKeyPressed = false;
        
        // Load assets
        this.loadAssets();
    }

    resizeCanvas() {
        const ratio = this.baseWidth / this.baseHeight;
        const maxWidth = this.inputHandler.isMobile ? Math.min(window.innerWidth, 980) : this.baseWidth;
        const maxHeight = this.inputHandler.isMobile ? Math.min(window.innerHeight, 760) : this.baseHeight;
        const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

        let width = maxWidth;
        let height = Math.round(width / ratio);

        if (height > maxHeight) {
            height = maxHeight;
            width = Math.round(height * ratio);
        }

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.width = width;
        this.canvas.height = height;

        this.canvasWidth = width;
        this.canvasHeight = height;

        this.inputHandler.setVirtualControlsVisible(this.inputHandler.isMobile || coarsePointer || width <= 900);

        const rect = this.canvas.getBoundingClientRect();
        this.inputHandler.setCanvasRect({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        });
    }
    
    loadAssets() {
        const assetPath = 'Foozle_2DS0011_Void_MainShip/Foozle_2DS0011_Void_MainShip/';
        
        const assets = {
            'shipFull': assetPath + 'Main Ship/Main Ship - Bases/PNGs/Main Ship - Base - Full health.png',
            'shipSlight': assetPath + 'Main Ship/Main Ship - Bases/PNGs/Main Ship - Base - Slight damage.png',
            'shipDamaged': assetPath + 'Main Ship/Main Ship - Bases/PNGs/Main Ship - Base - Damaged.png',
            'shipVeryDamaged': assetPath + 'Main Ship/Main Ship - Bases/PNGs/Main Ship - Base - Very damaged.png',
            'bulletZapper': assetPath + 'Main ship weapons/PNGs/Main ship weapon - Projectile - Zapper.png',
            'bulletRocket': assetPath + 'Main ship weapons/PNGs/Main ship weapon - Projectile - Rocket.png',
            'bulletBigGun': assetPath + 'Main ship weapons/PNGs/Main ship weapon - Projectile - Big Space Gun.png',
            'bulletAutoCannon': assetPath + 'Main ship weapons/PNGs/Main ship weapon - Projectile - Auto cannon bullet.png',
            'engineBurst': assetPath + 'Main Ship/Main Ship - Engine Effects/PNGs/Main Ship - Engines - Burst Engine - Spritesheet.png',
            'engineBase': assetPath + 'Main Ship/Main Ship - Engines/PNGs/Main Ship - Engines - Base Engine.png',
            'weaponZapper': assetPath + 'Main Ship/Main Ship - Weapons/PNGs/Main Ship - Weapons - Zapper.png',
            'weaponRockets': assetPath + 'Main Ship/Main Ship - Weapons/PNGs/Main Ship - Weapons - Rockets.png',
            'weaponBigGun': assetPath + 'Main Ship/Main Ship - Weapons/PNGs/Main Ship - Weapons - Big Space Gun.png',
            'weaponAutoCannon': assetPath + 'Main Ship/Main Ship - Weapons/PNGs/Main Ship - Weapons - Auto Cannon.png',
            'shieldRound': assetPath + 'Main Ship/Main Ship - Shields/PNGs/Main Ship - Shields - Round Shield.png',
            'shieldInv': assetPath + 'Main Ship/Main Ship - Shields/PNGs/Main Ship - Shields - Invincibility Shield.png',
            'shieldFront': assetPath + 'Main Ship/Main Ship - Shields/PNGs/Main Ship - Shields - Front Shield.png',
            'shieldFrontSide': assetPath + 'Main Ship/Main Ship - Shields/PNGs/Main Ship - Shields - Front and Side Shield.png',
        };
        
        this.assetManager.loadAll(assets).then(() => {
            this.gameState = 'start';
            console.log('Assets loaded successfully!');
        }).catch(err => {
            console.warn('Some assets failed to load, using fallbacks:', err);
            this.gameState = 'start';
        });
    }
    
    generateStars(count) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.canvasWidth;
            const y = Math.random() * this.canvasHeight;
            const radius = Math.random() * 1.5;
            const opacity = 0.4 + Math.random() * 0.6;
            stars.push(new Star(x, y, radius, opacity));
        }
        return stars;
    }
    
    update() {
        this.inputHandler.setGameplayTouchControlsEnabled(this.gameState === 'playing');

        if (this.gameState === 'loading') {
            // Just wait for assets to load
        } else if (this.gameState === 'start') {
            this.updateStart();
        } else if (this.gameState === 'modeSelect') {
            this.updateModeSelect();
        } else if (this.gameState === 'playing') {
            this.updatePlaying();
        } else if (this.gameState === 'bossWarn') {
            this.updateBossWarn();
        } else if (this.gameState === 'levelUp') {
            this.updateLevelUp();
        } else if (this.gameState === 'gameOver') {
            this.updateGameOver();
        }
    }
    
    updateStart() {
        // Update stars even on start screen
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));

        const pressedStartButton = this.inputHandler.consumeTapInRect(this.startButtonRect);
        // Check for Enter key
        if ((this.inputHandler.isEnterPressed() || pressedStartButton) && !this.enterKeyPressed) {
            this.enterKeyPressed = true;
            this.gameState = 'modeSelect';
        }

        if (!this.inputHandler.isEnterPressed() && !pressedStartButton) {
            this.enterKeyPressed = false;
        }
    }
    
    updateModeSelect() {
        // Update stars
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));

        const pressedStoryButton = this.inputHandler.consumeTapInRect(this.modeStoryButtonRect);
        const pressedEndlessButton = this.inputHandler.consumeTapInRect(this.modeEndlessButtonRect);
        
        // Check for number keys 1 or 2
        if ((this.inputHandler.isKeyPressed('1') || pressedStoryButton) && !this.enterKeyPressed) {
            this.enterKeyPressed = true;
            this.gameMode = 'story';
            this.startNewGame();
        } else if ((this.inputHandler.isKeyPressed('2') || pressedEndlessButton) && !this.enterKeyPressed) {
            this.enterKeyPressed = true;
            this.gameMode = 'endless';
            this.startNewGame();
        }

        if (!this.inputHandler.isKeyPressed('1') && !this.inputHandler.isKeyPressed('2') && !pressedStoryButton && !pressedEndlessButton) {
            this.enterKeyPressed = false;
        }
    }
    
    startNewGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.level = 1;
        this.wave = 1;
        this.player = new Player(80, this.canvasHeight / 2, this.assetManager);
        this.bullets = [];
        this.enemies = [];
        this.enemyBullets = [];
        this.explosions = [];
        this.powerUps = [];
        this.boss = null;
        this.bossActive = false;
        this.spawnCounter = 0;
        this.waveMultiplier = 1;
        this.waveEnemiesSpawned = 0;
        this.waveStarted = false;
        this.wave3EliteSpawned = false;
        this.calculateEnemiesToSpawn();
    }
    
    calculateEnemiesToSpawn() {
        // Each wave spawns more enemies as difficulty increases
        let baseEnemies = 5;
        
        // Endless mode: scale differently
        if (this.gameMode === 'endless') {
            baseEnemies = 5 + Math.floor(this.wave / 2) * 2;
        } else {
            baseEnemies = 8 + (this.level - 1) * 3 + (this.wave - 1) * 2;
        }
        
        this.enemiesToSpawn = baseEnemies;
        this.waveEnemiesSpawned = 0;
        this.waveStarted = false;
        this.wave3EliteSpawned = false;
    }
    
    updatePlaying() {
        // Update stars
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));
        
        // Update player
        this.player.update(this.inputHandler, this.canvasHeight, this.canvasWidth);
        
        // Player shooting
        const spacePressed = this.inputHandler.isSpacePressed();
        const touchShoot = this.inputHandler.getTouchInput(this.canvasWidth, this.canvasHeight).shoot;
        const shootHeld = spacePressed || touchShoot;
        this.laserBeamRect = null;

        if (shootHeld && this.player.laserActive) {
            const beamX = this.player.x + this.player.width;
            const beamH = 12;
            this.laserBeamRect = {
                x: beamX,
                y: this.player.y - beamH / 2,
                width: this.canvasWidth - beamX,
                height: beamH
            };
        }
        
        if (shootHeld && this.player.canShoot()) {
            this.player.shoot();
            this.soundManager.shoot();
            const fireX = this.player.x + this.player.renderWidth / 2 - 4;
            
            // Laser weapon
            if (this.player.laserActive) {
                const bullet = new Bullet(fireX, this.player.y, this.assetManager, 'laser');
                bullet.width = 12;
                bullet.height = 6;
                this.bullets.push(bullet);
            }
            // Triple shot
            else if (this.player.tripleShotActive) {
                this.bullets.push(new Bullet(fireX, this.player.y - 8, this.assetManager, 'auto'));
                this.bullets.push(new Bullet(fireX, this.player.y, this.assetManager, 'zapper'));
                this.bullets.push(new Bullet(fireX, this.player.y + 8, this.assetManager, 'auto'));
            }
            // Dual shot
            else if (this.player.dualShotActive) {
                this.bullets.push(new Bullet(fireX, this.player.y - 5, this.assetManager, 'auto'));
                this.bullets.push(new Bullet(fireX, this.player.y + 5, this.assetManager, 'auto'));
            }
            // Single shot (default)
            else {
                const bullet = new Bullet(fireX, this.player.y, this.assetManager, 'zapper');
                this.bullets.push(bullet);
            }
        }
        
        // Update bullets
        this.bullets.forEach(bullet => bullet.update());
        this.bullets = this.bullets.filter(bullet => !bullet.isOffScreen(this.canvasWidth));
        
        // Spawn enemies - improved wave system
        this.spawnCounter++;
        const currentSpawnInterval = Math.max(15, this.baseSpawnInterval - this.level * 3 - this.wave * 2);
        
        if (this.spawnCounter > currentSpawnInterval && !this.bossActive && this.waveEnemiesSpawned < this.enemiesToSpawn) {
            this.spawnCounter = 0;
            const y = Math.random() * (this.canvasHeight - 60) + 30;
            const patterns = ['straight', 'zigzag', 'sine', 'kamikaze', 'wave', 'arc', 'dash'];
            let pattern = patterns[Math.floor(Math.random() * patterns.length)];
            const enemySprites = ['shipSlight', 'shipDamaged', 'shipVeryDamaged'];
            const classes = ['normal', 'sniper', 'charger', 'drifter'];
            let enemyClass = classes[Math.floor(Math.random() * classes.length)];
            const remainingToSpawn = this.enemiesToSpawn - this.waveEnemiesSpawned;

            // Guarantee one stronger elite during Wave 3 in story mode.
            if (
                this.gameMode === 'story' &&
                this.wave === 3 &&
                !this.wave3EliteSpawned &&
                (this.waveEnemiesSpawned >= Math.floor(this.enemiesToSpawn / 2) || remainingToSpawn === 1)
            ) {
                pattern = 'bossLike';
                enemyClass = 'eliteWave3';
                this.wave3EliteSpawned = true;
            }

            if (enemyClass !== 'eliteWave3' && pattern === 'wave' && this.waveEnemiesSpawned <= this.enemiesToSpawn - 3) {
                for (let i = 0; i < 3; i++) {
                    const spriteName = enemySprites[Math.floor(Math.random() * enemySprites.length)];
                    const groupClass = Math.random() < 0.5 ? 'normal' : 'drifter';
                    this.enemies.push(new Enemy(this.canvasWidth + i * 34, y + (i - 1) * 24, this.assetManager, spriteName, 'wave', this.player, i, groupClass));
                }
                this.waveEnemiesSpawned += 3;
            } else {
                const spriteName = enemySprites[Math.floor(Math.random() * enemySprites.length)];
                this.enemies.push(new Enemy(this.canvasWidth, y, this.assetManager, spriteName, pattern, this.player, 0, enemyClass));
                this.waveEnemiesSpawned++;
            }
            this.waveStarted = true;
        }
        
        // Check if wave is complete
        if (!this.bossActive && !this.boss && this.waveStarted && this.waveEnemiesSpawned >= this.enemiesToSpawn && this.enemies.length === 0) {
            if (this.gameMode === 'endless') {
                // Endless mode: boss every 10 waves
                if (this.wave % 10 === 0) {
                    this.gameState = 'bossWarn';
                    this.bossWarningTimer = 120;
                    return;
                } else {
                    // Next wave in endless
                    this.wave++;
                    this.calculateEnemiesToSpawn();
                }
            } else {
                // Story mode: fixed levels with waves
                if (this.wave >= this.wavesPerLevel) {
                    // Boss time!
                    if (this.level % this.bossLevelInterval === 0) {
                        // Every configured number of levels
                        this.gameState = 'bossWarn';
                        this.bossWarningTimer = 120;
                        return;
                    } else {
                        // Next level
                        this.gameState = 'levelUp';
                        return;
                    }
                } else {
                    // Next wave
                    this.wave++;
                    this.calculateEnemiesToSpawn();
                }
            }
        }
        
        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(this.player);
            
            // Enemy shooting - increases with level
            if (enemy.shouldShoot()) {
                const shotPattern = enemy.getShotPattern(this.player.x, this.player.y);
                shotPattern.forEach((shot) => {
                    this.enemyBullets.push(new EnemyBullet(
                        shot.x,
                        shot.y,
                        shot.targetX,
                        shot.targetY,
                        shot.speed,
                        shot.mode,
                        shot.bulletType,
                        this.assetManager
                    ));
                });
                enemy.resetShootCounter();
            }
        });
        
        this.enemies = this.enemies.filter(enemy => !enemy.isOffScreen(this.canvasWidth));
        
        // Update boss
        if (this.boss && this.bossActive) {
            this.boss.update();
            
            if (this.boss.shouldShoot()) {
                const bulletPatterns = this.boss.getBulletPattern(this.player.x, this.player.y);
                bulletPatterns.forEach(bp => {
                    this.enemyBullets.push(new EnemyBullet(bp.x, bp.y, bp.targetX, bp.targetY, 2.6, 'aimed', 'standard', this.assetManager));
                });
                this.boss.resetShootCounter();
            }
            
            if (this.boss.isOffScreen(this.canvasWidth)) {
                this.bossActive = false;
                this.boss = null;
            }
        }
        
        // Update enemy bullets
        this.enemyBullets.forEach(bullet => bullet.update());
        this.enemyBullets = this.enemyBullets.filter(
            bullet => !bullet.isOffScreen(this.canvasWidth, this.canvasHeight)
        );
        
        // Update explosions
        this.explosions.forEach(exp => exp.update());
        this.explosions = this.explosions.filter(exp => exp.isAlive());
        
        // Update power-ups
        this.powerUps.forEach(pu => pu.update());
        this.powerUps = this.powerUps.filter(pu => !pu.isOffScreen(this.canvasWidth, this.canvasHeight));
        
        // Collision detection: Bullets vs Enemy Bullets (destroy both)
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.enemyBullets.length - 1; j >= 0; j--) {
                if (this.checkCollision(this.bullets[i], this.enemyBullets[j])) {
                    this.explosions.push(new Explosion(this.bullets[i].x, this.bullets[i].y, 4));
                    this.soundManager.explosion();
                    this.score += 1;
                    this.bullets.splice(i, 1);
                    this.enemyBullets.splice(j, 1);
                    break;
                }
            }
        }
        
        // Collision detection: Bullets vs Enemies
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.enemies.length - 1; j >= 0; j--) {
                if (this.checkCollision(this.bullets[i], this.enemies[j])) {
                    const enemyX = this.enemies[j].x;
                    const enemyY = this.enemies[j].y;
                    this.explosions.push(new Explosion(enemyX, enemyY));
                    this.soundManager.explosion();
                    
                    this.enemies.splice(j, 1);
                    this.bullets.splice(i, 1);
                    this.score += 10;

                    if (Math.random() < 0.3) {
                        const lootTypes = ['rapid-fire', 'shield', 'life', 'laser'];
                        const lootType = lootTypes[Math.floor(Math.random() * lootTypes.length)];
                        this.powerUps.push(new PowerUp(enemyX, enemyY, lootType));
                    }
                    break;
                }
            }
        }

        // Collision detection: Enemy Bullets vs Laser Lane while firing laser
        if (this.laserBeamRect) {
            for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
                const b = this.enemyBullets[i];
                const bx = b.x - b.width / 2;
                const by = b.y - b.height / 2;
                if (
                    this.laserBeamRect.x < bx + b.width &&
                    this.laserBeamRect.x + this.laserBeamRect.width > bx &&
                    this.laserBeamRect.y < by + b.height &&
                    this.laserBeamRect.y + this.laserBeamRect.height > by
                ) {
                    this.enemyBullets.splice(i, 1);
                }
            }
        }
        
        // Collision detection: Bullets vs Boss
        if (this.boss && this.bossActive) {
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                if (this.checkCollisionCircle(this.bullets[i].x, this.bullets[i].y, 2, this.boss.x, this.boss.y, 40)) {
                    this.boss.takeDamage(5);
                    this.explosions.push(new Explosion(this.bullets[i].x, this.bullets[i].y, 8));
                    this.bullets.splice(i, 1);
                    
                    if (!this.boss.isAlive()) {
                        this.explosions.push(new Explosion(this.boss.x, this.boss.y, 30));
                        this.soundManager.explosion();
                        this.score += 500;
                        this.bossActive = false;
                        this.boss = null;
                        
                        if (this.gameMode === 'endless') {
                            // In endless, just move to next wave after boss
                            this.wave++;
                            this.calculateEnemiesToSpawn();
                            this.gameState = 'playing';
                        } else {
                            // In story mode, show level up
                            this.gameState = 'levelUp';
                        }
                    }
                    break;
                }
            }
        }
        
        // Collision detection: Enemy Bullets vs Player
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            if (this.checkCollision(this.enemyBullets[i], this.player)) {
                if (this.player.takeDamage()) {
                    this.explosions.push(new Explosion(this.player.x, this.player.y));
                    this.soundManager.explosion();
                }
                this.enemyBullets.splice(i, 1);
            }
        }
        
        // Collision detection: Enemies vs Player
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.checkCollision(this.enemies[i], this.player)) {
                if (this.player.takeDamage()) {
                    this.explosions.push(new Explosion(this.player.x, this.player.y));
                    this.soundManager.explosion();
                }
                this.enemies.splice(i, 1);
            }
        }
        
        // Collision detection: Boss vs Player
        if (this.boss && this.bossActive) {
            if (this.checkCollisionCircle(this.boss.x, this.boss.y, 40, this.player.x, this.player.y, 16)) {
                if (this.player.takeDamage()) {
                    this.explosions.push(new Explosion(this.player.x, this.player.y));
                    this.soundManager.explosion();
                }
            }
        }
        
        // Collision detection: Power-ups vs Player
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            if (this.checkCollision(this.powerUps[i], this.player)) {
                const pu = this.powerUps[i];
                
                if (pu.type === 'rapid-fire') {
                    this.player.activateRapidFire(300);
                } else if (pu.type === 'shield') {
                    this.player.activateShield(300);
                } else if (pu.type === 'life') {
                    this.player.lives++;
                } else if (pu.type === 'dual-shot') {
                    this.player.activateDualShot(400);
                } else if (pu.type === 'triple-shot') {
                    this.player.activateTripleShot(400);
                } else if (pu.type === 'laser') {
                    this.player.activateLaser(400);
                }
                
                this.soundManager.powerup();
                this.powerUps.splice(i, 1);
            }
        }
        
        // Check game over
        if (!this.player.isAlive()) {
            this.gameState = 'gameOver';
        }
        
        // Screen shake
        if (this.screenShake > 0) this.screenShake--;
    }
    
    updateLevelUp() {
        // Update stars
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));
        
        // Progress level/wave
        if (this.gameMode === 'endless') {
            // In endless mode, just continue waves
            this.wave++;
            this.calculateEnemiesToSpawn();
        } else {
            // In story mode, progress to next level
            this.level++;
            this.wave = 1;
            this.calculateEnemiesToSpawn();
        }
        this.gameState = 'playing';
    }
    
    updateBossWarn() {
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));
        
        this.bossWarningTimer--;
        
        if (this.bossWarningTimer <= 0) {
            let bossLevel = 1;
            if (this.gameMode === 'endless') {
                bossLevel = Math.max(1, Math.floor(this.wave / 10));
            } else {
                bossLevel = this.level;
            }
            this.boss = new Boss(this.canvasWidth + 100, this.canvasHeight / 2, bossLevel, this.assetManager);
            this.bossActive = true;
            this.gameState = 'playing';
            this.spawnCounter = 0;
            this.enemies = []; // Clear enemies during boss fight
            this.enemyBullets = []; // Clear enemy bullets
        }
    }
    
    updateGameOver() {
        this.stars.forEach(star => star.update());
        this.stars = this.stars.filter(star => !star.isOffScreen(this.canvasWidth));
        this.stars.push(new Star(this.canvasWidth, Math.random() * this.canvasHeight));

        const pressedButton = this.inputHandler.consumeTapInRect(this.gameOverButtonRect);
        if ((this.inputHandler.isEnterPressed() || pressedButton) && !this.enterKeyPressed) {
            this.enterKeyPressed = true;
            this.gameState = 'start';
            this.level = 1;
            this.wave = 1;
        }

        if (!this.inputHandler.isEnterPressed() && !pressedButton) {
            this.enterKeyPressed = false;
        }
    }
    
    checkCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const minDistance = (obj1.width + obj2.width) / 2;
        return distance < minDistance;
    }
    
    checkCollisionCircle(x1, y1, r1, x2, y2, r2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < r1 + r2;
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Apply screen shake
        if (this.screenShake > 0) {
            this.ctx.translate(
                (Math.random() - 0.5) * this.screenShake,
                (Math.random() - 0.5) * this.screenShake
            );
        }
        
        // Draw stars
        this.stars.forEach(star => star.draw(this.ctx));
        
        // Draw game objects based on state
        if (this.gameState === 'loading') {
            this.drawLoading();
        } else if (this.gameState === 'start') {
            this.drawStartScreen();
        } else if (this.gameState === 'modeSelect') {
            this.drawModeSelect();
        } else if (this.gameState === 'playing') {
            this.drawGameplay();
        } else if (this.gameState === 'bossWarn') {
            this.drawBossWarning();
            this.drawHUD();
        } else if (this.gameState === 'levelUp') {
            this.drawLevelUp();
        } else if (this.gameState === 'gameOver') {
            this.drawGameOverScreen();
        }

        this.drawCredit();
    }

    drawCredit() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.85;
        this.ctx.fillStyle = '#9be8ff';
        const compact = this.canvasHeight < 360;
        this.ctx.font = `bold ${compact ? 11 : 14}px Arial`;
        this.ctx.textAlign = 'right';
        const creditY = compact && this.gameState !== 'playing' ? 18 : this.canvasHeight - 12;
        this.ctx.fillText('Made by BRYLE', this.canvasWidth - 12, creditY);
        this.ctx.restore();
    }
    
    drawLoading() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = 'bold 40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading Assets...', this.canvasWidth / 2, this.canvasHeight / 2);
        
        this.ctx.font = '20px Arial';
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText(`${this.assetManager.loadedCount}/${this.assetManager.totalCount}`, this.canvasWidth / 2, this.canvasHeight / 2 + 50);
    }
    
    drawStartScreen() {
        // Fade overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        const compact = this.canvasHeight < 380;
        const titleSize = Math.max(34, Math.min(60, Math.floor(this.canvasHeight * 0.14)));
        const subtitleSize = Math.max(18, Math.min(36, Math.floor(this.canvasHeight * 0.07)));
        const infoSize = compact ? 14 : 18;
        const titleY = Math.max(76, Math.floor(this.canvasHeight * 0.24));
        const subtitleY = titleY + Math.max(36, Math.floor(this.canvasHeight * 0.14));
        const instructionY = subtitleY + Math.max(34, Math.floor(this.canvasHeight * 0.12));
        const btnWidth = Math.min(300, Math.max(190, Math.floor(this.canvasWidth * 0.72)));
        const btnHeight = compact ? 46 : 52;
        const btnX = this.canvasWidth / 2 - btnWidth / 2;
        const btnY = this.canvasHeight - btnHeight - Math.max(14, Math.floor(this.canvasHeight * 0.07));
        this.startButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
        
        // Title
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = `bold ${titleSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPACE IMPACT', this.canvasWidth / 2, titleY);
        
        // Subtitle
        this.ctx.font = `bold ${subtitleSize}px Arial`;
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText('With Foozle Asset Pack', this.canvasWidth / 2, subtitleY);
        
        // Instructions
        this.ctx.font = `${infoSize}px Arial`;
        this.ctx.fillStyle = '#ffffff';
        if (compact) {
            this.ctx.fillText('Move with touch joystick, hold FIRE to shoot', this.canvasWidth / 2, instructionY);
        } else {
            this.ctx.fillText('Arrow Keys: Move | Space: Shoot', this.canvasWidth / 2, instructionY);
            this.ctx.fillText('Mobile: Touch Left to Move, Right to Shoot', this.canvasWidth / 2, instructionY + 40);
        }
        
        // Start instruction
        this.ctx.font = `bold ${compact ? 17 : 24}px Arial`;
        this.ctx.fillStyle = '#ffff00';
        const blinkAlpha = (Math.sin(Date.now() / 200) + 1) / 2;
        this.ctx.globalAlpha = 0.5 + blinkAlpha * 0.5;
        this.ctx.fillText('Press ENTER to Continue', this.canvasWidth / 2, btnY - 12);
        this.ctx.globalAlpha = 1;

        this.ctx.fillStyle = 'rgba(0, 220, 120, 0.22)';
        this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
        this.ctx.strokeStyle = '#7cffbf';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

        this.ctx.fillStyle = '#d7ffe8';
        this.ctx.font = `bold ${compact ? 18 : 22}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('ENTER GAME', btnX + btnWidth / 2, btnY + (compact ? 30 : 34));
    }
    
    drawModeSelect() {
        // Fade overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        const compact = this.canvasHeight < 420;
        const titleSize = compact ? 34 : 50;
        const headingSize = compact ? 24 : 32;
        const bodySize = compact ? 14 : 18;
        const titleY = Math.max(62, Math.floor(this.canvasHeight * 0.19));
        const storyY = Math.floor(this.canvasHeight * 0.39);
        const endlessY = Math.floor(this.canvasHeight * 0.67);
        const btnWidth = Math.min(320, Math.max(210, Math.floor(this.canvasWidth * 0.78)));
        const btnHeight = compact ? 44 : 48;
        const storyBtnX = this.canvasWidth / 2 - btnWidth / 2;
        const storyBtnY = storyY - Math.floor(btnHeight * 0.65);
        const endlessBtnX = this.canvasWidth / 2 - btnWidth / 2;
        const endlessBtnY = endlessY - Math.floor(btnHeight * 0.65);

        this.modeStoryButtonRect = { x: storyBtnX, y: storyBtnY, width: btnWidth, height: btnHeight };
        this.modeEndlessButtonRect = { x: endlessBtnX, y: endlessBtnY, width: btnWidth, height: btnHeight };
        
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = `bold ${titleSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SELECT MODE', this.canvasWidth / 2, titleY);
        
        // Story mode
        this.ctx.font = `bold ${headingSize}px Arial`;
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText('1. STORY', this.canvasWidth / 2, storyY);
        this.ctx.font = `${bodySize}px Arial`;
        this.ctx.fillStyle = '#ffffff';
        if (compact) {
            this.ctx.fillText('Campaign progression with boss fights', this.canvasWidth / 2, storyY + 28);
        } else {
            this.ctx.fillText('10 Levels with 3 Waves Each + Boss Every 10 Levels', this.canvasWidth / 2, storyY + 40);
        }
        
        // Endless mode
        this.ctx.font = `bold ${headingSize}px Arial`;
        this.ctx.fillStyle = '#ffff00';
        this.ctx.fillText('2. ENDLESS', this.canvasWidth / 2, endlessY);
        this.ctx.font = `${bodySize}px Arial`;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('Infinite waves with scaling difficulty', this.canvasWidth / 2, endlessY + (compact ? 26 : 40));

        this.ctx.fillStyle = 'rgba(0, 190, 255, 0.16)';
        this.ctx.fillRect(storyBtnX, storyBtnY, btnWidth, btnHeight);
        this.ctx.strokeStyle = '#5cd2ff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(storyBtnX, storyBtnY, btnWidth, btnHeight);

        this.ctx.fillStyle = 'rgba(255, 220, 0, 0.14)';
        this.ctx.fillRect(endlessBtnX, endlessBtnY, btnWidth, btnHeight);
        this.ctx.strokeStyle = '#ffe072';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(endlessBtnX, endlessBtnY, btnWidth, btnHeight);
    }
    
    drawGameplay() {
        this.player.draw(this.ctx);
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.enemyBullets.forEach(bullet => bullet.draw(this.ctx));
        this.explosions.forEach(exp => exp.draw(this.ctx));
        this.powerUps.forEach(pu => pu.draw(this.ctx));
        
        if (this.boss && this.bossActive) {
            this.boss.draw(this.ctx);
            this.drawBossHealthBar();
        }

        this.inputHandler.drawMobileControls(this.ctx);
        
        this.drawHUD();
    }
    
    drawBossWarning() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        const blinkAlpha = Math.sin(this.bossWarningTimer / 30) * 0.5 + 0.5;
        this.ctx.globalAlpha = blinkAlpha;
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 80px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.bossWarningText, this.canvasWidth / 2, this.canvasHeight / 2);
        
        this.ctx.globalAlpha = 1;
    }
    
    drawGameOverScreen() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        const compact = this.canvasHeight < 420;
        const titleSize = compact ? 40 : 60;
        const mainSize = compact ? 24 : 40;
        const noteSize = compact ? 16 : 24;
        const titleY = Math.max(68, Math.floor(this.canvasHeight * 0.24));
        const scoreY = titleY + Math.max(46, Math.floor(this.canvasHeight * 0.17));
        const levelY = scoreY + Math.max(34, Math.floor(this.canvasHeight * 0.14));
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = `bold ${titleSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvasWidth / 2, titleY);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${mainSize}px Arial`;
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvasWidth / 2, scoreY);
        this.ctx.fillText(`Level Reached: ${this.level}`, this.canvasWidth / 2, levelY);
        
        if (this.gameMode === 'endless') {
            this.ctx.font = `${Math.max(20, mainSize - 8)}px Arial`;
            this.ctx.fillText(`Waves Cleared: ${this.wave}`, this.canvasWidth / 2, levelY + Math.max(30, Math.floor(this.canvasHeight * 0.1)));
        }
        
        const btnWidth = Math.min(290, Math.max(200, Math.floor(this.canvasWidth * 0.72)));
        const btnHeight = compact ? 46 : 52;
        const btnX = this.canvasWidth / 2 - btnWidth / 2;
        const btnY = this.canvasHeight - btnHeight - Math.max(14, Math.floor(this.canvasHeight * 0.08));
        this.gameOverButtonRect = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };

        this.ctx.font = `bold ${noteSize}px Arial`;
        this.ctx.fillStyle = '#ffff00';
        const blinkAlpha = (Math.sin(Date.now() / 200) + 1) / 2;
        this.ctx.globalAlpha = 0.5 + blinkAlpha * 0.5;
        this.ctx.fillText('Press ENTER to Return to Menu', this.canvasWidth / 2, btnY - 10);
        this.ctx.globalAlpha = 1;

        this.ctx.fillStyle = 'rgba(0, 220, 120, 0.22)';
        this.ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
        this.ctx.strokeStyle = '#7cffbf';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);

        this.ctx.fillStyle = '#d7ffe8';
        this.ctx.font = `bold ${compact ? 18 : 22}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('RETURN MENU', btnX + btnWidth / 2, btnY + (compact ? 30 : 33));
    }
    
    drawHUD() {
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        
        // Score
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        
        // Lives
        this.ctx.fillText(`Lives: ${this.player.lives}`, 20, 60);
        
        // Level and Wave
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText(`Level: ${this.level} | Wave: ${this.wave}/${this.wavesPerLevel}`, 20, 90);
        
        // Power-up status
        let powerUpText = '';
        let powerUpColor = '#ffff00';
        
        if (this.player.laserActive) {
            powerUpText = `LASER: ${this.player.laserDuration}`;
            powerUpColor = '#ff00ff';
        } else if (this.player.tripleShotActive) {
            powerUpText = `TRIPLE SHOT: ${this.player.tripleShotDuration}`;
            powerUpColor = '#ff3300';
        } else if (this.player.dualShotActive) {
            powerUpText = `DUAL SHOT: ${this.player.dualShotDuration}`;
            powerUpColor = '#ff6600';
        } else if (this.player.rapidFireActive) {
            powerUpText = `Rapid Fire: ${this.player.rapidFireDuration}`;
        } else if (this.player.shield > 0) {
            powerUpText = `Shield: ${this.player.shield}`;
            powerUpColor = '#00ffff';
        }
        
        if (powerUpText) {
            this.ctx.fillStyle = powerUpColor;
            this.ctx.fillText(powerUpText, 20, 120);
        }
        
        // Boss health bar
        // (drawn separately in drawBossHealthBar)
    }
    
    drawLevelUp() {
        // Fade overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Level up message
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = 'bold 50px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEVEL UP!', this.canvasWidth / 2, 150);
        
        this.ctx.font = '36px Arial';
        this.ctx.fillStyle = '#00ccff';
        this.ctx.fillText(`Level ${this.level}`, this.canvasWidth / 2, 250);
        
        // Auto advance
        if (this.frameCount > 60) {
            this.gameState = 'playing';
            this.frameCount = 0;
        }
    }
    
    drawBossHealthBar() {
        const barWidth = 200;
        const barHeight = 20;
        const x = this.canvasWidth / 2 - barWidth / 2;
        const y = 30;
        
        // Background
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthPercent = Math.max(0, this.boss.health / this.boss.maxHealth);
        const healthColor = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        
        this.ctx.fillStyle = healthColor;
        this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
        
        // Border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`BOSS: ${Math.ceil(this.boss.health)}/${this.boss.maxHealth}`, this.canvasWidth / 2, y + 16);
    }
    
    run() {
        const gameLoop = () => {
            this.frameCount++;
            this.update();
            this.draw();
            requestAnimationFrame(gameLoop);
        };
        
        gameLoop();
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game('gameCanvas');
    game.run();
});
