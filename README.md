# Prospect

Fewer candidates. A reason for each.

India-first recruiting shortlist. Pick a role, confirm who you want, then review a ranked twenty — each with a case for, a case against, and a drafted outreach note.

## How it works

1. **Role** — start from a demo brief or paste a job description.
2. **Who we want** — edit must / nice / not a fit, then find 22 people.
3. **Shortlist** — keep, pass, or reveal contact. Passes re-rank the rest.

Searches and reveals live in this browser (`localStorage`). Contact stays hidden until you spend a reveal.

## Stack

- React 19 + TanStack Start / Router
- Tailwind v4
- Zustand (persisted searches)
- Vite + Nitro (Vercel)

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (defaults to port 8080).

```bash
npm run build
npm run typecheck
```

## Notes

Demo candidates and companies are synthetic. Outreach can send through a connected Gmail or Outlook inbox, or open the system mail app.
