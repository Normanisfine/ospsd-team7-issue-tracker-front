"use client";

import { useEffect, useState } from "react";
import { KeyRound, LogOut, ExternalLink } from "lucide-react";
import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from "@/lib/session";
import { api } from "@/lib/api";

/**
 * Thin header showing Trello auth state + "Connect" / "Sign out" actions.
 *
 * On first load there's no session token; user clicks "Connect Trello",
 * which kicks off the backend's /auth/login redirect chain. Trello
 * eventually redirects back with a session_token in the URL; we pick it
 * up and stash it in localStorage, then reload.
 */
export function SessionBar({ onChange }: { onChange: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    // Pick up ?session_token= from the URL after OAuth callback.
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("session_token");
    if (fromUrl) {
      setSessionToken(fromUrl);
      url.searchParams.delete("session_token");
      window.history.replaceState({}, "", url.toString());
    }
    setToken(getSessionToken());
  }, []);

  function handleSignOut() {
    clearSessionToken();
    setToken(null);
    onChange();
  }

  function handleManualSave() {
    if (!manualValue.trim()) return;
    setSessionToken(manualValue.trim());
    setToken(manualValue.trim());
    setManualValue("");
    setManualOpen(false);
    onChange();
  }

  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 grid place-items-center text-accent">
            <KeyRound size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">
              Team 7 · Issue Tracker
            </div>
            <div className="text-xs text-muted">
              Trello backend · Claude AI assistant
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {token ? (
            <>
              <span className="text-xs text-muted font-mono truncate max-w-[20ch]">
                {token.slice(0, 8)}…{token.slice(-4)}
              </span>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border hover:border-muted transition-colors"
              >
                <LogOut size={12} /> Sign out
              </button>
            </>
          ) : (
            <>
              <a
                href={api.authLoginUrl()}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-accent hover:bg-accentHover text-white transition-colors"
              >
                Connect Trello <ExternalLink size={12} />
              </a>
              <button
                onClick={() => setManualOpen((v) => !v)}
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-muted transition-colors"
              >
                Paste token
              </button>
            </>
          )}
        </div>
      </div>

      {manualOpen && !token && (
        <div className="max-w-7xl mx-auto px-6 pb-4 -mt-1 flex items-center gap-2 fade-in">
          <input
            className="flex-1 bg-panel border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-accent"
            placeholder="paste session_token from /auth/callback"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSave()}
          />
          <button
            onClick={handleManualSave}
            className="text-xs px-3 py-1.5 rounded-md bg-accent hover:bg-accentHover text-white transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </header>
  );
}
