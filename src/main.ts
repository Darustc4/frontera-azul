/**
 * La Frontera Azul - Main Application (v3)
 * Uses Pyodide for real Python execution with animated replay.
 */

import { GameWorld } from './game';
import { PythonExecutor } from './python-executor';
import { MISSIONS, Mission } from './missions';
import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    // ==================== INITIALIZATION ====================
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const world = new GameWorld(canvas);
    const consoleOutput = document.getElementById('console-output')!;
    const executor = new PythonExecutor(world, consoleOutput);

    executor.onStep = () => updateStatus();

    // UI Elements
    const codeEditor = document.getElementById('code-editor') as HTMLTextAreaElement;
    const lineNumbers = document.getElementById('line-numbers')!;
    const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
    const btnValidate = document.getElementById('btn-validate') as HTMLButtonElement;
    const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
    const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
    const btnMissions = document.getElementById('btn-missions') as HTMLButtonElement;
    const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
    const coordsDisplay = document.getElementById('coords-display')!;
    const fuelDisplay = document.getElementById('fuel-display')!;
    const fuelFill = document.getElementById('fuel-fill')!;
    const cargoDisplay = document.getElementById('cargo-display')!;
    const messageDisplay = document.getElementById('message-display')!;
    const missionLabel = document.getElementById('mission-label')!;
    const objectivesList = document.getElementById('objectives-list')!;

    // Modals
    const missionModal = document.getElementById('mission-modal')!;
    const modalTitle = document.getElementById('modal-title')!;
    const modalText = document.getElementById('modal-text')!;
    const modalObjectives = document.getElementById('modal-objectives')!;
    const modalAccept = document.getElementById('modal-accept')!;
    const successModal = document.getElementById('success-modal')!;
    const successTitle = document.getElementById('success-title')!;
    const successBody = document.getElementById('success-body')!;
    const successNext = document.getElementById('success-next') as HTMLButtonElement;

    // Sidebar
    const missionsSidebar = document.getElementById('missions-sidebar')!;
    const missionsList = document.getElementById('missions-list')!;
    const closeMissions = document.getElementById('close-missions')!;

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // State
    let currentMissionIdx = 0;
    let missionStates: string[] = MISSIONS.map(() => 'locked');
    missionStates[0] = 'current';
    loadProgress();

    // ==================== LINE NUMBERS ====================

    function updateLineNumbers() {
        const lines = codeEditor.value.split('\n').length;
        let text = '';
        for (let i = 1; i <= Math.max(lines, 12); i++) text += i + '\n';
        lineNumbers.textContent = text;
    }

    codeEditor.addEventListener('input', updateLineNumbers);
    codeEditor.addEventListener('scroll', () => { lineNumbers.scrollTop = codeEditor.scrollTop; });

    codeEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeEditor.selectionStart;
            const end = codeEditor.selectionEnd;
            codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
            updateLineNumbers();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
    });

    // ==================== TABS ====================

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + (btn as HTMLElement).dataset.tab)!.classList.add('active');
        });
    });

    // ==================== STATUS UPDATES ====================

    function updateStatus() {
        coordsDisplay.textContent = `Pos: (${world.boat.x}, ${world.boat.y}) | ${world.getDirectionName()}`;
        fuelDisplay.textContent = `⛽ ${world.boat.fuel}`;
        const pct = (world.boat.fuel / world.boat.maxFuel) * 100;
        fuelFill.style.width = pct + '%';
        fuelFill.className = 'fuel-fill' + (pct < 20 ? ' critical' : pct < 40 ? ' low' : '');
        cargoDisplay.textContent = `📦 Bodega: ${world.boat.cargo}/${world.boat.maxCargo}`;

        const cell = world.getCellType(world.boat.x, world.boat.y);
        if (cell === 'puerto') messageDisplay.textContent = '⚓ En puerto';
        else if (cell === 'pesca') messageDisplay.textContent = '🐟 Zona de pesca';
        else messageDisplay.textContent = '';

        updateSensorDisplay();
        updateVariablesDisplay();
    }

    function updateSensorDisplay() {
        const grid = world.getSensorGrid();
        const sensorGrid = document.getElementById('sensor-grid')!;
        const sensorInfo = document.getElementById('sensor-info')!;

        const typeIcons: Record<string, string> = { agua: '~', arrecife: '▲', puerto: '⚓', pesca: '🐟', boat: '🚢', tierra: '▓', fuera: '▓' };
        const typeClasses: Record<string, string> = { agua: 'water', arrecife: 'obstacle', puerto: 'port', pesca: 'fish', boat: 'boat', tierra: 'land', fuera: 'land' };

        let html = '';
        grid.forEach((row) => {
            row.forEach((cell) => {
                const cls = typeClasses[cell.type] || 'water';
                const icon = typeIcons[cell.type] || '?';
                html += `<div class="sensor-cell ${cls}">${icon}</div>`;
            });
        });
        sensorGrid.innerHTML = html;

        const scan = world.scan();
        sensorInfo.innerHTML = `
            <div><b>Relativo al rumbo:</b></div>
            <div><code>[1][2]</code> Adelante: <strong>${scan[1][2]}</strong></div>
            <div><code>[3][2]</code> Atrás: <strong>${scan[3][2]}</strong></div>
            <div><code>[2][3]</code> Estribor: <strong>${scan[2][3]}</strong></div>
            <div><code>[2][1]</code> Babor: <strong>${scan[2][1]}</strong></div>
            <div style="margin-top:6px">📍 (${world.boat.x}, ${world.boat.y})</div>
            <div>🧭 ${world.getDirectionName()}</div>
            <div>⛽ ${world.boat.fuel}</div>
            <div>P${world.nearestPort()} a dist ${world.distanceToPort(world.nearestPort())}</div>
        `;
    }

    function updateVariablesDisplay() {
        const container = document.getElementById('variables-display')!;
        const vars = executor.getVariables();
        const keys = Object.keys(vars);

        if (keys.length === 0) {
            container.innerHTML = '<p class="empty-state">Las variables aparecerán aquí al ejecutar tu código.</p>';
            return;
        }

        let html = '';
        keys.forEach(k => {
            const v = vars[k];
            let display: string;
            if (Array.isArray(v)) display = `[${v.length > 5 ? v.slice(0, 3).join(',') + '...' : v.join(',')}]`;
            else display = JSON.stringify(v);
            html += `<div class="var-item"><span class="var-name">${k}</span><span class="var-value">${display}</span></div>`;
        });
        container.innerHTML = html;
    }

    // ==================== MISSION SYSTEM ====================

    function getCurrentMission(): Mission { return MISSIONS[currentMissionIdx]; }

    function loadMission(idx: number) {
        currentMissionIdx = idx;
        const mission = MISSIONS[idx];
        missionLabel.textContent = `Misión ${mission.id}: ${mission.title}`;
        codeEditor.value = mission.starterCode;
        updateLineNumbers();

        setupMissionWorld(mission);
        world.render();
        renderObjectives();
        updateStatus();
        showMissionBriefing(mission);
    }

    function showMissionBriefing(mission: Mission) {
        modalTitle.textContent = `Misión ${mission.id}: ${mission.title}`;
        modalText.innerHTML = mission.briefing;

        let objHtml = '<h4>Objetivos:</h4><ul>';
        mission.objectives.forEach(o => { objHtml += `<li>${o.text}</li>`; });
        objHtml += '</ul>';
        if (mission.hint) objHtml += `<p style="margin-top:10px;font-size:0.8rem;color:var(--text-dim)">💡 Pista: ${mission.hint}</p>`;
        modalObjectives.innerHTML = objHtml;
        missionModal.classList.add('visible');
    }

    function renderObjectives() {
        const mission = getCurrentMission();
        objectivesList.innerHTML = '';
        mission.objectives.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = obj.text;
            li.className = 'active';
            objectivesList.appendChild(li);
        });
    }

    function checkObjectives(code: string): boolean {
        const mission = getCurrentMission();
        let allComplete = true;
        const items = objectivesList.querySelectorAll('li');

        mission.objectives.forEach((obj, i) => {
            const passed = obj.check(world.boat, mission.startPos, code, world);
            if (items[i]) {
                items[i].className = passed ? 'completed' : 'active';
            }
            if (!passed) allComplete = false;
        });
        return allComplete;
    }

    function completeMission() {
        const mission = getCurrentMission();
        missionStates[currentMissionIdx] = 'completed';

        mission.unlocks.forEach(id => {
            const idx = MISSIONS.findIndex(m => m.id === id);
            if (idx >= 0 && missionStates[idx] === 'locked')
                missionStates[idx] = 'current';
        });

        saveProgress();

        successTitle.textContent = `¡Misión ${mission.id} Completada!`;
        successBody.innerHTML = `<p>${mission.successMsg}</p>`;
        const nextIdx = MISSIONS.findIndex((_m, i) => missionStates[i] === 'current');
        successNext.style.display = nextIdx >= 0 ? 'inline-block' : 'none';
        successNext.onclick = () => {
            successModal.classList.remove('visible');
            if (nextIdx >= 0) loadMission(nextIdx);
        };
        successModal.classList.add('visible');
    }

    function renderMissionsSidebar() {
        missionsList.innerHTML = '';
        MISSIONS.forEach((mission, idx) => {
            const state = missionStates[idx];
            const card = document.createElement('div');
            card.className = `mission-card ${state === 'completed' ? 'completed' : state === 'current' ? 'active' : 'locked'}`;
            card.innerHTML = `
                <h4>${mission.id}. ${mission.title}</h4>
                <p class="mission-desc">${mission.subtitle}</p>
                <span class="mission-status status-${state}">${state === 'completed' ? '✓ Completada' : state === 'current' ? '● Disponible' : '🔒 Bloqueada'}</span>
            `;
            if (state !== 'locked') {
                card.addEventListener('click', () => {
                    loadMission(idx);
                    missionsSidebar.classList.add('hidden');
                });
            }
            missionsList.appendChild(card);
        });
    }

    // ==================== PERSISTENCE ====================

    function saveProgress() {
        try { localStorage.setItem('frontera_azul_v2', JSON.stringify(missionStates)); } catch (_e) { /* ignore */ }
    }

    function loadProgress() {
        try {
            const saved = localStorage.getItem('frontera_azul_v2');
            if (saved) {
                const states = JSON.parse(saved);
                if (states.length === MISSIONS.length) missionStates = states;
            }
        } catch (_e) { /* ignore */ }
    }

    // ==================== MISSION SETUP HELPER ====================

    function setupMissionWorld(mission: Mission) {
        world.resetMap();
        world.reset(mission.startPos, mission.startDir, mission.fuel);
        world.setFog(!!mission.fog);
        if (mission.fixedReefs) world.addFixedReefs(mission.fixedReefs);
        if (mission.randomReefs > 0) world.addRandomReefs(mission.randomReefs, [mission.startPos]);
        if (mission.randomFish > 0) world.addRandomFish(mission.randomFish, [mission.startPos]);
    }

    // ==================== CODE EXECUTION ====================

    async function runCode() {
        if (world.animating) return;

        const code = codeEditor.value.trim();
        if (!code) { executor.log('⚠ Escribe código primero.', 'warning'); return; }

        const mission = getCurrentMission();
        setupMissionWorld(mission);
        renderObjectives();

        btnRun.disabled = true;
        btnValidate.disabled = true;
        btnStop.disabled = false;
        btnRun.textContent = '⏳ Ejecutando...';
        world.animating = true;

        executor.log('─'.repeat(40), 'system');

        // Execute Python code (instant, no animation)
        const result = await executor.execute(code);

        if (executor.stopped) {
            world.animating = false;
            updateStatus();
            btnRun.disabled = false;
            btnValidate.disabled = false;
            btnStop.disabled = true;
            btnRun.textContent = '▶ Probar';
            return;
        }

        // Replay actions with animation
        if (result.actions.length > 0) {
            setupMissionWorld(mission);
            const speed = 550 - parseInt(speedSlider.value);
            await executor.replayActions(result.actions, speed, mission.startPos, mission.startDir, mission.fuel);
        }

        world.animating = false;
        updateStatus();
        updateVariablesDisplay();

        if (result.success || result.actions.length > 0) {
            const allDone = checkObjectives(code);
            if (allDone) {
                executor.log('🎯 ¡Todos los objetivos cumplidos! Usa "Validar" para completar.', 'success');
            }
        }

        btnRun.disabled = false;
        btnValidate.disabled = false;
        btnStop.disabled = true;
        btnRun.textContent = '▶ Probar';
    }

    // ==================== VALIDATION (multi-run) ====================

    async function validateCode() {
        if (world.animating) return;

        const code = codeEditor.value.trim();
        if (!code) { executor.log('⚠ Escribe código primero.', 'warning'); return; }

        const mission = getCurrentMission();
        const RUNS = 10;
        let failures = 0;

        btnRun.disabled = true;
        btnValidate.disabled = true;
        btnStop.disabled = false;
        executor.log('─'.repeat(40), 'system');
        executor.log(`🔍 Validando solución (${RUNS} ejecuciones)...`, 'system');

        for (let run = 0; run < RUNS; run++) {
            if (executor.stopped) break;

            setupMissionWorld(mission);

            executor.silent = true;
            world.animating = true;
            const result = await executor.execute(code);
            executor.silent = false;
            world.animating = false;

            const allDone = mission.objectives.every(obj => obj.check(world.boat, mission.startPos, code, world));
            if (!result.success || !allDone) {
                failures++;
            }
        }

        if (executor.stopped) {
            executor.log('⏹ Validación detenida.', 'warning');
        } else if (failures === 0) {
            executor.log(`✓ ¡${RUNS}/${RUNS} ejecuciones exitosas! Misión completada.`, 'success');
            completeMission();
        } else {
            executor.log(`✗ ${failures}/${RUNS} ejecuciones fallidas. Ajusta tu algoritmo.`, 'error');
            setupMissionWorld(mission);
            world.render();
        }

        updateStatus();
        btnRun.disabled = false;
        btnValidate.disabled = false;
        btnStop.disabled = true;
    }

    // ==================== EVENT HANDLERS ====================

    btnRun.addEventListener('click', runCode);
    btnValidate.addEventListener('click', validateCode);

    btnStop.addEventListener('click', () => { executor.stop(); });

    btnReset.addEventListener('click', () => {
        const mission = getCurrentMission();
        setupMissionWorld(mission);
        updateStatus();
        renderObjectives();
        executor.log('↺ Barco reiniciado.', 'system');
    });

    btnMissions.addEventListener('click', () => {
        renderMissionsSidebar();
        missionsSidebar.classList.toggle('hidden');
    });

    closeMissions.addEventListener('click', () => { missionsSidebar.classList.add('hidden'); });
    modalAccept.addEventListener('click', () => { missionModal.classList.remove('visible'); });

    speedSlider.addEventListener('input', () => {
        world.animSpeed = 550 - parseInt(speedSlider.value);
    });

    // ==================== INITIAL LOAD ====================

    updateLineNumbers();
    loadMission(currentMissionIdx);
    updateStatus();

    // Pre-load Pyodide in background
    executor.ensureLoaded();
});
