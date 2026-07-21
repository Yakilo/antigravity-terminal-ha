# Changelog

All notable changes to the **Antigravity Console** Home Assistant addon will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-07-21

### Fixed & Smooth Animation
- **Seamless Pending-to-Confirmed Message Conversion**: Transformed pending user bubbles in-place upon receiving terminal prompt confirmation without destroying/re-creating DOM nodes, eliminating double text animation & flickering on the right side.
- **Hardware-Accelerated Smooth Transitions**: Upgraded `@keyframes fadeInUp` to use GPU-accelerated 3D transforms (`translate3d`) and smooth opacity transitions.

## [2.1.9] - 2026-07-21

### Fixed & Optimized
- **Terminal Output Reconciliation**: Deduplicated prompt echoes and prevented user input mixing with agent messages.
- **Single-Shot CSS Animations**: Scoped entry keyframe animations to `.animate-in` to eliminate animation stuttering on polling updates.
- **Adaptive Capture Loop**: Reduced CPU and RAM usage via in-memory session caching and dynamic polling frequency back-off.
- **Interactive Code Block Copying**: Added copy buttons for all code blocks in agent responses.

## [2.1.8] - 2026-07-13

### Added
- **Multi-session Chat Sidebar**: Added a collapsible left sidebar to manage multiple separate chat histories simultaneously, powered by persistent session metadata.
- **Setup Wizard Custom Views**: Re-implemented the initial CLI setup dialogues (OAuth login, authorization input, color scheme selector, Terms of Service, workspace trust confirmation) as gorgeous modern Web GUI overlay cards with direct websocket interactions.

### Improved
- **Smoother CSS Animations**: Optimized transitions using hardware-accelerated transforms and opacity properties to eliminate layout shifting and UI flickering.

## [2.1.7] - 2026-07-13

### Fixed
- **Image tag name mismatch**: Added the addon slug suffix (`-antigravity_terminal`) to the `--image` flag in the publishing workflow to align with `build.yaml` formatting, resolving pull target 404 errors in HA Supervisor.

## [2.1.6] - 2026-07-13

### Fixed
- **CI/CD Buildx driver override**: Removed redundant setup-qemu-action and setup-buildx-action steps from the publish job to prevent the docker-container driver from overriding the default docker builder, resolving the image tagging error during the HA Builder stage.

## [2.1.5] - 2026-07-13

### Fixed
- **CI/CD registry login redundancy**: Removed redundant login credentials from builder flags to bypass the builder's default Docker Hub authorization check, relying entirely on the pre-authenticated docker/login-action credentials.

## [2.1.4] - 2026-07-13

### Fixed
- **CI/CD registry publishing flags**: Added --registry parameter for GHCR host and updated --docker-hub to contain only the namespace (yakilo) to resolve Docker registry authorization errors.

## [2.1.3] - 2026-07-13

### Fixed
- **CI/CD publishing script**: Corrected docker-hub registry namespace casing to lowercase (yakilo) in GitHub Actions to fix registry push permissions.

## [2.1.2] - 2026-07-13

### Added
- **Interactive choice menus** — Multiple choice prompt lines are automatically parsed and displayed as clean, clickable buttons in the chat.
- **Keyboard navigation for choices** — Users can navigate multiple choice options using ArrowUp/ArrowDown keys and select/send them with Enter from the input textarea.
- **Pending message buffering** — Manually submitted user messages immediately display at the bottom with a subtle pending state (⌛) and transition seamlessly when matched, eliminating disappearing and reappearing text.

### Fixed
- **Flicker-free rendering engine** — Replaced index-based DOM matching with an overlap-based stable alignment engine, eliminating layout shifts and choppy visual transitions when terminal output streams.

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

[2.1.8]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.7...v2.1.8
[2.1.7]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.6...v2.1.7
[2.1.6]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.4...v2.1.5
[2.1.4]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v1.0.15...v2.1.1
[1.0.15]: https://github.com/Yakilo/antigravity-terminal-ha/compare/v1.0.0...v1.0.15
[1.0.0]: https://github.com/Yakilo/antigravity-terminal-ha/releases/tag/v1.0.0
