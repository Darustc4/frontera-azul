/**
 * La Frontera Azul - Python Executor
 * Runs real Python code via Pyodide (CPython compiled to WebAssembly).
 * Supports numpy and other packages via micropip.
 */

import { GameWorld } from './game';

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs';

export type GameAction =
    | { type: 'advance'; fromX: number; fromY: number; toX: number; toY: number }
    | { type: 'turn_right'; newDir: number }
    | { type: 'turn_left'; newDir: number }
    | { type: 'collect'; x: number; y: number };

interface PyodideInterface {
    runPythonAsync(code: string): Promise<any>;
    globals: any;
    loadPackagesFromImports(code: string): Promise<void>;
    isPyProxy(obj: any): boolean;
}

export class PythonExecutor {
    private pyodide: PyodideInterface | null = null;
    private world: GameWorld;
    private consoleEl: HTMLElement;
    private loadingPromise: Promise<void> | null = null;

    public onStep: (() => void) | null = null;
    public onCheckObjectives: (() => boolean) | null = null;
    public stopped = false;
    public silent = false;

    private actions: GameAction[] = [];
    private executionError = false;
    private consoleMessages: { message: string; type: string }[] = [];
    private userVariables: Record<string, any> = {};

    constructor(world: GameWorld, consoleEl: HTMLElement) {
        this.world = world;
        this.consoleEl = consoleEl;
    }

    // ==================== LOGGING ====================

    log(message: string, type = 'info'): void {
        if (this.silent) {
            this.consoleMessages.push({ message, type });
            return;
        }
        const line = document.createElement('div');
        line.className = `log-${type}`;
        line.textContent = message;
        this.consoleEl.appendChild(line);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }

    clearConsole(): void { this.consoleEl.innerHTML = ''; }

    getVariables(): Record<string, any> { return { ...this.userVariables }; }

    // ==================== PYODIDE LOADING ====================

    isLoaded(): boolean { return this.pyodide !== null; }

    async ensureLoaded(): Promise<void> {
        if (this.pyodide) return;
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = this._loadPyodide();
        await this.loadingPromise;
    }

    private async _loadPyodide(): Promise<void> {
        this.log('🐍 Cargando Python (primera vez, ~10s)...', 'system');

        let loadPyodide: any;
        if (typeof window !== 'undefined') {
            // Browser: load from CDN
            const mod = await import(/* @vite-ignore */ PYODIDE_CDN);
            loadPyodide = mod.loadPyodide;
        } else {
            // Node.js (tests): use local npm package
            const mod = await import(/* @vite-ignore */ 'pyodide');
            loadPyodide = mod.loadPyodide;
        }

        this.pyodide = await loadPyodide({
            stdout: (text: string) => { this.log(text, 'info'); },
            stderr: (text: string) => { this.log(text, 'error'); },
        });

        // Set up the game API in Python
        await this._setupGameAPI();
        this.log('✓ Python listo.', 'success');
    }

    private async _setupGameAPI(): Promise<void> {
        if (!this.pyodide) return;

        // Define the game API module in Python
        await this.pyodide.runPythonAsync(`
import sys
from js import Object as _JsObject
from pyodide.ffi import to_js

# ============================================================
# Game state bridge - these get replaced before each execution
# ============================================================
class _GameBridge:
    """Bridge between Python game commands and the JS game engine."""

    def __init__(self):
        self.stopped = False
        self.step_count = 0
        self.max_steps = 50000
        self.error = None
        self.actions = []
        # Game state (mirrors JS GameWorld)
        self.boat_x = 30
        self.boat_y = 30
        self.boat_dir = 0  # 0=N, 1=E, 2=S, 3=W
        self.boat_fuel = 100
        self.boat_max_fuel = 100
        self.boat_cargo = 0
        self.boat_max_cargo = 5
        self.collected_zones = set()
        self.trail = []
        # Map reference (set from JS before execution)
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
            raise RuntimeError(f"Programa excede {self.max_steps} operaciones (posible bucle infinito)")
        if self.stopped:
            raise KeyboardInterrupt("Ejecución detenida por el usuario")

_bridge = _GameBridge()

# ============================================================
# Public API - these are the functions students use
# ============================================================

def avanzar(n=1):
    """Move forward n cells in current heading direction."""
    n = int(n)
    if n < 0:
        raise ValueError("avanzar() necesita un número positivo")
    for _ in range(n):
        _bridge.check_step()
        if _bridge.boat_fuel <= 0:
            _bridge.error = "¡Sin combustible!"
            raise RuntimeError("¡Sin combustible! A la deriva.")
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
    """Turn 90 degrees starboard."""
    _bridge.check_step()
    if _bridge.boat_fuel <= 0:
        _bridge.error = "¡Sin combustible para girar!"
        raise RuntimeError("¡Sin combustible para girar!")
    _bridge.boat_fuel -= 1
    _bridge.boat_dir = (_bridge.boat_dir + 1) % 4
    _bridge.actions.append({'type': 'turn_right', 'newDir': _bridge.boat_dir})

def girar_izquierda():
    """Turn 90 degrees port."""
    _bridge.check_step()
    if _bridge.boat_fuel <= 0:
        _bridge.error = "¡Sin combustible para girar!"
        raise RuntimeError("¡Sin combustible para girar!")
    _bridge.boat_fuel -= 1
    _bridge.boat_dir = (_bridge.boat_dir + 3) % 4
    _bridge.actions.append({'type': 'turn_left', 'newDir': _bridge.boat_dir})

def recoger():
    """Collect cargo at current position."""
    _bridge.check_step()
    result = _bridge._collect_cargo(_bridge.boat_x, _bridge.boat_y, _bridge.boat_cargo, _bridge.boat_max_cargo, _bridge.collected_zones)
    if not result.ok:
        raise RuntimeError(result.reason)
    _bridge.boat_cargo += 1
    _bridge.collected_zones.add(f"{_bridge.boat_x},{_bridge.boat_y}")
    _bridge.actions.append({'type': 'collect', 'x': _bridge.boat_x, 'y': _bridge.boat_y})

def escanear():
    """Return 5x5 scan matrix relative to boat heading."""
    _bridge.check_step()
    return _bridge._scan(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_adelante():
    """What's in front of the boat."""
    _bridge.check_step()
    return _bridge._sensor_forward(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_derecha():
    """What's to starboard."""
    _bridge.check_step()
    return _bridge._sensor_right(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_izquierda():
    """What's to port."""
    _bridge.check_step()
    return _bridge._sensor_left(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def sensor_atras():
    """What's behind the boat."""
    _bridge.check_step()
    return _bridge._sensor_back(_bridge.boat_x, _bridge.boat_y, _bridge.boat_dir)

def posicion_x():
    """Current X position."""
    return _bridge.boat_x

def posicion_y():
    """Current Y position."""
    return _bridge.boat_y

def rumbo():
    """Current heading as string."""
    return _bridge._direction_name(_bridge.boat_dir)

def rumbo_num():
    """Current heading as number (0=N, 1=E, 2=S, 3=W)."""
    return _bridge.boat_dir

def combustible():
    """Remaining fuel."""
    return _bridge.boat_fuel

def carga():
    """Current cargo count."""
    return _bridge.boat_cargo

def puerto_cercano():
    """ID of nearest port (1 or 2)."""
    return _bridge._nearest_port(_bridge.boat_x, _bridge.boat_y)

def puerto_x(n=None):
    """X coordinate of port n."""
    if n is None:
        n = puerto_cercano()
    return _bridge._port_x(int(n))

def puerto_y(n=None):
    """Y coordinate of port n."""
    if n is None:
        n = puerto_cercano()
    return _bridge._port_y(int(n))

def distancia_puerto(n=None):
    """Manhattan distance to port n."""
    if n is None:
        n = puerto_cercano()
    return _bridge._distance_to_port(int(n), _bridge.boat_x, _bridge.boat_y)
`);
    }

    // ==================== EXECUTION ====================

    stop(): void {
        this.stopped = true;
        if (this.pyodide) {
            this.pyodide.globals.get('_bridge').stopped = true;
        }
    }

    async execute(code: string, _speed?: number): Promise<{ success: boolean; actions: GameAction[] }> {
        if (!this.pyodide) {
            await this.ensureLoaded();
        }

        this.stopped = false;
        this.actions = [];
        this.executionError = false;
        this.consoleMessages = [];
        this.userVariables = {};

        // Sync game state to Python bridge
        this._syncStateToPython();

        // Try to load any packages the code imports
        try {
            await this.pyodide!.loadPackagesFromImports(code);
        } catch (_e) {
            // Non-fatal: package might not be available
        }

        // Execute student code
        this.log('▶ Ejecutando programa...', 'system');

        try {
            // Add trace for step limiting and wrap in function to capture locals
            const wrappedCode = `
_bridge.stopped = False
_bridge.step_count = 0
_bridge.error = None
_bridge.actions = []

# Set up step tracing for safety
import sys
_trace_counter = [0]
def _trace_fn(frame, event, arg):
    _trace_counter[0] += 1
    if _trace_counter[0] > 200000:
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
            await this.pyodide!.runPythonAsync(wrappedCode);

            // Collect actions from Python
            const bridgeActions = this.pyodide!.globals.get('_bridge').actions;
            this.actions = this._convertPyActions(bridgeActions);

            // Collect user variables
            this._collectUserVariables(code);

            // Sync state back from Python
            this._syncStateFromPython();

            if (this.stopped) {
                this.log('⏹ Ejecución detenida.', 'warning');
                return { success: false, actions: this.actions };
            }

            const bridge = this.pyodide!.globals.get('_bridge');
            if (bridge.error) {
                this.log(`✗ ${bridge.error}`, 'error');
                return { success: false, actions: this.actions };
            }

            if (this.actions.length > 0) {
                this.log(`✓ Completado. ${this.actions.length} acciones, Pos: (${bridge.boat_x}, ${bridge.boat_y})`, 'success');
            }
            return { success: true, actions: this.actions };

        } catch (err: any) {
            const msg = err.message || String(err);
            // Extract Python traceback if available
            const cleanMsg = this._cleanPythonError(msg);
            this.log(`✗ ${cleanMsg}`, 'error');
            this.executionError = true;

            // Still return any actions that were recorded before the error
            const bridge = this.pyodide!.globals.get('_bridge');
            this.actions = this._convertPyActions(bridge.actions);
            this._syncStateFromPython();
            return { success: false, actions: this.actions };
        }
    }

    // ==================== STATE SYNC ====================

    private _syncStateToPython(): void {
        if (!this.pyodide) return;
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
        for (const zone of boat.collectedZones) {
            bridge.collected_zones.add(zone);
        }
        bridge.trail = this.pyodide.globals.get('list')();
        bridge.stopped = false;
        bridge.error = null;
        bridge.actions = this.pyodide.globals.get('list')();

        // Bind JS functions for game queries
        const world = this.world;

        bridge._get_direction_delta = (dir: number): [number, number] => {
            return world.getDirectionDelta(dir);
        };

        bridge._can_move = (x: number, y: number) => {
            return world.canMoveTo(x, y);
        };

        bridge._collect_cargo = (x: number, y: number, cargo: number, maxCargo: number, collectedZones: any) => {
            const cell = world.map[y][x];
            if (cell !== world.FISH) return { ok: false, reason: 'No hay pesca aquí.' };
            if (cargo >= maxCargo) return { ok: false, reason: 'Bodega llena.' };
            const key = `${x},${y}`;
            // Check the Python set
            let alreadyCollected = false;
            try { alreadyCollected = collectedZones.has(key); } catch (_e) { /* */ }
            if (alreadyCollected) return { ok: false, reason: 'Ya recogiste aquí.' };
            // Update the actual map
            world.map[y][x] = world.WATER;
            return { ok: true };
        };

        bridge._reveal_around = (x: number, y: number) => {
            world.revealAround(x, y);
        };

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

        bridge._sensor_forward = (bx: number, by: number, dir: number): string => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 1, 0);
            return world.getCellType(x, y);
        };

        bridge._sensor_right = (bx: number, by: number, dir: number): string => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 0, 1);
            return world.getCellType(x, y);
        };

        bridge._sensor_left = (bx: number, by: number, dir: number): string => {
            const [x, y] = this._relativeToWorld(bx, by, dir, 0, -1);
            return world.getCellType(x, y);
        };

        bridge._sensor_back = (bx: number, by: number, dir: number): string => {
            const [x, y] = this._relativeToWorld(bx, by, dir, -1, 0);
            return world.getCellType(x, y);
        };

        bridge._nearest_port = (bx: number, by: number): number => {
            let minDist = Infinity, nearest = 1;
            for (const p of world.ports) {
                const d = Math.abs(p.x - bx) + Math.abs(p.y - by);
                if (d < minDist) { minDist = d; nearest = p.id; }
            }
            return nearest;
        };

        bridge._distance_to_port = (n: number, bx: number, by: number): number => {
            const p = world.ports.find(p => p.id === n) || world.ports[0];
            return Math.abs(p.x - bx) + Math.abs(p.y - by);
        };

        bridge._port_x = (n: number): number => {
            return (world.ports.find(p => p.id === n) || world.ports[0]).x;
        };

        bridge._port_y = (n: number): number => {
            return (world.ports.find(p => p.id === n) || world.ports[0]).y;
        };

        bridge._direction_name = (dir: number): string => {
            return ['Norte', 'Este', 'Sur', 'Oeste'][dir];
        };
    }

    private _syncStateFromPython(): void {
        if (!this.pyodide) return;
        const bridge = this.pyodide.globals.get('_bridge');
        const boat = this.world.boat;

        boat.x = bridge.boat_x;
        boat.y = bridge.boat_y;
        boat.direction = bridge.boat_dir;
        boat.fuel = bridge.boat_fuel;
        boat.cargo = bridge.boat_cargo;

        // Sync trail
        boat.trail = [];
        const pyTrail = bridge.trail;
        if (pyTrail && pyTrail.length) {
            for (let i = 0; i < pyTrail.length; i++) {
                const t = pyTrail[i];
                boat.trail.push({ x: t[0], y: t[1] });
            }
        }

        // Sync collected zones
        boat.collectedZones = new Set();
        const pyZones = bridge.collected_zones;
        if (pyZones) {
            try {
                for (const zone of pyZones) {
                    boat.collectedZones.add(zone);
                }
            } catch (_e) { /* */ }
        }
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

    // ==================== HELPERS ====================

    private _convertPyActions(pyActions: any): GameAction[] {
        const actions: GameAction[] = [];
        if (!pyActions) return actions;
        try {
            const len = pyActions.length;
            for (let i = 0; i < len; i++) {
                const a = pyActions[i];
                const type = a.get ? a.get('type') : a['type'];
                switch (type) {
                    case 'advance':
                        actions.push({
                            type: 'advance',
                            fromX: a.get ? a.get('fromX') : a['fromX'],
                            fromY: a.get ? a.get('fromY') : a['fromY'],
                            toX: a.get ? a.get('toX') : a['toX'],
                            toY: a.get ? a.get('toY') : a['toY'],
                        });
                        break;
                    case 'turn_right':
                        actions.push({ type: 'turn_right', newDir: a.get ? a.get('newDir') : a['newDir'] });
                        break;
                    case 'turn_left':
                        actions.push({ type: 'turn_left', newDir: a.get ? a.get('newDir') : a['newDir'] });
                        break;
                    case 'collect':
                        actions.push({ type: 'collect', x: a.get ? a.get('x') : a['x'], y: a.get ? a.get('y') : a['y'] });
                        break;
                }
            }
        } catch (_e) { /* conversion error, return what we have */ }
        return actions;
    }

    private _collectUserVariables(code: string): void {
        if (!this.pyodide) return;
        this.userVariables = {};

        // Get variable names from simple assignments in user code
        const varNames = new Set<string>();
        const assignRegex = /^(\w+)\s*=/gm;
        let match;
        while ((match = assignRegex.exec(code)) !== null) {
            const name = match[1];
            if (!name.startsWith('_') && !['def', 'class', 'import', 'from', 'for', 'while', 'if', 'else', 'elif', 'try', 'except', 'finally', 'with', 'return', 'yield', 'pass', 'break', 'continue'].includes(name)) {
                varNames.add(name);
            }
        }

        // Also get function names
        const funcRegex = /^def\s+(\w+)/gm;
        while ((match = funcRegex.exec(code)) !== null) {
            varNames.add(match[1]);
        }

        const globals = this.pyodide.globals;
        for (const name of varNames) {
            try {
                const val = globals.get(name);
                if (val !== undefined && val !== null) {
                    if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
                        this.userVariables[name] = val;
                    } else if (this.pyodide.isPyProxy(val)) {
                        const type = val.type;
                        if (type === 'list') {
                            const len = val.length;
                            if (len <= 10) {
                                this.userVariables[name] = val.toJs();
                            } else {
                                this.userVariables[name] = `[list len=${len}]`;
                            }
                        } else if (type === 'int' || type === 'float' || type === 'str' || type === 'bool') {
                            this.userVariables[name] = val.toString();
                        } else if (type === 'function') {
                            this.userVariables[name] = `<función>`;
                        } else {
                            this.userVariables[name] = `<${type}>`;
                        }
                        val.destroy();
                    }
                }
            } catch (_e) { /* skip */ }
        }
    }

    private _cleanPythonError(msg: string): string {
        // Try to extract the most useful part of the Python traceback
        const lines = msg.split('\n');

        // Look for the actual error message (last line of traceback)
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line && !line.startsWith('File') && !line.startsWith('Traceback') && !line.startsWith('at ')) {
                // Try to extract line number from traceback
                let lineNum = '';
                for (let j = 0; j < lines.length; j++) {
                    const lineMatch = lines[j].match(/line (\d+)/);
                    if (lineMatch) {
                        // Adjust for our wrapper (subtract the wrapper lines)
                        const pyLine = parseInt(lineMatch[1]);
                        const adjustedLine = pyLine - 16; // offset for wrapper code
                        if (adjustedLine > 0) {
                            lineNum = `Línea ${adjustedLine}: `;
                        }
                    }
                }
                return lineNum + line;
            }
        }
        return msg.slice(0, 200);
    }

    // ==================== REPLAY ====================

    async replayActions(actions: GameAction[], speed: number, startPos: { x: number; y: number }, startDir: number, startFuel: number): Promise<void> {
        // Reset boat to start position for visual replay
        this.world.boat.x = startPos.x;
        this.world.boat.y = startPos.y;
        this.world.boat.direction = startDir;
        this.world.boat.fuel = startFuel;
        this.world.boat.trail = [];
        this.world.boat.cargo = 0;
        this.world.boat.collectedZones = new Set();
        this.world.render();

        for (const action of actions) {
            if (this.stopped) break;

            switch (action.type) {
                case 'advance':
                    this.world.boat.trail.push({ x: action.fromX, y: action.fromY });
                    this.world.boat.x = action.toX;
                    this.world.boat.y = action.toY;
                    this.world.boat.fuel = Math.max(0, this.world.boat.fuel - 1);
                    this.world.revealAround(action.toX, action.toY);
                    break;
                case 'turn_right':
                case 'turn_left':
                    this.world.boat.direction = action.newDir;
                    this.world.boat.fuel = Math.max(0, this.world.boat.fuel - 1);
                    break;
                case 'collect':
                    this.world.boat.cargo++;
                    this.world.boat.collectedZones.add(`${action.x},${action.y}`);
                    this.world.map[action.y][action.x] = this.world.WATER;
                    break;
            }

            this.world.render();
            if (this.onStep) this.onStep();
            await this.world.sleep(speed);
        }
    }
}
