// WebSocket management
let socket = null;
let currentAgentMessageElement = null;
let isStreaming = false;

const chatMessages = document.getElementById('chat-messages');
const inputForm = document.getElementById('input-form');
const userInput = document.getElementById('user-input');
const connectionStatus = document.getElementById('connection-status');
const promptHelper = document.getElementById('prompt-helper');
const promptHelperText = document.getElementById('prompt-helper-text');
const btnApprove = document.getElementById('btn-approve');
const btnDeny = document.getElementById('btn-deny');

// Connect to WebSocket server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // HA Ingress serves the addon under a subpath (/api/hassio_ingress/TOKEN/)
  // We must ensure the WebSocket goes through this token path
  const path = window.location.pathname.replace(/\/$/, '');
  const wsUrl = `${protocol}//${window.location.host}${path}/ws`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('[WebSocket] Connected');
    setConnectionState(true);
    addSystemMessage('🔌 Verbindung zur Antigravity CLI hergestellt.');
  };

  socket.onclose = () => {
    console.log('[WebSocket] Disconnected. Reconnecting in 3s...');
    setConnectionState(false);
    addSystemMessage('❌ Verbindung getrennt. Reconnect wird versucht...');
    promptHelper.classList.add('hidden');
    setTimeout(connect, 3000);
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
      } else if (message.type === 'error') {
        renderScreenCapture(message.clean, false);
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing server message:', err);
    }
  };
}

// Update connection badge UI
function setConnectionState(connected) {
  if (connected) {
    connectionStatus.className = 'status-indicator connected';
    connectionStatus.querySelector('.status-label').innerText = 'Verbunden';
  } else {
    connectionStatus.className = 'status-indicator disconnected';
    connectionStatus.querySelector('.status-label').innerText = 'Getrennt';
  }
}

// Simple markdown formatter
function formatMarkdown(text) {
  let html = text;

  // Escape HTML characters to prevent XSS (except links/codes we generate)
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

  // Convert URLs to links (Linkify)
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  html = html.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');

  return html;
}

// Parse the full tmux terminal screen capture into separate chat bubbles without flickering
function renderScreenCapture(text, isPrompt) {
  if (!text || text.trim() === '') return;

  const lines = text.split('\n');
  let currentBubbleType = null; // 'user' or 'agent'
  let currentBubbleText = [];
  const parsedBubbles = [];

  const addParsedBubble = (type, linesArray) => {
    if (linesArray.length === 0) return;
    const cleanBubbleText = linesArray.join('\n').trim();
    if (cleanBubbleText === '') return;
    parsedBubbles.push({ type, text: cleanBubbleText });
  };

  // Helper patterns to identify user inputs in terminal
  const userPromptRegex = /^(\s*agy\s*>|>\s*|\$\s*|root@.*:~#\s*)/;

  // Filter rules to remove terminal decorations, status bars, and banners
  const isBannedLine = (line) => {
    const trimmed = line.trim();
    if (trimmed === '') return true;
    
    // ASCII Logo / Banner lines
    if (trimmed.includes('▄') || trimmed.includes('▀') || trimmed.includes('█')) return true;
    if (trimmed.includes('Antigravity CLI') || trimmed.includes('@google') || trimmed.includes('/config')) return true;
    
    // Divider lines (long sequences of horizontal lines)
    if (/^[─\-_=]{3,}$/.test(trimmed)) return true;
    if (trimmed.startsWith('────')) return true;

    // TUI status bar / shortcut hints
    if (trimmed.includes('? for shortcuts') || trimmed.includes('Gemini 3.5')) return true;
    if (trimmed.includes('ctrl+o to expand')) return true;

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip overhead lines
    if (isBannedLine(line)) {
      continue;
    }

    const isUserLine = userPromptRegex.test(line);

    if (isUserLine) {
      // Flush previous agent bubble if existed
      if (currentBubbleType === 'agent') {
        addParsedBubble('agent', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'user';
      // Strip the command prompt prefix from rendering
      const cleanCmd = line.replace(userPromptRegex, '').trim();
      if (cleanCmd !== '') {
        currentBubbleText.push(cleanCmd);
      }
    } else {
      // Flush previous user bubble if existed
      if (currentBubbleType === 'user') {
        addParsedBubble('user', currentBubbleText);
        currentBubbleText = [];
      }
      currentBubbleType = 'agent';
      
      // Clean up tool call bullet points (e.g. "● ListDir(...)") to make them look nice
      let processedLine = line;
      if (processedLine.trim().startsWith('●')) {
        processedLine = processedLine.replace('●', '⚙️ Werkzeug-Aufruf:');
      }
      
      currentBubbleText.push(processedLine);
    }
  }

  // Flush remaining bubble
  if (currentBubbleType && currentBubbleText.length > 0) {
    addParsedBubble(currentBubbleType, currentBubbleText);
  }

  // DOM Patching Engine (Flicker-Free)
  // Retrieve existing messages (excluding the permanent system welcome message at index 0)
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

        // Type Sync
        if (!existingBubble.classList.contains(newBubble.type)) {
          existingBubble.className = `message ${newBubble.type}`;
        }

        // Content Sync (patch only if changed)
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

  // Render the prompt choices buttons overlay
  if (isPrompt) {
    // Find the last line to show as prompt context
    const nonBlankLines = lines.filter(l => l.trim() !== '');
    const lastLine = nonBlankLines[nonBlankLines.length - 1] || 'Aktion bestätigen:';
    showPromptHelper(lastLine);
  } else {
    promptHelper.classList.add('hidden');
  }

  // Auto scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append a system notification
function addSystemMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'message system';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  msg.appendChild(content);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show the quick y/N confirmation panel
function showPromptHelper(promptText) {
  // Strip trailing prompts if clean
  const cleanPrompt = promptText.replace(/\[y\/N\]/gi, '').trim();
  promptHelperText.innerText = cleanPrompt || 'Aktion bestätigen:';
  promptHelper.classList.remove('hidden');
}

// Send user input to server
function sendInput(text) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    addSystemMessage('⚠️ Senden fehlgeschlagen: Keine Serververbindung.');
    return;
  }

  // Create user bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerText = text;
  userMsg.appendChild(content);
  chatMessages.appendChild(userMsg);
  
  // Reset streaming state so next output creates a new bubble
  isStreaming = false;
  currentAgentMessageElement = null;

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Send payload
  socket.send(JSON.stringify({
    type: 'input',
    data: text
  }));
}

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

// Hook prompt helper buttons
btnApprove.addEventListener('click', () => {
  sendInput('y');
  promptHelper.classList.add('hidden');
});

btnDeny.addEventListener('click', () => {
  sendInput('n');
  promptHelper.classList.add('hidden');
});

// View Toggle Logic (Chat vs. Raw Terminal)
const toggleViewBtn = document.getElementById('toggle-view');
const chatContainer = document.getElementById('chat-container');
const terminalFrame = document.getElementById('terminal-frame');

toggleViewBtn.addEventListener('click', () => {
  const isTerminalHidden = terminalFrame.classList.contains('hidden');

  if (isTerminalHidden) {
    // Show Terminal
    // Ingress URL format is relative: "terminal/" (redirects to proxied ttyd port)
    // We add a timestamp to force fresh loading and prevent old cache loops
    const base = window.location.pathname.replace(/\/$/, '');
    terminalFrame.src = `${base}/terminal/`;
    
    terminalFrame.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    toggleViewBtn.innerText = 'Chat anzeigen';
    toggleViewBtn.classList.add('active');
  } else {
    // Show Chat Console
    terminalFrame.classList.add('hidden');
    terminalFrame.src = ''; // Unload iframe to save memory/cpu
    chatContainer.classList.remove('hidden');
    toggleViewBtn.innerText = 'Terminal anzeigen';
    toggleViewBtn.classList.remove('active');
  }
});

// Start connection
connect();
