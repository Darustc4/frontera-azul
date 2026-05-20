import { Anchor, ClipboardList, Code, Globe } from 'lucide-react';
import { useI18n } from '../i18n';

interface HeaderProps {
  missionLabel: string;
  onMissionsClick: () => void;
}

export function Header({ missionLabel, onMissionsClick }: HeaderProps) {
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="bg-bg-secondary px-5 py-2 border-b-2 border-border flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-accent flex items-center gap-2">
          <Anchor className="w-5 h-5" />
          {t('app.title')}
        </h1>
        <p className="text-xs text-text-dim">{t('app.subtitle')}</p>
      </div>
      <div className="flex-1 text-center">
        <span className="bg-bg-panel border border-accent px-4 py-1 rounded-full text-sm text-accent-bright font-semibold">
          {missionLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded bg-bg-panel text-text text-sm hover:bg-border hover:border-accent transition-colors cursor-pointer"
          title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          <Globe className="w-4 h-4" />
          {locale === 'es' ? 'EN' : 'ES'}
        </button>
        <a
          href="https://github.com/Darustc4/frontera-azul"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded bg-bg-panel text-text text-sm hover:bg-border hover:border-accent transition-colors"
          title="Source code (AGPL-3.0)"
        >
          <Code className="w-4 h-4" />
          {locale === 'es' ? 'Fuente' : 'Source'}
        </a>
        <button
          onClick={onMissionsClick}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded bg-bg-panel text-text text-sm hover:bg-border hover:border-accent transition-colors cursor-pointer"
        >
          <ClipboardList className="w-4 h-4" />
          {t('header.missions')}
        </button>
      </div>
    </header>
  );
}
