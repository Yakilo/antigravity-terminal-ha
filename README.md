# Antigravity Console — Home Assistant Addon

![Antigravity Console](https://img.shields.io/badge/Antigravity-Console-6366f1?style=for-the-badge&logo=google&logoColor=white)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-OS-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white)
![Architecture](https://img.shields.io/badge/arch-aarch64%20%7C%20amd64-green?style=for-the-badge)
![Version](https://img.shields.io/badge/version-2.1.5-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)

[![Open your Home Assistant instance and show the add add-on repository dialog](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FYakilo%2Fantigravity-terminal-ha)

A **Web Console** interface for Google DeepMind's **Antigravity CLI (agy)** — running as a Home Assistant addon directly in your sidebar. Chat with a powerful AI agent that can read and modify your Home Assistant configuration, automate tasks, and much more.

---

## ✨ Features

- 💬 **Web Chat GUI** — Modern chat-style interface that parses CLI output into clean conversation bubbles with markdown rendering
- 🖥️ **Raw Terminal Toggle** — Switch to a full ttyd terminal with one click for direct CLI access
- 💾 **Session Persistence** — Tmux-backed sessions survive browser refreshes and addon restarts
- 🔄 **Auto-Updates** — The Antigravity CLI is installed at build time via the official install script
- ⚡ **Prompt Helper Buttons** — Inline "Yes / No" quick-action buttons appear automatically for CLI confirmation prompts
- 🎯 **DOM Patching Engine** — Flicker-free chat rendering that diffs existing bubbles instead of re-rendering
- 📌 **Version Display** — Current addon version shown in the header badge
- 🔌 **WebSocket Streaming** — Real-time tmux screen capture streamed to the browser every 500ms
- 🏠 **HA Integration** — Full access to the Home Assistant API and Supervisor API for MCP tool calls
- 📂 **Config Access** — Read/write access to your `/config` directory for direct file operations
- 🛡️ **Secure** — Runs in an isolated Docker container with AppArmor, no host network access
- 🧰 **Pre-installed Tools** — `git`, `gh`, `python3`, `nano`, `vim`, `tree`

---

## 📦 Installation

### Via Home Assistant Add-on Store (Custom Repository)

1. In Home Assistant, go to **Settings → Add-ons**
2. Click **"Add-on Store"** (bottom-right button)
3. Click the **⋮** menu (top-right) → **"Repositories"**
4. Add the following URL and confirm:
   ```
   https://github.com/Yakilo/antigravity-terminal-ha
   ```
5. Reload the store → **Antigravity Console** will appear in the list
6. Click **Install**, then go to the **Configuration** tab to enter your API key
7. **Start** the addon and optionally enable **"Show in sidebar"**

> **Tip:** You can also click the blue badge at the top of this README to add the repository automatically.

---

## ⚙️ Configuration

Configure the addon via the **Configuration** tab in the Home Assistant addon panel.

| Option | Type | Required | Description |
|---|---|---|---|
| `google_api_key` | `string` | **Yes** | Your Google AI / Gemini API key. Get one at [Google AI Studio](https://aistudio.google.com/apikey). |
| `persistent_apt_packages` | `list` | No | Additional system packages to install on startup via `apt-get`. Example: `["ffmpeg", "imagemagick"]` |
| `persistent_pip_packages` | `list` | No | Python pip packages to install on startup. Example: `["requests", "pyyaml"]` |

> **Note:** As of v2.1.5, the config key has been renamed from `persistent_apk_packages` to `persistent_apt_packages`. The old key is still supported for backward compatibility.

### Example Configuration

```yaml
google_api_key: "AIza..."
persistent_apt_packages:
  - ffmpeg
  - imagemagick
persistent_pip_packages:
  - requests
```

---

## 🏗️ Architecture

```
Browser (Home Assistant Frontend)
│
└── HA Ingress (port 8099)
      │
      └── Node.js Server (Express + WebSocket)
            │
            ├── WebSocket /ws ──── tmux capture-pane ──── Chat GUI
            │                       (polls every 500ms)
            │
            ├── Proxy /terminal/* ──── ttyd (port 8098) ──── Raw Terminal
            │
            └── tmux session "agy"
                  │
                  └── Antigravity CLI (agy)
                        ├── Google AI API
                        ├── HA Supervisor API
                        └── /config (r/w)
```

### Component Overview

| Component | Role |
|---|---|
| **Express** (`server.js`) | HTTP server, static file serving, ttyd proxy |
| **WebSocket** (`ws`) | Real-time bridge between browser and tmux screen capture |
| **ttyd** | Web-based terminal emulator, localhost:8098 |
| **tmux** | Session persistence manager |
| **agy** | Google DeepMind's Antigravity CLI agent |
| **Background syncer** | Backs up `/root` to `/data/agy/root_dir` every 60s |

### Ports

| Port | Scope | Purpose |
|---|---|---|
| `8099` | Ingress (exposed) | Web Console — Express + WebSocket |
| `8098` | localhost (internal) | ttyd raw terminal — proxied via Express |

---

## 🚀 Usage

### Web Chat Console (Default)

1. Open **Antigravity** from the Home Assistant sidebar
2. Type a message and press **Enter** to chat with the AI agent
3. Use **Shift + Enter** for multi-line input
4. Confirmation prompts (`[y/N]`) show interactive buttons automatically

### Raw Terminal

Click **"Show Terminal"** in the header to switch to the full terminal view. Click **"Show Chat"** to return.

### Session Persistence

- Your conversation runs in a tmux session — it survives browser refreshes
- The `/root` directory is backed up every 60 seconds and restored on restart
- All browser tabs share the same agy session

---

## 🔧 Troubleshooting

### Addon won't start
- Check the **Log** tab for error messages
- Verify that `google_api_key` is set and valid
- Try restarting the addon

### "Disconnected" indicator
- The WebSocket auto-reconnects every 3 seconds — wait a moment after startup
- Check addon logs for Node.js server errors
- Ensure your browser supports WebSocket connections through HA Ingress

### API key issues
- Verify your key at [Google AI Studio](https://aistudio.google.com/apikey)
- The key is exported as both `GOOGLE_API_KEY` and `GEMINI_API_KEY`
- **Restart the addon** after changing the key

### Packages not installing
- Packages are installed via `apt-get` (Debian), not `apk` (Alpine)
- Check addon logs for "Failed to install" warnings
- Ensure package names are valid for Debian

### Blank screen
- Hard refresh with **Ctrl + Shift + R**
- Switch to Raw Terminal to check if agy is running
- Restart the addon if the tmux session crashed

---

## 🙏 Credits

Inspired by [oded996/gemini-cli-home-assistant-addons](https://github.com/oded996/gemini-cli-home-assistant-addons).

Built with:
- [Antigravity CLI](https://antigravity.google/cli/) by Google DeepMind
- [ttyd](https://github.com/tsl0922/ttyd) — Web-based terminal
- [Express](https://expressjs.com/) + [ws](https://github.com/websockets/ws) — Node.js server
- [Home Assistant](https://www.home-assistant.io/) — The open-source home automation platform

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.
