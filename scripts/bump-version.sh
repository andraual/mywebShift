#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/src/config.js"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Arquivo não encontrado: $CONFIG_FILE" >&2
  exit 1
fi

current=$(grep -oE "APP_VERSION: '[0-9]+\.[0-9]+'" "$CONFIG_FILE" | head -n1 | grep -oE "[0-9]+\.[0-9]+" || true)
if [[ -z "$current" ]]; then
  echo "Não foi possível ler APP_VERSION em $CONFIG_FILE" >&2
  exit 1
fi

major="${current%.*}"
minor="${current#*.}"
minor=$((minor + 1))
next="$major.$minor"

sed -i "s/APP_VERSION: '[0-9]\+\.[0-9]\+'/APP_VERSION: '$next'/" "$CONFIG_FILE"

echo "Versão atualizada para $next"