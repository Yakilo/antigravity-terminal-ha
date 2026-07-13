# Antigravity Console — Documentation

## Overview

**Antigravity Console** is a Home Assistant addon that provides a web-based interface for Google DeepMind's **Antigravity CLI (agy)** — an AI-powered coding and automation agent. It runs directly in your Home Assistant sidebar, giving you access to a powerful AI assistant that can read and modify your HA configuration, automate tasks, and answer questions.

The addon offers two interface modes:

- **Web Chat Console** (default) — A modern chat-style GUI that parses the CLI output into readable conversation bubbles with markdown formatting.
- **Raw Terminal** — A full ttyd-based terminal for direct CLI interaction, accessible via the "Show Terminal" toggle button.

---

## Configuration

After installing the addon, go to the **Configuration** tab to set up the required options.

### Google API Key (required)

| Option | Description |
|---|---|
| `google_api_key` | Your Google AI / Gemini API key. Required for the Antigravity CLI to communicate with Google's AI models. |

**How to get an API key:**

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API key"**
3. Copy the key and paste it into the addon configuration
4. Restart the addon

### Extra Packages (optional)

| Option | Description |
|---|---|
| `persistent_apt_packages` | List of additional system packages (Debian `apt`) to install on every startup. Example: `["ffmpeg", "imagemagick"]` |
| `persistent_pip_packages` | List of Python pip packages to install on every startup. Example: `["requests", "pyyaml"]` |

> **Note:** The configuration key was renamed to `persistent_apt_packages` in v2.1.4 to match the underlying Debian OS. The legacy key `persistent_apk_packages` remains supported for backward compatibility.

---

## Usage

### Web Chat Console

The Web Chat Console is the default view when you open the addon. It works like a messaging interface:

1. **Type your message** in the input field at the bottom
2. **Press Enter** (or click the send button) to send it to the AI agent
3. **Agent responses** appear as chat bubbles on the left side
4. **Your messages** appear as chat bubbles on the right side

**Tips:**

- Use **Shift + Enter** to insert a new line without sending
- The console automatically detects when the CLI asks for confirmation (e.g. `[y/N]`) and shows quick-action buttons
- The connection indicator in the top-right shows whether the WebSocket connection to the backend is active
- The version badge in the header shows the current addon version

### Raw Terminal

Click the **"Show Terminal"** button in the header to switch to the raw terminal view. This gives you a full terminal emulator (ttyd) connected to the same tmux session as the chat console.

Use the raw terminal when you need:
- Direct keyboard shortcuts
- Full terminal capabilities (scrollback, copy/paste)
- To run shell commands alongside agy

Click **"Show Chat"** to return to the Web Console.

### Session Persistence

Your agy session runs inside a **tmux** session. This means:

- **Browser refresh** — Your conversation continues where you left off
- **Addon restart** — Your home directory (`/root`) is persisted, including CLI config, history, and installed tools
- **Multiple tabs** — All browser tabs connect to the same agy session

### Working Directory

The addon starts in `/config`, which maps to your Home Assistant configuration directory. The AI agent can read and modify your HA configuration files directly.

---

## Troubleshooting

### Addon won't start

1. **Check the logs** — Go to the addon's **Log** tab for error messages
2. **Verify API key** — Make sure `google_api_key` is set and valid
3. **Restart the addon** — Sometimes a simple restart resolves initialization issues

### "Disconnected" status / WebSocket won't connect

- The Web Console auto-reconnects every 3 seconds. Wait a moment after starting the addon.
- If persistently disconnected, check the addon logs for Node.js server errors.
- Ensure your browser supports WebSocket connections through HA Ingress.

### API key errors / "agy not responding"

- Verify your API key at [Google AI Studio](https://aistudio.google.com/apikey)
- The key is exported as both `GOOGLE_API_KEY` and `GEMINI_API_KEY`
- After changing the key, **restart** the addon for the change to take effect

### Packages not installing

- Packages listed in `persistent_apt_packages` (or the legacy `persistent_apk_packages`) are installed via `apt-get`, not `apk`
- Check the addon log for "Failed to install" warnings
- Ensure the package name is valid for Debian (not Alpine)

### Blank screen or chat not updating

- Try a hard refresh (**Ctrl + Shift + R**)
- Check that the agy tmux session is running (switch to Raw Terminal to verify)
- If the tmux session crashed, restart the addon

### Multiple agy instances

The addon uses tmux session locking to prevent this. If you see duplicate instances, restart the addon to clean up stale sessions.

---

## Architecture

```
Browser (Home Assistant Frontend)
  │
  └── HA Ingress (proxied to port 8099)
        │
        ├── Node.js Server (Express + WebSocket)
        │     │
        │     ├── GET /api/version → Returns addon version
        │     │
        │     ├── WebSocket /ws → Chat Console
        │     │     └── tmux capture-pane -t agy -p (polls every 250ms)
        │     │           └── Parses terminal output into chat bubbles
        │     │
        │     ├── Proxy /terminal/* → ttyd (port 8098)
        │     │     └── WebSocket upgrade for raw terminal
        │     │
        │     └── Static files → public/ (index.html, index.css, index.js)
        │
        └── ttyd (port 8098, localhost only)
              └── tmux session "agy"
                    └── Antigravity CLI (agy)
                          ├── GOOGLE_API_KEY (from addon config)
                          ├── HASS_HOST=http://supervisor/core
                          └── /config (HA config directory, r/w)
```

### Key Components

| Component | Purpose |
|---|---|
| **Express** (`server.js`) | HTTP server serving the Web GUI and proxying ttyd |
| **WebSocket** (`ws`) | Real-time communication between browser and tmux screen capture |
| **ttyd** | Web-based terminal emulator, bound to localhost:8098 |
| **tmux** | Session manager ensuring persistence across reconnects |
| **agy** | Google DeepMind's Antigravity CLI agent |
| **Background syncer** | Periodically backs up `/root` to `/data/agy/root_dir` |
| **hab** | Home Assistant Build CLI for reading addon configuration |

### Ports

| Port | Binding | Purpose |
|---|---|---|
| 8099 | 0.0.0.0 (Ingress) | Web Console (Express + WebSocket) |
| 8098 | 127.0.0.1 (internal) | ttyd raw terminal (proxied, not directly exposed) |
