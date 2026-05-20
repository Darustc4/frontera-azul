import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, CheckCircle, Square, RotateCcw, Terminal, Radar, Variable, BookOpen } from 'lucide-react';
import type { LogEntry } from '../App';

interface EditorPanelProps {
  code: string;
  onCodeChange: (code: string) => void;
  running: boolean;
  onRun: () => void;
  onValidate: () => void;
  onStop: () => void;
  onReset: () => void;
  logs: LogEntry[];
  variables: Record<string, any>;
  sensorGrid: { type: string }[][];
  sensorInfo: string;
}

type TabId = 'console' | 'sensor' | 'variables' | 'reference';

export function EditorPanel({
  code,
  onCodeChange,
  running,
  onRun,
  onValidate,
  onStop,
  onReset,
  logs,
  variables,
  sensorGrid,
  sensorInfo,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('console');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  const lines = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lines, 12) }, (_, i) => i + 1);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newVal = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
      onCodeChange(newVal);
      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
  }, [onCodeChange, onRun]);

  const handleScroll = () => {
    const lineEl = document.getElementById('line-nums');
    if (lineEl && editorRef.current) {
      lineEl.scrollTop = editorRef.current.scrollTop;
    }
  };

  const typeIcons: Record<string, string> = { agua: '~', arrecife: '▲', puerto: 'P', pesca: 'F', boat: 'B', tierra: '▓', fuera: '▓' };
  const typeColors: Record<string, string> = {
    agua: 'bg-[#0a2a4a]',
    arrecife: 'bg-[#5c4a3a]',
    puerto: 'bg-[#4a3a2a]',
    pesca: 'bg-success/20',
    boat: 'bg-boat text-white font-bold',
    tierra: 'bg-[#2a4a3a] text-[#5a7a6a]',
    fuera: 'bg-[#2a4a3a] text-[#5a7a6a]',
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'console', label: 'Consola', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'sensor', label: 'Sensor', icon: <Radar className="w-3.5 h-3.5" /> },
    { id: 'variables', label: 'Variables', icon: <Variable className="w-3.5 h-3.5" /> },
    { id: 'reference', label: 'Referencia', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <section className="flex-1 flex flex-col p-2 pr-2 min-w-[380px]">
      {/* Panel header */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-bg-panel rounded-t text-xs text-accent font-semibold">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" />
          Terminal de Programación
        </span>
        <div className="flex gap-1">
          <button
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#2d8659] rounded bg-[#1a5c3a] text-success text-xs font-semibold hover:bg-[#2d8659] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3" />
            {running ? 'Ejecutando...' : 'Probar'}
          </button>
          <button
            onClick={onValidate}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#2d6b99] rounded bg-[#1a3d5c] text-[#6bc4ff] text-xs font-semibold hover:bg-[#2d6b99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <CheckCircle className="w-3 h-3" />
            Validar
          </button>
          <button
            onClick={onStop}
            disabled={!running}
            className="flex items-center gap-1 px-2.5 py-1 border border-border rounded bg-bg-panel text-error text-xs hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
            Parar
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1 border border-border rounded bg-bg-panel text-text text-xs hover:bg-border transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex relative border-2 border-border rounded-b overflow-hidden min-h-[200px]">
        <div
          id="line-nums"
          className="bg-bg-secondary px-1.5 py-2.5 text-right font-mono text-[13px] leading-[1.5] text-text-muted select-none min-w-[36px] border-r border-border overflow-hidden whitespace-pre"
        >
          {lineNumbers.map(n => n + '\n').join('')}
        </div>
        <textarea
          ref={editorRef}
          value={code}
          onChange={e => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className="code-editor flex-1 p-2.5 overflow-y-auto border-none"
        />
      </div>

      {/* Bottom tabs */}
      <div className="mt-1.5 border-2 border-border rounded min-h-[160px] max-h-[240px] flex flex-col">
        <div className="flex bg-bg-secondary border-b border-border shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 text-xs transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-accent border-accent bg-accent/[0.08]'
                  : 'text-text-muted border-transparent hover:text-text hover:bg-accent/[0.05]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 bg-[#0a1118] font-mono text-xs leading-relaxed">
          {activeTab === 'console' && (
            <div ref={consoleRef} className="h-full overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className={`log-${log.type}`}>{log.message}</div>
              ))}
            </div>
          )}

          {activeTab === 'sensor' && (
            <div className="flex gap-4 items-start">
              <div className="grid grid-cols-5 gap-0.5">
                {sensorGrid.flat().map((cell, i) => (
                  <div key={i} className={`sensor-cell ${typeColors[cell.type] || 'bg-[#0a2a4a]'}`}>
                    {typeIcons[cell.type] || '?'}
                  </div>
                ))}
              </div>
              <div className="text-xs text-text-dim leading-relaxed whitespace-pre-line">
                {sensorInfo}
              </div>
            </div>
          )}

          {activeTab === 'variables' && (
            <div>
              {Object.keys(variables).length === 0 ? (
                <p className="text-text-muted italic text-center py-5 font-sans">
                  Las variables aparecerán aquí al ejecutar tu código.
                </p>
              ) : (
                Object.entries(variables).map(([k, v]) => (
                  <div key={k} className="flex justify-between px-2 py-0.5 border-b border-border/30">
                    <span className="text-accent">{k}</span>
                    <span className="text-success">
                      {Array.isArray(v) ? `[${v.length > 5 ? v.slice(0, 3).join(',') + '...' : v.join(',')}]` : JSON.stringify(v)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reference' && <ReferenceContent />}
        </div>
      </div>
    </section>
  );
}

function ReferenceContent() {
  return (
    <div className="font-sans text-xs leading-relaxed">
      <RefSection title="Movimiento">
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">avanzar(n)</code> — Avanza n casillas hacia donde apunta (1 fuel/casilla)<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">girar_derecha()</code> — Gira 90° a estribor (1 fuel)<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">girar_izquierda()</code> — Gira 90° a babor (1 fuel)
      </RefSection>
      <RefSection title="Control de Flujo">
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">for i in range(n):</code> — Bucle con contador<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">while condición:</code> — Bucle condicional<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">if condición:</code> — Condicional
      </RefSection>
      <RefSection title="Sensores (relativos al rumbo)">
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">escanear()</code> — Matriz 5×5 relativa al rumbo<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">sensor_adelante()</code> — Lo que hay delante<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">sensor_derecha()</code> — Lo que hay a estribor<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">sensor_izquierda()</code> — Lo que hay a babor
      </RefSection>
      <RefSection title="Información">
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">posicion_x()</code> <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">posicion_y()</code> — Posición absoluta<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">rumbo()</code> — Dirección actual<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">combustible()</code> — Fuel restante<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">carga()</code> — Carga en bodega<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">recoger()</code> — Recoge pesca
      </RefSection>
      <RefSection title="Puertos">
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">puerto_cercano()</code> — ID del más cercano<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">puerto_x(n)</code> <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">puerto_y(n)</code> — Coords del puerto n<br />
        <code className="bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]">distancia_puerto(n)</code> — Distancia Manhattan
      </RefSection>
    </div>
  );
}

function RefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <h4 className="text-accent mb-0.5 text-xs font-semibold">{title}</h4>
      {children}
    </div>
  );
}
