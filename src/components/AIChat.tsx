"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  User,
  XCircle,
} from "lucide-react";
import {
  ApiError,
  api,
  type AIChatResponse,
  type AIHealthResponse,
  type AIProvider,
  type AIToolAction,
} from "@/lib/api";

type Turn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      actions: AIToolAction[];
      truncated: boolean;
    }
  | { role: "error"; text: string };

interface Props {
  /** When set, the prompt is scoped to this board so the AI can use it. */
  boardId: string | null;
  /**
   * Called after the assistant runs at least one mutating tool
   * (create_board / rename_board / create_issue / update_issue_status)
   * so the board browser can re-fetch without a full remount.
   */
  onAfterAIMutation?: () => void;
}

/**
 * Tool names that change server state the BoardBrowser cares about.
 * Kept in sync with claude_ai_client_impl/tools.py.
 */
const MUTATING_TOOLS = new Set<string>([
  "create_board",
  "rename_board",
  "create_issue",
  "update_issue_status",
]);

/**
 * UI-level provider selection: `default` lets the backend use its configured
 * `AI_PROVIDER`; `claude` / `openai` are forwarded as `X-AI-Provider` per
 * request. Persisted in localStorage so the choice survives reloads.
 */
type ProviderChoice = "default" | AIProvider;

const PROVIDER_STORAGE_KEY = "ai.provider";

const PROVIDER_OPTIONS: { id: ProviderChoice; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "claude", label: "Claude" },
  { id: "openai", label: "OpenAI" },
];

function isProviderChoice(value: unknown): value is ProviderChoice {
  return value === "default" || value === "claude" || value === "openai";
}

const PROVIDER_LABEL: Record<AIProvider, string> = {
  claude: "Claude",
  openai: "OpenAI",
};

/**
 * Build the small subtitle under "AI assistant" in the chat header.
 *
 * When the user has chosen a non-default provider, render the model name for
 * that provider as reported by `/ai/health.providers[<provider>]` and tag it
 * with `(override)` so it is obvious the banner is reflecting the picker, not
 * the server default. Otherwise we show the top-level `health.model` (which
 * mirrors `AI_PROVIDER` on the server).
 *
 * The backend probes both providers on every health call, so we never have to
 * hardcode model strings here.
 */
function headerSubtitle(
  provider: ProviderChoice,
  health: AIHealthResponse | null,
): React.ReactNode {
  const mutationLabel = health
    ? health.allow_mutations
      ? "read/write"
      : "read-only"
    : null;

  if (provider !== "default") {
    const info = health?.providers?.[provider];
    if (info?.status === "ok") {
      return (
        <>
          {info.model}
          <span className="text-accent/80"> (override)</span>
          {mutationLabel ? ` · ${mutationLabel}` : ""}
        </>
      );
    }
    if (info?.status === "unconfigured") {
      return (
        <>
          {PROVIDER_LABEL[provider]}
          <span className="text-accent/80"> (override)</span>
          {" · API key not set"}
        </>
      );
    }
    // Health not loaded yet, or older backend without `providers` map.
    return (
      <>
        {PROVIDER_LABEL[provider]}
        <span className="text-accent/80"> (override)</span>
        {health ? "" : " · checking…"}
      </>
    );
  }

  if (health?.status === "ok") {
    return `${health.model} · ${mutationLabel}`;
  }
  if (health?.status === "unconfigured") {
    return "ANTHROPIC_API_KEY not set";
  }
  return "checking…";
}

/**
 * Right-hand column: chat with Claude. Every message is posted to
 * /ai/chat with the currently-selected board_id as scoping context.
 * The assistant's tool-call log is rendered under each reply for
 * transparency.
 */
export function AIChat({ boardId, onAfterAIMutation }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<AIHealthResponse | null>(null);
  const [provider, setProvider] = useState<ProviderChoice>("default");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .aiHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // Restore the saved provider choice once on mount. localStorage is wrapped
  // in try/catch because it can throw in private-browsing modes.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PROVIDER_STORAGE_KEY);
      if (isProviderChoice(stored)) setProvider(stored);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  function chooseProvider(next: ProviderChoice) {
    setProvider(next);
    try {
      window.localStorage.setItem(PROVIDER_STORAGE_KEY, next);
    } catch {
      /* ignore storage errors */
    }
  }

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  async function send() {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setDraft("");
    setTurns((t) => [...t, { role: "user", text: prompt }]);
    setBusy(true);
    try {
      const resp: AIChatResponse = await api.aiChat(
        {
          prompt,
          board_id: boardId || undefined,
        },
        provider === "default" ? undefined : provider,
      );
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: resp.reply,
          actions: resp.actions,
          truncated: resp.truncated,
        },
      ]);
      // If Claude ran any board/issue-mutating tool successfully, tell the
      // parent so the board browser can refetch.
      const mutated = resp.actions.some(
        (a) => a.ok && MUTATING_TOOLS.has(a.tool),
      );
      if (mutated) onAfterAIMutation?.();
    } catch (e) {
      const msg =
        e instanceof ApiError ? `${e.status}: ${e.message}` : String(e);
      setTurns((t) => [...t, { role: "error", text: msg }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-panel border border-border rounded-lg flex flex-col h-[calc(100vh-120px)]">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/40 grid place-items-center text-accent">
            <Sparkles size={14} />
          </div>
          <div>
            <div className="text-sm font-semibold">AI assistant</div>
            <div className="text-[11px] text-muted">
              {headerSubtitle(provider, health)}
            </div>
          </div>
        </div>
        {boardId && (
          <span className="text-[10px] font-mono bg-accent/10 border border-accent/30 text-accent px-2 py-0.5 rounded">
            scoped: {boardId.slice(0, 6)}
          </span>
        )}
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {turns.length === 0 && (
          <EmptyState boardScoped={!!boardId} onPick={(p) => setDraft(p)} />
        )}
        {turns.map((turn, i) => (
          <ChatBubble key={i} turn={turn} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-muted text-sm fade-in">
            <Loader2 size={14} className="animate-spin" /> thinking…
          </div>
        )}
      </div>

      <footer className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            className="flex-1 bg-bg border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:border-accent"
            placeholder={
              boardId
                ? "Ask about issues on this board…"
                : "Ask something about your boards or issues…"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
          />
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            className="h-9 px-3 inline-flex items-center gap-1 bg-accent hover:bg-accentHover disabled:opacity-40 disabled:hover:bg-accent rounded-md text-white text-sm transition-colors"
          >
            <Send size={14} /> Send
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <ProviderPicker
            value={provider}
            onChange={chooseProvider}
            disabled={busy}
          />
          <div className="text-[11px] text-muted text-right">
            Enter to send · Shift+Enter for newline · prompts and replies are
            scrubbed for API keys and emails before hitting the model.
          </div>
        </div>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------- //
// sub-components
// ---------------------------------------------------------------------- //

function ProviderPicker({
  value,
  onChange,
  disabled,
}: {
  value: ProviderChoice;
  onChange: (next: ProviderChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wider text-muted">
        Model
      </span>
      <div
        role="radiogroup"
        aria-label="AI provider"
        className="inline-flex bg-bg border border-border rounded-md p-0.5"
      >
        {PROVIDER_OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.id)}
              disabled={disabled}
              className={`text-[11px] px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                active
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "text-muted border border-transparent hover:text-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  boardScoped,
  onPick,
}: {
  boardScoped: boolean;
  onPick: (prompt: string) => void;
}) {
  const prompts = boardScoped
    ? [
        "Summarize the overdue issues on this board.",
        "Which tickets are still in To Do?",
        "Draft a stand-up update from the In Progress column.",
      ]
    : [
        "What boards do I have access to?",
        "List the issues on my most active board.",
        "Any open tickets mentioning 'bug' across my boards?",
      ];
  return (
    <div className="text-sm text-muted space-y-3 fade-in">
      <div className="flex items-center gap-2 text-gray-300">
        <Bot size={16} /> Ask me anything about your boards.
      </div>
      <div className="space-y-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="block w-full text-left text-xs px-3 py-2 rounded-md bg-bg border border-border hover:border-accent/40 hover:text-gray-200 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex gap-2 fade-in">
        <Avatar icon={<User size={12} />} variant="user" />
        <div className="bg-accent/10 border border-accent/30 rounded-md px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
          {turn.text}
        </div>
      </div>
    );
  }
  if (turn.role === "error") {
    return (
      <div className="flex gap-2 fade-in">
        <Avatar icon={<AlertTriangle size={12} />} variant="error" />
        <div className="bg-err/10 border border-err/30 text-err rounded-md px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 fade-in">
      <Avatar icon={<Bot size={12} />} variant="assistant" />
      <div className="space-y-2 max-w-[85%]">
        <div className="bg-bg border border-border rounded-md px-3 py-2 text-sm whitespace-pre-wrap">
          {turn.text || (
            <span className="italic text-muted">
              (no reply — the model didn't say anything)
            </span>
          )}
          {turn.truncated && (
            <div className="mt-1 text-[11px] text-warn flex items-center gap-1">
              <AlertTriangle size={11} /> Hit tool-hop limit; answer may be
              incomplete.
            </div>
          )}
        </div>
        {turn.actions.length > 0 && <ActionLog actions={turn.actions} />}
      </div>
    </div>
  );
}

function ActionLog({ actions }: { actions: AIToolAction[] }) {
  return (
    <div className="bg-bg border border-border rounded-md p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        tools run
      </div>
      {actions.map((a, i) => (
        <div
          key={i}
          className="text-[11px] font-mono flex items-start gap-2"
        >
          {a.ok ? (
            <CheckCircle2 size={12} className="text-ok mt-0.5 shrink-0" />
          ) : (
            <XCircle size={12} className="text-err mt-0.5 shrink-0" />
          )}
          <div>
            <span className="text-gray-200">{a.tool}</span>
            {a.error && (
              <span className="text-err ml-2">{a.error}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({
  icon,
  variant,
}: {
  icon: React.ReactNode;
  variant: "user" | "assistant" | "error";
}) {
  const cls =
    variant === "user"
      ? "bg-accent/20 border-accent/40 text-accent"
      : variant === "error"
        ? "bg-err/20 border-err/40 text-err"
        : "bg-panel border-border text-gray-300";
  return (
    <div
      className={`w-7 h-7 rounded-md border grid place-items-center shrink-0 ${cls}`}
    >
      {icon}
    </div>
  );
}
