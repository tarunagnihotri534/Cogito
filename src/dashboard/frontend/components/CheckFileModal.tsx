import React, { useState } from 'react';
import { DecisionIndexItem } from '../../../types/decision.js';

interface CheckFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDecision: (id: string) => void;
}

export const CheckFileModal: React.FC<CheckFileModalProps> = ({
  isOpen,
  onClose,
  onSelectDecision
}) => {
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<DecisionIndexItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/decisions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!res.ok) throw new Error('Failed to check file path');
      const data = await res.json();
      setMatches(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">🔍 Check File Scope Matcher</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Test a target file path against active architectural decision globs to see what advice Claude or human developers will receive when touching it.
        </p>

        <form onSubmit={handleCheck} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="e.g. src/api/payments/checkout.ts"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-sm text-indigo-300 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all"
          >
            {loading ? 'Testing...' : 'Check Matches'}
          </button>
        </form>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        {matches !== null && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase text-slate-400">
              Matched Active Decisions ({matches.length})
            </div>
            {matches.length === 0 ? (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-slate-400 text-xs">
                ℹ️ No active decisions match this file path.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {matches.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onClose();
                      onSelectDecision(item.id);
                    }}
                    className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-xs text-indigo-400 font-semibold mb-0.5">
                        {item.id}
                      </div>
                      <div className="text-sm font-medium text-slate-200">
                        {item.summary}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">View →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
