#!/usr/bin/env bash
set -euo pipefail

WRANGLER_FILE="wrangler.toml"
OUT_FILE=".env.cloudflare"

awk '
  BEGIN {
    map["amm"]="VITE_MODULE_AMM_ACCOUNT_ADDRESS"
    map["bonding_curve"]="VITE_MODULE_BONDING_CURVE_ACCOUNT_ADDRESS"
    map["clmm"]="VITE_MODULE_CLMM_ACCOUNT_ADDRESS"
    map["escrow"]="VITE_MODULE_ESCROW_ACCOUNT_ADDRESS"
    map["gauge"]="VITE_MODULE_GAUGE_ACCOUNT_ADDRESS"
    map["nft_springboard"]="VITE_MODULE_NFT_SPRINGBOARD_ACCOUNT_ADDRESS"
    map["stable"]="VITE_MODULE_STABLE_ACCOUNT_ADDRESS"
    map["tapp"]="VITE_MODULE_TAPP_ACCOUNT_ADDRESS"
    map["ve_tapp"]="VITE_MODULE_VETAPP_ACCOUNT_ADDRESS"
    map["ve_tapp_lib"]="VITE_MODULE_VETAPP_LIB_ACCOUNT_ADDRESS"
    map["ve_tapp_helper"]="VITE_MODULE_VETAPP_HELPER_ACCOUNT_ADDRESS"
  }
  /^\[vars\]/ { invars=1; next }
  /^\[/ { invars=0 }
  invars && $0 ~ /=/ {
    # preserve value, but map keys to their VITE_* names when configured
    split($0, parts, "=")
    key=parts[1]
    gsub(/^[ \t]+|[ \t]+$/, "", key)
    value=substr($0, index($0, "=") + 1)
    gsub(/^[ \t]+/, "", value)
    gsub(/^"|"$/, "", value)
    out_key=(key in map) ? map[key] : key
    print out_key " = \"" value "\""
  }
' "$WRANGLER_FILE" > "$OUT_FILE"
