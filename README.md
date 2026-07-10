# Antigravity Terminal - Home Assistant Addon

![Antigravity Terminal](https://img.shields.io/badge/Antigravity-Terminal-6366f1?style=for-the-badge&logo=google&logoColor=white)
![HA OS](https://img.shields.io/badge/Home%20Assistant-OS-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white)
![Architecture](https://img.shields.io/badge/arch-aarch64%20%7C%20amd64-green?style=for-the-badge)

A **Home Assistant Addon** that provides a web-based terminal running Google DeepMind's **Antigravity CLI**, deeply integrated with your Home Assistant instance via MCP.

Inspired by [oded996/gemini-cli-home-assistant-addons](https://github.com/oded996/gemini-cli-home-assistant-addons).

---

## ✨ Features

- 🚀 **Antigravity CLI (agy)** running directly inside Home Assistant
- ⚡ **Auto-Start & Setup Skipped** - No wizard needed, starts immediately with preconfigured API keys
- 📋 **System Clipboard Integration** - Includes `xclip` and `wl-clipboard` for seamless clipboard synchronization
- 🏠 **Full HA MCP Integration** - Antigravity can control your smart home natively
- 🖥️ **Web Terminal** via [ttyd](https://github.com/tsl0922/ttyd) - accessible directly in the HA sidebar
- 💾 **Session Persistence** via tmux - reconnect to your running session
- 🎨 **Customizable** - theme, font size, cursor style
- 🔐 **Secure** - runs in an isolated Docker container with HA AppArmor

---

## 🛠️ Installation

> [!WARNING]
> **Nicht über HACS installieren!** HACS verwaltet nur Integrationen und Frontend-Cards, aber keine Add-ons.  
> Diese Installation läuft ausschließlich über den nativen **HA Supervisor Add-on Store**.

### Via HA Add-on Store (Custom Repository)

1. Gehe in Home Assistant zu **Einstellungen → Add-ons**
2. Klicke auf **„Add-on Store"** (Button unten rechts)
3. Oben rechts auf **⋮** (drei Punkte) → **„Repositories"**
4. Folgende URL eintragen und mit **„Hinzufügen"** bestätigen:
   ```
   https://github.com/Yakilo/antigravity-terminal-ha
   ```
5. Den Store neu laden → **Antigravity Terminal** erscheint in der Liste
6. Addon installieren, konfigurieren und starten

**Direktlink zum Add-on Store:**  
`http://homeassistant.local:8123/hassio/store`

### Lokale Installation (ohne Internet)

1. Den Ordner `antigravity-terminal/` auf deine HA-Instanz nach `/config/addons/antigravity-terminal/` kopieren (z.B. via Samba)
2. Add-on Store neu laden: **⋮ → Reload**
3. Das Addon erscheint unter **„Lokale Add-ons"**

---

## ⚙️ Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `google_api_key` | `string` | `""` | Your Google AI / Gemini API key ([get one here](https://aistudio.google.com/app/apikey)) |
| `terminal_theme` | `string` | `"breeze"` | Terminal color theme |
| `font_size` | `int` | `14` | Terminal font size in pixels |
| `cursor_style` | `select` | `"block"` | Cursor style: `block`, `underline`, or `bar` |
| `cursor_blink` | `bool` | `false` | Enable cursor blinking |
| `persistent_apk_packages` | `list` | `[]` | Extra APT packages to install |
| `persistent_pip_packages` | `list` | `[]` | Extra Python pip packages to install |

### Example Configuration

```yaml
google_api_key: "AIza..."
terminal_theme: breeze
font_size: 14
cursor_style: block
cursor_blink: false
persistent_apk_packages: []
persistent_pip_packages: []
```

---

## 📋 Requirements

- Home Assistant OS or Supervised
- Google AI API Key ([free at aistudio.google.com](https://aistudio.google.com/app/apikey))

---

## 🏗️ Architecture

```
Browser
  └── HA Ingress (port 8099)
        └── ttyd (web terminal)
              └── tmux (session manager)
                    └── Antigravity CLI (agy)
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.
