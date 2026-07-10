# Antigravity Terminal - Home Assistant Addon

![Antigravity Terminal](https://img.shields.io/badge/Antigravity-Terminal-6366f1?style=for-the-badge&logo=google&logoColor=white)
![HA OS](https://img.shields.io/badge/Home%20Assistant-OS-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white)
![Architecture](https://img.shields.io/badge/arch-aarch64%20%7C%20amd64-green?style=for-the-badge)

A **Home Assistant Addon** that provides a web-based terminal running Google DeepMind's **Antigravity CLI**, deeply integrated with your Home Assistant instance via MCP.

Inspired by [oded996/gemini-cli-home-assistant-addons](https://github.com/oded996/gemini-cli-home-assistant-addons).

---

## ✨ Features

- 🚀 **Antigravity CLI** running directly inside Home Assistant
- 🏠 **Full HA MCP Integration** - Antigravity can control your smart home natively
- 🖥️ **Web Terminal** via [ttyd](https://github.com/tsl0922/ttyd) - accessible directly in the HA sidebar
- 💾 **Session Persistence** via tmux - reconnect to your running session
- 🎨 **Customizable** - theme, font size, cursor style
- 🔐 **Secure** - runs in an isolated Docker container with HA AppArmor

---

## 🛠️ Installation

### Via HACS Custom Repository

1. Open **HACS** in your Home Assistant
2. Go to **Integrations** → **Custom Repositories**
3. Add the repository URL of this addon
4. Install **Antigravity Terminal** from the addon store

### Manual Installation

1. Copy the `antigravity-terminal` folder to `/config/addons/antigravity-terminal/` on your HA instance
2. Reload the addon store in **Settings → Addons → Addon Store → ⋮ → Reload**
3. Find **Antigravity Terminal** in the **Local addons** section and install it

---

## ⚙️ Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `google_api_key` | `string` | `""` | Your Google AI / Gemini API key ([get one here](https://aistudio.google.com/app/apikey)) |
| `enable_ha_mcp` | `bool` | `true` | Enable Home Assistant MCP Server integration |
| `ha_mcp_url` | `string` | `""` | Custom MCP Server URL (leave empty for auto-detection) |
| `terminal_theme` | `string` | `"breeze"` | Terminal color theme |
| `font_size` | `int` | `14` | Terminal font size in pixels |
| `cursor_style` | `select` | `"block"` | Cursor style: `block`, `underline`, or `bar` |
| `cursor_blink` | `bool` | `false` | Enable cursor blinking |
| `persistent_apk_packages` | `list` | `[]` | Extra APT packages to install |
| `persistent_pip_packages` | `list` | `[]` | Extra Python pip packages to install |

### Example Configuration

```yaml
google_api_key: "AIza..."
enable_ha_mcp: true
ha_mcp_url: ""
terminal_theme: breeze
font_size: 14
cursor_style: block
cursor_blink: false
persistent_apk_packages: []
persistent_pip_packages: []
```

---

## 🔌 MCP Integration

This addon automatically connects Antigravity CLI to your Home Assistant via the **HA MCP Server** addon. 

**Prerequisites:** You need the [Home Assistant MCP Server](https://github.com/home-assistant/addons/tree/master/mcp_server) addon installed.

Once connected, you can ask Antigravity things like:
- *"Turn off all lights in the living room"*
- *"What's the current temperature in the bedroom?"*
- *"Create an automation that turns on the garden lights at sunset"*
- *"Show me which devices are currently unavailable"*

---

## 📋 Requirements

- Home Assistant OS or Supervised
- [Home Assistant MCP Server Addon](https://my.home-assistant.io/redirect/supervisor_addon/?addon=core_mcp_server) (for MCP integration)
- Google AI API Key ([free at aistudio.google.com](https://aistudio.google.com/app/apikey))

---

## 🏗️ Architecture

```
Browser
  └── HA Ingress (port 8099)
        └── ttyd (web terminal)
              └── tmux (session manager)
                    └── Antigravity CLI
                          └── MCP → Home Assistant
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.
