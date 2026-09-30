import React, { useEffect, useState } from 'react';

export interface DoctorIssue {
  type: 'dead_glob' | 'expired_review' | 'broken_superseded_by' | 'heavy_churn' | 'missing_scope';
  severity: 'error' | 'warning';
  decisionId: string;
  summary: string;
  message: string;
  details?: any;
}

export interface DoctorReport {
  healthy: boolean;
  totalActiveDecisions: number;
  issues: DoctorIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

interface DoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDecision?: (id: string) => void;
}

export const DoctorModal: React.FC<DoctorModalProps> = ({
  isOpen,
  onClose,
  onSelectDecision
}) => {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning'>('all');

  const fetchDoctor = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/doctor');
      if (!res.ok) throw new Error('Failed to run diagnostics');
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDoctor();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredIssues = report
    ? report.issues.filter((iss) => {
        if (filterSeverity === 'all') return true;
        return iss.severity === filterSeverity;
      })
    : [];

  const getIssueBadge = (type: DoctorIssue['type']) => {
    switch (type) {
      case 'dead_glob':
        return <span className="bg-rose-950/70 text-rose-300 border border-rose-800/50 px-2 py-0.5 rounded text-[10px] font-mono">DEAD GLOB</span>;
      case 'expired_review':
        return <span className="bg-amber-950/70 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded text-[10px] font-mono">EXPIRED REVIEW</span>;
      case 'broken_superseded_by':
        return <span className="bg-red-950/70 text-red-300 border border-red-800/50 px-2 py-0.5 rounded text-[10px] font-mono">BROKEN LINK</span>;
      case 'heavy_churn':
        return <span className="bg-orange-950/70 text-orange-300 border border-orange-800/50 px-2 py-0.5 rounded text-[10px] font-mono">HIGH CHURN</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xl">
              🩺
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Staleness Doctor
                {report && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      report.healthy
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {report.healthy ? 'All Healthy' : `${report.issues.length} Issues Found`}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Diagnostics for dead globs, expired reviewBy dates, broken supersession links, and file churn.
              </p>
            </div>
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
            <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Scanning repository and decision health...</span>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl">
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-400">Total Analyzed</div>
                  <div className="text-2xl font-bold text-slate-100 mt-1">
                    {report.totalActiveDecisions}
                  </div>
                </div>
                <div
                  onClick={() => setFilterSeverity(filterSeverity === 'error' ? 'all' : 'error')}
                  className={`bg-slate-950/60 border rounded-xl p-3 text-center cursor-pointer transition-colors ${
                    filterSeverity === 'error' ? 'border-rose-500 bg-rose-950/30' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs text-rose-400 font-medium">Errors</div>
                  <div className="text-2xl font-bold text-rose-300 mt-1">
                    {report.summary.errors}
                  </div>
                </div>
                <div
                  onClick={() => setFilterSeverity(filterSeverity === 'warning' ? 'all' : 'warning')}
                  className={`bg-slate-950/60 border rounded-xl p-3 text-center cursor-pointer transition-colors ${
                    filterSeverity === 'warning' ? 'border-amber-500 bg-amber-950/30' : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs text-amber-400 font-medium">Warnings</div>
                  <div className="text-2xl font-bold text-amber-300 mt-1">
                    {report.summary.warnings}
                  </div>
                </div>
              </div>

              {/* Issues List */}
              {report.issues.length === 0 ? (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-8 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <h4 className="text-base font-semibold text-emerald-300">Clean Bill of Health!</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    No dead globs, expired review dates, broken links, or high-churn file discrepancies detected.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Diagnostic Issues ({filteredIssues.length})</span>
                    {filterSeverity !== 'all' && (
                      <button
                        onClick={() => setFilterSeverity('all')}
                        className="text-indigo-400 hover:underline"
                      >
                        Reset filter
                      </button>
                    )}
                  </div>

                  {filteredIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col gap-2 transition-colors ${
                        issue.severity === 'error'
                          ? 'bg-rose-950/20 border-rose-900/50'
                          : 'bg-amber-950/20 border-amber-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getIssueBadge(issue.type)}
                          <button
                            type="button"
                            onClick={() => onSelectDecision?.(issue.decisionId)}
                            className="font-mono text-xs font-semibold text-indigo-400 hover:underline"
                          >
                            {issue.decisionId}
                          </button>
                        </div>
                        <span
                          className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${
                            issue.severity === 'error'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-200">{issue.summary}</div>
                      <div className="text-xs text-slate-400">{issue.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <button
            onClick={fetchDoctor}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span>🔄 Re-run Check</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
