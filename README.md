# Space Impact - Complete 2D Side-Scrolling Shooter

A production-quality space shooter game built with HTML5 Canvas and vanilla JavaScript.

## Quick Start

1. Open `index.html` in any modern web browser
2. Press **ENTER** to start the game
3. Use **Arrow Keys** to move and **Space** to shoot
4. On mobile: Touch left side to move, right side to shoot

## Game Features

### Core Mechanics
- **Player Ship**: Green ship that moves up/down and shoots projectiles
- **Enemies**: Orange enemy ships spawn from the right, shooting at the player
- **Boss Fight**: At score 50, a powerful red boss appears with multiple attack patterns
- **Lives System**: Start with 3 lives, lose one if hit by enemy fire or collision
- **Scoring**: +10 points per enemy, +500 points for boss defeat

### Power-Ups (20% drop rate from enemies)
- **Rapid Fire**: Increased shooting speed (yellow square)
- **Shield**: Temporary invincibility (cyan circle)
- **Extra Life**: Gain one additional life (pink heart)

### Visual Effects
- **Scrolling Starfield**: Parallax background with 100+ stars
- **Explosions**: Particle effects when enemies are destroyed
- **Screen Shake**: Visual feedback for impacts
- **Invulnerability Flicker**: Player flashes when temporarily invulnerable
- **Boss Health Bar**: Real-time health display during boss fight

### Game States
- **Start Screen**: Instructions and welcome screen
- **Boss Warning**: "BOSS INCOMING!" alert when score reaches 50
- **Gameplay**: Active combat with HUD
- **Game Over**: Final score and restart option

### Mobile Support
- Touch controls for left/right halves of screen
- Responsive canvas sizing on smaller devices
- Full touch gesture support

### Audio
- Synthesized sound effects via Web Audio API:
  - Shoot: Decreasing pitch beep
  - Explosion: Low-frequency burst
  - Power-up: Rising tone effect
- All sounds are fallback-compatible

### HUD Display
- Score counter (top-left)
- Lives remaining (top-left)
- Active power-up timer (top-left)
- Boss health bar (top-center, when boss is active)

## Game Architecture

### Class Structure
```
Game (Main engine)
├── Player (Player ship with shield/invulnerability)
├── Enemy (Basic enemy ships)
├── Boss (Heavy enemy with health & attack patterns)
├── Bullet (Player projectiles)
├── EnemyBullet (Enemy projectiles)
├── Explosion (Particle effects)
├── PowerUp (Collectable items)
├── Star (Background element)
├── InputHandler (Keyboard & touch input)
└── SoundManager (Audio playback)
```

### Key Methods
- `update()`: Position/state updates, collision checks
- `draw(ctx)`: Canvas rendering
- `checkCollision()`: Bounding box collision detection
- `checkCollisionCircle()`: Circle-based collision for boss

## Performance Optimizations
- Off-screen object culling (bullets, enemies, stars, power-ups)
- Efficient array filtering
- Canvas transformation state management
- No memory leaks (proper object cleanup)
- 60 FPS target with requestAnimationFrame

## Game Balance
- Enemy spawn rate increases with score multiplier
- Boss appears at 50+ points with 50 HP
- Rapid fire cooldown: 5 frames (vs normal 10)
- Shield lasts ~5 seconds
- Invulnerability on hit: ~2 seconds
- Enemy shoot interval: 60-100 frames

## Browser Support
- All modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires ES6 support (Classes, Arrow functions)
- Web Audio API optional (graceful fallback)

## Keyboard Controls
- **Arrow Up**: Move up
- **Arrow Down**: Move down
- **Space**: Shoot
- **Enter**: Start game / Return to menu

## Touch Controls
- **Left side drag**: Move up/down
- **Right side touch**: Shoot continuously

## File Structure
```
Space Impact/
├── index.html        (Entry point)
├── style.css         (Styling & responsive design)
└── game.js           (Complete game implementation)
```

## Code Quality
- Clean, modular OOP design
- Comprehensive comments throughout
- No external dependencies
- Single-file implementation
- Production-ready error handling
- Proper collision detection
- Scalable architecture

## Future Enhancement Ideas
- Level progression system
- Multiple boss types
- Weapon variety
- Leaderboard system
- Particle effects for power-ups
- Menu system for settings
- Difficulty levels
- Tutorial mode

## License
Free to use and modify for personal and educational purposes.

---

**Enjoy the game!** 🎮
