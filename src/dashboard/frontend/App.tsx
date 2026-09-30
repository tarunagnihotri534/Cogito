import React, { useEffect, useState } from 'react';
import { DecisionIndexItem, DecisionStatus } from '../../types/decision.js';
import { DecisionCard } from './components/DecisionCard.js';
import { DecisionDetailModal } from './components/DecisionDetailModal.js';
import { RecordDecisionModal } from './components/RecordDecisionModal.js';
import { CheckFileModal } from './components/CheckFileModal.js';
import { DoctorModal } from './components/DoctorModal.js';

export default function App() {
  const [decisions, setDecisions] = useState<DecisionIndexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isCheckOpen, setIsCheckOpen] = useState(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);

  const fetchDecisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/decisions');
      if (!res.ok) throw new Error('Failed to fetch decisions');
      const data = await res.json();
      setDecisions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisions();
  }, []);

  // Compute metrics
  const activeCount = decisions.filter((d) => d.status === 'active').length;
  const supersededCount = decisions.filter((d) => d.status === 'superseded').length;
  const archivedCount = decisions.filter((d) => d.status === 'archived').length;

  const allTags = Array.from(
    new Set(decisions.flatMap((d) => d.tags || []))
  ).sort();

  // Filtered decisions
  const filteredDecisions = decisions.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (selectedTag !== 'all' && !d.tags?.includes(selectedTag)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSummary = d.summary.toLowerCase().includes(q);
      const matchRationale = d.rationale?.toLowerCase().includes(q);
      const matchScope = d.scope.some((s) => s.toLowerCase().includes(q));
      if (!matchSummary && !matchRationale && !matchScope) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
              D
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Decision Tracker
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  Memory v1.0
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Architectural context & advisory rules for your codebase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDoctorOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>🩺 Health Doctor</span>
            </button>

            <button
              onClick={() => setIsCheckOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>🔍 Test File Path</span>
            </button>

            <button
              onClick={() => setIsRecordOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
            >
              <span>+ Record Decision</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Status Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div
            onClick={() => setStatusFilter('all')}
            className={"p-4 rounded-xl border cursor-pointer transition-all " +
              (statusFilter === 'all'
                ? 'bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700')}
          >
            <div className="text-xs font-medium text-slate-400">Total Decisions</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{decisions.length}</div>
          </div>

          <div
            onClick={() => setStatusFilter('active')}
            className={"p-4 rounded-xl border cursor-pointer transition-all " +
              (statusFilter === 'active'
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700')}
          >
            <div className="text-xs font-medium text-emerald-400 flex items-center justify-between">
              <span>Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{activeCount}</div>
          </div>

          <div
            onClick={() => setStatusFilter('superseded')}
            className={"p-4 rounded-xl border cursor-pointer transition-all " +
              (statusFilter === 'superseded'
                ? 'bg-amber-950/40 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700')}
          >
            <div className="text-xs font-medium text-amber-400 flex items-center justify-between">
              <span>Superseded</span>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1">{supersededCount}</div>
          </div>

          <div
            onClick={() => setStatusFilter('archived')}
            className={"p-4 rounded-xl border cursor-pointer transition-all " +
              (statusFilter === 'archived'
                ? 'bg-rose-950/40 border-rose-500/50 shadow-md shadow-rose-500/10'
                : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700')}
          >
            <div className="text-xs font-medium text-rose-400 flex items-center justify-between">
              <span>Archived</span>
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            </div>
            <div className="text-2xl font-bold text-rose-300 mt-1">{archivedCount}</div>
          </div>
        </div>

        {/* Filter and Search Toolbar */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <input
                type="text"
                placeholder="Search by summary, scope, rationale..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>
          </div>

          {/* Tags Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-slate-500 shrink-0">Tags:</span>
            <button
              onClick={() => setSelectedTag('all')}
              className={"px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 " +
                (selectedTag === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={"px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 " +
                  (selectedTag === tag
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200')}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Decisions Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading decisions...</div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-6 rounded-2xl text-center">
            {error}
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-3">📁</div>
            <h3 className="text-lg font-semibold text-slate-300">No decisions match your filters</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search criteria or click &quot;Record Decision&quot; to log a new architectural decision.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDecisions.map((item) => (
              <DecisionCard
                key={item.id}
                decision={item}
                onClick={() => setSelectedDecisionId(item.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <DecisionDetailModal
        decisionId={selectedDecisionId}
        onClose={() => setSelectedDecisionId(null)}
        onRefresh={fetchDecisions}
        onSelectDecision={(id) => setSelectedDecisionId(id)}
      />

      <RecordDecisionModal
        isOpen={isRecordOpen}
        onClose={() => setIsRecordOpen(false)}
        onSuccess={fetchDecisions}
      />

      <CheckFileModal
        isOpen={isCheckOpen}
        onClose={() => setIsCheckOpen(false)}
        onSelectDecision={(id) => setSelectedDecisionId(id)}
      />

      <DoctorModal
        isOpen={isDoctorOpen}
        onClose={() => setIsDoctorOpen(false)}
        onSelectDecision={(id) => {
          setIsDoctorOpen(false);
          setSelectedDecisionId(id);
        }}
      />
    </div>
  );
}
