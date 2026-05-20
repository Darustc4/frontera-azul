import { RefObject } from 'react';
import { Map, Fuel, Package, Target, Gauge, Anchor, Fish, CheckCircle2, Circle, Globe } from 'lucide-react';
import { useI18n } from '../i18n';

interface WorldPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  speed: number;
  onSpeedChange: (v: number) => void;
  statusText: string;
  fuelPct: number;
  fuelAmount: number;
  cargoText: string;
  messageText: string;
  objectives: { text: string; completed: boolean }[];
  onShowOverview: () => void;
}

export function WorldPanel({
  canvasRef,
  speed,
  onSpeedChange,
  statusText,
  fuelPct,
  fuelAmount,
  cargoText,
  messageText,
  objectives,
  onShowOverview,
}: WorldPanelProps) {
  const fuelColor = fuelPct < 20 ? 'bg-error' : fuelPct < 40 ? 'bg-warning' : 'bg-success';
  const { t } = useI18n();

  return (
    <section className="flex-none w-155 flex flex-col p-2 bg-bg-tertiary">
      {/* Panel Header */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-bg-panel rounded-t text-xs text-accent font-semibold">
        <span className="flex items-center gap-1.5">
          <Map className="w-3.5 h-3.5" />
          {t('world.chart')}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowOverview}
            className="flex items-center gap-1 text-xs text-text-dim hover:text-accent transition-colors"
            title={t('world.overview')}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>
          <label className="flex items-center gap-1 text-xs text-text-dim" title="Velocidad de animación">
            <Gauge className="w-3.5 h-3.5" />
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={speed}
              onChange={e => onSpeedChange(parseInt(e.target.value))}
              className="w-20 h-1 accent-accent"
            />
          </label>
          <span className="font-mono text-xs text-accent-bright">{statusText}</span>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} id="game-canvas" width={588} height={588} className="shrink-0" />

      {/* Status Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-bg-panel rounded-b text-xs border-t border-border">
        <div className="flex items-center gap-1.5">
          <Fuel className="w-3.5 h-3.5 text-success" />
          <span className="text-success min-w-12">{fuelAmount}</span>
          <div className="w-20 h-2 bg-[#0a1118] rounded overflow-hidden border border-border">
            <div className={`fuel-fill h-full rounded ${fuelColor}`} style={{ width: `${fuelPct}%` }} />
          </div>
        </div>
        <span className="text-text-dim flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          {t('world.cargo')} {cargoText}
        </span>
        {messageText && (
          <span className="text-warning italic ml-auto flex items-center gap-1">
            {messageText.includes('puerto') && <Anchor className="w-3.5 h-3.5" />}
            {messageText.includes('pesca') && <Fish className="w-3.5 h-3.5" />}
            {messageText}
          </span>
        )}
      </div>

      {/* Objectives */}
      <div className="mt-1.5 border border-border rounded flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-panel rounded-t text-xs text-accent font-semibold">
          <Target className="w-3.5 h-3.5" />
          {t('world.objectives')}
        </div>
        <ul className="px-2.5 py-1.5 text-sm">
          {objectives.map((obj, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 px-2 py-1 mb-0.5 rounded text-xs ${
                obj.completed
                  ? 'text-success line-through opacity-70'
                  : 'bg-accent/10 text-text'
              }`}
            >
              <span className={obj.completed ? 'text-success' : 'text-text-muted'}>
                {obj.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              </span>
              {obj.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
