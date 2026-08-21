import { Link, useLocation } from 'react-router-dom';

interface CompleteProfilePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: string[];
  actionName?: string; // e.g. 'enroll in this event' or 'create a team' or 'join this team'
}

export default function CompleteProfilePromptModal({
  isOpen,
  onClose,
  missingFields,
  actionName = 'enroll in this event',
}: CompleteProfilePromptModalProps) {
  const location = useLocation();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-center relative"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideIn 0.25s ease-out',
        }}
      >
        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(12px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-all border-none"
          title="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Status Icon */}
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#d97706',
          }}
        >
          ⚠️
        </div>

        {/* Title */}
        <h3 className="font-display text-2xl font-extrabold text-slate-900 mb-2">
          Profile Incomplete
        </h3>

        <p className="font-body text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
          To <strong>{actionName}</strong>, all participants must complete their full student profile.
        </p>

        {/* Missing Fields List */}
        <div
          className="rounded-2xl p-4 mb-6 text-left"
          style={{
            backgroundColor: '#FCFAF6',
            border: '1px solid rgba(217, 119, 6, 0.2)',
          }}
        >
          <p className="font-ui text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2.5 flex items-center justify-between">
            <span>Missing required fields:</span>
            <span className="text-amber-700 font-bold font-body text-xs">
              {missingFields.length} missing
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((f) => (
              <span
                key={f}
                className="font-body text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  color: '#92400e',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <span className="text-amber-600 font-bold text-[10px]">✕</span>
                <span>{f}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <Link
            to="/profile?edit=true"
            state={{ autoEdit: true, from: location.pathname + location.search }}
            onClick={onClose}
            className="w-full py-3.5 px-6 rounded-2xl font-body text-xs font-bold tracking-wider uppercase text-white no-underline shadow-md flex items-center justify-center gap-2 transition-all hover:opacity-95 cursor-pointer"
            style={{
              background: 'linear-gradient(180deg, #4d6a7d 0%, #3E5868 100%)',
              boxShadow: '0 4px 14px rgba(62, 88, 104, 0.35)',
            }}
          >
            <span>Complete Profile Now</span>
            <span>→</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs font-body font-semibold text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
