# ---------- BASE IMAGE ----------
FROM node:20-slim

# ---------- ENV ----------
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

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

# ---------- BUILD ----------
# If you have a backend build step, keep this
# Otherwise you can remove this line
RUN pnpm run build || echo "No build step"

# ---------- PORT ----------
ENV PORT=8080

# ---------- START ----------
# Adjust this if your backend entry point differs
CMD ["pnpm", "--filter", "@workside/api", "start"]