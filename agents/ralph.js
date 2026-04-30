// agents/ralph.js — research briefs for decisions Manny is about to make.
//
// Engine: Claude Code subprocess (Max plan). Quality matters — Ralph's output
// drives strategic moves, so we use the strategic-tier engine, not Hermes.
//
// Modes:
//   default               — Ralph scans the task queue + active projects, picks the
//                           decision that's most under-researched, produces a brief.
//   options.question      — explicit research question. Ralph focuses there.
//   options.slug          — short slug for the output filename (default: derived
//                           from question or 'ad-hoc').
//
// Output: 04-Knowledge-Base/Market-Research/ralph/<date>-<slug>.md
//
// Output format is fixed (see RALPH_BRIEF_PROMPT) so reports are scannable.

const fs = require('fs/promises');
const path = require('path');
const { callClaude } = require('../lib/claude');

const RALPH_BRIEF_PROMPT = `
You are Ralph — Ward AI Agency's research and intelligence agent. Your job is to produce a tight 500-word decision brief on the topic in question.

INSTRUCTIONS

1. Read the vault context above.
2. If a specific question was given below, answer that. If not, scan the task queue and active projects, identify the ONE decision Manny needs to make next that is most under-researched (high stakes + low current information), and brief that.
3. Output format MUST be exactly:

---
QUESTION: <one sentence — the decision Ralph is briefing>
WHY THIS MATTERS NOW: <one or two sentences — what action this unblocks, what cost ignoring it has>

## Facts
- <bullet> (5-8 bullets — what is true, with rough sources or "verify with X" tags)

## Trade-offs
- <option A>: <costs / benefits / risks>
- <option B>: <costs / benefits / risks>
- (3-5 distinct options where relevant — if there are only 2, say so)

## Recommendation
<one paragraph — what Ralph would do, and why. Not hedged. Pick a side.>

## Open questions / verify before acting
- <bullet> (things Ralph couldn't determine and Manny needs to confirm)

## Sources to check
- <bullet> (2-5 specific sources Manny or a CPA/attorney/lender should validate against — URLs, document types, professionals to call)

---

VOICE GUIDE
- Direct. Pick a side in the recommendation.
- Concrete numbers when possible. Don't say "high cost" — say "$5–15K range."
- If you don't know something specific to Manny's deal, mark it for verification rather than inventing it.
- No hedging language ("it depends" only when you actually break out the dependent options).
- ~500 words for the body, not counting headers and bullets.
`.trim();


function makeSlug(input, fallback = 'ad-hoc') {
  if (!input) return fallback;
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .slice(0, 50) || fallback;
}


async function run({ vault, config, options = {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = makeSlug(options.slug || options.question, 'ad-hoc');

  const ctx = await vault.billContext();
  const contextParts = [];
  if (ctx.identity) contextParts.push('## Operator profile\n' + ctx.identity);
  if (ctx.state)    contextParts.push('## Current agency state\n' + ctx.state);
  if (ctx.tasks)    contextParts.push('## Active task queue\n' + ctx.tasks);

  // Pull in active projects so Ralph has full picture.
  const projects = await vault.activeProjects();
  for (const p of projects.slice(0, 5)) {
    try {
      const content = await vault.readFile(p.path);
      contextParts.push(`## Active project — ${p.name}\n${content}`);
    } catch {}
  }

  const contextPrefix = `<vault-context>\n${contextParts.join('\n\n---\n\n')}\n</vault-context>`;

  const userMessage = options.question
    ? `Research question: ${options.question}\n\n${RALPH_BRIEF_PROMPT}`
    : RALPH_BRIEF_PROMPT;

  const { full } = await callClaude({
    cliCommand: config.claude.cliCommand,
    systemPromptPath: path.resolve(__dirname, '..', config.claude.systemPromptPath),
    userMessage,
    contextPrefix,
  });

  const outDir = path.join(vault.root, '04-Knowledge-Base/Market-Research/ralph');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}-${slug}.md`);
  const body = [
    `# Ralph — ${slug} — ${today}`,
    '',
    options.question ? `**Question:** ${options.question}` : `**Mode:** auto-pick from queue`,
    '',
    full,
    '',
  ].join('\n');
  await fs.writeFile(outPath, body, 'utf8');

  return {
    wrote: path.relative(vault.root, outPath),
    engine: 'claude',
    slug,
    chars: full.length,
  };
}

module.exports = { run };
