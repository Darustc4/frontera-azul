
class Interpreter {
    constructor(gameWorld, consoleOutput) {
        this.world = gameWorld;
        this.consoleEl = consoleOutput;
        this.variables = {};
        this.functions = {};
        this.executionError = false;
        this.onStep = null;
        this.onCheckObjectives = null; // returns true if all objectives met
        this.objectivesComplete = false;
        this.silent = false;
    }

    log(message, type = 'info') {
        if (this.silent) return;
        const line = document.createElement('div');
        line.className = `log-${type}`;
        line.textContent = message;
        this.consoleEl.appendChild(line);
        this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }

    clearConsole() { this.consoleEl.innerHTML = ''; }
    getVariables() { return { ...this.variables }; }

    async execute(code, speed) {
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

    stop() { this.stopped = true; this.world.stop(); }

    consumeTurnFuel() {
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

    parse(lines, startIdx, baseIndent) {
        const commands = [];
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

                // else clause — must be at same indent as the if
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

    parseLine(line, lineNum) {
        let match;

        // repetir mientras condition:
        match = line.match(/^repetir\s+mientras\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'while', condition: match[1], body: [], needsBlock: true, line: lineNum };

        // repetir(n):
        match = line.match(/^repetir\s*\(\s*(.+?)\s*\)\s*:?\s*$/);
        if (match) return { type: 'loop', countExpr: match[1], body: [], needsBlock: true, line: lineNum };

        // for i in range(n):
        match = line.match(/^for\s+(\w+)\s+in\s+range\s*\(\s*(.+?)\s*\)\s*:?\s*$/);
        if (match) return { type: 'for', varName: match[1], countExpr: match[2], body: [], needsBlock: true, line: lineNum };

        // while condition:
        match = line.match(/^while\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'while', condition: match[1], body: [], needsBlock: true, line: lineNum };

        // if condition:
        match = line.match(/^if\s+(.+?)\s*:\s*$/);
        if (match) return { type: 'if', condition: match[1], body: [], elseBody: null, needsBlock: true, line: lineNum };

        // def name():
        match = line.match(/^def\s+(\w+)\s*\(\s*([\w,\s]*)\s*\)\s*:\s*$/);
        if (match) return { type: 'def', name: match[1], params: match[2].split(',').map(s => s.trim()).filter(Boolean), body: [], needsBlock: true, line: lineNum };

        // Variable assignment
        match = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (match && !this.isKeyword(match[1]))
            return { type: 'assign', name: match[1], expr: match[2], line: lineNum };

        // avanzar(n)
        match = line.match(/^avanzar\s*\(\s*(.+?)\s*\)\s*$/);
        if (match) return { type: 'advance', expr: match[1], line: lineNum };

        // girar_derecha()
        if (/^girar_derecha\s*\(\s*\)\s*$/.test(line)) return { type: 'turn_right', line: lineNum };

        // girar_izquierda()
        if (/^girar_izquierda\s*\(\s*\)\s*$/.test(line)) return { type: 'turn_left', line: lineNum };

        // recoger()
        if (/^recoger\s*\(\s*\)\s*$/.test(line)) return { type: 'collect', line: lineNum };

        // print(...)
        match = line.match(/^print\s*\(\s*(.+)\s*\)\s*$/);
        if (match) return { type: 'print', expr: match[1], line: lineNum };

        // Function call: name() or name(args)
        match = line.match(/^(\w+)\s*\(\s*(.*?)\s*\)\s*$/);
        if (match) return { type: 'call', name: match[1], argsExpr: match[2], line: lineNum };

        this.log(`✗ Línea ${lineNum}: no entiendo "${line}"`, 'error');
        return null;
    }

    isKeyword(word) {
        return ['if', 'else', 'for', 'while', 'def', 'repetir', 'mientras', 'in', 'range', 'and', 'or', 'not', 'True', 'False'].includes(word);
    }

    // ==================== EXECUTOR ====================

    async executeLive(commands) {
        for (const cmd of commands) {
            if (this.executionError || this.stopped) return false;
            if (this.objectivesComplete) return true;
            if (!await this.executeLiveOne(cmd)) return false;
        }
        return true;
    }

    async executeLiveOne(cmd) {
        if (this.stopped) return false;

        switch (cmd.type) {
            case 'assign': {
                const val = this.evalExpr(cmd.expr, cmd.line);
                if (val === undefined) return false;
                this.variables[cmd.name] = val;
                return true;
            }

            case 'advance': {
                const steps = this.evalExpr(cmd.expr, cmd.line);
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
                // Check objectives after collecting (may satisfy cargo goals)
                if (this.onCheckObjectives && this.onCheckObjectives()) {
                    this.objectivesComplete = true;
                }
                return true;
            }

            case 'print': {
                const val = this.evalExpr(cmd.expr, cmd.line);
                if (val === undefined) return false;
                this.log(String(val), 'info');
                return true;
            }

            case 'loop': {
                const count = this.evalExpr(cmd.countExpr, cmd.line);
                if (count === undefined) return false;
                const n = Math.floor(Number(count));
                if (isNaN(n) || n < 0) { this.log(`✗ Línea ${cmd.line}: repetir necesita un número positivo`, 'error'); return false; }
                for (let i = 0; i < n; i++) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    if (!await this.executeLive(cmd.body)) return false;
                }
                return true;
            }

            case 'for': {
                const count = this.evalExpr(cmd.countExpr, cmd.line);
                if (count === undefined) return false;
                const n = Math.floor(Number(count));
                if (isNaN(n) || n < 0) return false;
                for (let i = 0; i < n; i++) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    this.variables[cmd.varName] = i;
                    if (!await this.executeLive(cmd.body)) return false;
                }
                return true;
            }

            case 'while': {
                let iterations = 0;
                const MAX_ITER = 5000;
                while (iterations < MAX_ITER) {
                    if (this.stopped || this.executionError) return false;
                    if (this.objectivesComplete) return true;
                    const cond = this.evalCondition(cmd.condition, cmd.line);
                    if (cond === undefined) return false;
                    if (!cond) break;
                    if (!await this.executeLive(cmd.body)) return false;
                    iterations++;
                }
                if (iterations >= MAX_ITER) {
                    this.log(`✗ Línea ${cmd.line}: bucle while excede ${MAX_ITER} iteraciones`, 'error');
                    return false;
                }
                return true;
            }

            case 'if': {
                const cond = this.evalCondition(cmd.condition, cmd.line);
                if (cond === undefined) return false;
                if (cond) return await this.executeLive(cmd.body);
                else if (cmd.elseBody) return await this.executeLive(cmd.elseBody);
                return true;
            }

            case 'def':
                this.functions[cmd.name] = { params: cmd.params, body: cmd.body };
                return true;

            case 'call':
                return await this.executeLiveCall(cmd);

            default:
                this.log(`✗ Comando desconocido: ${cmd.type}`, 'error');
                return false;
        }
    }

    async moveSteps(dx, dy, n, line) {
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

            // Check if objectives are satisfied — stop early
            if (this.onCheckObjectives && this.onCheckObjectives()) {
                this.objectivesComplete = true;
                return true;
            }
        }
        return true;
    }

    async executeLiveCall(cmd) {
        const fn = this.functions[cmd.name];
        if (!fn) { this.log(`✗ Línea ${cmd.line}: función '${cmd.name}' no definida`, 'error'); return false; }

        const args = cmd.argsExpr ? cmd.argsExpr.split(',').map(a => this.evalExpr(a.trim(), cmd.line)) : [];
        if (args.some(a => a === undefined)) return false;

        const savedVars = { ...this.variables };
        for (let i = 0; i < fn.params.length; i++)
            this.variables[fn.params[i]] = args[i] !== undefined ? args[i] : 0;

        const result = await this.executeLive(fn.body);

        // Restore only the parameter variables
        for (const p of fn.params) {
            if (savedVars[p] !== undefined) this.variables[p] = savedVars[p];
            else delete this.variables[p];
        }
        return result;
    }

    // ==================== EXPRESSION EVALUATOR ====================

    evalExpr(expr, line) {
        try {
            let e = expr.trim();

            // String literal
            if ((e.startsWith('"') && e.endsWith('"')) || (e.startsWith("'") && e.endsWith("'")))
                return e.slice(1, -1);

            // escanear()
            if (/^escanear\s*\(\)\s*$/.test(e)) return this.world.scan();

            // Boolean: or
            if (/\bor\b/.test(e)) {
                const parts = e.split(/\bor\b/);
                for (const p of parts) { const v = this.evalExpr(p.trim(), line); if (v) return v; }
                return false;
            }
            // Boolean: and
            if (/\band\b/.test(e)) {
                const parts = e.split(/\band\b/);
                let result = true;
                for (const p of parts) { const v = this.evalExpr(p.trim(), line); if (!v) return false; result = v; }
                return result;
            }

            // not
            const notMatch = e.match(/^not\s+(.+)$/);
            if (notMatch) { const v = this.evalExpr(notMatch[1], line); return v === undefined ? undefined : !v; }

            // Comparison (must come before unary negation to handle -x > -y)
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

            // Unary negation (only if no comparison operator present)
            const unaryNeg = e.match(/^-\s*(.+)$/);
            if (unaryNeg) {
                const v = this.evalExpr(unaryNeg[1], line);
                return v === undefined ? undefined : -v;
            }

            // Modulo: expr % expr
            const modMatch = e.match(/^(.+?)\s*%\s*(.+)$/);
            if (modMatch) {
                const left = this.evalExpr(modMatch[1], line);
                const right = this.evalExpr(modMatch[2], line);
                if (left === undefined || right === undefined) return undefined;
                return ((left % right) + right) % right; // Python-style modulo
            }

            // Array indexing: var[i][j] or var[i]
            const idxMatch = e.match(/^(\w+)((?:\s*\[\s*.+?\s*\])+)\s*$/);
            if (idxMatch) {
                let val = this.variables[idxMatch[1]];
                if (val === undefined) { this.log(`✗ Línea ${line}: variable '${idxMatch[1]}' no definida`, 'error'); return undefined; }
                const idxRegex = /\[\s*(.+?)\s*\]/g;
                let m;
                while ((m = idxRegex.exec(idxMatch[2])) !== null) {
                    const idx = this.evalExpr(m[1], line);
                    if (idx === undefined) return undefined;
                    if (!Array.isArray(val)) { this.log(`✗ Línea ${line}: no se puede indexar '${idxMatch[1]}'`, 'error'); return undefined; }
                    val = val[idx];
                    if (val === undefined) { this.log(`✗ Línea ${line}: índice fuera de rango`, 'error'); return undefined; }
                }
                return val;
            }

            // Built-in sensor/utility function calls
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
            // Port utilities
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

            // Variable substitution
            e = e.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
                if (['true', 'false', 'True', 'False', 'null', 'undefined'].includes(match)) return match;
                if (this.variables[match] !== undefined) {
                    const v = this.variables[match];
                    if (typeof v === 'string') return `"${v}"`;
                    return String(v);
                }
                return match;
            });

            // Python booleans
            e = e.replace(/\bTrue\b/g, 'true');
            e = e.replace(/\bFalse\b/g, 'false');

            // Safe arithmetic eval
            const safeExpr = e.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
            if (/^[\d\s+\-*/%().<>=!&|"'truefalse]+$/.test(safeExpr)) {
                const result = Function('"use strict"; return (' + e + ')')();
                return result;
            }

            // Plain number
            if (!isNaN(Number(e))) return Number(e);

            // Variable holding array
            if (this.variables[e] !== undefined) return this.variables[e];

            this.log(`✗ Línea ${line}: no puedo evaluar '${expr}'`, 'error');
            return undefined;
        } catch (err) {
            this.log(`✗ Línea ${line}: error evaluando '${expr}'`, 'error');
            return undefined;
        }
    }

    evalCondition(condStr, line) {
        const result = this.evalExpr(condStr, line);
        if (result === undefined) return undefined;
        return !!result;
    }

    /**
     * Resolve a function argument that could be a literal or a variable.
     */
    resolveArg(arg, line) {
        const trimmed = arg.trim();
        if (!isNaN(Number(trimmed))) return Number(trimmed);
        if (this.variables[trimmed] !== undefined) return Number(this.variables[trimmed]);
        return this.evalExpr(trimmed, line);
    }
}
