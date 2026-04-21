"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  FolderKanban,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  ApiError,
  type Board,
  type Issue,
  type IssueStatus,
} from "@/lib/api";

interface Props {
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string | null) => void;
  /**
   * Monotonically-increasing counter. When it changes, the browser
   * silently refetches boards + the currently-selected board's issues.
   * Used by the AI chat to auto-reload after mutating tool calls.
   */
  refreshSignal?: number;
}

const STATUSES: IssueStatus[] = ["to_do", "in_progress", "completed"];
const STATUS_LABEL: Record<IssueStatus, string> = {
  to_do: "To do",
  in_progress: "In progress",
  completed: "Completed",
};

/**
 * Left-hand column: list of boards (click to select), create/delete boards,
 * and a Kanban of the selected board's issues with create/move/delete.
 * Selecting a board also scopes the AI chat on the right (see page.tsx).
 */
export function BoardBrowser({
  selectedBoardId,
  onSelectBoard,
  refreshSignal = 0,
}: Props) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Inline-create state
  const [newBoardName, setNewBoardName] = useState("");
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const [newIssue, setNewIssue] = useState<{
    status: IssueStatus | null;
    title: string;
  }>({ status: null, title: "" });
  const [creatingIssue, setCreatingIssue] = useState(false);

  function toApiError(e: unknown): string {
    return e instanceof ApiError ? `${e.status}: ${e.message}` : String(e);
  }

  async function refreshBoards() {
    setLoadingBoards(true);
    setErr(null);
    try {
      setBoards(await api.listBoards());
    } catch (e) {
      setBoards(null);
      setErr(toApiError(e));
    } finally {
      setLoadingBoards(false);
    }
  }

  async function refreshIssues(boardId: string) {
    setLoadingIssues(true);
    try {
      setIssues(await api.listIssues(boardId));
    } catch (e) {
      setErr(toApiError(e));
    } finally {
      setLoadingIssues(false);
    }
  }

  useEffect(() => {
    refreshBoards();
  }, []);

  useEffect(() => {
    if (!selectedBoardId) {
      setIssues(null);
      return;
    }
    refreshIssues(selectedBoardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoardId]);

  // Auto-reload when the AI chat signals that something changed server-side.
  // Skip the initial mount (refreshSignal === 0) so we don't double-fetch.
  useEffect(() => {
    if (refreshSignal === 0) return;
    refreshBoards();
    if (selectedBoardId) refreshIssues(selectedBoardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  async function handleCreateBoard() {
    const name = newBoardName.trim();
    if (!name) return;
    setCreatingBoard(true);
    setErr(null);
    try {
      const b = await api.createBoard(name);
      setNewBoardName("");
      setShowNewBoard(false);
      await refreshBoards();
      onSelectBoard(b.id);
    } catch (e) {
      setErr(toApiError(e));
    } finally {
      setCreatingBoard(false);
    }
  }

  async function handleDeleteBoard(id: string) {
    if (!confirm("Delete this board? This cannot be undone.")) return;
    setErr(null);
    try {
      await api.deleteBoard(id);
      if (selectedBoardId === id) onSelectBoard(null);
      await refreshBoards();
    } catch (e) {
      setErr(toApiError(e));
    }
  }

  async function handleCreateIssue(status: IssueStatus) {
    if (!selectedBoardId || !newIssue.title.trim()) return;
    setCreatingIssue(true);
    setErr(null);
    try {
      await api.createIssue({
        title: newIssue.title.trim(),
        board_id: selectedBoardId,
        status,
      });
      setNewIssue({ status: null, title: "" });
      await refreshIssues(selectedBoardId);
    } catch (e) {
      setErr(toApiError(e));
    } finally {
      setCreatingIssue(false);
    }
  }

  async function handleMoveIssue(issue: Issue, status: IssueStatus) {
    if (issue.status === status || !selectedBoardId) return;
    try {
      await api.updateIssue(issue.id, { status });
      await refreshIssues(selectedBoardId);
    } catch (e) {
      setErr(toApiError(e));
    }
  }

  async function handleDeleteIssue(issue: Issue) {
    if (!selectedBoardId) return;
    if (!confirm(`Delete issue "${issue.title}"?`)) return;
    try {
      await api.deleteIssue(issue.id);
      await refreshIssues(selectedBoardId);
    } catch (e) {
      setErr(toApiError(e));
    }
  }

  const columns = groupByStatus(issues || []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-gray-200 flex items-center gap-2">
          <FolderKanban size={16} /> Your boards
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewBoard((v) => !v)}
            className="text-xs inline-flex items-center gap-1 text-muted hover:text-gray-200 transition-colors"
          >
            <Plus size={12} /> New board
          </button>
          <button
            onClick={refreshBoards}
            disabled={loadingBoards}
            className="text-xs inline-flex items-center gap-1 text-muted hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={loadingBoards ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {showNewBoard && (
        <div className="flex items-center gap-2 bg-panel border border-border rounded-md p-2">
          <input
            autoFocus
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateBoard();
              if (e.key === "Escape") {
                setShowNewBoard(false);
                setNewBoardName("");
              }
            }}
            placeholder="Board name…"
            className="flex-1 bg-bg border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleCreateBoard}
            disabled={creatingBoard || !newBoardName.trim()}
            className="text-xs px-3 py-1 rounded bg-accent text-black font-medium disabled:opacity-50"
          >
            {creatingBoard ? "…" : "Create"}
          </button>
          <button
            onClick={() => {
              setShowNewBoard(false);
              setNewBoardName("");
            }}
            className="text-muted hover:text-gray-200"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {err && (
        <div className="border border-err/40 bg-err/10 text-err text-sm rounded-md p-3 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Backend error</div>
            <div className="text-err/80">{err}</div>
          </div>
          <button
            onClick={() => setErr(null)}
            className="text-err/70 hover:text-err"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {!boards && loadingBoards && (
        <div className="text-muted text-sm flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> loading boards…
        </div>
      )}

      {boards && (
        <div className="space-y-2">
          {boards.length === 0 && (
            <div className="text-sm text-muted">
              No boards yet. Click <b>New board</b> above.
            </div>
          )}
          {boards.map((b) => {
            const active = b.id === selectedBoardId;
            return (
              <div
                key={b.id}
                className={`w-full px-3 py-2 rounded-md border transition-colors flex items-center gap-2 ${
                  active
                    ? "bg-accent/15 border-accent/40 text-white"
                    : "bg-panel border-border hover:border-muted"
                }`}
              >
                <button
                  onClick={() => onSelectBoard(active ? null : b.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium">{b.board_name}</div>
                  <div className="text-[11px] font-mono text-muted truncate">
                    {b.id}
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteBoard(b.id)}
                  title="Delete board"
                  className="text-muted hover:text-err transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedBoardId && (
        <div className="pt-2">
          <h3 className="text-xs uppercase tracking-wider text-muted mb-2">
            Issues on this board
          </h3>

          {loadingIssues && (
            <div className="text-muted text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> loading issues…
            </div>
          )}

          {!loadingIssues && issues && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STATUSES.map((s) => (
                <div
                  key={s}
                  className="bg-panel border border-border rounded-md"
                >
                  <div className="px-3 py-2 text-xs uppercase tracking-wider text-muted border-b border-border flex items-center justify-between">
                    <span>{STATUS_LABEL[s]}</span>
                    <span>{columns[s].length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[40px]">
                    {columns[s].map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onMove={(newStatus) => handleMoveIssue(issue, newStatus)}
                        onDelete={() => handleDeleteIssue(issue)}
                      />
                    ))}

                    {newIssue.status === s ? (
                      <div className="bg-bg border border-accent/40 rounded p-2 space-y-2">
                        <input
                          autoFocus
                          value={newIssue.title}
                          onChange={(e) =>
                            setNewIssue({ ...newIssue, title: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateIssue(s);
                            if (e.key === "Escape")
                              setNewIssue({ status: null, title: "" });
                          }}
                          placeholder="Issue title…"
                          className="w-full bg-panel border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateIssue(s)}
                            disabled={creatingIssue || !newIssue.title.trim()}
                            className="flex-1 text-xs px-2 py-1 rounded bg-accent text-black font-medium disabled:opacity-50"
                          >
                            {creatingIssue ? "…" : "Add"}
                          </button>
                          <button
                            onClick={() =>
                              setNewIssue({ status: null, title: "" })
                            }
                            className="text-xs px-2 py-1 rounded border border-border text-muted hover:text-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewIssue({ status: s, title: "" })}
                        className="w-full text-xs text-muted hover:text-accent border border-dashed border-border rounded py-1.5 inline-flex items-center justify-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Add
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function IssueCard({
  issue,
  onMove,
  onDelete,
}: {
  issue: Issue;
  onMove: (s: IssueStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-bg border border-border rounded p-2 hover:border-muted transition-colors fade-in group">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium break-words">{issue.title}</div>
          {issue.desc && (
            <div className="text-xs text-muted mt-1 line-clamp-2">
              {issue.desc}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-muted">
            <span>#{issue.id.slice(0, 6)}</span>
            {issue.due_date && <span>· due {issue.due_date.slice(0, 10)}</span>}
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Delete issue"
          className="text-muted hover:text-err opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <label className="text-[10px] uppercase tracking-wider text-muted">
          Move
        </label>
        <select
          value={issue.status}
          onChange={(e) => onMove(e.target.value as IssueStatus)}
          className="flex-1 bg-panel border border-border rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-accent"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function groupByStatus(issues: Issue[]): Record<IssueStatus, Issue[]> {
  const cols: Record<IssueStatus, Issue[]> = {
    to_do: [],
    in_progress: [],
    completed: [],
  };
  for (const issue of issues) {
    const key: IssueStatus = (STATUSES as readonly string[]).includes(
      issue.status,
    )
      ? (issue.status as IssueStatus)
      : "to_do";
    cols[key].push(issue);
  }
  return cols;
}
