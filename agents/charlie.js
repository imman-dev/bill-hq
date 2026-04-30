// agents/charlie.js — outreach copy drafts.
//
// Engine: Claude Code subprocess (Max plan). Quality matters here — these are
// the messages that go to real humans.
//
// Modes:
//   default                — Charlie reads the task queue, picks the most urgent
//                            outreach, drafts it.
//   options.target         — slug for a specific outreach target. Charlie pulls
//                            target-specific context from the vault if a brief
//                            file exists at 04-Knowledge-Base/Templates/charlie/<target>.md
//   options.brief          — explicit one-liner overriding everything else
//                            (e.g. "draft a 2-day follow-up to TRaK's after no response")
//
// Output: 05-Daily-Operations/Agent-Reports/<date>-charlie-<topic>.md

const fs = require('fs/promises');
const path = require('path');
const { callClaude } = require('../lib/claude');

const TASK_PROMPT_DEFAULT = `
You are Charlie — Ward AI Agency's communications agent. Your job: pick the highest-priority outreach for today and draft it.

INSTRUCTIONS

1. Read the vault context above (operator profile, agency state, task queue).
2. From the task queue and active projects, identify ONE outreach Manny needs to send today. Prefer P1/P2 items. If multiple compete, pick the one with the closest deadline or biggest revenue impact.
3. Draft the outreach. Output format MUST be exactly:

---
TARGET: <who is this to>
CHANNEL: <email | text | DM | walk-in>
WHY THIS ONE: <one line explaining your pick>

SUBJECT: <subject line, only if email>

<body — written in Manny's voice: direct, military-veteran, no fluff, no emojis>

---
NOTES FOR MANNY: <anything Manny should know before sending — what to confirm, what to follow up if no reply, etc.>

VOICE GUIDE
- Direct. No "I hope this email finds you well."
- Concrete asks, not vague ones.
- Short sentences. Active voice.
- Reference specifics from the relationship if known.
- For B2B (TRaK's, salon owners, dental offices): lead with value, not features.
- For peers (military friends, vendors): casual but professional.

DON'T
- Don't write a generic template. Pick the actual situation and write the actual message.
- Don't add disclaimers, marketing fluff, or feature lists.
- Don't sign off with anything more than "Manny" or "Immanuel" — no titles.
`.trim();


async function run({ vault, config, agentConfig, options = {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const topic = (options.target || options.topic || 'auto-pick').toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');

  // Build the user message. If a specific brief was given, use it directly.
  // Otherwise, use the default "pick the most urgent" instructions.
  let userMessage = options.brief;
  if (!userMessage) {
    if (options.target) {
      userMessage = `Draft today's outreach to: ${options.target}\n\n${TASK_PROMPT_DEFAULT}`;
    } else {
      userMessage = TASK_PROMPT_DEFAULT;
    }
  }

  // Vault context — full picture of what's happening so Charlie picks well.
  const ctx = await vault.billContext();
  const contextParts = [];
  if (ctx.identity) contextParts.push('## Operator profile\n' + ctx.identity);
  if (ctx.state)    contextParts.push('## Current agency state\n' + ctx.state);
  if (ctx.tasks)    contextParts.push('## Active task queue\n' + ctx.tasks);

  // Pull in the active project for Etsy lane (most outreach right now relates to it).
  try {
    const etsyPlan = await vault.readFile('03-Projects/Active/etsy-lane-b-launch.md');
    contextParts.push('## Active project — Etsy Lane B launch\n' + etsyPlan);
  } catch {}

  // Optional target-specific brief if Manny has filed one.
  if (options.target) {
    try {
      const targetBrief = await vault.readFile(
        `04-Knowledge-Base/Templates/charlie/${options.target}.md`
      );
      contextParts.push(`## Target brief — ${options.target}\n` + targetBrief);
    } catch {}
  }

  const contextPrefix = `<vault-context>\n${contextParts.join('\n\n---\n\n')}\n</vault-context>`;

  const { full } = await callClaude({
    cliCommand: config.claude.cliCommand,
    systemPromptPath: path.resolve(__dirname, '..', config.claude.systemPromptPath),
    userMessage,
    contextPrefix,
  });

  const outDir = path.join(vault.root, '05-Daily-Operations/Agent-Reports');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}-charlie-${topic}.md`);
  const body = [
    `# Charlie — ${topic} — ${today}`,
    '',
    '> Drafted by Charlie. Review before sending.',
    '',
    full,
    '',
  ].join('\n');
  await fs.writeFile(outPath, body, 'utf8');

  return {
    wrote: path.relative(vault.root, outPath),
    engine: 'claude',
    topic,
    chars: full.length,
  };
}

module.exports = { run };
