// agents/ralph.js — deep research on a topic.
//
// Engine: Claude Code subprocess (Max plan). High-quality synthesis for
// Q-level research questions (market, competitor, regulatory, tax, etc.).
//
// Manual-trigger. Pass options.question to specify the topic; otherwise
// Ralph picks the most urgent question from the task queue.

const fs = require('fs/promises');
const path = require('path');
const { callClaude } = require('../lib/claude');

async function run({ vault, config, options = {} }) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = (options.slug || 'ad-hoc').replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  const ctx = await vault.billContext();
  const userMessage = options.question ||
    'Default Ralph task: scan the current task queue and active projects, identify ' +
    'the one decision that is most under-researched and would benefit most from a ' +
    '500-word brief. Produce that brief — facts, sources to verify, open questions.';

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

  const outDir = path.join(vault.root, '04-Knowledge-Base/Market-Research/ralph');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}-${slug}.md`);
  await fs.writeFile(outPath, `# Ralph — ${slug} — ${today}\n\n${full}\n`, 'utf8');

  return { wrote: path.relative(vault.root, outPath), engine: 'claude' };
}

module.exports = { run };
