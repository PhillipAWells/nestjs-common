#!/usr/bin/env bash
set -euo pipefail

corepack enable

COREPACK_ENABLE_STRICT=0 corepack prepare yarn@stable --activate

yarn config set --home enableTelemetry 0

yarn install
