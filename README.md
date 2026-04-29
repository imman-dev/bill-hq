# Bill HQ

JARVIS-flavored Mission Control for Ward AI Agency.

Reads the Ward vault (private, separate repo: `imman-dev/Ward-vault`), orchestrates batch + strategic agents, and hosts **Bill** — the Agency OS persona.

---

## What this is

A small Node.js + Express app that:

- Renders the Ward vault as a live dashboard (markdown auto-rendered)
- Watches the vault for changes and pushes updates to the browser via Server-Sent Events
- Hosts a chat panel where you talk to **Bill** (Claude Code subprocess, authed via your Max plan — no API key in code)
- Dispatches autonomous "agents" — some run on local Ollama (free, batch), some via Claude (strategic)

It runs locally on your machine (`localhost:3737` by default) — not deployed to the public web. Vault stays private; this code stays open.

---

## Architecture

```
bill-hq/                          Mission Control app (this repo, public)
├── server.js                     Express + SSE + chat + agent dispatch
├── config.example.js             Template — copy to config.js with your paths
├── lib/
│   ├── vault.js                  Reads markdown from the Ward vault
│   ├── watcher.js                chokidar → SSE bridge for live updates
│   ├── claude.js                 Claude Code CLI subprocess wrapper (Max-plan auth)
│   ├── ollama.js                 Local Ollama HTTP client for batch agents
│   └── bill-persona.txt          System prompt for Bill's voice/role
├── agents/
│   ├── scout.js                  Etsy / Gumroad competitor sweep (Hermes)
│   ├── hunter.js                 Tax-lien / foreclosure scan (Hermes)
│   ├── echo.js                   Daily KPI roll-up (Hermes)
│   ├── charlie.js                Outreach drafts (Claude)
│   └── ralph.js                  Deep research (Claude)
├── public/
│   ├── index.html
│   ├── styles.css                JARVIS aesthetic — dark, cyan accents, mono
│   └── app.js                    Frontend logic: SSE listener, chat, agent grid
└── docs/
    └── ROADMAP.md                Phase 1-4 plan
```

The vault is **separate** — it lives at `imman-dev/Ward-vault` (private). This app reads from a local clone of that vault. The path to the vault clone is set in `config.js`.

---

## Setup (Windows or Mac)

You need:
- Node v18+ (Manny has v24 on Windows, none on Mac yet)
- `git`
- A local clone of the Ward vault repo
- Optional: Claude Code CLI (`claude`) installed and logged in — required for chat and Claude-engine agents
- Optional: Ollama with at least one model pulled (e.g. `ollama pull hermes3`) — required for Hermes-engine agents

```bash
# 1. Clone this repo
git clone https://github.com/imman-dev/bill-hq.git
cd bill-hq

# 2. Install Node deps
npm install

# 3. Clone the vault (private repo) somewhere convenient
git clone https://github.com/imman-dev/Ward-vault.git ../ward-vault

# 4. Configure
cp config.example.js config.js
# Edit config.js — set vaultPath to the absolute path of your Ward-vault clone.

# 5. Run
npm start
```

Open `http://localhost:3737` in your browser.

---

## What works in Phase 1 (this version)

- Dashboard live-renders the vault: `00-Agency-Core/agency-state.md`, `05-Daily-Operations/task-queue.md`, latest agent reports, latest Scout reports
- File watcher: edits to vault markdown push live to the dashboard within ~1 second
- Bill chat panel: type → Claude Code subprocess responds in stream (uses your Max plan auth, $0 above subscription)
- Agent dispatch grid: each agent has a clickable card; clicking runs the agent's `run()` function
- Agent stubs: each agent script writes a placeholder report to the vault when triggered, proving the round-trip works

## What's deferred to later phases (see `docs/ROADMAP.md`)

- **Phase 2** — real agent implementations (Scout actually scrapes Etsy, Hunter actually pulls tax liens, Echo pulls real KPI sources)
- **Phase 3** — voice interface (Whisper + Piper for talking to Bill hands-free)
- **Phase 4** — proactive triggers (rule-based alerts: "Hughes lease 90 days out," "competitor undercut," etc.) and scheduled cron-style runs

---

## Why this design

- **Localhost not public:** Mission Control is for one operator. No need to expose it. Privacy is free.
- **Vault stays private; code stays open:** the data is sensitive (financials, contacts, plans). The code that *renders* the data isn't sensitive. Two repos, two policies.
- **Claude Code subprocess vs API:** uses your Max plan auth — no API key in code, no per-token billing, runs against your subscription quota.
- **Hermes for batch, Claude for strategic:** matches model quality to task quality. Free local inference for the work that doesn't need brilliance; paid quality for the work that does.
- **Markdown all the way:** the vault is plain `.md` files. Obsidian still works on the same files. Mission Control is just one renderer of many.

---

## License

MIT
