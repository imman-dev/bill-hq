// Bill HQ — local config
// Copy this file to config.js and edit paths/ports for your machine.
// config.js is gitignored so machine-specific paths stay local.

module.exports = {
  // Where the Ward vault is checked out on this machine.
  // Mac default: '/Users/immanuel/Downloads/root/ward-ai-agency-vault'
  // Windows default: 'C:\\Users\\iblad\\Documents\\ward-ai-agency-vault'
  vaultPath: 'C:\\Users\\iblad\\Documents\\ward-ai-agency-vault',

  // HTTP port the dashboard serves on (open localhost:PORT in browser)
  port: 3737,

  // Claude Code subprocess settings
  // Uses your Max plan auth via the locally-installed `claude` CLI — no API key in code.
  claude: {
    cliCommand: 'claude',          // override if `claude` isn't in PATH
    maxOutputTokens: 4096,
    systemPromptPath: './lib/bill-persona.txt',
  },

  // Ollama endpoint for batch agents (Hermes, etc.)
  ollama: {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'hermes3',       // ollama pull hermes3 first
  },

  // Agents — each entry is a script under ./agents/ that exports a `run` function.
  // schedule is a cron-style string ('disabled' to keep manual-only).
  agents: {
    scout:   { engine: 'ollama', model: 'hermes3', schedule: 'disabled', label: 'Etsy/Gumroad competitor sweep' },
    hunter:  { engine: 'ollama', model: 'hermes3', schedule: 'disabled', label: 'Tax-lien + foreclosure scan' },
    echo:    { engine: 'ollama', model: 'hermes3', schedule: 'disabled', label: 'Daily KPI roll-up' },
    charlie: { engine: 'claude', schedule: 'disabled',                   label: 'Outreach copy drafts' },
    ralph:   { engine: 'claude', schedule: 'disabled',                   label: 'Deep research' },
  },
};
