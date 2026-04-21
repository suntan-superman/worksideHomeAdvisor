# ---------- BASE IMAGE ----------
FROM node:20-slim

# ---------- ENV ----------
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR="/opt/puppeteer"

# ---------- INSTALL PNPM ----------
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# ---------- WORKDIR ----------
WORKDIR /app

# ---------- COPY FILES ----------
# Copy entire monorepo (important for workspaces)
COPY . .

# ---------- INSTALL DEPENDENCIES ----------
# Install all workspace deps
RUN pnpm install --frozen-lockfile

# ---------- INSTALL PUPPETEER CHROME ----------
# Ensure Chrome is present in the image (Cloud Run has no persistent disk).
RUN mkdir -p /opt/puppeteer
RUN npx puppeteer browsers install chrome

# ---------- VERIFY PUPPETEER ----------
# Fail the build if browser launch is broken.
RUN node --input-type=module -e "import puppeteer from 'puppeteer'; const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']}); await browser.close(); console.log('puppeteer_launch_ok');"

# ---------- BUILD ----------
# If you have a backend build step, keep this
# Otherwise you can remove this line
RUN pnpm run build || echo "No build step"

# ---------- PORT ----------
ENV PORT=8080

# ---------- START ----------
# Adjust this if your backend entry point differs
CMD ["pnpm", "--filter", "@workside/api", "start"]
