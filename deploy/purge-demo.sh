#!/usr/bin/env bash
# Nightly: asks the app to delete sample accounts older than a day.
set -euo pipefail
cd "$(dirname "$0")/../web"
secret=$(grep -E '^CRON_SECRET=' .env.production.local | cut -d= -f2-)
curl -fsS -H "Authorization: Bearer $secret" http://127.0.0.1:3000/api/cron/purge-demo
echo
