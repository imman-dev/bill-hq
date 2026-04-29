// lib/claude.js — wrap the Claude Code CLI as a subprocess.
//
// Uses the user's Claude Max plan login automatically via the installed
// `claude` CLI. No API key in code.
//
// Implementation notes:
// - On Windows, npm/pnpm-installed CLIs are .cmd shims. Node 18.20.2+ requires
//   shell:true to spawn them safely (CVE-2024-27980). We detect .cmd targets
//   and enable shell mode on Windows.
// - We pass the full prompt (system + context + user message) via stdin instead
//   of as a CLI argument. This avoids cmd.exe command-line length limits and
//   quoting hell for multi-line system prompts.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadSystemPrompt(systemPromptPath) {
  if (!systemPromptPath) return null;
  try {
    return fs.readFileSync(systemPromptPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Resolve the claude CLI command to a path Node's spawn can find.
 * On Windows, probes common pnpm/npm install locations for .cmd shims.
 */
function resolveCommand(cliCommand) {
  if (path.isAbsolute(cliCommand)) return cliCommand;
  if (/\.(cmd|exe|bat|ps1)$/i.test(cliCommand)) return cliCommand;
  if (process.platform !== 'win32') return cliCommand;

  const cmdName = `${cliCommand}.cmd`;
  const exeName = `${cliCommand}.exe`;
  const candidates = [];

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'pnpm', cmdName));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'pnpm', exeName));
  }
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', cmdName));
    candidates.push(path.join(process.env.APPDATA, 'npm', exeName));
  }
  if (process.env.PROGRAMFILES) {
    candidates.push(path.join(process.env.PROGRAMFILES, 'nodejs', cmdName));
    candidates.push(path.join(process.env.PROGRAMFILES, 'nodejs', exeName));
  }

  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }
  return cliCommand;
}

/**
 * Run Claude Code as a subprocess.
 *
 * Sends a single combined prompt (system + context + user message) via stdin.
 * The `claude -p` flag puts the CLI in non-interactive print mode reading from stdin.
 */
function callClaude(opts) {
  const {
    cliCommand = 'claude',
    systemPromptPath,
    userMessage,
    contextPrefix = '',
    onChunk,
  } = opts;

  const systemPrompt = loadSystemPrompt(systemPromptPath);

  // Build one combined prompt. Bill's system instructions go first, then any
  // vault context, then the user's message. Tagged with delimiters so the
  // model can distinguish system instructions from user input.
  const parts = [];
  if (systemPrompt) {
    parts.push(`<bill-system-prompt>\n${systemPrompt}\n</bill-system-prompt>`);
  }
  if (contextPrefix) {
    parts.push(contextPrefix);
  }
  parts.push(`<user-message>\n${userMessage}\n</user-message>`);
  const combinedPrompt = parts.join('\n\n');

  const cmdToUse = resolveCommand(cliCommand);
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmdToUse);

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmdToUse, ['-p'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: needsShell,
      });
    } catch (err) {
      return reject(err);
    }

    let full = '';
    let stderr = '';

    child.stdout.on('data', (buf) => {
      const chunk = buf.toString('utf8');
      full += chunk;
      if (onChunk) {
        try { onChunk(chunk); } catch {}
      }
    });

    child.stderr.on('data', (buf) => {
      stderr += buf.toString('utf8');
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        return reject(new Error(
          `claude CLI not found at "${cmdToUse}". ` +
          `Install with: npm install -g @anthropic-ai/claude-code  ` +
          `Then run "claude /login" once with your Max plan. ` +
          `Or set claude.cliCommand in config.js to the full path.`
        ));
      }
      if (err.code === 'EINVAL') {
        return reject(new Error(
          `spawn EINVAL for "${cmdToUse}". ` +
          `On Windows, Node refuses to spawn .cmd files without shell mode. ` +
          `This patch sets shell:true automatically — if you still see this, ` +
          `you may need to update Node to v18.20.2+ / v20.12.2+.`
        ));
      }
      reject(err);
    });

    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error(
          `claude exited ${exitCode}: ${stderr.trim() || '(no stderr)'}`
        ));
      }
      resolve({ full, exitCode });
    });

    // Send the full prompt via stdin and close the input stream.
    try {
      child.stdin.write(combinedPrompt);
      child.stdin.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { callClaude, resolveCommand };
