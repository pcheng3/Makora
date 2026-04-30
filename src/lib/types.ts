export interface Session {
  id: number;
  repo_path: string;
  branch: string;
  base_branch: string;
  commit_hash: string | null;
  provider: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  diff_stats: string | null;
  chunk_count: number;
  chunks_done: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ReviewItem {
  id: number;
  session_id: number;
  chunk_index: number;
  category: "issue" | "question" | "positive" | "test_suggestion";
  severity: "critical" | "blocking" | "suggestion" | "nit" | null;
  title: string;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  description: string;
  proposed_fix: string | null;
  raw_json: string | null;
  created_at: string;
}

export interface Rating {
  id: number;
  review_item_id: number;
  rating: 1 | -1;
  comment: string | null;
  created_at: string;
}

export interface Rule {
  id: number;
  rule_type: "do" | "avoid";
  category: string | null;
  title: string;
  description: string;
  source_type: "learned" | "manual" | "imported";
  confidence: number;
  times_applied: number;
  enabled: boolean;
  source_ratings: string | null;
  file_extensions: string | null;
  created_at: string;
  updated_at: string;
}

export interface FewShotExample {
  rating: 1 | -1;
  comment: string | null;
  category: string;
  severity: string | null;
  title: string;
  file_path: string | null;
  code_snippet: string | null;
  description: string;
  proposed_fix: string | null;
}

export interface GuidanceFile {
  id: number;
  filename: string;
  original_name: string;
  description: string | null;
  file_path: string;
  content_hash: string | null;
  size_bytes: number | null;
  enabled: boolean;
  created_at: string;
}

export interface ReviewItemWithRating extends ReviewItem {
  rating: Rating | null;
}

export interface SessionWithStats extends Session {
  total_items: number;
  rated_items: number;
  thumbs_up: number;
  thumbs_down: number;
}

export interface AIReviewOutput {
  summary: string;
  items: AIReviewItem[];
}

export interface AIReviewItem {
  category: "issue" | "question" | "positive" | "test_suggestion";
  severity?: "critical" | "blocking" | "suggestion" | "nit";
  title: string;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  code_snippet?: string;
  description: string;
  proposed_fix?: string;
}

export interface ReviewRequest {
  diff: string;
  chunkIndex: number;
  chunkCount: number;
  repoPath: string;
  branch: string;
  baseBranch: string;
  systemPrompt: string;
}

export interface ReviewResult {
  summary: string;
  items: AIReviewItem[];
  rawOutput: string;
  durationMs: number;
}

export interface SSEEvent {
  type: "status" | "item" | "progress" | "complete" | "error" | "cancelled";
  data: Record<string, unknown>;
}
