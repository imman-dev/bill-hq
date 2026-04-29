# Bill HQ — Roadmap

Phased plan toward "JARVIS-flavored Mission Control" for Ward AI Agency.

---

## Phase 1 — Live Dashboard + Bill Chat ✅ (current)

Foundation. Everything else plugs into this.

- [x] Express server reads vault markdown
- [x] File watcher → SSE → live dashboard updates
- [x] Bill chat panel via Claude Code subprocess (Max plan auth)
- [x] Agent dispatch grid (UI + REST endpoints)
- [x] Agent stubs that write placeholder reports to vault
- [x] JARVIS-style frontend aesthetic (dark + cyan + mono)

**Outcome:** open localhost in browser, see vault state live, chat with Bill, click an agent to run it.

---

## Phase 2 — Real Agents

Replace stubs with working implementations. Each agent is independent — can do them one at a time as bandwidth allows.

### Scout (Hermes / Ollama)
- Fetch top 20 Etsy listings for tracked search terms (functional/desk lane)
- Track price + listing changes vs prior day's snapshot
- Hermes summarizes "what changed and why it matters"
- Same pattern for Gumroad, SAM.gov, Marketplace tracking

### Hunter (Hermes + scraping)
- Pull from gsccca.org, houstoncountyga.gov, maconbibb.us
- Filter against Manny's buy box criteria
- Score and rank candidates
- Optionally tax-lien lists per county

### Echo (Hermes + APIs)
- Gumroad API: sales, refunds, conversion
- YouTube Data API: views, subs, watch-time
- Etsy stats (when listings exist): impressions, clicks
- Hughes property: rent collection status (manual entry → tracked)
- Bambu Studio logs: prints completed, filament used
- Daily 5-line "what moved" summary

### Charlie (Claude)
- Reads task queue, picks the most urgent outreach
- Drafts subject + body in Manny's voice
- Writes to `05-Daily-Operations/Agent-Reports/`

### Ralph (Claude)
- Topic-driven research briefs
- Writes to `04-Knowledge-Base/Market-Research/ralph/`
- 500-word format: facts, sources, open questions

---

## Phase 3 — Voice Interface

Make Bill conversational, not chat-shaped.

- **Speech-to-text:** Whisper (local, free, runs well on the 5080)
- **Text-to-speech:** Piper or Coqui (local, free)
- **Wake word:** optional ("Hey Bill") via Picovoice / openWakeWord
- **Streaming:** Bill's response speaks as it generates, not after
- **Use case:** hands-free queries while at the printer or doing physical work

---

## Phase 4 — Proactive Triggers & Scheduling

Bill stops being reactive only.

- **Schedule layer** — agents run on cron (Windows Task Scheduler hooks), not just manual click
- **Rule-based alerts:**
  - "Hughes rent notice deadline in N days"
  - "Competitor X undercut listing Y by Z%"
  - "Filament low — last print used N grams"
  - "SAM.gov contract matched NAICS — within deadline window"
  - "Echo KPI delta >X% from 7-day baseline"
- **Morning brief generator:** reads overnight Scout/Hunter/Echo, Claude synthesizes 6-line narrative, surfaces in dashboard's brief panel
- **Optional notifications later:** Manny said no phone push for now, but Mac/Windows native notifications via `node-notifier` are an easy add

---

## Phase 5 — Personality & Polish

The JARVIS feel.

- Refine Bill's voice via system prompt iterations + few-shot examples
- Pixel-art easter eggs / loading animations (per the original bill-hq vision)
- Status panel for "what is each agent thinking about right now"
- Conversation memory — chat history persisted to vault, so cross-session context works
- Agent-to-agent calls (Bill spawns Charlie, Charlie reports back to Bill, Bill summarizes)

---

## Phase 6 — Browser Automation Agents

When Claude in Chrome MCP is set up.

- Scout actually browses Etsy/Gumroad/Marketplace via headed Chrome
- Hunter fills county search forms, downloads filings
- Charlie posts drafted messages to actual destinations (with Manny approving each one)
- Bill becomes capable of "do X for me" tasks that previously required Manny's hands

---

## Stretch / Later

- **Multi-machine sync** — vault changes on Mac propagate to Windows in <1s (currently requires `git pull`). Possibly via a file-watcher → git auto-commit pattern, or shift to a real-time sync layer.
- **Mobile read-only view** — Cloudflare Tunnel + auth, view dashboard from phone
- **Calendar integration** — push deadlines from vault into Google Calendar / Apple Calendar
- **Voice replies in Manny's voice** (custom TTS training) — niche but cool
