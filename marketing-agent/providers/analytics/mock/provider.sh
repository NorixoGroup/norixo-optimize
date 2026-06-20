#!/usr/bin/env bash

set -euo pipefail

ANALYTICS_REQUEST_FILE="${1:-}"

if [[ -z "${ANALYTICS_REQUEST_FILE}" ]]; then
  echo "Error: missing analytics request path." >&2
  echo "Usage: bash marketing-agent/providers/analytics/mock/provider.sh <analytics-request-path>" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_REQUEST_FILE}" ]]; then
  echo "Error: analytics request not found: ${ANALYTICS_REQUEST_FILE}" >&2
  exit 1
fi

echo "ANALYTICS MOCK PROVIDER"
echo
echo "Provider: mock-analytics"
echo "Status: READY"
echo "Collection: DISABLED"
echo "Network: DISABLED"
echo "Report Path: N/A"
