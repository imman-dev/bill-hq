// agents/scout.js — overnight competitor sweep on the functional/desk Etsy lane.
//
// Engine: Hermes 3 on local Ollama (free, slow OK for batch).
// Schedule (Phase 2): nightly via cron / Windows Task Scheduler.
// Manual: clickable from the dashboard agent grid.
//
// Stub for now — Phase 2 wires up real Etsy fetching + summarization.

const fs = require('fs/promises');
const path = require('path');

async function run({ vault, config, agentConfig }) {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(vault.root, '04-Knowledge-Base/Market-Research/scout-daily');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.md`);

  const placeholder = [
    `# Scout — Competitor Sweep — ${today}`,
    '',
    '> Stub run. Real fetch/summarize wired in Phase 2.',
    '',
    `Engine planned: ${agentConfig.engine} (${agentConfig.model || 'n/a'})`,
    `Endpoint: ${config.ollama?.baseUrl || 'unset'}`,
    '',
    'When implemented this report will list:',
    '- Top 20 listings in the functional/desk Etsy lane',
    '- Pricing changes vs prior day',
    '- New listings appearing in tracked search terms',
    '- Notable review-velocity changes on competitor listings',
  ].join('\n');

  await fs.writeFile(outPath, placeholder, 'utf8');
  return { wrote: path.relative(vault.root, outPath), engine: agentConfig.engine };
}

module.exports = { run };
