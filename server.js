// server.js — Bill HQ Mission Control server.
//
// One Node process serves the dashboard, watches the vault, dispatches agents,
// and proxies chat to Claude Code (Max plan auth via subprocess).

const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { Vault } = require('./lib/vault');
const { VaultWatcher } = require('./lib/watcher');
const { callClaude } = require('./lib/claude');

let config;
try {
  config = require('./config');
} catch {
  console.error(
    '\n[!] Missing config.js. Copy config.example.js to config.js and edit ' +
    'vaultPath to point at your local Ward vault clone.\n'
  );
  process.exit(1);
}

const vault = new Vault(config.vaultPath);
const watcher = new VaultWatcher(config.vaultPath);
watcher.start();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Vault state endpoints ---

app.get('/api/state', async (req, res) => {
  try {
    const [agencyState, taskQueue, recentReports, scoutReports, projects, identity] =
      await Promise.all([
        vault.agencyState().catch(() => null),
        vault.taskQueue().catch(() => null),
        vault.recentAgentReports(5),
        vault.recentScoutReports(5),
        vault.activeProjects(),
        vault.identity(),
      ]);
    res.json({
      ts: Date.now(),
      vaultPath: config.vaultPath,
      identity,
      agencyState,
      taskQueue,
      recentReports,
      scoutReports,
      projects,
      agents: Object.entries(config.agents).map(([name, cfg]) => ({
        name,
        ...cfg,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/file', async (req, res) => {
  const rel = req.query.path;
  if (!rel || rel.includes('..')) {
    return res.status(400).json({ error: 'invalid path' });
  }
  try {
    const content = await vault.readFile(rel);
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// --- Live updates via Server-Sent Events ---
app.get('/api/events', (req, res) => watcher.subscribe(res));

// --- Bill chat (Claude Code subprocess) ---
app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    // Compact vault context: identity + agency state + task queue.
    const ctx = await vault.billContext();
    const contextParts = [];
    if (ctx.identity) contextParts.push('## Operator profile\n' + ctx.identity);
    if (ctx.state)    contextParts.push('## Current agency state\n' + ctx.state);
    if (ctx.tasks)    contextParts.push('## Active task queue\n' + ctx.tasks);
    const contextPrefix = contextParts.length
      ? `<vault-context>\n${contextParts.join('\n\n---\n\n')}\n</vault-context>\n`
      : '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders?.();

    const onChunk = (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    };

    const { full } = await callClaude({
      cliCommand: config.claude.cliCommand,
      systemPromptPath: path.resolve(__dirname, config.claude.systemPromptPath),
      userMessage: message,
      contextPrefix,
      onChunk,
    });

    res.write(`data: ${JSON.stringify({ done: true, full })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// --- Agent dispatch (stub for now — wired up in Phase 2) ---
app.post('/api/agents/:name/run', async (req, res) => {
  const { name } = req.params;
  const cfg = config.agents[name];
  if (!cfg) return res.status(404).json({ error: `unknown agent: ${name}` });

  try {
    const agentPath = path.join(__dirname, 'agents', `${name}.js`);
    const agent = require(agentPath);
    if (typeof agent.run !== 'function') {
      return res.status(501).json({ error: `agent ${name} has no run() yet` });
    }
    const out = await agent.run({ vault, config, agentConfig: cfg });
    res.json({ ok: true, agent: name, ...out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now(), vaultPath: config.vaultPath });
});

function getLanIPs() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const port = config.port || 3737;
app.listen(port, () => {
  console.log(`\n[ Bill HQ ] Mission Control online`);
  console.log(`[ Bill HQ ] Local URL  : http://localhost:${port}`);
  for (const ip of getLanIPs()) {
    console.log(`[ Bill HQ ] LAN URL    : http://${ip}:${port}   (use this from other devices on your network)`);
  }
  console.log(`[ Bill HQ ] Vault path : ${config.vaultPath}`);
  console.log(`[ Bill HQ ] Ctrl+C to stop.\n`);
});

process.on('SIGINT', async () => {
  console.log('\n[ Bill HQ ] Shutting down...');
  await watcher.stop();
  process.exit(0);
});
