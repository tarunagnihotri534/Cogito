import React, { useEffect, useState } from 'react';
import { DecisionRecord, DecisionStatus } from '../../../types/decision.js';

interface TimelineNode {
  id: string;
  summary: string;
  status: string;
  created: string;
  supersededBy?: string;
  supersedes?: string[];
  rationale?: string;
}

interface DecisionDetailModalProps {
  decisionId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelectDecision?: (id: string) => void;
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({
  decisionId,
  onClose,
  onRefresh,
  onSelectDecision
}) => {
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [editRationale, setEditRationale] = useState('');
  const [editScope, setEditScope] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editReviewBy, setEditReviewBy] = useState('');
  const [editContext, setEditContext] = useState('');
  const [editConsequences, setEditConsequences] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!decisionId) {
      setRecord(null);
      setTimeline([]);
      setIsEditing(false);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setIsEditing(false);
      try {
        const [resDec, resTime] = await Promise.all([
          fetch(`/api/decisions/${decisionId}`),
          fetch(`/api/decisions/${decisionId}/timeline`)
        ]);

        if (!resDec.ok) throw new Error('Decision not found');
        const data = await resDec.json();
        setRecord(data);

        // Pre-fill edit state
        setEditSummary(data.summary || '');
        setEditRationale(data.rationale || '');
        setEditScope(Array.isArray(data.scope) ? data.scope.join(', ') : '');
        setEditTags(Array.isArray(data.tags) ? data.tags.join(', ') : '');
        setEditReviewBy(data.reviewBy || '');
        setEditContext(data.context || '');
        setEditConsequences(data.consequences || '');

        if (resTime.ok) {
          const timeData = await resTime.json();
          setTimeline(Array.isArray(timeData) ? timeData : []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [decisionId]);

  if (!decisionId) return null;

  const handleStatusChange = async (newStatus: DecisionStatus) => {
    if (!record) return;
    setUpdating(true);
    try {
      let supersededBy: string | undefined = undefined;
      if (newStatus === 'superseded') {
        const input = prompt('Enter the ID of the decision that supersedes this one (optional):');
        if (input) supersededBy = input.trim();
      }

      const res = await fetch(`/api/decisions/${record.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, supersededBy })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update status');
      }

      const updated = await res.json();
      setRecord(updated);
      onRefresh();

      // Refresh timeline
      const resTime = await fetch(`/api/decisions/${record.id}/timeline`);
      if (resTime.ok) {
        setTimeline(await resTime.json());
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    setSaveError(null);

    if (!editSummary.trim()) {
      setSaveError('Summary is required');
      return;
    }
    if (!editRationale.trim()) {
      setSaveError('Rationale is required');
      return;
    }

    setUpdating(true);
    try {
      const scopeArray = editScope
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/decisions/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editSummary.trim(),
          rationale: editRationale.trim(),
          scope: scopeArray,
          tags: tagsArray,
          reviewBy: editReviewBy.trim() || undefined,
          context: editContext.trim() || undefined,
          consequences: editConsequences.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update decision');
      }

      const updated = await res.json();
      setRecord(updated);
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setSaveError(err.message);
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
                <span
                  className={`text-xs px-3 py-1 rounded-full border font-medium capitalize ${
                    record.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : record.status === 'superseded'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}
                >
                  {record.status}
                </span>
              )}
              {record?.reviewBy && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Review by: {record.reviewBy}
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
              {/* Timeline (if multi-node or supersession exists) */}
              {timeline.length > 1 && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                  <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                    <span>⏳</span> Supersession Timeline
                  </h4>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {timeline.map((node, idx) => {
                      const isCurrent = node.id === record.id;
                      return (
                        <React.Fragment key={node.id}>
                          <div
                            onClick={() => {
                              if (!isCurrent && onSelectDecision) {
                                onSelectDecision(node.id);
                              }
                            }}
                            className={`shrink-0 p-2.5 rounded-lg border text-xs transition-all ${
                              isCurrent
                                ? 'bg-indigo-950/70 border-indigo-500 ring-1 ring-indigo-500'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-[11px] text-indigo-300">
                                {node.id}
                              </span>
                              <span
                                className={`text-[9px] uppercase px-1.5 py-0.2 rounded ${
                                  node.status === 'active'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {node.status}
                              </span>
                            </div>
                            <div className="font-medium text-slate-200 max-w-[150px] truncate text-[11px]">
                              {node.summary}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(node.created).toLocaleDateString()}
                            </div>
                          </div>
                          {idx < timeline.length - 1 && (
                            <span className="text-slate-600 font-bold px-1">➔</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Edit Mode vs Read Mode */}
              {isEditing ? (
                <form onSubmit={handleSaveChanges} className="space-y-4">
                  {saveError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-xs">
                      {saveError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Summary *
                    </label>
                    <input
                      type="text"
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Rationale *
                    </label>
                    <textarea
                      rows={3}
                      value={editRationale}
                      onChange={(e) => setEditRationale(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Scope (comma-separated globs)
                      </label>
                      <input
                        type="text"
                        value={editScope}
                        onChange={(e) => setEditScope(e.target.value)}
                        placeholder="src/core/**, tests/**"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Review Date (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={editReviewBy}
                        onChange={(e) => setEditReviewBy(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="architecture, auth, database"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Context (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={editContext}
                      onChange={(e) => setEditContext(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Consequences (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={editConsequences}
                      onChange={(e) => setEditConsequences(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={updating}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors disabled:opacity-50"
                    >
                      {updating ? 'Saving...' : '💾 Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
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
                        ⚠️ This decision has been superseded by{' '}
                        <button
                          type="button"
                          onClick={() => onSelectDecision?.(record.supersededBy!)}
                          className="font-bold underline hover:text-amber-200"
                        >
                          {record.supersededBy}
                        </button>
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
            </>
          )}
        </div>

        {/* Footer actions */}
        {record && !isEditing && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                ✏️ Edit Decision
              </button>

              <span className="text-xs text-slate-500 ml-2">Status:</span>
              <button
                disabled={updating || record.status === 'active'}
                onClick={() => handleStatusChange('active')}
                className="text-xs px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 disabled:opacity-30 transition-colors"
              >
                Active
              </button>
              <button
                disabled={updating || record.status === 'superseded'}
                onClick={() => handleStatusChange('superseded')}
                className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 disabled:opacity-30 transition-colors"
              >
                Superseded
              </button>
              <button
                disabled={updating || record.status === 'archived'}
                onClick={() => handleStatusChange('archived')}
                className="text-xs px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 transition-colors"
              >
                Archived
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
