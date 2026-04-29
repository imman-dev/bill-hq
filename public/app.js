// Bill HQ frontend — fetches vault state, listens for live updates, runs chat.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---- Clock ----
function tickClock() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('#clock').textContent =
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
setInterval(tickClock, 1000);
tickClock();

// ---- Markdown rendering ----
marked.setOptions({ breaks: true, gfm: true });
function renderMarkdown(target, md) {
  target.innerHTML = md ? marked.parse(md) : '<p class="muted">empty</p>';
}

// ---- Fetch and render state ----
async function loadState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`state ${res.status}`);
    const data = await res.json();

    if (data.agencyState) {
      renderMarkdown($('#state-content'), data.agencyState);
    }
    if (data.taskQueue) {
      renderMarkdown($('#tasks-content'), data.taskQueue);
    }

    // Brief panel: latest scout report if available, else latest agent report.
    const briefSource =
      (data.scoutReports && data.scoutReports[0]) ||
      (data.recentReports && data.recentReports[0]) ||
      null;
    if (briefSource) {
      $('#brief-content').innerHTML =
        `<div class="muted small">latest from <code>${briefSource.path}</code></div>` +
        marked.parse(briefSource.content);
    }

    // Agent grid
    renderAgents(data.agents || []);
  } catch (err) {
    console.error('loadState failed', err);
    setConnection('error');
  }
}

function renderAgents(agents) {
  const grid = $('#agent-grid');
  grid.innerHTML = '';
  if (!agents.length) {
    grid.innerHTML = '<p class="muted small">no agents configured</p>';
    return;
  }
  for (const a of agents) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.agent = a.name;
    card.innerHTML = `
      <div class="agent-name">${a.name}</div>
      <div class="agent-engine">${a.engine}${a.model ? ' · ' + a.model : ''}</div>
      <div class="agent-label">${a.label || ''}</div>
      <div class="agent-status">schedule: ${a.schedule}</div>
    `;
    card.addEventListener('click', () => runAgent(a.name, card));
    grid.appendChild(card);
  }
  $('#agents-meta').textContent = `${agents.length} configured · click to dispatch`;
}

async function runAgent(name, card) {
  card.classList.remove('success', 'error');
  card.classList.add('running');
  card.querySelector('.agent-status').textContent = 'running...';
  try {
    const res = await fetch(`/api/agents/${name}/run`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      card.classList.remove('running');
      card.classList.add('success');
      card.querySelector('.agent-status').textContent = 'completed';
      pushActivity('agent', `${name} ran successfully`);
    } else {
      throw new Error(data.error || 'agent failed');
    }
  } catch (err) {
    card.classList.remove('running');
    card.classList.add('error');
    card.querySelector('.agent-status').textContent = err.message.slice(0, 40);
    pushActivity('error', `${name}: ${err.message.slice(0, 80)}`);
  }
}

// ---- Live updates via SSE ----
let eventSource;
function setConnection(state) {
  const dot = $('#connection-dot');
  dot.classList.remove('dot-pending', 'dot-live', 'dot-error');
  dot.classList.add('dot-' + state);
}

function startSSE() {
  eventSource = new EventSource('/api/events');
  eventSource.onopen = () => setConnection('live');
  eventSource.onerror = () => setConnection('error');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'connected') return;
      pushActivity(data.event, data.path || '');
      // Reload state on relevant changes.
      if (data.path && (
        data.path.startsWith('00-Agency-Core/') ||
        data.path.startsWith('05-Daily-Operations/') ||
        data.path.startsWith('04-Knowledge-Base/Market-Research/')
      )) {
        loadState();
      }
    } catch {}
  };
}

function pushActivity(event, label) {
  const list = $('#activity-list');
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `
    <span class="timestamp">${time}</span>
    <span class="event">${event}</span>
    <span>${label}</span>
  `;
  list.prepend(li);
  // Cap list at 50 entries.
  while (list.children.length > 50) list.removeChild(list.lastChild);
}

// ---- Chat with Bill (Claude Code subprocess) ----
const chatForm = $('#chat-form');
const chatInput = $('#chat-input');
const chatLog = $('#chat-log');
const chatStatus = $('#chat-status');

function appendChatMsg(role, text) {
  const div = document.createElement('div');
  div.className = `chat-msg from-${role}`;
  div.innerHTML = `
    <div class="role">${role === 'bill' ? 'BILL' : role.toUpperCase()}</div>
    <div class="content"></div>
  `;
  div.querySelector('.content').textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div.querySelector('.content');
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  appendChatMsg('user', text);
  chatInput.value = '';
  chatInput.disabled = true;
  $('#chat-send').disabled = true;
  chatStatus.textContent = 'thinking...';

  const billSink = appendChatMsg('bill', '');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) throw new Error(`chat ${res.status}`);

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
        if (!line.startsWith('data:')) continue;
        try {
          const obj = JSON.parse(line.slice(5).trim());
          if (obj.chunk) {
            billSink.textContent += obj.chunk;
            chatLog.scrollTop = chatLog.scrollHeight;
          }
          if (obj.error) {
            billSink.parentElement.classList.add('error');
            billSink.textContent = obj.error;
          }
        } catch {}
      }
    }
  } catch (err) {
    billSink.parentElement.classList.add('error');
    billSink.textContent = err.message;
  } finally {
    chatInput.disabled = false;
    $('#chat-send').disabled = false;
    chatStatus.textContent = 'idle';
    chatInput.focus();
  }
});

// Cmd/Ctrl+K to focus chat
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    chatInput.focus();
  }
});

// ---- Boot ----
loadState();
startSSE();
