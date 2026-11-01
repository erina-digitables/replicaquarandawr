#!/usr/bin/env bash
# Pull the latest code, migrate, rebuild, restart. Run as the dawr user.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd web
npm ci
npm run db:migrate
npm run build
sudo systemctl restart dawr
echo "Updated to $(git rev-parse --short HEAD)."
