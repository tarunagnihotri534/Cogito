import React, { useEffect, useState } from 'react';
import { DecisionRecord, DecisionStatus } from '../../../types/decision.js';

interface DecisionDetailModalProps {
  decisionId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
  decisionId,
  onClose,
  onRefresh
}) => {
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!decisionId) {
      setRecord(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/decisions/${decisionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch decision details');
        return res.json();
      })
      .then((data) => setRecord(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [decisionId]);

  if (!decisionId) return null;

  const handleStatusChange = async (newStatus: DecisionStatus) => {
    if (!record) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/decisions/${record.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setRecord(updated);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm font-semibold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-lg border border-indigo-800/40">
                {decisionId}
              </span>
              {record && (
                <span className="text-xs px-3 py-1 rounded-full border font-medium capitalize bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {record.status}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {record ? record.summary : 'Loading Decision...'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl font-bold p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {loading && (
            <div className="text-center py-12 text-slate-400">Loading details...</div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
              {error}
            </div>
          )}

          {record && (
            <>
              {/* Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Author</span>
                  <span className="font-medium text-slate-200">{record.author}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Created</span>
                  <span className="font-medium text-slate-200">
                    {new Date(record.created).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">Confidence</span>
                  <span className="font-medium text-slate-200 capitalize">
                    {record.confidence || 'explicit'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-0.5">File Path</span>
                  <span className="font-mono text-xs text-slate-300 truncate block">
                    {record.filePath}
                  </span>
                </div>
              </div>

              {/* Rationale */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                  Rationale
                </h4>
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {record.rationale}
                </div>
              </div>

              {/* Scopes */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                  Governed Scopes (Glob Patterns)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {record.scope.map((s, idx) => (
                    <span
                      key={idx}
                      className="font-mono text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/50 px-3 py-1 rounded-lg"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Context if present */}
              {record.context && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                    Background Context
                  </h4>
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {record.context}
                  </div>
                </div>
              )}

              {/* Consequences if present */}
              {record.consequences && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                    Consequences & Trade-offs
                  </h4>
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {record.consequences}
                  </div>
                </div>
              )}

              {/* Superseded link */}
              {record.supersededBy && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-xl flex items-center justify-between">
                  <span>
                    ⚠️ This decision has been superseded by <strong>{record.supersededBy}</strong>.
                  </span>
                </div>
              )}

              {/* Raw Body */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2">
                  Raw Markdown Document
                </h4>
                <pre className="font-mono text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-slate-400 leading-relaxed">
                  {record.body}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        {record && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Change Status:</span>
              <button
                disabled={updating || record.status === 'active'}
                onClick={() => handleStatusChange('active')}
                className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 disabled:opacity-30 transition-colors"
              >
                Set Active
              </button>
              <button
                disabled={updating || record.status === 'superseded'}
                onClick={() => handleStatusChange('superseded')}
                className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 disabled:opacity-30 transition-colors"
              >
                Set Superseded
              </button>
              <button
                disabled={updating || record.status === 'archived'}
                onClick={() => handleStatusChange('archived')}
                className="text-xs px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 transition-colors"
              >
                Set Archive
              </button>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
