import React, { useState } from 'react';
import { DecisionConfidence } from '../../../types/decision.js';

interface RecordDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordDecisionModal: React.FC<RecordDecisionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [summary, setSummary] = useState('');
  const [rationale, setRationale] = useState('');
  const [scope, setScope] = useState('');
  const [tags, setTags] = useState('');
  const [author, setAuthor] = useState('');
  const [confidence, setConfidence] = useState<DecisionConfidence>('explicit');
  const [context, setContext] = useState('');
  const [consequences, setConsequences] = useState('');
  const [supersedes, setSupersedes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !rationale || !scope) {
      setError('Summary, Rationale, and Scope are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          rationale,
          scope: scope.split(',').map((s) => s.trim()).filter(Boolean),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          author: author || 'web-user',
          confidence,
          context: context || undefined,
          consequences: consequences || undefined,
          supersedes: supersedes || undefined
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record decision');
      }

      // Reset form
      setSummary('');
      setRationale('');
      setScope('');
      setTags('');
      setContext('');
      setConsequences('');
      setSupersedes('');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <h2 className="text-xl font-bold text-slate-100">💡 Record Architectural Decision</h2>
            <p className="text-xs text-slate-400">Capture technical rationale and govern files with glob scopes</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl font-bold p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm text-slate-300">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Summary <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Use synchronous processing for payment callback handlers"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Rationale <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain why this decision was made and why alternatives were rejected..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Governed Scope Globs <span className="text-rose-400">*</span> (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., src/api/payments/**/*.ts, src/controllers/checkout.ts"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-indigo-300 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                placeholder="architecture, security, payments"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Author
              </label>
              <input
                type="text"
                placeholder="Name or handle"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Confidence Level
              </label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as DecisionConfidence)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              >
                <option value="explicit">Explicit (Confirmed & Mandated)</option>
                <option value="inferred">Inferred (Observed Pattern)</option>
                <option value="suggested">Suggested (Recommendation)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Supersedes Decision ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., dec_20260212_abc123"
                value={supersedes}
                onChange={(e) => setSupersedes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-slate-300 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Background Context (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="System conditions, historical PRs, or user feedback that led to this decision..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Consequences & Trade-offs (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="What must developers keep in mind when working with this area?"
              value={consequences}
              onChange={(e) => setConsequences(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all text-xs"
            >
              {submitting ? 'Recording...' : 'Record Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
