// lib/claude.js — wrap the Claude Code CLI as a subprocess.
//
// This uses the user's Claude Max plan login automatically via the
// installed `claude` CLI. No API key in code, no key file, no env var.
//
// We use --print mode for one-shot calls. For streaming we read stdout
// incrementally and pipe chunks to the caller via the onChunk callback.

const { spawn } = require('child_process');
const fs = require('fs');

function loadSystemPrompt(systemPromptPath) {
  if (!systemPromptPath) return null;
  try {
    return fs.readFileSync(systemPromptPath, 'utf8');
  } catch {
    return null;
  }
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

  // Compose the full input: vault context, then user message.
  const inputText = [contextPrefix, userMessage].filter(Boolean).join('\n\n');

  // Args: -p for print mode (non-interactive). System prompt via flag if provided.
  const args = ['-p'];
  if (systemPrompt) {
    args.push('--system-prompt', systemPrompt);
  }
  args.push(inputText);

  return new Promise((resolve, reject) => {
    const child = spawn(cliCommand, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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

    child.on('error', reject);

    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        return reject(new Error(`claude exited ${exitCode}: ${stderr.trim()}`));
      }
      resolve({ full, exitCode });
    });
  });
}

module.exports = { callClaude };
