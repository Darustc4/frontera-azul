/**
 * La Frontera Azul - Game Engine (v2)
 * Large lake world with boat-centric scrolling viewport.
 * Irregular coastline, 2 fixed ports, randomized fish/reefs.
 * Scanner returns data RELATIVE to boat heading.
 */

class GameWorld {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // World dimensions
        this.worldW = 60;
        this.worldH = 60;

        // Viewport (odd so boat is exactly centered)
        this.viewSize = 21;
        this.tileSize = Math.floor(canvas.width / this.viewSize);

        // Cell types
        this.LAND = 0;
        this.WATER = 1;
        this.PORT = 2;
        this.FISH = 3;
        this.REEF = 4;

        // Fixed port locations
        this.ports = [
            { id: 1, x: 18, y: 14, name: "Puerto Norte" },
            { id: 2, x: 42, y: 46, name: "Puerto Sur" }
        ];

        // Boat state
        this.boat = {
            x: 30, y: 30,
            direction: 0, // 0=N, 1=E, 2=S, 3=W
            fuel: 100,
            maxFuel: 100,
            cargo: 0,
            maxCargo: 5,
            trail: [],
            collectedZones: new Set()
        };

        // Generate fixed lake shape
        this.lakeMap = this.generateLake();
        // Working map (reefs/fish added per mission)
        this.map = this.lakeMap.map(row => [...row]);

        // Fog of war
        this.fog = false;
        this.revealed = new Set();

        // Animation
        this.animating = false;
        this.stopped = false;
        this.animSpeed = 180;
        this.waterTime = 0;

        this.startWaterAnimation();
    }

    // ==================== LAKE GENERATION ====================

    generateLake() {
        const W = this.worldW, H = this.worldH;
        const map = Array(H).fill(null).map(() => Array(W).fill(this.LAND));
        const cx = W / 2, cy = H / 2;

        // Seeded PRNG for reproducible lake
        const rng = this.mulberry32(42);

        // Harmonic coefficients for irregular shore
        const harmonics = [];
        for (let i = 0; i < 8; i++) {
            harmonics.push({
                amp: 2 + rng() * 4,
                freq: 2 + Math.floor(rng() * 6),
                phase: rng() * Math.PI * 2
            });
        }

        const baseRadius = 22;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const dx = x - cx, dy = y - cy;
                const angle = Math.atan2(dy, dx);
                let boundaryR = baseRadius;
                for (const h of harmonics) {
                    boundaryR += h.amp * Math.sin(angle * h.freq + h.phase);
                }
                // Slight elongation on x-axis for variety
                const dist = Math.sqrt((dx * 0.92) ** 2 + dy ** 2);
                if (dist < boundaryR) {
                    map[y][x] = this.WATER;
                }
            }
        }

        // Place ports — ensure they're on water, nudge if needed
        for (const port of this.ports) {
            this.ensureWaterCell(map, port, cx, cy);
            map[port.y][port.x] = this.PORT;
            // Make a 2-cell dock
            const adj = this.findAdjacentOfType(map, port.x, port.y, this.WATER);
            if (adj) map[adj.y][adj.x] = this.PORT;
        }

        return map;
    }

    ensureWaterCell(map, port, cx, cy) {
        if (map[port.y] && map[port.y][port.x] === this.WATER) return;
        const dx = cx - port.x, dy = cy - port.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        for (let i = 1; i < 20; i++) {
            const px = Math.round(port.x + (dx / len) * i);
            const py = Math.round(port.y + (dy / len) * i);
            if (px >= 0 && px < this.worldW && py >= 0 && py < this.worldH && map[py][px] === this.WATER) {
                port.x = px; port.y = py; return;
            }
        }
    }

    findAdjacentOfType(map, x, y, type) {
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < this.worldW && ny >= 0 && ny < this.worldH && map[ny][nx] === type)
                return { x: nx, y: ny };
        }
        return null;
    }

    mulberry32(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ==================== MAP SETUP PER MISSION ====================

    resetMap() {
        this.map = this.lakeMap.map(row => [...row]);
    }

    addRandomReefs(count, avoid = []) {
        const avoidSet = new Set();
        avoid.forEach(p => {
            for (let dy = -3; dy <= 3; dy++)
                for (let dx = -3; dx <= 3; dx++)
                    avoidSet.add(`${p.x + dx},${p.y + dy}`);
        });
        this.ports.forEach(p => {
            for (let dy = -2; dy <= 2; dy++)
                for (let dx = -2; dx <= 2; dx++)
                    avoidSet.add(`${p.x + dx},${p.y + dy}`);
        });

        let placed = 0, attempts = 0;
        while (placed < count && attempts < 3000) {
            const x = Math.floor(Math.random() * this.worldW);
            const y = Math.floor(Math.random() * this.worldH);
            if (this.map[y][x] === this.WATER && !avoidSet.has(`${x},${y}`)) {
                this.map[y][x] = this.REEF;
                placed++;
            }
            attempts++;
        }
    }

    addFixedReefs(reefs) {
        for (const r of reefs) {
            if (r.x >= 0 && r.x < this.worldW && r.y >= 0 && r.y < this.worldH)
                this.map[r.y][r.x] = this.REEF;
        }
    }

    addRandomFish(count, avoid = []) {
        const avoidSet = new Set();
        avoid.forEach(p => {
            for (let dy = -2; dy <= 2; dy++)
                for (let dx = -2; dx <= 2; dx++)
                    avoidSet.add(`${p.x + dx},${p.y + dy}`);
        });
        this.ports.forEach(p => avoidSet.add(`${p.x},${p.y}`));

        let placed = 0, attempts = 0;
        while (placed < count && attempts < 3000) {
            const x = Math.floor(Math.random() * this.worldW);
            const y = Math.floor(Math.random() * this.worldH);
            if (this.map[y][x] === this.WATER && !avoidSet.has(`${x},${y}`)) {
                this.map[y][x] = this.FISH;
                placed++;
            }
            attempts++;
        }
    }

    // ==================== BOAT STATE ====================

    reset(pos, dir, fuel) {
        this.boat.x = pos ? pos.x : 30;
        this.boat.y = pos ? pos.y : 30;
        this.boat.direction = dir || 0;
        this.boat.fuel = fuel || 100;
        this.boat.maxFuel = fuel || 100;
        this.boat.cargo = 0;
        this.boat.trail = [];
        this.boat.collectedZones = new Set();
        this.animating = false;
        this.stopped = false;
        this.revealed = new Set();
        if (this.fog) this.revealAround(this.boat.x, this.boat.y);
        this.render();
    }

    setFog(enabled) {
        this.fog = enabled;
        this.revealed = new Set();
        if (enabled) this.revealAround(this.boat.x, this.boat.y);
        this.render();
    }

    revealAround(cx, cy) {
        for (let dy = -5; dy <= 5; dy++)
            for (let dx = -5; dx <= 5; dx++) {
                const x = cx + dx, y = cy + dy;
                if (x >= 0 && x < this.worldW && y >= 0 && y < this.worldH)
                    this.revealed.add(`${x},${y}`);
            }
    }

    isRevealed(x, y) {
        return !this.fog || this.revealed.has(`${x},${y}`);
    }

    // ==================== SENSORS (RELATIVE TO HEADING) ====================

    getCellType(x, y) {
        if (x < 0 || x >= this.worldW || y < 0 || y >= this.worldH) return "tierra";
        switch (this.map[y][x]) {
            case this.LAND: return "tierra";
            case this.WATER: return "agua";
            case this.PORT: return "puerto";
            case this.FISH: return "pesca";
            case this.REEF: return "arrecife";
            default: return "agua";
        }
    }

    /**
     * Convert relative coordinates (forward, right) to world (x, y).
     * forward > 0 = ahead, right > 0 = starboard.
     */
    relativeToWorld(forward, right) {
        const dir = this.boat.direction;
        let wx, wy;
        switch (dir) {
            case 0: wx = this.boat.x + right; wy = this.boat.y - forward; break; // N
            case 1: wx = this.boat.x + forward; wy = this.boat.y + right; break; // E
            case 2: wx = this.boat.x - right; wy = this.boat.y + forward; break; // S
            case 3: wx = this.boat.x - forward; wy = this.boat.y - right; break; // W
        }
        return [wx, wy];
    }

    /**
     * 5×5 scan matrix RELATIVE to boat heading.
     * Row 0 = 2 ahead, Row 2 = boat ([2][2]), Row 4 = 2 behind.
     * Col 0 = 2 port, Col 2 = center, Col 4 = 2 starboard.
     */
    scan() {
        const matrix = [];
        for (let row = 0; row < 5; row++) {
            const matRow = [];
            for (let col = 0; col < 5; col++) {
                const relForward = 2 - row;
                const relRight = col - 2;
                const [wx, wy] = this.relativeToWorld(relForward, relRight);
                matRow.push(this.getCellType(wx, wy));
            }
            matrix.push(matRow);
        }
        return matrix;
    }

    // Single-cell relative sensors
    sensorForward() { const [x, y] = this.relativeToWorld(1, 0); return this.getCellType(x, y); }
    sensorRight()   { const [x, y] = this.relativeToWorld(0, 1); return this.getCellType(x, y); }
    sensorLeft()    { const [x, y] = this.relativeToWorld(0, -1); return this.getCellType(x, y); }
    sensorBack()    { const [x, y] = this.relativeToWorld(-1, 0); return this.getCellType(x, y); }

    // ==================== PORT UTILITIES ====================

    nearestPort() {
        let minDist = Infinity, nearest = 1;
        for (const p of this.ports) {
            const d = Math.abs(p.x - this.boat.x) + Math.abs(p.y - this.boat.y);
            if (d < minDist) { minDist = d; nearest = p.id; }
        }
        return nearest;
    }

    distanceToPort(n) {
        const p = this.ports.find(p => p.id === n) || this.ports[0];
        return Math.abs(p.x - this.boat.x) + Math.abs(p.y - this.boat.y);
    }

    portX(n) { return (this.ports.find(p => p.id === n) || this.ports[0]).x; }
    portY(n) { return (this.ports.find(p => p.id === n) || this.ports[0]).y; }

    // ==================== MOVEMENT ====================

    getDirectionName() { return ['Norte', 'Este', 'Sur', 'Oeste'][this.boat.direction]; }

    getDirectionDelta(dir) {
        const d = dir !== undefined ? dir : this.boat.direction;
        return [[0, -1], [1, 0], [0, 1], [-1, 0]][d];
    }

    canMoveTo(x, y) {
        if (x < 0 || x >= this.worldW || y < 0 || y >= this.worldH)
            return { ok: false, reason: '¡Fuera del mundo!' };
        const cell = this.map[y][x];
        if (cell === this.LAND)
            return { ok: false, reason: `¡Tierra en (${x},${y})! No puedes navegar sobre tierra.` };
        if (cell === this.REEF)
            return { ok: false, reason: `¡Arrecife en (${x},${y})! Necesitas esquivarlo.` };
        return { ok: true };
    }

    collectCargo() {
        const cell = this.map[this.boat.y][this.boat.x];
        if (cell !== this.FISH) return { ok: false, reason: 'No hay pesca aquí.' };
        if (this.boat.cargo >= this.boat.maxCargo) return { ok: false, reason: 'Bodega llena.' };
        const key = `${this.boat.x},${this.boat.y}`;
        if (this.boat.collectedZones.has(key)) return { ok: false, reason: 'Ya recogiste aquí.' };
        this.boat.cargo++;
        this.boat.collectedZones.add(key);
        this.map[this.boat.y][this.boat.x] = this.WATER;
        return { ok: true };
    }

    stop() { this.stopped = true; }

    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    // ==================== VIEWPORT & RENDERING ====================

    startWaterAnimation() {
        const animate = () => {
            this.waterTime = Date.now() / 3000;
            if (!this.animating) this.render();
            setTimeout(() => requestAnimationFrame(animate), 900);
        };
        animate();
    }

    getViewport() {
        const half = Math.floor(this.viewSize / 2);
        return { startX: this.boat.x - half, startY: this.boat.y - half, size: this.viewSize };
    }

    render() {
        const ctx = this.ctx;
        const ts = this.tileSize;
        const vp = this.getViewport();
        const canvasUsed = this.viewSize * ts;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw tiles
        for (let vy = 0; vy < this.viewSize; vy++) {
            for (let vx = 0; vx < this.viewSize; vx++) {
                const wx = vp.startX + vx;
                const wy = vp.startY + vy;
                const px = vx * ts, py = vy * ts;

                if (wx < 0 || wx >= this.worldW || wy < 0 || wy >= this.worldH) {
                    this.drawLand(ctx, px, py, ts);
                    continue;
                }
                if (!this.isRevealed(wx, wy)) {
                    ctx.fillStyle = '#080e18';
                    ctx.fillRect(px, py, ts, ts);
                    continue;
                }

                const cell = this.map[wy][wx];
                switch (cell) {
                    case this.LAND: this.drawLand(ctx, px, py, ts); break;
                    case this.WATER: this.drawWaterTile(ctx, px, py, ts, wx, wy); break;
                    case this.PORT: this.drawPortTile(ctx, px, py, ts); break;
                    case this.FISH:
                        this.drawWaterTile(ctx, px, py, ts, wx, wy);
                        this.drawFishOverlay(ctx, px, py, ts);
                        break;
                    case this.REEF:
                        this.drawWaterTile(ctx, px, py, ts, wx, wy);
                        this.drawReefOverlay(ctx, px, py, ts);
                        break;
                }
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(27, 73, 101, 0.18)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.viewSize; i++) {
            ctx.beginPath(); ctx.moveTo(i * ts, 0); ctx.lineTo(i * ts, canvasUsed); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * ts); ctx.lineTo(canvasUsed, i * ts); ctx.stroke();
        }

        // Fog edge
        if (this.fog) this.drawFogEdge(ctx, ts, vp);

        // Trail
        this.drawTrail(ctx, ts, vp);

        // Port indicators (arrows at edges for off-screen ports)
        this.drawPortIndicators(ctx, ts, vp, canvasUsed);

        // Boat at center
        this.drawBoat(ctx, ts);

        // Compass
        this.drawCompass(ctx, canvasUsed);
    }

    drawLand(ctx, px, py, ts) {
        ctx.fillStyle = '#2a4a3a';
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = '#3a5c4a';
        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
    }

    drawWaterTile(ctx, px, py, ts, wx, wy) {
        const wave = Math.sin(wx * 0.4 + this.waterTime) * Math.cos(wy * 0.3 + this.waterTime * 0.7) * 5;
        ctx.fillStyle = `rgb(10, ${42 + wave}, ${72 + wave * 0.5})`;
        ctx.fillRect(px, py, ts, ts);
    }

    drawPortTile(ctx, px, py, ts) {
        ctx.fillStyle = '#5a4a2a';
        ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = '#7a6a4a';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            const ly = py + 4 + i * (ts - 8) / 2;
            ctx.beginPath(); ctx.moveTo(px + 3, ly); ctx.lineTo(px + ts - 3, ly); ctx.stroke();
        }
        ctx.fillStyle = '#c0a060';
        ctx.font = `${ts * 0.5}px serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚓', px + ts / 2, py + ts / 2);
    }

    drawFishOverlay(ctx, px, py, ts) {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.2)';
        ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);
        ctx.font = `${ts * 0.4}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐟', px + ts / 2, py + ts / 2);
    }

    drawReefOverlay(ctx, px, py, ts) {
        ctx.fillStyle = 'rgba(92, 64, 42, 0.7)';
        ctx.beginPath();
        ctx.arc(px + ts / 2, py + ts / 2, ts * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(231, 111, 81, 0.5)';
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(231, 111, 81, 0.7)';
        ctx.font = `${ts * 0.32}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('▲', px + ts / 2, py + ts / 2);
    }

    drawFogEdge(ctx, ts, vp) {
        for (let vy = 0; vy < this.viewSize; vy++) {
            for (let vx = 0; vx < this.viewSize; vx++) {
                const wx = vp.startX + vx, wy = vp.startY + vy;
                if (wx < 0 || wx >= this.worldW || wy < 0 || wy >= this.worldH) continue;
                if (this.isRevealed(wx, wy)) {
                    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
                        if (!this.isRevealed(wx + dx, wy + dy)) {
                            ctx.fillStyle = 'rgba(8, 14, 24, 0.3)';
                            ctx.fillRect(vx * ts, vy * ts, ts, ts);
                            break;
                        }
                    }
                }
            }
        }
    }

    drawTrail(ctx, ts, vp) {
        ctx.fillStyle = 'rgba(95, 168, 211, 0.3)';
        for (const t of this.boat.trail) {
            const sx = t.x - vp.startX, sy = t.y - vp.startY;
            if (sx >= 0 && sx < this.viewSize && sy >= 0 && sy < this.viewSize) {
                ctx.beginPath();
                ctx.arc(sx * ts + ts / 2, sy * ts + ts / 2, ts * 0.12, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawBoat(ctx, ts) {
        const half = Math.floor(this.viewSize / 2);
        const cx = half * ts + ts / 2;
        const cy = half * ts + ts / 2;
        const size = ts * 0.4;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][this.boat.direction]);

        ctx.fillStyle = '#e76f51';
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.6, size * 0.7);
        ctx.lineTo(-size * 0.6, size * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    drawPortIndicators(ctx, ts, vp, canvasUsed) {
        for (const port of this.ports) {
            const sx = port.x - vp.startX, sy = port.y - vp.startY;
            if (sx >= 0 && sx < this.viewSize && sy >= 0 && sy < this.viewSize) {
                if (this.isRevealed(port.x, port.y)) {
                    ctx.fillStyle = 'rgba(192, 160, 96, 0.85)';
                    ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(`P${port.id}`, sx * ts + ts / 2, sy * ts - 2);
                }
            } else {
                const dx = port.x - this.boat.x, dy = port.y - this.boat.y;
                const angle = Math.atan2(dy, dx);
                const margin = 18;
                const edgeX = Math.max(margin, Math.min(canvasUsed - margin, canvasUsed / 2 + Math.cos(angle) * (canvasUsed / 2 - margin)));
                const edgeY = Math.max(margin, Math.min(canvasUsed - margin, canvasUsed / 2 + Math.sin(angle) * (canvasUsed / 2 - margin)));

                ctx.save();
                ctx.translate(edgeX, edgeY);
                ctx.rotate(angle);
                ctx.fillStyle = 'rgba(192, 160, 96, 0.85)';
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
                ctx.rotate(-angle);
                ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(`P${port.id}`, 0, -10);
                ctx.restore();
            }
        }
    }

    drawCompass(ctx, canvasUsed) {
        const x = canvasUsed - 32, y = 32, r = 16;
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#0d1b2a';
        ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1b4965'; ctx.lineWidth = 1.5; ctx.stroke();

        ctx.fillStyle = '#e76f51'; ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('N', x, y - r + 4);
        ctx.fillStyle = '#5fa8d3'; ctx.font = '8px sans-serif';
        ctx.fillText('S', x, y + r - 3);
        ctx.fillText('E', x + r - 3, y);
        ctx.fillText('O', x - r + 3, y);

        // Heading dot
        ctx.fillStyle = '#e76f51';
        const dirAngle = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][this.boat.direction];
        ctx.beginPath();
        ctx.arc(x + Math.cos(dirAngle) * (r - 6), y + Math.sin(dirAngle) * (r - 6), 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Returns sensor grid for the UI panel (5×5 relative to heading).
     */
    getSensorGrid() {
        const grid = [];
        for (let row = 0; row < 5; row++) {
            const rowData = [];
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) { rowData.push({ type: 'boat' }); continue; }
                const relForward = 2 - row, relRight = col - 2;
                const [wx, wy] = this.relativeToWorld(relForward, relRight);
                rowData.push({ type: this.getCellType(wx, wy) });
            }
            grid.push(rowData);
        }
        return grid;
    }
}
