#!/usr/bin/env bash

set -euo pipefail

REQUEST_FILE="${1:-}"

if [[ -z "${REQUEST_FILE}" ]]; then
  echo "Error: missing runtime request file." >&2
  exit 1
fi

if [[ ! -f "${REQUEST_FILE}" ]]; then
  echo "Error: runtime request file not found: ${REQUEST_FILE}" >&2
  exit 1
fi

extract_json_string_field() {
  local field="$1"
  local file="$2"
  local value

  value="$(sed -n "s/^[[:space:]]*\"${field}\":[[:space:]]*\"\\(.*\\)\"[[:space:]]*,\{0,1\}[[:space:]]*$/\\1/p" "${file}" | head -n 1)"
  printf '%s' "${value}"
}

request_id="$(extract_json_string_field "requestId" "${REQUEST_FILE}")"
timestamp="$(extract_json_string_field "timestamp" "${REQUEST_FILE}")"

if [[ -z "${request_id}" ]]; then
  request_id="mock-request"
fi

if [[ -z "${timestamp}" ]]; then
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi

cat <<EOF
{
  "requestId": "${request_id}",
  "provider": "mock",
  "status": "mocked",
  "output": "Mock provider selected. No external request executed.",
  "confidence": "100",
  "warnings": [],
  "errors": [],
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "estimatedCost": 0
  },
  "latency": {
    "ms": 0
  },
  "timestamp": "${timestamp}"
}
EOF
