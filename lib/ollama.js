// lib/ollama.js — talk to a local Ollama server over HTTP.
//
// Used by batch agents (Scout, Hunter, Echo) for free local inference.
// Default endpoint http://localhost:11434 — change in config if Ollama runs elsewhere.

async function callOllama({
  baseUrl = 'http://localhost:11434',
  model,
  systemPrompt,
  userMessage,
  temperature = 0.4,
  onChunk,
} = {}) {
  if (!model) throw new Error('callOllama: model is required');

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: Boolean(onChunk),
      options: { temperature },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ollama ${res.status}: ${text}`);
  }

  if (!onChunk) {
    const data = await res.json();
    return data.message?.content ?? '';
  }

  // Streaming: Ollama emits newline-delimited JSON.
  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        const chunk = obj.message?.content ?? '';
        if (chunk) {
          full += chunk;
          onChunk(chunk);
        }
      } catch {
        // ignore malformed lines
      }
    }
  }

  return full;
}

module.exports = { callOllama };
