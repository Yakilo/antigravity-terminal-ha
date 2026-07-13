// ─── WebSocket Management ──────────────────────────────────────────────────
let socket = null;
let reconnectDelay = 1000; // Start at 1s, exponential backoff
const MAX_RECONNECT_DELAY = 30000; // Cap at 30s

const chatMessages = document.getElementById('chat-messages');
const inputForm = document.getElementById('input-form');
const userInput = document.getElementById('user-input');
const connectionStatus = document.getElementById('connection-status');
const promptHelper = document.getElementById('prompt-helper');
const promptHelperText = document.getElementById('prompt-helper-text');
const btnApprove = document.getElementById('btn-approve');
const btnDeny = document.getElementById('btn-deny');

// ─── WebSocket Connection with Exponential Backoff ─────────────────────────

function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // HA Ingress serves the addon under a subpath (/api/hassio_ingress/TOKEN/)
  const path = window.location.pathname.replace(/\/$/, '');
  const wsUrl = `${protocol}//${window.location.host}${path}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WebSocket] Connected');
    reconnectDelay = 1000; // Reset backoff on successful connection
    setConnectionState(true);
    addSystemMessage('🔌 Connected to Antigravity CLI.');
  };

  socket.onclose = () => {
    console.log(`[WebSocket] Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
    setConnectionState(false);
    addSystemMessage(`❌ Connection lost. Retrying in ${Math.round(reconnectDelay / 1000)}s...`);
    promptHelper.classList.add('hidden');
    setTimeout(connect, reconnectDelay);
    // Exponential backoff with jitter
    reconnectDelay = Math.min(reconnectDelay * 1.5 + Math.random() * 500, MAX_RECONNECT_DELAY);
  };

  socket.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
    setConnectionState(false);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'output') {
        renderScreenCapture(message.clean, message.isPrompt);
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing server message:', err);
    }
  };
}

// ─── Connection Status UI ──────────────────────────────────────────────────

function setConnectionState(connected) {
  if (connected) {
    connectionStatus.className = 'status-indicator connected';
    connectionStatus.querySelector('.status-label').innerText = 'Connected';
  } else {
    connectionStatus.className = 'status-indicator disconnected';
    connectionStatus.querySelector('.status-label').innerText = 'Disconnected';
  }
}

// ─── Markdown Formatter ────────────────────────────────────────────────────

function formatMarkdown(text) {
  let html = text;

  // Escape HTML characters to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```code```
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold text: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Bullet lists: - item or * item
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Convert URLs to links (after HTML escaping, so we work with escaped entities)
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  html = html.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  return html;
}

// ─── Screen Capture Parser ─────────────────────────────────────────────────
// Parses the raw tmux screen capture into chat bubbles

function renderScreenCapture(text, isPrompt) {
  if (!text || text.trim() === '') return;

  const lines = text.split('\n');
  let currentBubbleType = null;
  let currentBubbleText = [];
  const parsedBubbles = [];

  const addParsedBubble = (type, linesArray) => {
    if (linesArray.length === 0) return;
    const cleanBubbleText = linesArray.join('\n').trim();
    if (cleanBubbleText === '') return;
    parsedBubbles.push({ type, text: cleanBubbleText });
  };

  // Patterns to identify user input lines in terminal output
  const userPromptRegex = /^(\s*agy\s*>|>\s*|\$\s*|root@.*:~#\s*)/;

  // Filter rules to remove terminal decorations, status bars, and banners
  const isBannedLine = (line) => {
    const trimmed = line.trim();
    if (trimmed === '') return true;
    
    // ASCII logo/banner characters
    if (/[▄▀█]/.test(trimmed)) return true;

    // Antigravity banner lines (version-independent)
    if (/Antigravity\s+CLI/i.test(trimmed)) return true;
    if (/@google/i.test(trimmed)) return true;
    
    // Path-only lines like "/config"
    if (/^\/\w+$/.test(trimmed)) return true;
    
    // Divider lines
    if (/^[─\-_=]{3,}$/.test(trimmed)) return true;
    if (trimmed.startsWith('────')) return true;

    // TUI status bar / shortcut hints (version-independent patterns)
    if (/\?\s*for shortcuts/i.test(trimmed)) return true;
    if (/Gemini\s+\d/i.test(trimmed)) return true;
    if (/ctrl\+[a-z]\s+to\s+/i.test(trimmed)) return true;

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isBannedLine(line)) continue;

    // Identify user lines, but exclude interactive menu items like '> 1. Yes'
    const isUserLine = userPromptRegex.test(line) && !/^\s*>\s*\d+\./.test(line);

    if (isUserLine) {
      if (currentBubbleType === 'agent') {
        addParsedBubble('agent', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'user';
      const cleanCmd = line.replace(userPromptRegex, '').trim();
      if (cleanCmd !== '') {
        currentBubbleText.push(cleanCmd);
      }
    } else {
      if (currentBubbleType === 'user') {
        addParsedBubble('user', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'agent';
      
      // Clean up tool call bullet points
      let processedLine = line;
      if (processedLine.trim().startsWith('●')) {
        processedLine = processedLine.replace('●', '⚙️ Tool call:');
      }
      
      currentBubbleText.push(processedLine);
    }
  }

  // Flush remaining
  if (currentBubbleType && currentBubbleText.length > 0) {
    addParsedBubble(currentBubbleType, currentBubbleText);
  }

  // ─── DOM Patching Engine (Flicker-Free) ──────────────────────────────────
  const existingBubbles = Array.from(chatMessages.querySelectorAll('.message:not(.system)'));
  const totalNew = parsedBubbles.length;
  const totalExisting = existingBubbles.length;

  for (let i = 0; i < Math.max(totalNew, totalExisting); i++) {
    if (i < totalNew) {
      const newBubble = parsedBubbles[i];
      const newHtml = newBubble.type === 'user' ? newBubble.text : formatMarkdown(newBubble.text);

      if (i < totalExisting) {
        // Update existing bubble if it changed
        const existingBubble = existingBubbles[i];
        const contentDiv = existingBubble.querySelector('.message-content');
        const oldRaw = contentDiv.getAttribute('data-raw');

        if (!existingBubble.classList.contains(newBubble.type)) {
          existingBubble.className = `message ${newBubble.type}`;
        }

        if (oldRaw !== newBubble.text) {
          contentDiv.setAttribute('data-raw', newBubble.text);
          if (newBubble.type === 'user') {
            contentDiv.innerText = newHtml;
          } else {
            contentDiv.innerHTML = newHtml;
          }
        }
      } else {
        // Append new bubble
        const bubble = document.createElement('div');
        bubble.className = `message ${newBubble.type}`;
        const content = document.createElement('div');
        content.className = 'message-content';
        content.setAttribute('data-raw', newBubble.text);
        if (newBubble.type === 'user') {
          content.innerText = newBubble.text;
        } else {
          content.innerHTML = newHtml;
        }
        bubble.appendChild(content);
        chatMessages.appendChild(bubble);
      }
    } else {
      // Remove excess bubbles
      existingBubbles[i].remove();
    }
  }

  // Prompt helper overlay
  if (isPrompt) {
    const nonBlankLines = lines.filter(l => l.trim() !== '');
    const lastLine = nonBlankLines[nonBlankLines.length - 1] || 'Confirm action:';
    showPromptHelper(lastLine);
  } else {
    promptHelper.classList.add('hidden');
  }

  // Auto scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── System Messages ───────────────────────────────────────────────────────

function addSystemMessage(text) {
  // Limit system messages to prevent DOM bloat during long sessions
  const systemMessages = chatMessages.querySelectorAll('.message.system');
  if (systemMessages.length > 10) {
    // Keep the first (welcome) and remove oldest non-welcome ones
    for (let i = 1; i < systemMessages.length - 5; i++) {
      systemMessages[i].remove();
    }
  }

  const msg = document.createElement('div');
  msg.className = 'message system';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  msg.appendChild(content);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Prompt Helper ─────────────────────────────────────────────────────────

function showPromptHelper(promptText) {
  const cleanPrompt = promptText.replace(/\[y\/N\]/gi, '').trim();
  promptHelperText.innerText = cleanPrompt || 'Confirm action:';
  promptHelper.classList.remove('hidden');
}

// ─── Send Input ────────────────────────────────────────────────────────────

function sendInput(text) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    addSystemMessage('⚠️ Cannot send: No server connection.');
    return;
  }

  // Create user bubble immediately for responsive feel
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  userMsg.appendChild(content);
  chatMessages.appendChild(userMsg);

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Send payload to server
  socket.send(JSON.stringify({
    type: 'input',
    data: text
  }));
}

// ─── Input Handling ────────────────────────────────────────────────────────

// Auto-adjust height of textarea while typing
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = (userInput.scrollHeight - 4) + 'px';
});

// Handle form submission (Enter or Send Button)
inputForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (text === '') return;

  sendInput(text);

  userInput.value = '';
  userInput.style.height = 'auto';
});

// Submit on Enter key (without Shift)
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    inputForm.requestSubmit();
  }
});

// Prompt helper button handlers
btnApprove.addEventListener('click', () => {
  sendInput('y');
  promptHelper.classList.add('hidden');
});

btnDeny.addEventListener('click', () => {
  sendInput('n');
  promptHelper.classList.add('hidden');
});

// ─── View Toggle (Chat ↔ Raw Terminal) ─────────────────────────────────────

const toggleViewBtn = document.getElementById('toggle-view');
const chatContainer = document.getElementById('chat-container');
const terminalFrame = document.getElementById('terminal-frame');

toggleViewBtn.addEventListener('click', () => {
  const isTerminalHidden = terminalFrame.classList.contains('hidden');

  if (isTerminalHidden) {
    const base = window.location.pathname.replace(/\/$/, '');
    terminalFrame.src = `${base}/terminal/`;
    
    terminalFrame.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    toggleViewBtn.innerText = 'Show Chat';
    toggleViewBtn.classList.add('active');
  } else {
    terminalFrame.classList.add('hidden');
    terminalFrame.src = ''; // Unload iframe to save resources
    chatContainer.classList.remove('hidden');
    toggleViewBtn.innerText = 'Show Terminal';
    toggleViewBtn.classList.remove('active');
  }
});

// ─── Version Display ───────────────────────────────────────────────────────

async function fetchVersion() {
  try {
    const response = await fetch('./api/version');
    const data = await response.json();
    if (data.version) {
      document.getElementById('app-version').innerText = `v${data.version}`;
    }
  } catch (err) {
    console.error('[Frontend] Failed to fetch version:', err);
  }
}

// ─── Initialize ────────────────────────────────────────────────────────────

fetchVersion();
connect();
