#!/usr/bin/env bash

set -euo pipefail

PUBLICATION_REQUEST_FILE="${1:-}"

if [[ -z "${PUBLICATION_REQUEST_FILE}" ]]; then
  echo "Error: missing publication request path." >&2
  echo "Usage: bash marketing-agent/providers/publications/mock/provider.sh <publication-request-path>" >&2
  exit 1
fi

if [[ ! -f "${PUBLICATION_REQUEST_FILE}" ]]; then
  echo "Error: publication request not found: ${PUBLICATION_REQUEST_FILE}" >&2
  exit 1
fi

echo "PUBLICATION MOCK PROVIDER"
echo
echo "Provider: mock-publication"
echo "Status: READY"
echo "Publication: DISABLED"
echo "Network: DISABLED"
echo "Publication ID: N/A"
echo "Publication URL: N/A"
