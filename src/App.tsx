import { useState, useRef, useEffect, useCallback } from 'react';
import { GameWorld } from './game';
import { PythonExecutor, GameAction } from './python-executor';
import { GameEvents } from './events';
import { MISSIONS, Mission } from './missions';
import { useI18n } from './i18n';
import { Header } from './components/Header';
import { WorldPanel } from './components/WorldPanel';
import { EditorPanel } from './components/EditorPanel';
import { MissionModal } from './components/MissionModal';
import { SuccessModal } from './components/SuccessModal';
import { MissionsSidebar } from './components/MissionsSidebar';
import { MapOverviewModal } from './components/MapOverviewModal';

export interface LogEntry {
  id: number;
  message: string;
  type: string;
}

export default function App() {
  const { t, locale } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<GameWorld | null>(null);
  const executorRef = useRef<PythonExecutor | null>(null);
  const eventsRef = useRef<GameEvents>(new GameEvents());

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
  const [showOverview, setShowOverview] = useState(false);
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
    if (cell === 'port') setMessageText(t('world.atPort'));
    else if (cell === 'fish') setMessageText(t('world.fishZone'));
    else setMessageText('');

    // Sensor grid
    const grid = world.getSensorGrid();
    setSensorGrid(grid);

    const scan = world.scan();
    setSensorInfo(
      `${t('sensor.ahead')}: ${scan[1][2]} | ${t('sensor.behind')}: ${scan[3][2]} | ${t('sensor.starboard')}: ${scan[2][3]} | ${t('sensor.port')}: ${scan[2][1]}\n` +
      `Pos: (${world.boat.x}, ${world.boat.y}) | ${world.getDirectionName()} | Fuel: ${world.boat.fuel}\n` +
      `P${world.nearestPort()} dist ${world.distanceToPort(world.nearestPort())}`
    );
  }, [t]);

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
    setObjectives(mission.objectives.map(obj => ({ text: t(`mission.${mission.id}.obj.${obj.id}`), completed: false })));
  }, [t]);

  const checkObjectives = useCallback((missionIdx: number, codeStr: string): boolean => {
    const world = worldRef.current;
    if (!world) return false;
    const mission = MISSIONS[missionIdx];
    let allComplete = true;
    const results = mission.objectives.map(obj => {
      const passed = obj.check(world.boat, mission.startPos, codeStr, world);
      if (!passed) allComplete = false;
      return { text: t(`mission.${mission.id}.obj.${obj.id}`), completed: passed };
    });
    setObjectives(results);
    return allComplete;
  }, [t]);

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

    const events = eventsRef.current;
    const world = new GameWorld(canvas);
    worldRef.current = world;

    const executor = new PythonExecutor(world, events);
    executorRef.current = executor;

    // Subscribe to events
    events.on('log', addLog);
    events.on('step', () => updateStatus());

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

  // Keep executor messages in sync with the active locale
  useEffect(() => {
    const executor = executorRef.current;
    if (!executor) return;
    executor.messages = {
      loading: t('executor.loading'),
      running: t('executor.running'),
      operationLimit: t('executor.operationLimit'),
      pythonReady: t('executor.pythonReady'),
      stopped: t('executor.stopped'),
      completed: t('executor.completed'),
      alreadyCollected: t('executor.alreadyCollected'),
      directions: t('executor.directions').split(','),
    };
  }, [locale, t]);

  const saveProgress = useCallback((states: string[]) => {
    try { localStorage.setItem('frontera_azul_v2', JSON.stringify(states)); } catch (_e) { /* ignore */ }
  }, []);

  const runCode = useCallback(async () => {
    const world = worldRef.current;
    const executor = executorRef.current;
    if (!world || !executor || world.animating) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) { addLog(t('log.noCode'), 'warning'); return; }

    const mission = MISSIONS[currentMissionIdx];
    setupMissionWorld(mission);
    renderObjectives(currentMissionIdx);

    setRunning(true);
    world.animating = true;

    addLog('─'.repeat(40), 'system');

    // Allow execution to stop early when all objectives are met
    executor.onCheckObjectives = () => {
      return mission.objectives.every(obj => obj.check(world.boat, mission.startPos, trimmedCode, world));
    };

    const result = await executor.execute(trimmedCode);
    executor.onCheckObjectives = null;

    if (executor.stopped) {
      world.animating = false;
      updateStatus();
      setRunning(false);
      return;
    }

    if (result.actions.length > 0) {
      setupMissionWorld(mission);
      const animSpeed = 550 - speed;

      // Check objectives after each step; stop early if all pass
      executor.onCheckObjectives = () => {
        const allDone = mission.objectives.every(obj => obj.check(world.boat, mission.startPos, trimmedCode, world));
        if (allDone) {
          const results = mission.objectives.map(obj => ({
            text: t(`mission.${mission.id}.obj.${obj.id}`),
            completed: true,
          }));
          setObjectives(results);
        }
        return allDone;
      };

      await executor.replayActions(result.actions, animSpeed, mission.startPos, mission.startDir, mission.fuel);
      executor.onCheckObjectives = null;
    }

    world.animating = false;
    updateStatus();
    setVariables(executor.getVariables());

    const allDone = checkObjectives(currentMissionIdx, trimmedCode);
    if (allDone) {
      addLog(t('log.allObjectives'), 'success');
    }

    setRunning(false);
  }, [code, currentMissionIdx, speed, setupMissionWorld, renderObjectives, updateStatus, checkObjectives, addLog, t]);

  const validateCode = useCallback(async () => {
    const world = worldRef.current;
    const executor = executorRef.current;
    if (!world || !executor || world.animating) return;

    const trimmedCode = code.trim();
    if (!trimmedCode) { addLog(t('log.noCode'), 'warning'); return; }

    const mission = MISSIONS[currentMissionIdx];
    const RUNS = 10;
    let failures = 0;
    let firstFailedActions: GameAction[] | null = null;
    let firstFailedMap: number[][] | null = null;
    let firstFailedObjectives: string[] = [];

    setRunning(true);
    addLog('─'.repeat(40), 'system');
    addLog(t('log.validating', { runs: RUNS }), 'system');

    for (let run = 0; run < RUNS; run++) {
      if (executor.stopped) break;

      setupMissionWorld(mission);
      const mapSnapshot = world.map.map(row => [...row]);
      executor.silent = true;
      world.animating = true;

      // Stop execution early when all objectives pass
      executor.onCheckObjectives = () => {
        return mission.objectives.every(obj => obj.check(world.boat, mission.startPos, trimmedCode, world));
      };

      const result = await executor.execute(trimmedCode);
      executor.onCheckObjectives = null;
      executor.silent = false;
      world.animating = false;

      const allDone = mission.objectives.every(obj => obj.check(world.boat, mission.startPos, trimmedCode, world));
      if (!result.success || !allDone) {
        failures++;
        if (!firstFailedActions) {
          firstFailedActions = result.actions;
          firstFailedMap = mapSnapshot;
          firstFailedObjectives = mission.objectives
            .filter(obj => !obj.check(world.boat, mission.startPos, trimmedCode, world))
            .map(obj => t(`mission.${mission.id}.obj.${obj.id}`));
        }
      }
    }

    if (executor.stopped) {
      addLog(t('log.stopped'), 'warning');
    } else if (failures === 0) {
      addLog(t('log.validated', { runs: RUNS }), 'success');
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

      setSuccessTitle(t('success.title', { id: mission.id }));
      setSuccessBody(t(`mission.${mission.id}.success`));
      const nextIdx = MISSIONS.findIndex((_m, i) => newStates[i] === 'current');
      setHasNextMission(nextIdx >= 0);
      setShowSuccessModal(true);
    } else {
      addLog(t('log.failed', { failures, runs: RUNS }), 'error');
      firstFailedObjectives.forEach(obj => {
        addLog(`  ✗ ${obj}`, 'error');
      });
      addLog(t('log.replayingFailure'), 'system');

      // Replay the first failed scenario visually
      if (firstFailedActions && firstFailedMap) {
        world.map = firstFailedMap;
        world.animating = true;
        const animSpeed = 550 - speed;
        await executor.replayActions(firstFailedActions, animSpeed, mission.startPos, mission.startDir, mission.fuel);
        world.animating = false;
        checkObjectives(currentMissionIdx, trimmedCode);
      }
    }

    updateStatus();
    setRunning(false);
  }, [code, currentMissionIdx, missionStates, speed, setupMissionWorld, updateStatus, checkObjectives, addLog, saveProgress, t]);

  const handleStop = useCallback(() => {
    executorRef.current?.stop();
  }, []);

  const handleReset = useCallback(() => {
    const mission = MISSIONS[currentMissionIdx];
    setupMissionWorld(mission);
    updateStatus();
    renderObjectives(currentMissionIdx);
    addLog(t('log.reset'), 'system');
  }, [currentMissionIdx, setupMissionWorld, updateStatus, renderObjectives, addLog, t]);

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
        missionLabel={t('mission.label', { id: currentMission.id, title: t(`mission.${currentMission.id}.title`) })}
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
          onShowOverview={() => setShowOverview(true)}
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

      {showOverview && worldRef.current && (
        <MapOverviewModal
          world={worldRef.current}
          onClose={() => setShowOverview(false)}
        />
      )}
    </>
  );
}
