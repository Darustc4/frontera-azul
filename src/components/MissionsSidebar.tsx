import { X, Lock, CheckCircle, Circle, ClipboardList } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Mission } from '../missions';

interface MissionsSidebarProps {
  missions: Mission[];
  missionStates: string[];
  onSelect: (idx: number) => void;
  onClose: () => void;
}

export function MissionsSidebar({ missions, missionStates, onSelect, onClose }: MissionsSidebarProps) {
  const { t } = useI18n();

  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-bg-secondary border-l-2 border-border z-900lex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.3)] sidebar-active">
      <div className="flex justify-between items-center px-4 py-4 border-b border-border">
        <h3 className="text-accent font-bold flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {t('sidebar.title')}</h3>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text text-xl cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {missions.map((mission, idx) => {
          const state = missionStates[idx];
          const isLocked = state === 'locked';
          const isCompleted = state === 'completed';

          return (
            <div
              key={mission.id}
              onClick={() => !isLocked && onSelect(idx)}
              className={`p-3 mb-2 rounded-md border transition-colors ${
                isCompleted
                  ? 'border-success/50 bg-bg-panel opacity-80 cursor-pointer hover:border-success'
                  : isLocked
                  ? 'border-border bg-bg-panel opacity-50 cursor-not-allowed'
                  : 'border-accent/50 bg-accent/10 cursor-pointer hover:border-accent hover:bg-accent/15'
              }`}
            >
              <h4 className="text-text text-sm font-medium mb-1">
                {mission.id}. {t(`mission.${mission.id}.title`)}
              </h4>
              <p className="text-text-dim text-xs">{t(`mission.${mission.id}.subtitle`)}</p>
              <span className={`inline-flex items-center gap-1 mt-1.5 text-[0.7rem] px-2 py-0.5 rounded-full ${
                isCompleted
                  ? 'bg-success/20 text-success'
                  : isLocked
                  ? 'bg-text-muted/20 text-text-muted'
                  : 'bg-accent/20 text-accent-bright'
              }`}>
                {isCompleted && <><CheckCircle className="w-3 h-3" /> {t('sidebar.completed')}</>}
                {state === 'current' && <><Circle className="w-3 h-3" /> {t('sidebar.available')}</>}
                {isLocked && <><Lock className="w-3 h-3" /> {t('sidebar.locked')}</>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
