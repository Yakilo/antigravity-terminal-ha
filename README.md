# Antigravity Terminal - Home Assistant Addon

![Antigravity Terminal](https://img.shields.io/badge/Antigravity-Terminal-6366f1?style=for-the-badge&logo=google&logoColor=white)
![HA OS](https://img.shields.io/badge/Home%20Assistant-OS-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white)
![Architecture](https://img.shields.io/badge/arch-aarch64%20%7C%20amd64-green?style=for-the-badge)

A **Home Assistant Addon** that provides a web-based terminal running Google DeepMind's **Antigravity CLI (agy)** directly in your browser.

Inspired by [oded996/gemini-cli-home-assistant-addons](https://github.com/oded996/gemini-cli-home-assistant-addons).

---

## ✨ Features

- 🚀 **Antigravity CLI (agy)** running directly inside Home Assistant
- ⚡ **Auto-Start & Setup Skipped** - No wizard needed, starts immediately with preconfigured API keys
- 📋 **System Clipboard Integration** - Includes `xclip` and `wl-clipboard` for seamless clipboard synchronization
- 🖥️ **Web Terminal** via [ttyd](https://github.com/tsl0922/ttyd) - accessible directly in the HA sidebar
- 💾 **Session Persistence** via tmux - reconnect to your running session
- 🎨 **Customizable** - theme, font size, cursor style
- 🔐 **Secure** - runs in an isolated Docker container with HA AppArmor

---

## 🛠️ Installation

### Via HA Add-on Store (Custom Repository)

1. Gehe in Home Assistant zu **Einstellungen → Add-ons**
2. Klicke auf **„Add-on Store"** (Button unten rechts)
3. Oben rechts auf **⋮** (drei Punkte) → **„Repositories"**
4. Folgende URL eintragen und mit **„Hinzufügen"** bestätigen:
   ```
   https://github.com/Yakilo/antigravity-terminal-ha
   ```
5. Den Store neu laden → **Antigravity Terminal** erscheint in der Liste und kann installiert werden.

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
