import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';
import { GameWorld } from '../game';

interface MapOverviewModalProps {
  world: GameWorld;
  onClose: () => void;
}

export function MapOverviewModal({ world, onClose }: MapOverviewModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (canvasRef.current) {
      world.renderOverview(canvasRef.current);
    }
  }, [world]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-bg-panel border border-border rounded-lg p-4 max-w-lg w-full shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-accent">{t('world.overview')}</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text p-1 rounded hover:bg-bg-tertiary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={480}
          height={480}
          className="w-full rounded border border-border"
        />
        <p className="mt-2 text-xs text-text-dim text-center">{t('world.overviewHint')}</p>
      </div>
    </div>
  );
}
