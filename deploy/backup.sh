#!/usr/bin/env bash
# Nightly database backup: a compressed dump in ~/backups, keeping 14 days.
# Restore one with: gunzip -c FILE.sql.gz | psql "$MIGRATE_DATABASE_URL"
set -euo pipefail
# Dumps hold emails and password hashes: readable by the dawr user only.
umask 077
cd "$(dirname "$0")/../web"
url=$(grep -E '^MIGRATE_DATABASE_URL=' .env.production.local | cut -d= -f2-)
mkdir -p ~/backups
pg_dump --no-owner --clean --if-exists "$url" | gzip > ~/backups/dawr-$(date -u +%Y%m%d-%H%M).sql.gz
find ~/backups -name 'dawr-*.sql.gz' -mtime +14 -delete
