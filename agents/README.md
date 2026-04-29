# Agents

Each agent in this directory is a small Node module that exports a `run({ vault, config, agentConfig, options })` function.

## Contract

```js
async function run({
  vault,        // Vault instance — has helper methods like .readFile(), .billContext()
  config,       // Loaded config.js
  agentConfig,  // Just this agent's slice of config.agents.<name>
  options,      // Optional per-call args (e.g. { topic: 'TRaKs' } for Charlie)
}) {
  // do work
  return { wrote: 'relative/path.md', engine: '...' };
}

module.exports = { run };
```

The dashboard's agent grid invokes these via `POST /api/agents/<name>/run`. The Phase 4 scheduler will invoke the same function on a cron.

## Engines

- `engine: 'ollama'` — call `lib/ollama.js` against the user's local Ollama. Use for any agent where output quality at "good enough" is fine and cost-per-run matters (overnight grunt work).
- `engine: 'claude'` — call `lib/claude.js` which spawns the Claude Code CLI. Uses Max-plan auth. Use for agents where output quality matters (drafts going to humans, strategic synthesis).

## Output

- All agents write to the vault at well-defined paths.
- Output files are markdown. Bill (and the dashboard) reads from the same paths.
- Side effects beyond the vault (sending emails, posting to platforms, etc.) are NOT done at this layer — agents draft into vault, Manny reviews + dispatches.

## Adding a new agent

1. Create `agents/<name>.js` with the contract above.
2. Add an entry to `config.example.js` under `agents:`.
3. The dashboard auto-renders new agents from config.

That's it.
