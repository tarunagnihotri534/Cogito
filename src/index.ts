// Types and Schemas
export * from './types/decision.js';

// Core Storage & Store Class
export {
  checkFileDecisions as check,
  recordDecision as record,
  listDecisions as list,
  getDecision as get,
  reindexStorage as reindex,
  checkFileDecisions,
  recordDecision,
  listDecisions,
  getDecision,
  updateDecisionStatus,
  loadIndex,
  reindexStorage,
  initStorage,
  getDecisionsDir,
  normalizePath,
  slugify,
  generateDecisionId,
  DecisionStore
} from './core/store.js';

// Search & Diagnostics
export {
  searchDecisions as search,
  searchDecisions,
  type SearchResultItem
} from './core/search.js';

export {
  runDoctor as doctor,
  runDoctor,
  collectRepoFiles,
  type DoctorReport,
  type DoctorIssue,
  type RunDoctorOptions
} from './core/doctor.js';

export {
  lintDecisions as lint,
  lintDecisions,
  type LintResult,
  type LintError
} from './core/lint.js';

export {
  getDecisionTimeline as getTimeline,
  getDecisionTimeline,
  type TimelineNode
} from './core/timeline.js';

// Conflict & Overlap Detection
export {
  detectConflicts,
  checkScopeOverlap,
  type ConflictWarning,
  type CandidateDecisionInput
} from './core/conflict.js';

// Monorepo Support
export {
  isMonorepo,
  findMonorepoRoot,
  discoverWorkspaces,
  checkMonorepoFileDecisions,
  listAllMonorepoDecisions,
  type WorkspacePackage,
  type MonorepoDecisionMatch
} from './core/monorepo.js';

// Local Semantic Matcher (Pluggable, Opt-in)
export {
  matchFileSemantically,
  extractImports,
  LocalKeywordSemanticMatcher,
  type SemanticMatchResult,
  type SemanticMatcherPlugin
} from './core/semantic.js';

// Exporters
export {
  exportDecisions,
  checkExport,
  watchDecisions,
  formatDecisionsMarkdown,
  exportCursorRules,
  checkCursorRules,
  installPreCommitHook,
  injectManagedSection,
  atomicWriteFile,
  BEGIN_MARKER,
  END_MARKER,
  type ExportTarget,
  type ExportResult,
  type CheckExportResult
} from './core/exporters/index.js';

// Propose & Inbox
export {
  proposeFromTranscript,
  reviewInboxSync,
  loadInboxCandidates,
  saveInboxCandidate,
  removeInboxCandidate,
  approveInboxCandidate,
  ensureInboxIgnored,
  getInboxDir,
  type ProposedCandidate,
  type ProposeResult,
  type ReviewResult
} from './core/propose/index.js';

// MCP Server & Dashboard
export { createServer, runMcpServer } from './mcp/server.js';
export { startDashboardServer } from './dashboard/server.js';
