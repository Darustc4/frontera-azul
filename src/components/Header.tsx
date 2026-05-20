import { Anchor, ClipboardList } from 'lucide-react';

interface HeaderProps {
  missionLabel: string;
  onMissionsClick: () => void;
}

export function Header({ missionLabel, onMissionsClick }: HeaderProps) {
  return (
    <header className="bg-bg-secondary px-5 py-2 border-b-2 border-border flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-accent flex items-center gap-2">
          <Anchor className="w-5 h-5" />
          La Frontera Azul
        </h1>
        <p className="text-xs text-text-dim">Terminal de Navegación</p>
      </div>
      <div className="flex-1 text-center">
        <span className="bg-bg-panel border border-accent px-4 py-1 rounded-full text-sm text-accent-bright font-semibold">
          {missionLabel}
        </span>
      </div>
      <div>
        <button
          onClick={onMissionsClick}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded bg-bg-panel text-text text-sm hover:bg-border hover:border-accent transition-colors cursor-pointer"
        >
          <ClipboardList className="w-4 h-4" />
          Misiones
        </button>
      </div>
    </header>
  );
}
