import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, CheckCircle, Square, RotateCcw, Terminal, Radar, Variable, BookOpen } from 'lucide-react';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
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

  const typeIcons: Record<string, string> = { water: '~', reef: '▲', port: 'P', fish: 'F', boat: 'B', land: '▓', fuera: '▓' };
  const typeColors: Record<string, string> = {
    water: 'bg-[#0a2a4a]',
    reef: 'bg-[#5c4a3a]',
    port: 'bg-[#4a3a2a]',
    fish: 'bg-success/20',
    boat: 'bg-boat text-white font-bold',
    land: 'bg-[#2a4a3a] text-[#5a7a6a]',
    fuera: 'bg-[#2a4a3a] text-[#5a7a6a]',
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'console', label: t('editor.tab.console'), icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'sensor', label: t('editor.tab.sensor'), icon: <Radar className="w-3.5 h-3.5" /> },
    { id: 'variables', label: t('editor.tab.variables'), icon: <Variable className="w-3.5 h-3.5" /> },
    { id: 'reference', label: t('editor.tab.reference'), icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <section className="flex-1 flex flex-col p-2 pr-2 min-w-95">
      {/* Panel header */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-bg-panel rounded-t text-xs text-accent font-semibold">
        <span className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" />
          {t('editor.title')}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onRun}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#2d8659] rounded bg-[#1a5c3a] text-success text-xs font-semibold hover:bg-[#2d8659] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3" />
            {running ? t('editor.running') : t('editor.run')}
          </button>
          <button
            onClick={onValidate}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#2d6b99] rounded bg-[#1a3d5c] text-[#6bc4ff] text-xs font-semibold hover:bg-[#2d6b99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <CheckCircle className="w-3 h-3" />
            {t('editor.validate')}
          </button>
          <button
            onClick={onStop}
            disabled={!running}
            className="flex items-center gap-1 px-2.5 py-1 border border-border rounded bg-bg-panel text-error text-xs hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
            {t('editor.stop')}
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1 border border-border rounded bg-bg-panel text-text text-xs hover:bg-border transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            {t('editor.reset')}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex relative border-2 border-border rounded-b overflow-hidden min-h-50">
        <div
          id="line-nums"
          className="bg-bg-secondary px-1.5 py-2.5 text-right font-mono text-[13px] leading-normal text-text-muted select-none min-w-9 border-r border-border overflow-hidden whitespace-pre"
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
      <div className="mt-1.5 border-2 border-border rounded min-h-40 max-h-60 flex flex-col">
        <div className="flex bg-bg-secondary border-b border-border shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 border-b-2 text-xs transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'text-accent border-accent bg-accent/8'
                  : 'text-text-muted border-transparent hover:text-text hover:bg-accent/5'
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
  const { t } = useI18n();
  const c = "bg-bg-panel px-1.5 rounded text-success font-mono text-[0.72rem]";
  return (
    <div className="font-sans text-xs leading-relaxed">
      <RefSection title={t('ref.control')}>
        <code className={c}>control.forward(n)</code> — {t('ref.control.forward')}<br />
        <code className={c}>control.back(n)</code> — {t('ref.control.back')}<br />
        <code className={c}>control.turn_right()</code> — {t('ref.control.turnRight')}<br />
        <code className={c}>control.turn_left()</code> — {t('ref.control.turnLeft')}<br />
        <code className={c}>control.collect()</code> — {t('ref.control.collect')}
      </RefSection>
      <RefSection title={t('ref.sensor')}>
        <code className={c}>sensor.scan()</code> — {t('ref.sensor.scan')}<br />
        <code className={c}>sensor.forward()</code> — {t('ref.sensor.forward')}<br />
        <code className={c}>sensor.right()</code> — {t('ref.sensor.right')}<br />
        <code className={c}>sensor.left()</code> — {t('ref.sensor.left')}<br />
        <code className={c}>sensor.back()</code> — {t('ref.sensor.back')}
      </RefSection>
      <RefSection title={t('ref.nav')}>
        <code className={c}>nav.x()</code> <code className={c}>nav.y()</code> — {t('ref.nav.pos')}<br />
        <code className={c}>nav.heading()</code> — {t('ref.nav.heading')}<br />
        <code className={c}>nav.heading_num()</code> — {t('ref.nav.headingNum')}<br />
        <code className={c}>nav.fuel()</code> — {t('ref.nav.fuel')}<br />
        <code className={c}>nav.cargo()</code> — {t('ref.nav.cargo')}<br />
        <code className={c}>nav.nearest_port()</code> — {t('ref.nav.nearestPort')}<br />
        <code className={c}>nav.port_x(n)</code> <code className={c}>nav.port_y(n)</code> — {t('ref.nav.portCoords')}<br />
        <code className={c}>nav.port_distance(n)</code> — {t('ref.nav.portDistance')}
      </RefSection>
      <RefSection title={t('ref.python')}>
        <code className={c}>for i in range(n):</code> — {t('ref.python.for')}<br />
        <code className={c}>while condition:</code> — {t('ref.python.while')}<br />
        <code className={c}>if condition:</code> — {t('ref.python.if')}<br />
        <code className={c}>def name(params):</code> — {t('ref.python.def')}<br />
        <code className={c}>print("msg")</code> — {t('ref.python.print')}
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
