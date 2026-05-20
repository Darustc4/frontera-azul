import { PartyPopper, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';

interface SuccessModalProps {
  title: string;
  body: string;
  hasNext: boolean;
  onNext: () => void;
  onClose: () => void;
}

export function SuccessModal({ title, body, hasNext, onNext, onClose }: SuccessModalProps) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/70 z-1000 flex items-center justify-center">
      <div className="bg-bg-secondary border-2 border-success rounded-xl px-8 py-6 max-w-140 w-[90%] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <PartyPopper className="w-8 h-8 text-success" />
          <h2 className="text-success text-lg font-bold">{title}</h2>
        </div>

        <p className="text-text text-sm leading-relaxed mb-4">{body}</p>

        <div className="text-right mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border bg-bg-panel text-text text-sm hover:bg-border transition-colors cursor-pointer"
          >
            {t('success.close')}
          </button>
          {hasNext && (
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 px-6 py-2 rounded-md bg-success text-bg-secondary font-semibold text-sm hover:brightness-110 hover:-translate-y-0.5 transition-all cursor-pointer"
            >
              {t('success.next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
