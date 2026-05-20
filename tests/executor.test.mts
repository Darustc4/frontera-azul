/**
 * Integration tests for PythonExecutor using real Pyodide in Node.js.
 * Run directly: pnpm test:executor
 *
 * This runs as a plain Node script because Pyodide WASM is incompatible
 * with vitest's worker isolation (forks/threads both hang).
 */
import { loadPyodide } from 'pyodide';

// ============================================================
// Minimal test runner
// ============================================================

let passed = 0, failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertEqual(actual: any, expected: any, msg = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${msg}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
    }
}

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (e: any) {
        failed++;
        const msg = `  ✗ ${name}: ${e.message}`;
        console.log(msg);
        failures.push(msg);
    }
}

// ============================================================
// Mock GameWorld (minimal implementation matching real game)
// ============================================================

class MockGameWorld {
    worldW = 60;
    worldH = 60;
    LAND = 0; WATER = 1; PORT = 2; FISH = 3; REEF = 4;

    ports = [
        { id: 1, x: 18, y: 14, name: "Puerto Norte" },
        { id: 2, x: 42, y: 46, name: "Puerto Sur" },
    ];

    boat = {
        x: 30, y: 30, direction: 0,
        fuel: 100, maxFuel: 100,
        cargo: 0, maxCargo: 5,
        trail: [] as { x: number; y: number }[],
        collectedZones: new Set<string>(),
    };

    map: number[][];

    constructor() {
        // Simple map: water everywhere except edges
        this.map = Array(60).fill(null).map((_, y) =>
            Array(60).fill(null).map((_, x) =>
                (x <= 1 || x >= 58 || y <= 1 || y >= 58) ? this.LAND : this.WATER
            )
        );
        // Place ports
        this.map[14][18] = this.PORT;
        this.map[46][42] = this.PORT;
    }

    reset(pos?: { x: number; y: number }, dir?: number, fuel?: number) {
        this.boat.x = pos?.x ?? 30;
        this.boat.y = pos?.y ?? 30;
        this.boat.direction = dir ?? 0;
        this.boat.fuel = fuel ?? 100;
        this.boat.maxFuel = fuel ?? 100;
        this.boat.cargo = 0;
        this.boat.trail = [];
        this.boat.collectedZones = new Set();
    }

    resetMap() {
        this.map = Array(60).fill(null).map((_, y) =>
            Array(60).fill(null).map((_, x) =>
                (x <= 1 || x >= 58 || y <= 1 || y >= 58) ? this.LAND : this.WATER
            )
        );
        this.map[14][18] = this.PORT;
        this.map[46][42] = this.PORT;
    }

    getDirectionDelta(dir: number): [number, number] {
        return ([[0, -1], [1, 0], [0, 1], [-1, 0]] as [number, number][])[dir];
    }

    getCellType(x: number, y: number): string {
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

    canMoveTo(x: number, y: number): { ok: boolean; reason?: string } {
        if (x < 0 || x >= this.worldW || y < 0 || y >= this.worldH)
            return { ok: false, reason: '¡Fuera del mundo!' };
        const cell = this.map[y][x];
        if (cell === this.LAND)
            return { ok: false, reason: `¡Tierra en (${x},${y})!` };
        if (cell === this.REEF)
            return { ok: false, reason: `¡Arrecife en (${x},${y})!` };
        return { ok: true };
    }

    revealAround(_x: number, _y: number) {}

    render() {}
}

// ============================================================
// Executor harness - embeds the same Python bridge logic
// ============================================================

interface ExecutorResult {
    success: boolean;
    actions: any[];
    error?: string;
}

class TestExecutor {
    private pyodide: any;
    private world: MockGameWorld;

    constructor(pyodide: any, world: MockGameWorld) {
        this.pyodide = pyodide;
        this.world = world;
    }

    async setup(): Promise<void> {
        // Define the game bridge Python code (same as python-executor.ts)
        await this.pyodide.runPythonAsync(`
import sys

class _GameBridge:
    def __init__(self):
        self.stopped = False
        self.step_count = 0
        self.max_steps = 50000
        self.error = None
        self.actions = []
        self.boat_x = 30
        self.boat_y = 30
        self.boat_dir = 0
        self.boat_fuel = 100
        self.boat_max_fuel = 100
        self.boat_cargo = 0
        self.boat_max_cargo = 5
        self.collected_zones = set()
        self.trail = []
        self._get_cell = None
        self._can_move = None
        self._collect_cargo = None
        self._scan = None
        self._sensor_forward = None
        self._sensor_right = None
        self._sensor_left = None
        self._sensor_back = None
        self._nearest_port = None
        self._distance_to_port = None
        self._port_x = None
        self._port_y = None
        self._direction_name = None
        self._get_direction_delta = None
        self._reveal_around = None

    def check_step(self):
        self.step_count += 1
        if self.step_count > self.max_steps:
            raise RuntimeError(f"Programa excede {self.max_steps} operaciones")
        if self.stopped:
            raise KeyboardInterrupt("Detenido")

_bridge = _GameBridge()

def avanzar(n=1):
    n = int(n)
    if n < 0:
        raise ValueError("avanzar() necesita un número positivo")
    for _ in range(n):
        _bridge.check_step()
        if _bridge.boat_fuel <= 0:
            _bridge.error = "¡Sin combustible!"
            raise RuntimeError("¡Sin combustible!")
        dx, dy = _bridge._get_direction_delta(_bridge.boat_dir)
        new_x = _bridge.boat_x + dx
        new_y = _bridge.boat_y + dy
        result = _bridge._can_move(new_x, new_y)
        if not result.ok:
            _bridge.error = result.reason
            raise RuntimeError(result.reason)
        _bridge.trail.append((_bridge.boat_x, _bridge.boat_y))
        from_x, from_y = _bridge.boat_x, _bridge.boat_y
        _bridge.boat_x = new_x
        _bridge.boat_y = new_y
        _bridge.boat_fuel -= 1
        _bridge._reveal_around(new_x, new_y)
        _bridge.actions.append({
            'type': 'advance',
            'fromX': from_x, 'fromY': from_y,
            'toX': new_x, 'toY': new_y
        })

def girar_derecha():
    _bridge.check_step()
    if _bridge.boat_fuel <= 0:
        raise RuntimeError("¡Sin combustible para girar!")
    _bridge.boat_fuel -= 1
    _bridge.boat_dir = (_bridge.boat_dir + 1) % 4
    _bridge.actions.append({'type': 'turn_right', 'newDir': _bridge.boat_dir})

def girar_izquierda():
    _bridge.check_step()
    if _bridge.boat_fuel <= 0:
        raise RuntimeError("¡Sin combustible para girar!")
    _bridge.boat_fuel -= 1
    _bridge.boat_dir = (_bridge.boat_dir + 3) % 4
    _bridge.actions.append({'type': 'turn_left', 'newDir': _bridge.boat_dir})

def recoger():
    _bridge.check_step()
    result = _bridge._collect_cargo(_bridge.boat_x, _bridge.boat_y, _bridge.boat_cargo, _bridge.boat_max_cargo, _bridge.collected_zones)
    if not result.ok:
        raise RuntimeError(result.reason)
    _bridge.boat_cargo += 1
    _bridge.collected_zones.add(f"{_bridge.boat_x},{_bridge.boat_y}")
    _bridge.actions.append({'type': 'collect', 'x': _bridge.boat_x, 'y': _bridge.boat_y})

def escanear():
    _bridge.check_step()
    return _bridge._scan(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_adelante():
    _bridge.check_step()
    return _bridge._sensor_forward(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_derecha():
    _bridge.check_step()
    return _bridge._sensor_right(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_izquierda():
    _bridge.check_step()
    return _bridge._sensor_left(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_atras():
    _bridge.check_step()
    return _bridge._sensor_back(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def posicion_x():
    return _bridge.boat_x

def posicion_y():
    return _bridge.boat_y

def rumbo():
    return _bridge._direction_name(_bridge.boat_dir)

def rumbo_num():
    return _bridge.boat_dir

def combustible():
    return _bridge.boat_fuel

def carga():
    return _bridge.boat_cargo

def puerto_cercano():
    return _bridge._nearest_port(_bridge.boat_x, _bridge.boat_y)

def puerto_x(n=None):
    if n is None:
        n = puerto_cercano()
    return _bridge._port_x(int(n))

def puerto_y(n=None):
    if n is None:
        n = puerto_cercano()
    return _bridge._port_y(int(n))

def distancia_puerto(n=None):
    if n is None:
        n = puerto_cercano()
    return _bridge._distance_to_port(int(n), _bridge.boat_x, _bridge.boat_y)
`);
    }

    private _relativeToWorld(bx: number, by: number, dir: number, forward: number, right: number): [number, number] {
        let wx = 0, wy = 0;
        switch (dir) {
            case 0: wx = bx + right; wy = by - forward; break;
            case 1: wx = bx + forward; wy = by + right; break;
            case 2: wx = bx - right; wy = by + forward; break;
            case 3: wx = bx - forward; wy = by - right; break;
        }
        return [wx, wy];
    }

    private _syncState(): void {
        const bridge = this.pyodide.globals.get('_bridge');
        const boat = this.world.boat;

        bridge.boat_x = boat.x;
        bridge.boat_y = boat.y;
        bridge.boat_dir = boat.direction;
        bridge.boat_fuel = boat.fuel;
        bridge.boat_max_fuel = boat.maxFuel;
        bridge.boat_cargo = boat.cargo;
        bridge.boat_max_cargo = boat.maxCargo;
        bridge.collected_zones = this.pyodide.globals.get('set')();
        bridge.trail = this.pyodide.globals.get('list')();
        bridge.stopped = false;
        bridge.error = null;
        bridge.actions = this.pyodide.globals.get('list')();

        const world = this.world;

        bridge._get_direction_delta = (dir: number) => world.getDirectionDelta(dir);
        bridge._can_move = (x: number, y: number) => world.canMoveTo(x, y);
        bridge._collect_cargo = (x: number, y: number, cargo: number, maxCargo: number, collectedZones: any) => {
            const cell = world.map[y][x];
            if (cell !== world.FISH) return { ok: false, reason: 'No hay pesca aquí.' };
            if (cargo >= maxCargo) return { ok: false, reason: 'Bodega llena.' };
            const key = `${x},${y}`;
            let alreadyCollected = false;
            try { alreadyCollected = collectedZones.has(key); } catch { /* */ }
            if (alreadyCollected) return { ok: false, reason: 'Ya recogiste aquí.' };
            world.map[y][x] = world.WATER;
            return { ok: true };
        };
        bridge._reveal_around = (x: number, y: number) => world.revealAround(x, y);

        bridge._scan = (bx: number, by: number, dir: number): string[][] => {
            const matrix: string[][] = [];
            for (let row = 0; row < 5; row++) {
                const matRow: string[] = [];
                for (let col = 0; col < 5; col++) {
                    const relForward = 2 - row;
                    const relRight = col - 2;
                    const [wx, wy] = this._relativeToWorld(bx, by, dir, relForward, relRight);
                    matRow.push(world.getCellType(wx, wy));
                }
                matrix.push(matRow);
            }
            return matrix;
        };

        bridge._sensor_forward = (bx: number, by: number, dir: number) => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 1, 0);
            return world.getCellType(x, y);
        };
        bridge._sensor_right = (bx: number, by: number, dir: number) => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 0, 1);
            return world.getCellType(x, y);
        };
        bridge._sensor_left = (bx: number, by: number, dir: number) => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 0, -1);
            return world.getCellType(x, y);
        };
        bridge._sensor_back = (bx: number, by: number, dir: number) => {
            const [x, y] = this._relativeToWorld(bx, by, dir, -1, 0);
            return world.getCellType(x, y);
        };

        bridge._nearest_port = (bx: number, by: number) => {
            let minDist = Infinity, nearest = 1;
            for (const p of world.ports) {
                const d = Math.abs(p.x - bx) + Math.abs(p.y - by);
                if (d < minDist) { minDist = d; nearest = p.id; }
            }
            return nearest;
        };
        bridge._distance_to_port = (n: number, bx: number, by: number) => {
            const p = world.ports.find(p => p.id === n) || world.ports[0];
            return Math.abs(p.x - bx) + Math.abs(p.y - by);
        };
        bridge._port_x = (n: number) => (world.ports.find(p => p.id === n) || world.ports[0]).x;
        bridge._port_y = (n: number) => (world.ports.find(p => p.id === n) || world.ports[0]).y;
        bridge._direction_name = (dir: number) => ['Norte', 'Este', 'Sur', 'Oeste'][dir];
    }

    async execute(code: string): Promise<ExecutorResult> {
        this._syncState();

        const wrappedCode = `
_bridge.stopped = False
_bridge.step_count = 0
_bridge.error = None
_bridge.actions = []

import sys
_trace_counter = [0]
def _trace_fn(frame, event, arg):
    _trace_counter[0] += 1
    if _trace_counter[0] > 10000:
        raise RuntimeError("Programa excede el límite de operaciones")
    if _bridge.stopped:
        raise KeyboardInterrupt("Detenido")
    return _trace_fn
sys.settrace(_trace_fn)

try:
${code.split('\n').map(l => '    ' + l).join('\n')}
except KeyboardInterrupt:
    pass
finally:
    sys.settrace(None)
`;

        try {
            await this.pyodide.runPythonAsync(wrappedCode);
            const bridge = this.pyodide.globals.get('_bridge');

            // Sync state back
            this.world.boat.x = bridge.boat_x;
            this.world.boat.y = bridge.boat_y;
            this.world.boat.direction = bridge.boat_dir;
            this.world.boat.fuel = bridge.boat_fuel;
            this.world.boat.cargo = bridge.boat_cargo;

            const actions = this._convertActions(bridge.actions);

            if (bridge.error) {
                return { success: false, actions, error: bridge.error };
            }
            return { success: true, actions };
        } catch (e: any) {
            const bridge = this.pyodide.globals.get('_bridge');
            const actions = this._convertActions(bridge.actions);

            // Sync whatever state was achieved
            this.world.boat.x = bridge.boat_x;
            this.world.boat.y = bridge.boat_y;
            this.world.boat.direction = bridge.boat_dir;
            this.world.boat.fuel = bridge.boat_fuel;
            this.world.boat.cargo = bridge.boat_cargo;

            return { success: false, actions, error: e.message };
        }
    }

    private _convertActions(pyActions: any): any[] {
        const actions: any[] = [];
        if (!pyActions) return actions;
        const len = pyActions.length;
        for (let i = 0; i < len; i++) {
            const a = pyActions[i];
            const type = a.get ? a.get('type') : a.type;
            switch (type) {
                case 'advance':
                    actions.push({
                        type: 'advance',
                        fromX: a.get ? a.get('fromX') : a.fromX,
                        fromY: a.get ? a.get('fromY') : a.fromY,
                        toX: a.get ? a.get('toX') : a.toX,
                        toY: a.get ? a.get('toY') : a.toY,
                    });
                    break;
                case 'turn_right':
                    actions.push({ type: 'turn_right', newDir: a.get ? a.get('newDir') : a.newDir });
                    break;
                case 'turn_left':
                    actions.push({ type: 'turn_left', newDir: a.get ? a.get('newDir') : a.newDir });
                    break;
                case 'collect':
                    actions.push({ type: 'collect', x: a.get ? a.get('x') : a.x, y: a.get ? a.get('y') : a.y });
                    break;
            }
        }
        return actions;
    }

    getVar(name: string): any {
        try {
            const val = this.pyodide.globals.get(name);
            if (val === undefined || val === null) return undefined;
            if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') return val;
            if (val.toJs) return val.toJs();
            return val;
        } catch { return undefined; }
    }
}

// ============================================================
// Test cases
// ============================================================

async function main() {
    console.log('Loading Pyodide...');
    const pyodide = await loadPyodide();
    console.log('Pyodide ready.\n');

    const world = new MockGameWorld();
    const executor = new TestExecutor(pyodide, world);
    await executor.setup();

    function resetWorld(fuel = 100) {
        world.resetMap();
        world.reset({ x: 30, y: 30 }, 0, fuel);
    }

    // ── Basic Movement ──
    console.log('Basic Movement:');

    await test('avanzar(1) moves boat north', async () => {
        resetWorld();
        const r = await executor.execute('avanzar(1)');
        assert(r.success, 'should succeed');
        assertEqual(r.actions.length, 1);
        assertEqual(r.actions[0], { type: 'advance', fromX: 30, fromY: 30, toX: 30, toY: 29 });
        assertEqual(world.boat.y, 29);
        assertEqual(world.boat.fuel, 99);
    });

    await test('avanzar(3) moves 3 cells', async () => {
        resetWorld();
        const r = await executor.execute('avanzar(3)');
        assert(r.success, 'should succeed');
        assertEqual(r.actions.length, 3);
        assertEqual(world.boat.y, 27);
        assertEqual(world.boat.fuel, 97);
    });

    await test('girar_derecha() turns right', async () => {
        resetWorld();
        const r = await executor.execute('girar_derecha()');
        assert(r.success, 'should succeed');
        assertEqual(r.actions[0], { type: 'turn_right', newDir: 1 });
        assertEqual(world.boat.direction, 1);
    });

    await test('girar_izquierda() turns left', async () => {
        resetWorld();
        const r = await executor.execute('girar_izquierda()');
        assert(r.success, 'should succeed');
        assertEqual(r.actions[0], { type: 'turn_left', newDir: 3 });
        assertEqual(world.boat.direction, 3);
    });

    await test('4 right turns = full circle', async () => {
        resetWorld();
        const r = await executor.execute('girar_derecha()\ngirar_derecha()\ngirar_derecha()\ngirar_derecha()');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.direction, 0);
    });

    // ── Navigation ──
    console.log('\nNavigation:');

    await test('avanzar + turn + avanzar navigates correctly', async () => {
        resetWorld();
        const r = await executor.execute('avanzar(2)\ngirar_derecha()\navanzar(2)');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.x, 32);
        assertEqual(world.boat.y, 28);
        assertEqual(world.boat.direction, 1);
    });

    await test('hitting land fails', async () => {
        resetWorld();
        world.map[29][30] = world.LAND;
        const r = await executor.execute('avanzar(1)');
        assert(!r.success, 'should fail');
    });

    await test('hitting reef fails', async () => {
        resetWorld();
        world.map[29][30] = world.REEF;
        const r = await executor.execute('avanzar(1)');
        assert(!r.success, 'should fail');
    });

    // ── Fuel ──
    console.log('\nFuel System:');

    await test('fuel decreases with movement', async () => {
        resetWorld();
        await executor.execute('avanzar(5)');
        assertEqual(world.boat.fuel, 95);
    });

    await test('fuel decreases with turns', async () => {
        resetWorld();
        await executor.execute('girar_derecha()');
        assertEqual(world.boat.fuel, 99);
    });

    await test('runs out of fuel', async () => {
        resetWorld(3);
        const r = await executor.execute('avanzar(5)');
        assert(!r.success, 'should fail when out of fuel');
        assertEqual(world.boat.fuel, 0);
    });

    // ── Sensors ──
    console.log('\nSensors:');

    await test('sensor_adelante() detects reef', async () => {
        resetWorld();
        world.map[29][30] = world.REEF;
        const r = await executor.execute('resultado = sensor_adelante()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('resultado'), 'arrecife');
    });

    await test('sensor_derecha() detects fish', async () => {
        resetWorld();
        world.map[30][31] = world.FISH;
        const r = await executor.execute('resultado = sensor_derecha()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('resultado'), 'pesca');
    });

    await test('escanear() returns 5x5 matrix', async () => {
        resetWorld();
        const r = await executor.execute('mapa = escanear()\nfilas = len(mapa)\ncols = len(mapa[0])\ncentro = mapa[2][2]');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('filas'), 5);
        assertEqual(executor.getVar('cols'), 5);
        assertEqual(executor.getVar('centro'), 'agua');
    });

    await test('escanear() detects reef ahead', async () => {
        resetWorld();
        world.map[29][30] = world.REEF;
        const r = await executor.execute('mapa = escanear()\nadelante = mapa[1][2]');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('adelante'), 'arrecife');
    });

    // ── Cargo ──
    console.log('\nCargo:');

    await test('recoger() collects fish', async () => {
        resetWorld();
        world.map[30][30] = world.FISH;
        const r = await executor.execute('recoger()');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.cargo, 1);
        assertEqual(r.actions[0], { type: 'collect', x: 30, y: 30 });
    });

    await test('recoger() fails on water', async () => {
        resetWorld();
        const r = await executor.execute('recoger()');
        assert(!r.success, 'should fail');
    });

    await test('collect multiple fish', async () => {
        resetWorld();
        world.map[29][30] = world.FISH;
        world.map[28][30] = world.FISH;
        const r = await executor.execute('avanzar(1)\nrecoger()\navanzar(1)\nrecoger()');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.cargo, 2);
    });

    // ── Information Functions ──
    console.log('\nInformation Functions:');

    await test('posicion_x/y returns position', async () => {
        resetWorld();
        const r = await executor.execute('x = posicion_x()\ny = posicion_y()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('x'), 30);
        assertEqual(executor.getVar('y'), 30);
    });

    await test('rumbo() returns direction string', async () => {
        resetWorld();
        const r = await executor.execute('r = rumbo()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('r'), 'Norte');
    });

    await test('rumbo_num() returns direction number', async () => {
        resetWorld();
        const r = await executor.execute('r = rumbo_num()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('r'), 0);
    });

    await test('combustible() returns fuel', async () => {
        resetWorld();
        const r = await executor.execute('f = combustible()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('f'), 100);
    });

    await test('carga() returns cargo', async () => {
        resetWorld();
        const r = await executor.execute('c = carga()');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('c'), 0);
    });

    await test('puerto_x/y returns port coordinates', async () => {
        resetWorld();
        const r = await executor.execute('px = puerto_x(1)\npy = puerto_y(1)');
        assert(r.success, 'should succeed');
        assertEqual(executor.getVar('px'), 18);
        assertEqual(executor.getVar('py'), 14);
    });

    await test('distancia_puerto() returns Manhattan distance', async () => {
        resetWorld();
        const r = await executor.execute('d = distancia_puerto(1)');
        assert(r.success, 'should succeed');
        const expected = Math.abs(18 - 30) + Math.abs(14 - 30);
        assertEqual(executor.getVar('d'), expected);
    });

    // ── Python Control Flow ──
    console.log('\nPython Control Flow:');

    await test('for loop works', async () => {
        resetWorld();
        const r = await executor.execute('for i in range(4):\n    avanzar(1)');
        assert(r.success, 'should succeed');
        assertEqual(r.actions.length, 4);
        assertEqual(world.boat.y, 26);
    });

    await test('while loop works', async () => {
        resetWorld(5);
        const r = await executor.execute('while combustible() > 2:\n    avanzar(1)');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.fuel, 2);
        assertEqual(r.actions.length, 3);
    });

    await test('if/else with sensors', async () => {
        resetWorld();
        world.map[29][30] = world.REEF;
        const r = await executor.execute(
            'if sensor_adelante() == "arrecife":\n    girar_derecha()\n    avanzar(1)\nelse:\n    avanzar(1)'
        );
        assert(r.success, 'should succeed');
        assertEqual(world.boat.direction, 1);
        assertEqual(world.boat.x, 31);
    });

    await test('def functions work', async () => {
        resetWorld();
        const r = await executor.execute(
            'def avanzar_y_girar():\n    avanzar(2)\n    girar_derecha()\n\navanzar_y_girar()\navanzar_y_girar()'
        );
        assert(r.success, 'should succeed');
        assertEqual(world.boat.x, 32);
        assertEqual(world.boat.y, 28);
        assertEqual(world.boat.direction, 2);
    });

    // ── Safety Limits ──
    // Note: sys.settrace with `while True: pass` is too slow in WASM/Node.
    // In the browser this works fine. We test the bridge step counter instead.
    console.log('\nSafety:');

    await test('bridge step counter catches runaway game calls', async () => {
        resetWorld(99999); // Give tons of fuel so fuel isn't the limit
        const r = await executor.execute('while True:\n    girar_derecha()');
        assert(!r.success, 'should fail from step limit');
    });

    // ── Error Handling ──
    console.log('\nError Handling:');

    await test('syntax error reports failure', async () => {
        resetWorld();
        const r = await executor.execute('def (broken:');
        assert(!r.success, 'should fail');
    });

    await test('undefined variable reports failure', async () => {
        resetWorld();
        const r = await executor.execute('avanzar(variable_no_existe)');
        assert(!r.success, 'should fail');
    });

    await test('negative avanzar raises error', async () => {
        resetWorld();
        const r = await executor.execute('avanzar(-1)');
        assert(!r.success, 'should fail');
    });

    // ── State Isolation ──
    console.log('\nState Isolation:');

    await test('boat resets between runs', async () => {
        resetWorld();
        await executor.execute('avanzar(5)');
        assertEqual(world.boat.y, 25);

        resetWorld();
        const r = await executor.execute('avanzar(2)');
        assert(r.success, 'should succeed');
        assertEqual(world.boat.y, 28);
        assertEqual(world.boat.fuel, 98);
    });

    // ── Summary ──
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => console.log(f));
    }
    console.log(`${'═'.repeat(50)}`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
