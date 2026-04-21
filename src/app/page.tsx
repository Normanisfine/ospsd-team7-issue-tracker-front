"use client";

import { useEffect, useState } from "react";
import { SessionBar } from "@/components/SessionBar";
import { BoardBrowser } from "@/components/BoardBrowser";
import { AIChat } from "@/components/AIChat";
import { getSessionToken } from "@/lib/session";

/**
 * Single-page dashboard.
 *
 * Left column: boards + issues (calls /boards, /boards/{id}/issues).
 * Right column: AI chat (calls /ai/chat).
 *
 * The two sides are linked through `selectedBoardId` so the chat can be
 * scoped to the board the user is currently looking at.
 */
export default function Home() {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  // `bump` is a simple dependency that forces children to refetch whenever
  // the session changes (sign in / sign out).
  const [bump, setBump] = useState(0);
  // Separate counter the AI chat bumps after a mutating tool call so the
  // board browser auto-refreshes without a full remount.
  const [aiMutationBump, setAiMutationBump] = useState(0);

  // Read localStorage only after mount so the server-rendered HTML (which
  // can't see localStorage) matches the first client render.
  const [mounted, setMounted] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    setMounted(true);
    setHasSession(!!getSessionToken());
  }, [bump]);

  return (
    <>
      <SessionBar onChange={() => setBump((n) => n + 1)} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!mounted ? null : !hasSession ? (
          <Welcome />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),420px] gap-6">
            <div key={`browser-${bump}`}>
              <BoardBrowser
                selectedBoardId={selectedBoardId}
                onSelectBoard={setSelectedBoardId}
                refreshSignal={aiMutationBump}
              />
            </div>
            <div key={`chat-${bump}`}>
              <AIChat
                boardId={selectedBoardId}
                onAfterAIMutation={() => setAiMutationBump((n) => n + 1)}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Welcome() {
  return (
    <div className="mx-auto max-w-2xl text-center py-20 fade-in">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs mb-6">
        NYU OSPSD · Team 7 · HW3
      </div>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
        A Trello-backed issue tracker with a Claude assistant.
      </h1>
      <p className="text-muted mb-8 leading-relaxed">
        Browse your Trello boards, open tickets from columns, and chat with
        an AI that can read and update them for you — all behind a clean,
        component-based FastAPI backend.
      </p>
      <ol className="text-left max-w-md mx-auto space-y-2 text-sm text-gray-300">
        <li>
          <span className="text-accent font-mono mr-2">1.</span>
          Click <b>Connect Trello</b> in the top-right.
        </li>
        <li>
          <span className="text-accent font-mono mr-2">2.</span>
          Finish OAuth on Trello; you'll land back here signed in.
        </li>
        <li>
          <span className="text-accent font-mono mr-2">3.</span>
          Pick a board on the left — then ask the AI anything on the right.
        </li>
      </ol>
    </div>
  );
}
