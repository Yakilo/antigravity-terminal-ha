# Stage 1: Main add-on image (no intermediate build stages needed)
ARG BUILD_FROM
ARG BUILD_ARCH

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
# - nodejs/npm: Required for Web Console GUI
# - git: Required by Antigravity CLI for version control operations
# - jq: JSON processing for helper scripts
# - curl/ca-certificates: For downloading binaries
# - procps: Provides pgrep for health check
# - tmux: Session persistence to prevent multiple CLI instances
# - nano, vim, tree: Useful terminal tools for the raw terminal mode
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
        rsync \
        tmux \
        nano \
        vim \
        tree \
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

# Install ttyd (web-based terminal) for the correct architecture
RUN ARCH=$([ "$BUILD_ARCH" = "aarch64" ] && echo "aarch64" || echo "x86_64") \
    && curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${ARCH}" \
        -o /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd

# Install Antigravity CLI via official install script
# Binary is installed as 'agy' to ~/.local/bin/agy
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash \
    && ln -sf /root/.local/bin/agy /usr/local/bin/agy

# Add ~/.local/bin to global PATH
ENV PATH="/root/.local/bin:${PATH}"

# Copy Web GUI Application package configuration and install dependencies
# Doing this first allows Docker to cache the npm install layer
COPY app/package.json /app/package.json
RUN cd /app && npm install

# Copy the rest of the Web GUI Application code
COPY app /app

# Copy all rootfs files (scripts, configs, etc.)
COPY rootfs /

# Make all scripts executable
RUN chmod +x /usr/bin/antigravity-startup \
    && chmod +x /etc/cont-init.d/*.sh 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -sf http://localhost:8099/api/version || exit 1

# Expose the Web Console port
EXPOSE 8099

# Build labels
LABEL \
    io.hass.name="Antigravity Console" \
    io.hass.description="Web Console for Google DeepMind's Antigravity CLI with HA MCP integration" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}"
