import { Radio, Lightbulb } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Mission } from '../missions';

interface MissionModalProps {
  mission: Mission;
  onAccept: () => void;
}

export function MissionModal({ mission, onAccept }: MissionModalProps) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/70 z-1000 flex items-center justify-center">
      <div className="bg-bg-secondary border-2 border-accent rounded-xl px-8 py-6 max-w-140 w-[90%] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Radio className="w-8 h-8 text-accent" />
          <h2 className="text-accent-bright text-lg font-bold">
            {t('mission.label', { id: mission.id, title: t(`mission.${mission.id}.title`) })}
          </h2>
        </div>

        <div
          className="text-text text-sm leading-relaxed mb-4"
          dangerouslySetInnerHTML={{ __html: t(`mission.${mission.id}.briefing`) }}
        />

        <div className="bg-bg-panel rounded-md px-4 py-3 mb-4">
          <h4 className="text-accent text-xs font-semibold mb-2">{t('modal.objectives')}</h4>
          <ul className="text-sm">
            {mission.objectives.map(obj => (
              <li key={obj.id} className="text-text-dim py-0.5 before:content-['→_'] before:text-accent">
                {t(`mission.${mission.id}.obj.${obj.id}`)}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-text-dim flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 shrink-0" /> {t('modal.hint')} {t(`mission.${mission.id}.hint`)}
            </p>
        </div>

        <div className="text-right mt-4">
          <button
            onClick={onAccept}
            className="px-6 py-2 rounded-md bg-accent text-bg-secondary font-semibold text-sm hover:bg-accent-bright hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            {t('modal.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
