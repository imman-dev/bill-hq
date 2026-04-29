// lib/claude.js — wrap the Claude Code CLI as a subprocess.
//
// This uses the user's Claude Max plan login automatically via the
// installed `claude` CLI. No API key in code, no key file, no env var.
//
// We use --print mode for one-shot calls. For streaming we read stdout
// incrementally and pipe chunks to the caller via the onChunk callback.

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
 * Resolve the claude CLI command to a path Node's spawn can actually find.
 *
 * On Windows, npm/pnpm-installed CLIs are typically `<name>.cmd` files in
 * locations that aren't always on the PATH that a Node child process inherits.
 * We probe the common locations and prefer an absolute path.
 */
function resolveCommand(cliCommand) {
  // Absolute path or explicit extension — use as-is.
  if (path.isAbsolute(cliCommand)) return cliCommand;
  if (/\.(cmd|exe|bat|ps1)$/i.test(cliCommand)) return cliCommand;

  // Non-Windows: rely on the OS to find it via PATH.
  if (process.platform !== 'win32') return cliCommand;

  // Windows: search common install locations for a .cmd shim.
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
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  // Last resort: original bare name. spawn will throw ENOENT if PATH lookup fails.
  return cliCommand;
}

/**
 * Run Claude Code as a subprocess.
 *
 * @param {object}   opts
 * @param {string}   opts.cliCommand        path/name of the claude CLI
 * @param {string}   opts.systemPromptPath  path to system prompt file
 * @param {string}   opts.userMessage       what the user typed
 * @param {string}   [opts.contextPrefix]   optional vault context prepended
 * @param {function} [opts.onChunk]         called with each stdout chunk (string)
 * @returns {Promise<{full: string, exitCode: number}>}
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
  const inputText = [contextPrefix, userMessage].filter(Boolean).join('\n\n');

  const args = ['-p'];
  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt);
  }
  args.push(inputText);

  const cmdToUse = resolveCommand(cliCommand);

  return new Promise((resolve, reject) => {
    const child = spawn(cmdToUse, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
          `Or set claude.cliCommand in config.js to the full path of claude.cmd.`
        ));
      }
      reject(err);
    });

    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error(`claude exited ${exitCode}: ${stderr.trim() || '(no stderr)'}`));
      }
      resolve({ full, exitCode });
    });
  });
}

module.exports = { callClaude, resolveCommand };
