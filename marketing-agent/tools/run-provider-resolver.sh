#!/usr/bin/env bash

set -euo pipefail

RAW_MODE="false"

if [[ "${1:-}" == "--raw" ]]; then
  RAW_MODE="true"
fi

if [[ "${RAW_MODE}" == "true" ]]; then
  printf '%s\n' "mock"
  exit 0
fi

echo "========================="
echo
echo "PROVIDER RESOLVER"
echo
echo "========================="
echo
echo "Configured provider :"
echo
echo "mock"
echo
echo "Status :"
echo
echo "READY"
echo
echo "Reason :"
echo
echo "Default secure configuration."
echo
echo "External API :"
echo
echo "disabled"
echo
echo "Network :"
echo
echo "disabled"
