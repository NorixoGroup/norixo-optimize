#!/usr/bin/env bash

set -euo pipefail

RAW_MODE="false"
CONFIGURED_PROVIDER="${MARKETING_AGENT_PROVIDER:-mock}"

if [[ "${1:-}" == "--raw" ]]; then
  RAW_MODE="true"
fi

case "${CONFIGURED_PROVIDER}" in
  mock|openai)
    ;;
  *)
    CONFIGURED_PROVIDER="mock"
    ;;
esac

if [[ "${RAW_MODE}" == "true" ]]; then
  printf '%s\n' "${CONFIGURED_PROVIDER}"
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
echo "${CONFIGURED_PROVIDER}"
echo
echo "Status :"
echo
echo "READY"
echo
echo "Reason :"
echo
if [[ "${CONFIGURED_PROVIDER}" == "openai" ]]; then
  echo "Explicit runtime override detected."
else
  echo "Default secure configuration."
fi
echo
echo "External API :"
echo
if [[ "${CONFIGURED_PROVIDER}" == "openai" ]]; then
  echo "provider-dependent"
else
  echo "disabled"
fi
echo
echo "Network :"
echo
if [[ "${CONFIGURED_PROVIDER}" == "openai" ]]; then
  echo "provider-dependent"
else
  echo "disabled"
fi
