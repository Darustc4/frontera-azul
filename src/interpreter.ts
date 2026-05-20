/**
 * La Frontera Azul - Interpreter
 * Parses and executes a simplified Python-like language for boat control.
 */

import { GameWorld } from './game';

interface Command {
    type: string;
    line: number;
    needsBlock?: boolean;
    body?: Command[];
    elseBody?: Command[] | null;
    condition?: string;
    countExpr?: string;
    varName?: string;
    name?: string;
    params?: string[];
    expr?: string;
    argsExpr?: string;
}

interface ParseResult {
    commands: Command[];
    nextIndex: number;
}

interface FunctionDef {
    params: string[];
    body: Command[];
}

export class Interpreter {
    world: GameWorld;
    consoleEl: HTMLElement;
    variables: Record<string, any> = {};
    functions: Record<string, FunctionDef> = {};
    executionError = false;
    onStep: (() => void) | null = null;
    onCheckObjectives: (() => boolean) | null = null;
    objectivesComplete = false;
    silent = false;
    stopped = false;
    speed = 180;
    moveCount = 0;

    constructor(gameWorld: GameWorld, consoleOutput: HTMLElement) {
        this.world = gameWorld;
        this.consoleEl = consoleOutput;
    }

    log(message: string, type = 'info'): void {
        if (this.silent) return;
        const line = document.createElement('div');
        line.className = `log-${type}`;
        line.textContent = message;
        this.consoleEl.appendChild(line);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }

    clearConsole(): void { this.consoleEl.innerHTML = ''; }
    getVariables(): Record<string, any> { return { ...this.variables }; }

    async execute(code: string, speed?: number): Promise<{ success: boolean }> {
        this.variables = {};
        this.functions = {};
        this.executionError = false;
        this.objectivesComplete = false;
        this.stopped = false;
        this.speed = speed || 180;
        this.moveCount = 0;

        const lines = code.split('\n');
        const parseResult = this.parse(lines, 0, 0);
        if (parseResult === null) return { success: false };

        this.log('▶ Ejecutando programa...', 'system');
        const ok = await this.executeLive(parseResult.commands);

        if (this.stopped) {
            this.log('⏹ Ejecución detenida.', 'warning');
            return { success: false };
        }
        if (this.objectivesComplete) {
            this.log(`✓ ¡Objetivos cumplidos! Pos: (${this.world.boat.x}, ${this.world.boat.y})`, 'success');
            return { success: true };
        }
        if (ok && !this.executionError) {
            if (this.moveCount > 0)
                this.log(`✓ Completado. Pos: (${this.world.boat.x}, ${this.world.boat.y})`, 'success');
            return { success: true };
        }
        return { success: false };
    }

    stop(): void { this.stopped = true; this.world.stop(); }

    consumeTurnFuel(): boolean {
        if (this.world.boat.fuel <= 0) {
            this.log('✗ ¡Sin combustible para girar!', 'error');
            this.executionError = true;
            return false;
        }
        this.world.boat.fuel = Math.max(0, this.world.boat.fuel - 1);
        if (this.onStep) this.onStep();
        return true;
    }

    // ==================== PARSER ====================

    parse(lines: string[], startIdx: number, baseIndent: number): ParseResult | null {
        const commands: Command[] = [];
        let i = startIdx;

        while (i < lines.length) {
            const rawLine = lines[i];
            const trimmed = rawLine.trim();
            if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }

            const indent = rawLine.length - rawLine.trimStart().length;
            if (indent < baseIndent) break;

            const cmd = this.parseLine(trimmed, i + 1);
            if (cmd === null) return null;

            if (cmd.needsBlock) {
                i++;
                let blockIndent = -1;
                for (let j = i; j < lines.length; j++) {
                    const t = lines[j].trim();
                    if (t !== '' && !t.startsWith('#')) {
                        blockIndent = lines[j].length - lines[j].trimStart().length;
                        break;
                    }
                }
                if (blockIndent <= indent) {
                    this.log(`✗ Línea ${i}: bloque indentado requerido después de '${trimmed}'`, 'error');
                    return null;
                }

                const blockResult = this.parse(lines, i, blockIndent);
                if (blockResult === null) return null;
                cmd.body = blockResult.commands;
                i = blockResult.nextIndex;

                if (cmd.type === 'if' && i < lines.length) {
                    const elseLine = lines[i];
                    const elseLineIndent = elseLine ? elseLine.length - elseLine.trimStart().length : -1;
                    if (elseLine && elseLine.trim().startsWith('else') && elseLineIndent === indent) {
                        i++;
                        let elseIndent = -1;
                        for (let j = i; j < lines.length; j++) {
                            const t = lines[j].trim();
                            if (t !== '' && !t.startsWith('#')) {
                                elseIndent = lines[j].length - lines[j].trimStart().length;
                                break;
                            }
                        }
                        if (elseIndent > indent) {
                            const elseResult = this.parse(lines, i, elseIndent);
                            if (elseResult === null) return null;
                            cmd.elseBody = elseResult.commands;
                            i = elseResult.nextIndex;
                        }
                    }
                }
                commands.push(cmd);
            } else {
                commands.push(cmd);
                i++;
            }
        }
        return { commands, nextIndex: i };
    }

    parseLine(line: string, lineNum: number): Command | null {
        let match: RegExpMatchArray | null;

        match = line.match(/^repetir\s+mientras\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'while', condition: match[1], body: [], needsBlock: true, line: lineNum };

        match = line.match(/^repetir\s*\(\s*(.+?)\s*\)\s*:?\s*$/);
        if (match) return { type: 'loop', countExpr: match[1], body: [], needsBlock: true, line: lineNum };

        match = line.match(/^for\s+(\w+)\s+in\s+range\s*\(\s*(.+?)\s*\)\s*:?\s*$/);
        if (match) return { type: 'for', varName: match[1], countExpr: match[2], body: [], needsBlock: true, line: lineNum };

        match = line.match(/^while\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'while', condition: match[1], body: [], needsBlock: true, line: lineNum };

        match = line.match(/^if\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'if', condition: match[1], body: [], elseBody: null, needsBlock: true, line: lineNum };

        match = line.match(/^def\s+(\w+)\s*\(\s*([\w,\s]*)\s*\)\s*:\s*$/);
        if (match) return { type: 'def', name: match[1], params: match[2].split(',').map(s => s.trim()).filter(Boolean), body: [], needsBlock: true, line: lineNum };

        match = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (match && !this.isKeyword(match[1]))
            return { type: 'assign', name: match[1], expr: match[2], line: lineNum };

        match = line.match(/^avanzar\s*\(\s*(.+?)\s*\)\s*$/);
        if (match) return { type: 'advance', expr: match[1], line: lineNum };

        if (/^girar_derecha\s*\(\s*\)\s*$/.test(line)) return { type: 'turn_right', line: lineNum };

        if (/^girar_izquierda\s*\(\s*\)\s*$/.test(line)) return { type: 'turn_left', line: lineNum };

        if (/^recoger\s*\(\s*\)\s*$/.test(line)) return { type: 'collect', line: lineNum };

        match = line.match(/^print\s*\(\s*(.+)\s*\)\s*$/);
        if (match) return { type: 'print', expr: match[1], line: lineNum };

        match = line.match(/^(\w+)\s*\(\s*(.*?)\s*\)\s*$/);
        if (match) return { type: 'call', name: match[1], argsExpr: match[2], line: lineNum };

        this.log(`✗ Línea ${lineNum}: no entiendo "${line}"`, 'error');
        return null;
    }

    isKeyword(word: string): boolean {
        return ['if', 'else', 'for', 'while', 'def', 'repetir', 'mientras', 'in', 'range', 'and', 'or', 'not', 'True', 'False'].includes(word);
    }

    // ==================== EXECUTOR ====================

    async executeLive(commands: Command[]): Promise<boolean> {
        for (const cmd of commands) {
            if (this.executionError || this.stopped) return false;
            if (this.objectivesComplete) return true;
            if (!await this.executeLiveOne(cmd)) return false;
        }
        return true;
    }

    async executeLiveOne(cmd: Command): Promise<boolean> {
        if (this.stopped) return false;

        switch (cmd.type) {
            case 'assign': {
                const val = this.evalExpr(cmd.expr!, cmd.line);
                if (val === undefined) return false;
                this.variables[cmd.name!] = val;
                return true;
            }

            case 'advance': {
                const steps = this.evalExpr(cmd.expr!, cmd.line);
                if (steps === undefined) return false;
                const n = Math.floor(Number(steps));
                if (isNaN(n) || n < 0) { this.log(`✗ Línea ${cmd.line}: avanzar necesita un número positivo`, 'error'); return false; }
                const [dx, dy] = this.world.getDirectionDelta();
                return await this.moveSteps(dx, dy, n, cmd.line);
            }

            case 'turn_right': {
                if (!this.consumeTurnFuel()) return false;
                this.world.boat.direction = (this.world.boat.direction + 1) % 4;
                if (!this.silent) { this.world.render(); await this.world.sleep(this.speed / 2); }
                return true;
            }

            case 'turn_left': {
                if (!this.consumeTurnFuel()) return false;
                this.world.boat.direction = (this.world.boat.direction + 3) % 4;
                if (!this.silent) { this.world.render(); await this.world.sleep(this.speed / 2); }
                return true;
            }

            case 'collect': {
                const result = this.world.collectCargo();
                if (!result.ok) { this.log(`✗ Línea ${cmd.line}: ${result.reason}`, 'error'); return false; }
                this.log('📦 ¡Carga recogida!', 'success');
                if (this.onStep) this.onStep();
                if (this.onCheckObjectives && this.onCheckObjectives()) {
                    this.objectivesComplete = true;
                }
                return true;
            }

            case 'print': {
                const val = this.evalExpr(cmd.expr!, cmd.line);
                if (val === undefined) return false;
                this.log(String(val), 'info');
                return true;
            }

            case 'loop': {
                const count = this.evalExpr(cmd.countExpr!, cmd.line);
                if (count === undefined) return false;
                const n = Math.floor(Number(count));
                if (isNaN(n) || n < 0) { this.log(`✗ Línea ${cmd.line}: repetir necesita un número positivo`, 'error'); return false; }
                for (let i = 0; i < n; i++) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    if (!await this.executeLive(cmd.body!)) return false;
                }
                return true;
            }

            case 'for': {
                const count = this.evalExpr(cmd.countExpr!, cmd.line);
                if (count === undefined) return false;
                const n = Math.floor(Number(count));
                if (isNaN(n) || n < 0) return false;
                for (let i = 0; i < n; i++) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    this.variables[cmd.varName!] = i;
                    if (!await this.executeLive(cmd.body!)) return false;
                }
                return true;
            }

            case 'while': {
                let iterations = 0;
                const MAX_ITER = 5000;
                while (iterations < MAX_ITER) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    const cond = this.evalCondition(cmd.condition!, cmd.line);
                    if (cond === undefined) return false;
                    if (!cond) break;
                    if (!await this.executeLive(cmd.body!)) return false;
                    iterations++;
                }
                if (iterations >= MAX_ITER) {
                    this.log(`✗ Línea ${cmd.line}: bucle while excede ${MAX_ITER} iteraciones`, 'error');
                    return false;
                }
                return true;
            }

            case 'if': {
                const cond = this.evalCondition(cmd.condition!, cmd.line);
                if (cond === undefined) return false;
                if (cond) return await this.executeLive(cmd.body!);
                else if (cmd.elseBody) return await this.executeLive(cmd.elseBody);
                return true;
            }

            case 'def':
                this.functions[cmd.name!] = { params: cmd.params!, body: cmd.body! };
                return true;

            case 'call':
                return await this.executeLiveCall(cmd);

            default:
                this.log(`✗ Comando desconocido: ${cmd.type}`, 'error');
                return false;
        }
    }

    async moveSteps(dx: number, dy: number, n: number, line: number): Promise<boolean> {
        for (let i = 0; i < n; i++) {
            if (this.stopped) return false;
            const newX = this.world.boat.x + dx;
            const newY = this.world.boat.y + dy;
            const check = this.world.canMoveTo(newX, newY);
            if (!check.ok) {
                this.log(`✗ Línea ${line}: ${check.reason}`, 'error');
                this.executionError = true;
                return false;
            }
            this.world.boat.trail.push({ x: this.world.boat.x, y: this.world.boat.y });
            this.world.boat.x = newX;
            this.world.boat.y = newY;
            this.world.boat.fuel = Math.max(0, this.world.boat.fuel - 1);
            this.world.revealAround(newX, newY);
            this.moveCount++;

            if (this.world.boat.fuel <= 0 && i < n - 1) {
                this.log('✗ ¡Sin combustible! A la deriva.', 'error');
                this.executionError = true;
                if (!this.silent) this.world.render();
                return false;
            }

            if (!this.silent) {
                this.world.render();
                await this.world.sleep(this.speed);
                if (this.onStep) this.onStep();
            }

            if (this.onCheckObjectives && this.onCheckObjectives()) {
                this.objectivesComplete = true;
                return true;
            }
        }
        return true;
    }

    async executeLiveCall(cmd: Command): Promise<boolean> {
        const fn = this.functions[cmd.name!];
        if (!fn) { this.log(`✗ Línea ${cmd.line}: función '${cmd.name}' no definida`, 'error'); return false; }

        const args = cmd.argsExpr ? cmd.argsExpr.split(',').map(a => this.evalExpr(a.trim(), cmd.line)) : [];
        if (args.some(a => a === undefined)) return false;

        const savedVars = { ...this.variables };
        for (let i = 0; i < fn.params.length; i++)
            this.variables[fn.params[i]] = args[i] !== undefined ? args[i] : 0;

        const result = await this.executeLive(fn.body);

        for (const p of fn.params) {
            if (savedVars[p] !== undefined) this.variables[p] = savedVars[p];
            else delete this.variables[p];
        }
        return result;
    }

    // ==================== EXPRESSION EVALUATOR ====================

    evalExpr(expr: string, line: number): any {
        try {
            let e = expr.trim();

            if ((e.startsWith('"') && e.endsWith('"')) || (e.startsWith("'") && e.endsWith("'")))
                return e.slice(1, -1);

            if (/^escanear\s*\(\)\s*$/.test(e)) return this.world.scan();

            if (/\bor\b/.test(e)) {
                const parts = e.split(/\bor\b/);
                for (const p of parts) { const v = this.evalExpr(p.trim(), line); if (v) return v; }
                return false;
            }
            if (/\band\b/.test(e)) {
                const parts = e.split(/\band\b/);
                let result: any = true;
                for (const p of parts) { const v = this.evalExpr(p.trim(), line); if (!v) return false; result = v; }
                return result;
            }

            const notMatch = e.match(/^not\s+(.+)$/);
            if (notMatch) { const v = this.evalExpr(notMatch[1], line); return v === undefined ? undefined : !v; }

            const cmpMatch = e.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
            if (cmpMatch) {
                const left = this.evalExpr(cmpMatch[1], line);
                const right = this.evalExpr(cmpMatch[3], line);
                if (left === undefined || right === undefined) return undefined;
                switch (cmpMatch[2]) {
                    case '==': return left == right;
                    case '!=': return left != right;
                    case '>=': return left >= right;
                    case '<=': return left <= right;
                    case '>': return left > right;
                    case '<': return left < right;
                }
            }

            const unaryNeg = e.match(/^-\s*(.+)$/);
            if (unaryNeg) {
                const v = this.evalExpr(unaryNeg[1], line);
                return v === undefined ? undefined : -v;
            }

            const modMatch = e.match(/^(.+?)\s*%\s*(.+)$/);
            if (modMatch) {
                const left = this.evalExpr(modMatch[1], line);
                const right = this.evalExpr(modMatch[2], line);
                if (left === undefined || right === undefined) return undefined;
                return ((left % right) + right) % right;
            }

            const idxMatch = e.match(/^(\w+)((?:\s*\[\s*.+?\s*\])+)\s*$/);
            if (idxMatch) {
                let val: any = this.variables[idxMatch[1]];
                if (val === undefined) { this.log(`✗ Línea ${line}: variable '${idxMatch[1]}' no definida`, 'error'); return undefined; }
                const idxRegex = /\[\s*(.+?)\s*\]/g;
                let m: RegExpExecArray | null;
                while ((m = idxRegex.exec(idxMatch[2])) !== null) {
                    const idx = this.evalExpr(m[1], line);
                    if (idx === undefined) return undefined;
                    if (!Array.isArray(val)) { this.log(`✗ Línea ${line}: no se puede indexar '${idxMatch[1]}'`, 'error'); return undefined; }
                    val = val[idx];
                    if (val === undefined) { this.log(`✗ Línea ${line}: índice fuera de rango`, 'error'); return undefined; }
                }
                return val;
            }

            e = e.replace(/sensor_adelante\s*\(\)/g, () => `"${this.world.sensorForward()}"`);
            e = e.replace(/sensor_derecha\s*\(\)/g, () => `"${this.world.sensorRight()}"`);
            e = e.replace(/sensor_izquierda\s*\(\)/g, () => `"${this.world.sensorLeft()}"`);
            e = e.replace(/sensor_atras\s*\(\)/g, () => `"${this.world.sensorBack()}"`);
            e = e.replace(/posicion_x\s*\(\)/g, () => this.world.boat.x.toString());
            e = e.replace(/posicion_y\s*\(\)/g, () => this.world.boat.y.toString());
            e = e.replace(/rumbo_num\s*\(\)/g, () => this.world.boat.direction.toString());
            e = e.replace(/rumbo\s*\(\)/g, () => `"${this.world.getDirectionName()}"`);
            e = e.replace(/combustible\s*\(\)/g, () => this.world.boat.fuel.toString());
            e = e.replace(/carga\s*\(\)/g, () => this.world.boat.cargo.toString());
            e = e.replace(/puerto_cercano\s*\(\)/g, () => this.world.nearestPort().toString());
            e = e.replace(/distancia_puerto\s*\(\s*(.+?)\s*\)/g, (_, arg) => {
                const n = this.resolveArg(arg, line);
                return n !== undefined ? this.world.distanceToPort(n).toString() : '0';
            });
            e = e.replace(/distancia_puerto\s*\(\)/g, () => this.world.distanceToPort(this.world.nearestPort()).toString());
            e = e.replace(/puerto_x\s*\(\s*(.+?)\s*\)/g, (_, arg) => {
                const n = this.resolveArg(arg, line);
                return n !== undefined ? this.world.portX(n).toString() : '0';
            });
            e = e.replace(/puerto_y\s*\(\s*(.+?)\s*\)/g, (_, arg) => {
                const n = this.resolveArg(arg, line);
                return n !== undefined ? this.world.portY(n).toString() : '0';
            });
            e = e.replace(/puerto_x\s*\(\)/g, () => this.world.portX(this.world.nearestPort()).toString());
            e = e.replace(/puerto_y\s*\(\)/g, () => this.world.portY(this.world.nearestPort()).toString());

            e = e.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
                if (['true', 'false', 'True', 'False', 'null', 'undefined'].includes(match)) return match;
                if (this.variables[match] !== undefined) {
                    const v = this.variables[match];
                    if (typeof v === 'string') return `"${v}"`;
                    return String(v);
                }
                return match;
            });

            e = e.replace(/\bTrue\b/g, 'true');
            e = e.replace(/\bFalse\b/g, 'false');

            const safeExpr = e.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
            if (/^[\d\s+\-*/%().<>=!&|"'truefalse]+$/.test(safeExpr)) {
                const result = Function('"use strict"; return (' + e + ')')();
                return result;
            }

            if (!isNaN(Number(e))) return Number(e);

            if (this.variables[e] !== undefined) return this.variables[e];

            this.log(`✗ Línea ${line}: no puedo evaluar '${expr}'`, 'error');
            return undefined;
        } catch (_err) {
            this.log(`✗ Línea ${line}: error evaluando '${expr}'`, 'error');
            return undefined;
        }
    }

    evalCondition(condStr: string, line: number): boolean | undefined {
        const result = this.evalExpr(condStr, line);
        if (result === undefined) return undefined;
        return !!result;
    }

    resolveArg(arg: string, line: number): number | undefined {
        const trimmed = arg.trim();
        if (!isNaN(Number(trimmed))) return Number(trimmed);
        if (this.variables[trimmed] !== undefined) return Number(this.variables[trimmed]);
        return this.evalExpr(trimmed, line) as number | undefined;
    }
}
