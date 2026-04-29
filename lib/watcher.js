// lib/watcher.js — file-system watcher → SSE bridge.
//
// Watches the vault directory and pushes events to connected dashboard clients.
// Uses Server-Sent Events because they're simple, one-way, and don't need a
// websocket dependency.

const chokidar = require('chokidar');
const path = require('path');

class VaultWatcher {
  constructor(vaultRoot) {
    this.root = vaultRoot;
    this.subscribers = new Set();
    this.watcher = null;
  }

  start() {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.root, {
      ignored: [
        /(^|[\/\\])\../, // dotfiles (.git, .obsidian, .DS_Store)
        '**/node_modules/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    const broadcast = (event, fullPath) => {
      const relPath = path.relative(this.root, fullPath);
      const payload = { event, path: relPath, ts: Date.now() };
      for (const res of this.subscribers) {
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          // client likely disconnected; will be cleaned up on next subscribe
        }
      }
    };

    this.watcher
      .on('add',    (p) => broadcast('add', p))
      .on('change', (p) => broadcast('change', p))
      .on('unlink', (p) => broadcast('unlink', p));
  }

  subscribe(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ event: 'connected', ts: Date.now() })}\n\n`);

    this.subscribers.add(res);
    res.on('close', () => this.subscribers.delete(res));
  }

  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    for (const res of this.subscribers) {
      try { res.end(); } catch {}
    }
    this.subscribers.clear();
  }
}

module.exports = { VaultWatcher };
