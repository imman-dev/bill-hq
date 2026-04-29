// lib/vault.js — read and parse the Ward vault from disk.
//
// The vault is plain markdown files in a directory tree. We don't transform
// them; we render them. This keeps the vault Obsidian-compatible.

const fs = require('fs/promises');
const path = require('path');

class Vault {
  constructor(rootPath) {
    this.root = rootPath;
  }

  async readFile(relativePath) {
    const full = path.join(this.root, relativePath);
    return fs.readFile(full, 'utf8');
  }

  async exists(relativePath) {
    try {
      await fs.access(path.join(this.root, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  // Core state files used by the dashboard home page.
  async agencyState() {
    return this.readFile('00-Agency-Core/agency-state.md');
  }

  async taskQueue() {
    return this.readFile('05-Daily-Operations/task-queue.md');
  }

  async identity() {
    if (await this.exists('00-Agency-Core/identity.md')) {
      return this.readFile('00-Agency-Core/identity.md');
    }
    return null;
  }

  // List recent agent reports (most-recent first).
  async recentAgentReports(limit = 5) {
    const reportsDir = path.join(this.root, '05-Daily-Operations/Agent-Reports');
    try {
      const entries = await fs.readdir(reportsDir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort()
        .reverse()
        .slice(0, limit);
      return Promise.all(
        files.map(async (name) => ({
          name,
          path: `05-Daily-Operations/Agent-Reports/${name}`,
          content: await fs.readFile(path.join(reportsDir, name), 'utf8'),
        }))
      );
    } catch {
      return [];
    }
  }

  // List recent Scout intelligence (Etsy / Gumroad / SAM.gov sweeps).
  async recentScoutReports(limit = 5) {
    const dir = path.join(this.root, '04-Knowledge-Base/Market-Research/scout-daily');
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort()
        .reverse()
        .slice(0, limit);
      return Promise.all(
        files.map(async (name) => ({
          name,
          path: `04-Knowledge-Base/Market-Research/scout-daily/${name}`,
          content: await fs.readFile(path.join(dir, name), 'utf8'),
        }))
      );
    } catch {
      return [];
    }
  }

  // Active projects (everything in 03-Projects/Active/).
  async activeProjects() {
    const dir = path.join(this.root, '03-Projects/Active');
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const items = [];
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.md')) {
          items.push({
            name: e.name,
            path: `03-Projects/Active/${e.name}`,
          });
        }
      }
      return items;
    } catch {
      return [];
    }
  }

  // Build a compact context bundle Bill can use as system context.
  async billContext() {
    const [state, tasks, identity] = await Promise.all([
      this.agencyState().catch(() => null),
      this.taskQueue().catch(() => null),
      this.identity(),
    ]);
    return { state, tasks, identity };
  }
}

module.exports = { Vault };
