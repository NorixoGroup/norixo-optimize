#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROVIDER_RESOLVER_SCRIPT="${SCRIPT_DIR}/run-provider-resolver.sh"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROVIDERS_DIR="${MARKETING_AGENT_DIR}/providers"
REQUEST_FILE=""
TEMP_REQUEST_FILE=""

if [[ ! -f "${PROVIDER_RESOLVER_SCRIPT}" ]]; then
  echo "Error: provider resolver script not found: ${PROVIDER_RESOLVER_SCRIPT}" >&2
  exit 1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --request-file)
      REQUEST_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${REQUEST_FILE}" ]]; then
  TEMP_REQUEST_FILE="$(mktemp)"
  REQUEST_FILE="${TEMP_REQUEST_FILE}"
  cat > "${REQUEST_FILE}" <<EOF
{
  "requestId": "mock-runtime-request",
  "provider": "auto",
  "role": "content-drafter",
  "scenario": "standalone-adapter-check",
  "prompt": "Mock runtime request.",
  "constraints": ["no-network", "mock-only"],
  "language": "fr",
  "metadata": {
    "source": "run-llm-adapter.sh",
    "taskType": "adapter-check",
    "providerMode": "mock"
  },
  "expectedOutput": {
    "format": "json",
    "type": "runtime-response"
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
fi

trap 'if [[ -n "${TEMP_REQUEST_FILE}" && -f "${TEMP_REQUEST_FILE}" ]]; then rm -f "${TEMP_REQUEST_FILE}"; fi' EXIT

if [[ ! -f "${REQUEST_FILE}" ]]; then
  echo "Error: runtime request file not found: ${REQUEST_FILE}" >&2
  exit 1
fi

resolved_provider="$(bash "${PROVIDER_RESOLVER_SCRIPT}" --raw)"
resolver_output="$(bash "${PROVIDER_RESOLVER_SCRIPT}")"

case "${resolved_provider}" in
  mock)
    provider_script="${PROVIDERS_DIR}/mock/provider.sh"
    ;;
  openai)
    provider_script="${PROVIDERS_DIR}/openai/provider.sh"
    ;;
  *)
    echo "Error: unsupported provider resolved: ${resolved_provider}" >&2
    exit 1
    ;;
esac

if [[ ! -f "${provider_script}" ]]; then
  echo "Error: provider script not found: ${provider_script}" >&2
  exit 1
fi

runtime_response="$(bash "${provider_script}" "${REQUEST_FILE}")"
runtime_status="$(printf '%s\n' "${runtime_response}" | sed -n 's/^[[:space:]]*"status":[[:space:]]*"\([^"]*\)".*$/\1/p' | head -n 1)"
runtime_errors="$(printf '%s\n' "${runtime_response}" | sed -n 's/^[[:space:]]*"errors":[[:space:]]*\[\(.*\)\].*$/\1/p' | head -n 1)"

echo "========================"
echo
echo "LLM ADAPTER"
echo
echo "========================"
echo
echo "Provider resolved :"
echo
echo "${resolved_provider}"
echo
echo "Status :"
echo
if [[ -n "${runtime_status}" ]]; then
  printf '%s\n' "${runtime_status}" | tr '[:lower:]' '[:upper:]'
else
  echo "READY"
fi
echo
echo "API :"
echo
if [[ "${resolved_provider}" == "openai" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "disabled"
  else
    echo "configured"
  fi
else
  echo "disabled"
fi
echo
echo "Network :"
echo
if [[ "${resolved_provider}" == "openai" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "disabled"
  else
    echo "provider-dependent"
  fi
else
  echo "disabled"
fi
echo
echo "----- Provider Resolver Output -----"
echo
echo "${resolver_output}"
echo
echo "----- Runtime Response -----"
echo
echo "${runtime_response}"
echo
if [[ "${resolved_provider}" == "openai" && -n "${runtime_errors}" ]]; then
  echo "Provider :"
  echo
  echo "openai"
  echo
  echo "Status :"
  echo
  if [[ -n "${runtime_status}" ]]; then
    printf '%s\n' "${runtime_status}" | tr '[:lower:]' '[:upper:]'
  else
    echo "ERROR"
  fi
  echo
  echo "OPENAI_API_KEY missing"
  echo
fi
echo "Response :"
echo
if [[ "${resolved_provider}" == "openai" ]]; then
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "OpenAI Provider"
    echo
    echo "Status : ERROR"
    echo
    echo "Reason :"
    echo
    echo "OPENAI_API_KEY not configured."
    echo
    echo "Falling back is handled by Provider Resolver."
  else
    echo "OpenAI provider selected."
    echo
    echo "Runtime path ready."
  fi
else
  echo "Mock provider selected."
  echo
  echo "No external request executed."
fi
