// agents/charlie.js — outreach copy drafts (TRaK's, military friends, vendors, etc.)
//
// Engine: Claude Code subprocess (Max plan). Quality matters here — these are
// the messages that go to real humans, so we use the strategic-tier engine.
//
// Manual-trigger only. Reads target context from vault, drafts the outreach,
// writes to 05-Daily-Operations/Agent-Reports/charlie-<topic>-<date>.md.

const fs = require('fs/promises');
const path = require('path');
const { callClaude } = require('../lib/claude');

async function run({ vault, config, agentConfig, options = {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const topic = options.topic || 'general-outreach';

  const ctx = await vault.billContext();
  const userMessage = options.brief ||
    'Default Charlie task: review the current task queue, identify the most urgent ' +
    'outreach Manny should send today, and draft it. Output: subject line + body. ' +
    'Tone matches Manny\'s voice (direct, military-veteran, no fluff).';

  const contextPrefix =
    `<vault-context>\n## Operator profile\n${ctx.identity || ''}\n\n` +
    `## Agency state\n${ctx.state || ''}\n\n## Task queue\n${ctx.tasks || ''}\n` +
    `</vault-context>\n`;

  const { full } = await callClaude({
    cliCommand: config.claude.cliCommand,
    systemPromptPath: path.resolve(__dirname, '..', config.claude.systemPromptPath),
    userMessage,
    contextPrefix,
  });

  const outDir = path.join(vault.root, '05-Daily-Operations/Agent-Reports');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}-charlie-${topic}.md`);
  await fs.writeFile(outPath, `# Charlie — ${topic} — ${today}\n\n${full}\n`, 'utf8');

  return { wrote: path.relative(vault.root, outPath), engine: 'claude' };
}

module.exports = { run };
