import { useState, useRef, useEffect, useCallback } from 'react';
import { GameWorld } from './game';
import { PythonExecutor } from './python-executor';
import { MISSIONS, Mission } from './missions';
import { Header } from './components/Header';
import { WorldPanel } from './components/WorldPanel';
import { EditorPanel } from './components/EditorPanel';
import { MissionModal } from './components/MissionModal';
import { SuccessModal } from './components/SuccessModal';
import { MissionsSidebar } from './components/MissionsSidebar';

export interface LogEntry {
  id: number;
  message: string;
  type: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<GameWorld | null>(null);
  const executorRef = useRef<PythonExecutor | null>(null);

  const [currentMissionIdx, setCurrentMissionIdx] = useState(0);
  const [missionStates, setMissionStates] = useState<string[]>(() => {
    const states = MISSIONS.map(() => 'locked');
    states[0] = 'current';
    try {
      const saved = localStorage.getItem('frontera_azul_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.length === MISSIONS.length) return parsed;
      }
    } catch (_e) { /* ignore */ }
    return states;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [running, setRunning] = useState(false);
  const [code, setCode] = useState(MISSIONS[0].starterCode);
  const [speed, setSpeed] = useState(180);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [fuelPct, setFuelPct] = useState(100);
  const [fuelAmount, setFuelAmount] = useState(100);
  const [cargoText, setCargoText] = useState('0/5');
  const [messageText, setMessageText] = useState('');
  const [objectives, setObjectives] = useState<{ text: string; completed: boolean }[]>([]);
  const [sensorGrid, setSensorGrid] = useState<{ type: string }[][]>([]);
  const [sensorInfo, setSensorInfo] = useState('');
  const [successTitle, setSuccessTitle] = useState('');
  const [successBody, setSuccessBody] = useState('');
  const [hasNextMission, setHasNextMission] = useState(false);

  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: string) => {
    const id = ++logIdRef.current;
    setLogs(prev => [...prev, { id, message, type }]);
  }, []);

  const updateStatus = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    setStatusText(`Pos: (${world.boat.x}, ${world.boat.y}) | ${world.getDirectionName()}`);
    const pct = (world.boat.fuel / world.boat.maxFuel) * 100;
    setFuelPct(pct);
    setFuelAmount(world.boat.fuel);
    setCargoText(`${world.boat.cargo}/${world.boat.maxCargo}`);

    const cell = world.getCellType(world.boat.x, world.boat.y);
    if (cell === 'puerto') setMessageText('En puerto');
    else if (cell === 'pesca') setMessageText('Zona de pesca');
    else setMessageText('');

    // Sensor grid
    const grid = world.getSensorGrid();
    setSensorGrid(grid);

    const scan = world.scan();
    setSensorInfo(
      `Adelante: ${scan[1][2]} | Atrás: ${scan[3][2]} | Estribor: ${scan[2][3]} | Babor: ${scan[2][1]}\n` +
      `Pos: (${world.boat.x}, ${world.boat.y}) | ${world.getDirectionName()} | Fuel: ${world.boat.fuel}\n` +
      `P${world.nearestPort()} a dist ${world.distanceToPort(world.nearestPort())}`
    );
  }, []);

  const setupMissionWorld = useCallback((mission: Mission) => {
    const world = worldRef.current;
    if (!world) return;
    world.resetMap();
    world.reset(mission.startPos, mission.startDir, mission.fuel);
    world.setFog(!!mission.fog);
    if (mission.fixedReefs) world.addFixedReefs(mission.fixedReefs);
    if (mission.randomReefs > 0) world.addRandomReefs(mission.randomReefs, [mission.startPos]);
    if (mission.randomFish > 0) world.addRandomFish(mission.randomFish, [mission.startPos]);
  }, []);

  const renderObjectives = useCallback((missionIdx: number) => {
    const mission = MISSIONS[missionIdx];
    setObjectives(mission.objectives.map(obj => ({ text: obj.text, completed: false })));
  }, []);

  const checkObjectives = useCallback((missionIdx: number, codeStr: string): boolean => {
    const world = worldRef.current;
    if (!world) return false;
    const mission = MISSIONS[missionIdx];
    let allComplete = true;
    const results = mission.objectives.map(obj => {
      const passed = obj.check(world.boat, mission.startPos, codeStr, world);
      if (!passed) allComplete = false;
      return { text: obj.text, completed: passed };
    });
    setObjectives(results);
    return allComplete;
  }, []);

  const loadMission = useCallback((idx: number) => {
    const mission = MISSIONS[idx];
    setCurrentMissionIdx(idx);
    setCode(mission.starterCode);
    setupMissionWorld(mission);
    worldRef.current?.render();
    renderObjectives(idx);
    updateStatus();
    setShowMissionModal(true);
  }, [setupMissionWorld, renderObjectives, updateStatus]);

  // Initialize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || worldRef.current) return;

    const world = new GameWorld(canvas);
    worldRef.current = world;

    const executor = new PythonExecutor(world);
    executor.onLog = addLog;
    executor.onStep = () => updateStatus();
    executorRef.current = executor;

    // Load first available mission
    const firstAvailable = missionStates.findIndex(s => s === 'current');
    const idx = firstAvailable >= 0 ? firstAvailable : 0;
    const mission = MISSIONS[idx];
    setCurrentMissionIdx(idx);
    setCode(mission.starterCode);
    setupMissionWorld(mission);
    world.render();
    renderObjectives(idx);
    updateStatus();
    setShowMissionModal(true);

    // Pre-load Pyodide
    executor.ensureLoaded();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProgress = useCallback((states: string[]) => {
    try { localStorage.setItem('frontera_azul_v2', JSON.stringify(states)); } catch (_e) { /* ignore */ }
  }, []);

  const runCode = useCallback(async () => {
    const world = worldRef.current;
    const executor = executorRef.current;
    if (!world || !executor || world.animating) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) { addLog('[!] Escribe código primero.', 'warning'); return; }

    const mission = MISSIONS[currentMissionIdx];
    setupMissionWorld(mission);
    renderObjectives(currentMissionIdx);

    setRunning(true);
    world.animating = true;

    addLog('─'.repeat(40), 'system');

    const result = await executor.execute(trimmedCode);

    if (executor.stopped) {
      world.animating = false;
      updateStatus();
      setRunning(false);
      return;
    }

    if (result.actions.length > 0) {
      setupMissionWorld(mission);
      const animSpeed = 550 - speed;
      await executor.replayActions(result.actions, animSpeed, mission.startPos, mission.startDir, mission.fuel);
    }

    world.animating = false;
    updateStatus();
    setVariables(executor.getVariables());

    if (result.success || result.actions.length > 0) {
      const allDone = checkObjectives(currentMissionIdx, trimmedCode);
      if (allDone) {
        addLog('[OK] ¡Todos los objetivos cumplidos! Usa "Validar" para completar.', 'success');
      }
    }

    setRunning(false);
  }, [code, currentMissionIdx, speed, setupMissionWorld, renderObjectives, updateStatus, checkObjectives, addLog]);

  const validateCode = useCallback(async () => {
    const world = worldRef.current;
    const executor = executorRef.current;
    if (!world || !executor || world.animating) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) { addLog('[!] Escribe código primero.', 'warning'); return; }

    const mission = MISSIONS[currentMissionIdx];
    const RUNS = 10;
    let failures = 0;

    setRunning(true);
    addLog('─'.repeat(40), 'system');
    addLog(`[~] Validando solución (${RUNS} ejecuciones)...`, 'system');

    for (let run = 0; run < RUNS; run++) {
      if (executor.stopped) break;

      setupMissionWorld(mission);
      executor.silent = true;
      world.animating = true;
      const result = await executor.execute(trimmedCode);
      executor.silent = false;
      world.animating = false;

      const allDone = mission.objectives.every(obj => obj.check(world.boat, mission.startPos, trimmedCode, world));
      if (!result.success || !allDone) {
        failures++;
      }
    }

    if (executor.stopped) {
      addLog('[x] Validación detenida.', 'warning');
    } else if (failures === 0) {
      addLog(`[OK] ¡${RUNS}/${RUNS} ejecuciones exitosas! Misión completada.`, 'success');
      // Complete mission
      const newStates = [...missionStates];
      newStates[currentMissionIdx] = 'completed';
      mission.unlocks.forEach(id => {
        const unlockIdx = MISSIONS.findIndex(m => m.id === id);
        if (unlockIdx >= 0 && newStates[unlockIdx] === 'locked')
          newStates[unlockIdx] = 'current';
      });
      setMissionStates(newStates);
      saveProgress(newStates);

      setSuccessTitle(`¡Misión ${mission.id} Completada!`);
      setSuccessBody(mission.successMsg);
      const nextIdx = MISSIONS.findIndex((_m, i) => newStates[i] === 'current');
      setHasNextMission(nextIdx >= 0);
      setShowSuccessModal(true);
    } else {
      addLog(`[ERR] ${failures}/${RUNS} ejecuciones fallidas. Ajusta tu algoritmo.`, 'error');
      setupMissionWorld(mission);
      world.render();
    }

    updateStatus();
    setRunning(false);
  }, [code, currentMissionIdx, missionStates, setupMissionWorld, updateStatus, addLog, saveProgress]);

  const handleStop = useCallback(() => {
    executorRef.current?.stop();
  }, []);

  const handleReset = useCallback(() => {
    const mission = MISSIONS[currentMissionIdx];
    setupMissionWorld(mission);
    updateStatus();
    renderObjectives(currentMissionIdx);
    addLog('[~] Barco reiniciado.', 'system');
  }, [currentMissionIdx, setupMissionWorld, updateStatus, renderObjectives, addLog]);

  const handleNextMission = useCallback(() => {
    setShowSuccessModal(false);
    const nextIdx = MISSIONS.findIndex((_m, i) => missionStates[i] === 'current');
    if (nextIdx >= 0) loadMission(nextIdx);
  }, [missionStates, loadMission]);

  const handleSelectMission = useCallback((idx: number) => {
    loadMission(idx);
    setShowSidebar(false);
  }, [loadMission]);

  const currentMission = MISSIONS[currentMissionIdx];

  return (
    <>
      <Header
        missionLabel={`Misión ${currentMission.id}: ${currentMission.title}`}
        onMissionsClick={() => setShowSidebar(prev => !prev)}
      />

      <main className="flex flex-1 overflow-hidden">
        <WorldPanel
          canvasRef={canvasRef}
          speed={speed}
          onSpeedChange={setSpeed}
          statusText={statusText}
          fuelPct={fuelPct}
          fuelAmount={fuelAmount}
          cargoText={cargoText}
          messageText={messageText}
          objectives={objectives}
        />
        <EditorPanel
          code={code}
          onCodeChange={setCode}
          running={running}
          onRun={runCode}
          onValidate={validateCode}
          onStop={handleStop}
          onReset={handleReset}
          logs={logs}
          variables={variables}
          sensorGrid={sensorGrid}
          sensorInfo={sensorInfo}
        />
      </main>

      {showMissionModal && (
        <MissionModal
          mission={currentMission}
          onAccept={() => setShowMissionModal(false)}
        />
      )}

      {showSuccessModal && (
        <SuccessModal
          title={successTitle}
          body={successBody}
          hasNext={hasNextMission}
          onNext={handleNextMission}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      {showSidebar && (
        <MissionsSidebar
          missions={MISSIONS}
          missionStates={missionStates}
          onSelect={handleSelectMission}
          onClose={() => setShowSidebar(false)}
        />
      )}
    </>
  );
}
