# Global ARGs (available in FROM instructions)
ARG BUILD_FROM
ARG BUILD_ARCH

## Stage 1: Build hab CLI from source (pinned release)
## hab = Home Assistant Build CLI - used for config access
FROM golang:1.24-trixie AS hab-builder

ARG BUILD_ARCH
ARG HAB_VERSION=1.6.4
RUN git clone --depth 1 --branch "${HAB_VERSION}" https://github.com/balloob/home-assistant-build-cli.git /src
WORKDIR /src

# Cross-compile for the target architecture
RUN GOARCH=$([ "$BUILD_ARCH" = "aarch64" ] && echo "arm64" || echo "amd64") \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /hab .

## Stage 2: Main add-on image
FROM $BUILD_FROM

# Build arguments
ARG BUILD_VERSION
ARG BUILD_ARCH
ARG TTYD_VERSION=1.7.7

# Environment for better Node.js performance
ENV NODE_ENV=production \
    npm_config_update_notifier=false \
    npm_config_fund=false

# Install system dependencies in a single layer
# - nodejs/npm: Required for Antigravity CLI
# - git: Required by Antigravity CLI for version control operations
# - jq: JSON processing for helper scripts
# - curl/ca-certificates: For downloading ttyd and binaries
# - procps: Provides pgrep for health check
# - tmux: Session persistence to prevent multiple Antigravity CLI instances
# - nano, vim, tree: Useful terminal tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        jq \
        nodejs \
        npm \
        procps \
        python3 \
        python3-venv \
        tmux \
        nano \
        vim \
        tree \
        xclip \
        wl-clipboard \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI (gh) for repository operations
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Antigravity CLI via official install script
# Binary is installed as 'agy' to ~/.local/bin/agy
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash \
    && ln -sf /root/.local/bin/agy /usr/local/bin/agy

# Add ~/.local/bin to global PATH
ENV PATH="/root/.local/bin:${PATH}"

# Copy the hab binary from builder stage
COPY --from=hab-builder /hab /usr/local/bin/hab

# Copy Web GUI Application
COPY antigravity-terminal/app /app
RUN cd /app && npm install

# Copy all rootfs files (scripts, configs, etc.)
COPY rootfs /

# Make all scripts executable
RUN chmod +x /usr/bin/antigravity-startup \
    && chmod +x /etc/cont-init.d/*.sh 2>/dev/null || true

# Expose the Web Console port
EXPOSE 8099

# Build labels
LABEL \
    io.hass.name="Antigravity Terminal" \
    io.hass.description="Terminal interface for Google DeepMind's Antigravity CLI with HA MCP integration" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}"
