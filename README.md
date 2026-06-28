# Alpas

> *Alpas* is a Filipino word for letting go, breaking free, unchained.

**Alpas** is an anonymous confession board where anyone can post the thoughts they'd never say out loud — no account, no name, no trace back to who you are.

**Live site:** [alpas-confession.vercel.app](https://alpas-confession.vercel.app)

## Features

- **Anonymous posting** — no sign-up or login required
- **Categories** — tag confessions with relatable, Filipino-flavored categories (Hugot, Kalokohan, Red Flag Alert, Crush Diaries, Pera Problems, NPC Moments, and more)
- **Likes & comments** — react and respond to confessions, all anonymously
- **Filter by category** — browse confessions by the category that fits your mood
- **Sort by newest or most liked**
- **Delete your own confession** — handled via a private device ID stored in the browser, no account needed
- **Report inappropriate posts** — simple flagging system
- **Dark / light theme toggle** — preference saved across visits

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | HTML, CSS, JavaScript (no framework) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Hosting | [Vercel](https://vercel.com) |
| Version control / CI | GitHub → auto-deploy on push |

## How It Works

- Confessions, comments, and reports are stored in a Supabase Postgres database
- Anonymous read/write access is enabled through Supabase Row Level Security (RLS) policies — no login system needed
- A randomly generated device ID is stored in `localStorage` so users can delete their own confessions without needing an account
- Every push to the `main` branch on GitHub automatically redeploys the live site via Vercel

## Project Structure

```
├── index.html      # page structure and layout
├── style.css        # all styling (dark/light theme, layout, animations)
└── app.js           # app logic — Supabase queries, rendering, interactivity
```

## What I Learned

This was my first full-stack project built from scratch — going beyond static front-end pages into:
- Designing and querying a real relational database (Supabase/Postgres)
- Understanding Row Level Security and why public-facing apps need explicit access policies
- Deploying a live app and setting up an automatic deploy pipeline with GitHub + Vercel
- Debugging real production issues (naming conflicts, missing permissions, authentication credential mismatches)

---

Built by [John Lester Jaca](https://github.com/lesterjaca123-creator)
