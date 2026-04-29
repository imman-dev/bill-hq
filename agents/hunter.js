// agents/hunter.js — tax-lien + foreclosure scan from public GA county sources.
//
// Sources: gsccca.org, houstoncountyga.gov, maconbibb.us, plus delinquent
// tax lien lists per county.
//
// Engine: Hermes 3 on Ollama for filtering and summarization.
// Output: 04-Knowledge-Base/Market-Research/hunter-daily/YYYY-MM-DD.md

const fs = require('fs/promises');
const path = require('path');

async function run({ vault, config, agentConfig }) {
  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(vault.root, '04-Knowledge-Base/Market-Research/hunter-daily');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.md`);

  const placeholder = [
    `# Hunter — Real Estate Lead Scan — ${today}`,
    '',
    '> Stub run. Real scrape/score wired in Phase 2.',
    '',
    'Planned sources:',
    '- gsccca.org — Georgia Superior Court Clerks records',
    '- houstoncountyga.gov — Houston County records',
    '- maconbibb.us — Macon-Bibb County records',
    '- per-county delinquent tax-lien lists',
    '',
    'Output will rank candidates by Manny\'s buy box criteria.',
  ].join('\n');

  await fs.writeFile(outPath, placeholder, 'utf8');
  return { wrote: path.relative(vault.root, outPath), engine: agentConfig.engine };
}

module.exports = { run };
