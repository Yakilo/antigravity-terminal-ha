# Changelog

All notable changes to the **Antigravity Console** Home Assistant addon will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-07-13

### Added
- **Web Console GUI** — Full migration from raw terminal to a modern chat-style interface built with HTML/CSS/JS.
- **WebSocket-based chat interface** — Real-time bidirectional communication between the browser and the Antigravity CLI via `ws` and Express.
- **Tmux screen capture engine** — Polls the `agy` tmux pane every 250 ms and streams parsed output to the Web Console.
- **Prompt helper buttons** — Inline "Yes (y)" / "No (n)" quick-action buttons that appear automatically when the CLI asks for confirmation (e.g. `[y/N]`).
- **DOM patching engine** — Flicker-free rendering that diffs existing chat bubbles against new tmux captures instead of replacing the entire DOM.
- **Version display in header** — The addon version is fetched from `/api/version` and shown as a badge next to the logo.
- **Raw Terminal toggle** — One-click button to switch between the Web Chat GUI and the embedded ttyd raw terminal (proxied via `http-proxy`).
- **Markdown rendering** — Agent responses are rendered with basic markdown support (code blocks, bold, bullet lists, links).
- **Node.js backend** — Express server on port 8099 serving the Web GUI, proxying ttyd on port 8098, and managing WebSocket connections.

### Changed
- Primary interface is now the Web Chat Console; the raw ttyd terminal is available as a secondary view.
- Addon name changed from "Antigravity Terminal" to **Antigravity Console** to reflect the GUI-first approach.
- Base image migrated from Alpine to **Debian Trixie** (`ghcr.io/home-assistant/*-base-debian:trixie`).
- Package manager changed from `apk` to `apt-get` (legacy `persistent_apk_packages` config key is still honoured).

## [1.0.15] - 2026-07-06

### Added
- **Persistent home directory** — The `/root` directory is backed up to `/data/agy/root_dir` and restored on every restart, preserving CLI history, configuration, and installed tools.
- **Background syncer** — A background process copies `/root` to persistent storage every 60 seconds (excluding caches and tmux state).
- **Session persistence** — Tmux session named `agy` is reattached on reconnect so running conversations survive browser refreshes.
- **Extra package installation** — Support for `persistent_apk_packages` and `persistent_pip_packages` addon options to install additional tools at startup.

### Changed
- Startup script refactored for cleaner signal handling and graceful shutdown of all child processes.

### Fixed
- Prevented duplicate agy instances when multiple browser tabs connect simultaneously (tmux session locking).

## [1.0.0] - 2026-06-28

### Added
- **Initial release** of the Antigravity Terminal Home Assistant addon.
- **ttyd web terminal** — Full-featured web terminal accessible directly in the Home Assistant sidebar via Ingress.
- **Antigravity CLI (agy) integration** — Pre-installed `agy` binary with auto-configured API key from addon options.
- **MCP (Model Context Protocol) support** — Home Assistant API and Supervisor API access enabled for agy tool calls.
- **Tmux session manager** — Persistent terminal sessions that survive page reloads.
- **Google API key configuration** — Configurable via the addon options panel; automatically exported as `GOOGLE_API_KEY` and `GEMINI_API_KEY`.
- **Multi-architecture support** — Builds for `aarch64` and `amd64`.
- **Pre-installed tools** — `git`, `gh` (GitHub CLI), `nano`, `vim`, `tree`, `python3`, `xclip`, `wl-clipboard`.
- **AppArmor security** — Runs in an isolated Docker container with Home Assistant AppArmor.
- **HA config directory mount** — Read/write access to `/config` for file operations.

[2.1.1]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v1.0.15...v2.1.1
[1.0.15]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v1.0.0...v1.0.15
[1.0.0]: https://github.com/Yakilo/antigravity-terminal-ha/releases/tag/v1.0.0
