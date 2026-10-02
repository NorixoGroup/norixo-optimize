// Types partagés du Nomad Studio. Reflètent le contrat du pont local
// `youtube-agent.bridge.v1` ; aucune logique ici.

export const BRIDGE_CONTRACT = "youtube-agent.bridge.v1";

export const BRIDGE_VIEWS = [
  "system",
  "productions",
  "pipeline",
  "planner",
  "comments",
  "analytics",
  "learning",
  "journal",
  "settings",
] as const;

export type BridgeView = (typeof BRIDGE_VIEWS)[number];

export type FailureKind =
  | "not_configured"
  | "invalid_config"
  | "unreachable"
  | "timeout"
  | "host_rejected"
  | "origin_rejected"
  | "bridge_disabled"
  | "unauthorized"
  | "bad_response"
  | "contract_mismatch"
  | "agent_error";

export type BridgeFailure = {
  kind: FailureKind;
  httpStatus?: number;
  code?: string;
  message: string;
};

export type Tone = "green" | "orange" | "red" | "grey";

export type StageView = {
  key: string;
  label: string;
  engine: string;
  status: "done" | "running" | "failed" | "pending" | "not_connected";
  tone: Tone;
  percent: number | null;
};

export type ProductionItem = {
  id: string;
  title: string;
  type: "real" | "test";
  mode: string;
  pipeline_status: string;
  workflow_state: string;
  bucket: "planned" | "in_progress" | "published" | "archived";
  progress_percent: number;
  video_id: string | null;
  target_date: string | null;
  linked: boolean;
  locked: boolean;
  thumbnail: null;
};

export type ProductionsData = {
  items: ProductionItem[];
  counts: Record<"planned" | "in_progress" | "published" | "archived", number>;
  totals: { in_pipeline: number; shown: number; hidden_tests: number; truncated: boolean };
  thumbnails: "not_available";
};

export type PipelineData = {
  production: { id: string; title: string; workflow_state: string } | null;
  stages: StageView[];
  progress_percent: number;
};

export type PlannerEntry = {
  production_id: string;
  title: string;
  deadline: string | null;
  workflow_state: string;
  bucket: string;
  progress_percent: number;
  recommendation: { next_engine: string | null; action: string; reason: string; requires_approval: boolean };
  blockers: Array<{ code: string; label: string }>;
};

export type PlannerData = { next: PlannerEntry | null; queue: PlannerEntry[]; priority: "not_defined" };

export type CommentItem = {
  ref: string;
  video_id: string | null;
  type: string | null;
  priority_score: number | null;
  author_label: string | null;
  excerpt: string | null;
  proposal_text: string | null;
  state: string;
};

export type CommentsData = {
  columns: Array<{ key: string; label: string; items: CommentItem[] }>;
  ingestion: "not_connected";
  untrusted_text: true;
  auto_reply: false;
  human_validation_required: true;
  actions: { enabled: boolean; reason: string; available: string[] };
};

export type AnalyticsData = {
  source: "not_connected";
  reason: string;
  cards: Array<{ key: string; label: string; status: "not_connected"; value: null }>;
  top_videos: { status: "not_connected"; items: unknown[] };
  worst_videos: { status: "not_connected"; items: unknown[] };
};

export type LearningItem = { id: string; ts: string; text: string | null };

export type LearningData = {
  read_only: true;
  observations: LearningItem[];
  validated_learnings: LearningItem[];
  prompt_updates: LearningItem[];
  knowledge: { status: "ok" | "empty"; documents: number };
};

export type JournalEntry = {
  ts: string;
  type: string;
  action: string;
  engine: string | null;
  subject_id: string | null;
  outcome: string | null;
  actor: "human_approved" | "agent_recorded";
  validation: "approved" | "none";
};

export type JournalData = { entries: JournalEntry[] };

export type SettingsData = {
  read_only: true;
  channel: { id: string };
  language: string | null;
  project: { name?: string; language?: string; platform?: string; content_type?: string } | null;
  writing_style: { status: string };
  narration_voice: { kind?: string; model_id?: string; output_format?: string; voice_id?: string } | null;
  workflow: { transitions: number; approval_required_on: string[] };
  comments: { human_validation_required: true; auto_reply: false; ingestion: string };
  publication: { status: string; approval_required: boolean };
};

export type SystemData = {
  agent: { name: string; phase: string };
  channel_id: string;
  data: { channel_dir_exists: boolean };
  productions: { in_pipeline: number; readable: number; inspected: number };
  registry: { linked: number; updated_at: string | null };
  journal: { last_ts: string | null };
  engines: { existing: number; planned: number; undecided: number; external_actions_require_approval: number };
  integrations: { youtube_api: string; oauth: string; network: string };
  safety: { auto_reply: boolean; human_validation_required: boolean; engines_executable: number };
};

export type ViewDataMap = {
  system: SystemData;
  productions: ProductionsData;
  pipeline: PipelineData;
  planner: PlannerData;
  comments: CommentsData;
  analytics: AnalyticsData;
  learning: LearningData;
  journal: JournalData;
  settings: SettingsData;
};

export type DiagnosticStepStatus = "ok" | "warn" | "fail" | "skipped";

export type DiagnosticStep = {
  id: "environment" | "configuration" | "reachability" | "bridge" | "authentication" | "contract" | "data";
  label: string;
  status: DiagnosticStepStatus;
  detail: string;
  hint?: string;
  /** English explanation of why the step failed or warns (absent when OK). */
  cause?: string;
  /** English corrective action (absent when OK). */
  action?: string;
};

export type DiagnosticReport = {
  overall: "ready" | "degraded" | "blocked";
  summary: string;
  blocking_step: DiagnosticStep["id"] | null;
  steps: DiagnosticStep[];
  endpoint: string | null;
  latency_ms: number | null;
  checked_at: string;
};

export type SectionResult<T> = { ok: true; data: T } | { ok: false; failure: BridgeFailure };

export type OverviewResponse =
  | { connected: false; diagnostics: DiagnosticReport }
  | {
      connected: true;
      diagnostics: DiagnosticReport;
      channel_id: string;
      sections: { [K in BridgeView]: SectionResult<ViewDataMap[K]> };
    };
