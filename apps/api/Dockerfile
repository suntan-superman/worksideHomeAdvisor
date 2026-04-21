# ---------- BASE IMAGE ----------
FROM node:20-bookworm-slim

# ---------- ENV ----------
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR="/opt/puppeteer"

# ---------- INSTALL PNPM ----------
# Keep Docker aligned with the repo's packageManager version to avoid Corepack
# switching versions at install time.
RUN corepack enable && corepack prepare pnpm@10.7.1 --activate

# ---------- SYSTEM DEPS FOR HEADLESS CHROME ----------
# Pinning to bookworm + explicit deps keeps Puppeteer stable in Cloud Build.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# ---------- WORKDIR ----------
WORKDIR /app

# ---------- COPY FILES ----------
# Copy entire monorepo (important for workspaces)
COPY . .

# ---------- INSTALL DEPENDENCIES ----------
# Install all workspace deps. Build-script approvals are configured in the
# workspace root package.json under `pnpm.onlyBuiltDependencies`.
RUN pnpm install --frozen-lockfile

# ---------- INSTALL PUPPETEER CHROME ----------
# Ensure Chrome is present in the image (Cloud Run has no persistent disk).
RUN mkdir -p /opt/puppeteer
RUN pnpm --filter @workside/api exec puppeteer browsers install chrome

# ---------- VERIFY PUPPETEER ----------
# Fail the build if browser launch is broken.
RUN pnpm --filter @workside/api exec node --input-type=module -e "import puppeteer from 'puppeteer'; const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']}); await browser.close(); console.log('puppeteer_launch_ok');"

# ---------- BUILD ----------
# If you have a backend build step, keep this
# Otherwise you can remove this line
RUN pnpm run build || echo "No build step"

# ---------- PORT ----------
ENV PORT=8080

# ---------- START ----------
# Adjust this if your backend entry point differs
CMD ["pnpm", "--filter", "@workside/api", "start"]
