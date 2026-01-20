#!/usr/bin/env bash
set -euo pipefail

WRANGLER_FILE="wrangler.toml"
OUT_FILE=".env.cloudflare"

awk '
  /^\[vars\]/ { invars=1; next }
  /^\[/ { invars=0 }
  invars && $0 ~ /=/ {
    # preserve key = "value" lines
    gsub(/[ \t]+$/, "", $0)
    print $0
  }
' "$WRANGLER_FILE" > "$OUT_FILE"
