# ospsd-team7-issue-tracker-front

Frontend for the Team 7 Trello-backed issue tracker. Next.js 14 + React
18 + Tailwind CSS. Talks to the FastAPI backend (`issue_tracker_service`)
over HTTP and offers two primary experiences:

1. **Issue browsing** — list boards, open a board to see its issues and
   lists, inspect a single issue.
2. **AI assistant** — chat panel that posts to `POST /ai/chat` on the
   backend and renders the assistant's answer plus any tool-call log.

## Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local if the backend runs on a non-default host

# in another terminal, start the backend
cd ../ospsd-team7-issue-tracker
uv run uvicorn issue_tracker_service.main:app --reload

# back here:
npm run dev
# → http://localhost:3000
```

Sign in by clicking **Connect Trello** (which opens the backend's
`/auth/login` flow). After Trello redirects back, paste the returned
`session_token` into the banner input — everything else is done for you.

## Production deployment (Vercel)

1. Push this directory to a GitHub repo.
2. Import it in Vercel.
3. Set one env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com`
4. Deploy. Vercel auto-detects Next.js, no config needed.

Remember to add the Vercel URL to `CORS_ALLOW_ORIGINS` on the backend.

## What's where

| Path                             | Role                                        |
| -------------------------------- | ------------------------------------------- |
| `src/app/page.tsx`               | Single-page dashboard (boards + AI chat).   |
| `src/app/layout.tsx`             | Root layout + global styles.                |
| `src/app/globals.css`            | Tailwind + a handful of CSS variables.      |
| `src/lib/api.ts`                 | Tiny typed HTTP client for the backend.     |
| `src/lib/session.ts`             | `localStorage`-backed session helper.       |
| `src/components/*`               | UI pieces (BoardList, IssueCard, AIChat).   |
