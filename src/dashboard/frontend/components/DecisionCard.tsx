import React from 'react';
import { DecisionIndexItem } from '../../../types/decision.js';

interface DecisionCardProps {
  decision: DecisionIndexItem;
  onClick: () => void;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onClick }) => {
  const statusStyles = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    superseded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    archived: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  const confidenceBadges = {
    explicit: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    inferred: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    suggested: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">
            {decision.id}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${
                statusStyles[decision.status]
              }`}
            >
              {decision.status}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium border capitalize ${
                confidenceBadges[decision.confidence || 'explicit']
              }`}
            >
              {decision.confidence || 'explicit'}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors mb-2 line-clamp-2">
          {decision.summary}
        </h3>

        <p className="text-sm text-slate-400 line-clamp-2 mb-4">
          {decision.rationale}
        </p>
      </div>

      <div>
        {/* Scope Globs */}
        <div className="mb-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">
            Governed Scopes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {decision.scope.map((glob, idx) => (
              <span
                key={idx}
                className="font-mono text-xs text-indigo-300/90 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded"
              >
                {glob}
              </span>
            ))}
          </div>
        </div>

        {/* Tags & Metadata */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex flex-wrap gap-1">
            {decision.tags.map((tag, idx) => (
              <span
                key={idx}
                className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="text-[11px]">
            by <span className="text-slate-400 font-medium">{decision.author}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
