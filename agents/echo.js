// agents/echo.js — daily KPI roll-up across all live revenue streams.
//
// Engine: Hermes 3 on Ollama for the synthesis. Inputs come from per-platform
// API/scrape modules (added in Phase 2).
//
// Output: 04-Knowledge-Base/Market-Research/echo-daily/YYYY-MM-DD.md
// Plus: writes a one-line summary to 05-Daily-Operations/Performance-Metrics/

const fs = require('fs/promises');
const path = require('path');

async function run({ vault, agentConfig }) {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(vault.root, '04-Knowledge-Base/Market-Research/echo-daily');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.md`);

  const placeholder = [
    `# Echo — Daily KPI Roll-up — ${today}`,
    '',
    '> Stub run. Real data sources wired in Phase 2.',
    '',
    'Will pull from:',
    '- Gumroad API — sales / refunds / view counts',
    '- YouTube Data API — channel views, subs, watch-time',
    '- Etsy stats — listing impressions, clicks, sales',
    '- Hughes property — rent collection status',
    '- 3D printer logs — prints completed, filament used',
    '',
    'Synthesizes into a 5-line "what moved" summary for Bill\'s morning brief.',
  ].join('\n');

  await fs.writeFile(outPath, placeholder, 'utf8');
  return { wrote: path.relative(vault.root, outPath), engine: agentConfig.engine };
}

module.exports = { run };
