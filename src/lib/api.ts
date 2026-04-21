/**
 * Thin, typed fetch wrapper for the FastAPI backend.
 *
 * The base URL is read from NEXT_PUBLIC_API_BASE_URL at build time and
 * falls back to http://localhost:8000 for local dev.
 */

import { getSessionToken } from "./session";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// ---------------------------------------------------------------------- //
// Types mirror the Pydantic response models in issue_tracker_service/main
// ---------------------------------------------------------------------- //

export interface Board {
  id: string;
  board_name: string;
}

export interface Issue {
  id: string;
  title: string;
  desc: string;
  members: string[] | null;
  due_date: string | null;
  status: string;
  board_id: string;
}

export interface List {
  id: string;
  name: string;
  board_id: string;
}

export interface AIToolAction {
  tool: string;
  ok: boolean;
  error?: string | null;
}

export interface AIChatResponse {
  reply: string;
  actions: AIToolAction[];
  truncated: boolean;
}

export interface AIHealthResponse {
  status: "ok" | "unconfigured" | string;
  model: string;
  allow_mutations: boolean;
  api_key_loaded: boolean;
}

// ---------------------------------------------------------------------- //
// Core request helper
// ---------------------------------------------------------------------- //

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getSessionToken();
    if (token) headers.set("X-Session-Token", token);
  }
  const resp = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!resp.ok) {
    let detail = resp.statusText;
    try {
      const data = (await resp.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      /* body not JSON; keep statusText */
    }
    throw new ApiError(resp.status, detail);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

// ---------------------------------------------------------------------- //
// Endpoints
// ---------------------------------------------------------------------- //

export type IssueStatus = "to_do" | "in_progress" | "completed";

export const api = {
  authLoginUrl: () => `${API_BASE}/auth/login`,

  // Boards
  listBoards: () => request<Board[]>("/boards"),
  getBoard: (id: string) => request<Board>(`/boards/${id}`),
  createBoard: (name: string) =>
    request<Board>("/boards", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameBoard: (id: string, name: string) =>
    request<Board>(`/boards/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteBoard: (id: string) =>
    request<{ success: boolean }>(`/boards/${id}`, { method: "DELETE" }),

  // Issues
  listIssues: (boardId: string) =>
    request<Issue[]>(`/boards/${boardId}/issues`),
  getIssue: (id: string) => request<Issue>(`/issues/${id}`),
  createIssue: (payload: {
    title: string;
    board_id: string;
    desc?: string;
    status?: IssueStatus;
  }) =>
    request<Issue>("/issues", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIssue: (
    id: string,
    patch: Partial<{
      title: string;
      desc: string;
      status: IssueStatus;
      due_date: string;
      members: string[];
    }>,
  ) =>
    request<Issue>(`/issues/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteIssue: (id: string) =>
    request<{ success: boolean }>(`/issues/${id}`, { method: "DELETE" }),

  // Lists
  listLists: (boardId: string) => request<List[]>(`/boards/${boardId}/lists`),

  // AI
  aiHealth: () => request<AIHealthResponse>("/ai/health", {}, { auth: false }),
  aiChat: (payload: {
    prompt: string;
    board_id?: string | null;
    channel_id?: string | null;
  }) =>
    request<AIChatResponse>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
