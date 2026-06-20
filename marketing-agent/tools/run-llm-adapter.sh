#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDER_RESOLVER_SCRIPT="${SCRIPT_DIR}/run-provider-resolver.sh"

if [[ ! -f "${PROVIDER_RESOLVER_SCRIPT}" ]]; then
  echo "Error: provider resolver script not found: ${PROVIDER_RESOLVER_SCRIPT}" >&2
  exit 1
fi

resolver_output="$(bash "${PROVIDER_RESOLVER_SCRIPT}")"

echo "========================"
echo
echo "LLM ADAPTER"
echo
echo "========================"
echo
echo "Provider resolved :"
echo
echo "mock"
echo
echo "Status :"
echo
echo "READY"
echo
echo "API :"
echo
echo "disabled"
echo
echo "Network :"
echo
echo "disabled"
echo
echo "----- Provider Resolver Output -----"
echo
echo "${resolver_output}"
echo
echo "Response :"
echo
echo "Mock provider selected."
echo
echo "No external request executed."
