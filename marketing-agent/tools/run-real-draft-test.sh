#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LLM_ADAPTER_SCRIPT="${SCRIPT_DIR}/run-llm-adapter.sh"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-real-draft-test.sh <scenario-name>" >&2
  exit 1
fi

if [[ ! "${SCENARIO_NAME}" =~ ^scenario-[0-9]{3}-[a-z0-9-]+$ ]]; then
  echo "Error: invalid scenario name: ${SCENARIO_NAME}" >&2
  echo "Expected format: scenario-XXX-slug" >&2
  exit 1
fi

if [[ "${SCENARIO_NAME}" == *".."* ]] || [[ "${SCENARIO_NAME}" == */* ]]; then
  echo "Error: unsafe scenario name." >&2
  exit 1
fi

if [[ "${MARKETING_AGENT_PROVIDER:-}" != "openai" ]]; then
  echo "This test requires MARKETING_AGENT_PROVIDER=openai" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"
OUTPUT_FILE="${SCENARIO_DIR}/openai-draft-test.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BRIEF_FILE}" ]]; then
  echo "Error: editorial brief not found: ${BRIEF_FILE}" >&2
  exit 1
fi

if [[ ! -f "${LLM_ADAPTER_SCRIPT}" ]]; then
  echo "Error: LLM adapter script not found: ${LLM_ADAPTER_SCRIPT}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: output file already exists: ${OUTPUT_FILE}" >&2
  echo "Refusing to overwrite existing OpenAI draft test." >&2
  exit 1
fi

json_escape_file() {
  local file="$1"

  awk '
    BEGIN { first = 1 }
    {
      gsub(/\\/,"\\\\")
      gsub(/"/,"\\\"")
      gsub(/\r/,"")
      if (!first) {
        printf "\\n"
      }
      printf "%s", $0
      first = 0
    }
  ' "${file}"
}

prompt_file="$(mktemp)"
request_file="$(mktemp)"
adapter_output_file="$(mktemp)"
runtime_response_file="$(mktemp)"
trap 'rm -f "${prompt_file}" "${request_file}" "${adapter_output_file}" "${runtime_response_file}"' EXIT

cat > "${prompt_file}" <<EOF
You are producing a first structured working draft for Norixo AI.

Use only the editorial brief below. Do not invent product claims, metrics, or unavailable features.

Return Markdown only, with exactly these sections:

# OpenAI Draft Test

## Titre

## Introduction

## Probleme

## Solution Norixo

## Benefices

## CTA discret

## Version courte Facebook

## Version courte Instagram

## Version courte Snapchat

Tone requirements:
- professional
- modern
- expert
- accessible
- never too commercial

Editorial brief:

$(cat "${BRIEF_FILE}")
EOF

cat > "${request_file}" <<EOF
{
  "requestId": "${SCENARIO_NAME}-openai-draft-test",
  "provider": "auto",
  "role": "draft-test-writer",
  "scenario": "${SCENARIO_NAME}",
  "prompt": "$(json_escape_file "${prompt_file}")",
  "constraints": ["markdown-only", "no-overwrite", "real-draft-test"],
  "language": "fr",
  "metadata": {
    "source": "editorial-brief.md",
    "taskType": "openai-draft-test",
    "providerMode": "openai"
  },
  "expectedOutput": {
    "format": "markdown",
    "type": "draft"
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

bash "${LLM_ADAPTER_SCRIPT}" --request-file "${request_file}" > "${adapter_output_file}"

awk '
  /----- Runtime Response -----/ { capture=1; next }
  /^Response :$/ { capture=0 }
  capture { print }
' "${adapter_output_file}" | sed '/^[[:space:]]*$/d' > "${runtime_response_file}"

if [[ ! -s "${runtime_response_file}" ]]; then
  echo "Error: runtime response could not be extracted from LLM Adapter output." >&2
  exit 1
fi

runtime_status="$(jq -r '.status // empty' "${runtime_response_file}")"
runtime_output="$(jq -r '.output // empty' "${runtime_response_file}")"
runtime_first_error="$(jq -r '(.errors // [])[0] // empty' "${runtime_response_file}")"
runtime_provider="$(jq -r '.provider // empty' "${runtime_response_file}")"

if [[ "${runtime_provider}" != "openai" ]]; then
  echo "Error: unexpected provider in runtime response: ${runtime_provider}" >&2
  exit 1
fi

if [[ "${runtime_status}" != "success" ]]; then
  echo "OpenAI Draft Test"
  echo "Scenario: ${SCENARIO_NAME}"
  echo
  echo "Status: ERROR"
  echo
  if [[ -n "${runtime_first_error}" ]]; then
    echo "${runtime_first_error}" >&2
  else
    echo "Unknown OpenAI runtime error." >&2
  fi
  exit 1
fi

printf '%s\n' "${runtime_output}" > "${OUTPUT_FILE}"

echo "OpenAI Draft Test"
echo "Scenario: ${SCENARIO_NAME}"
echo "Provider: openai"
echo "Status: CREATED"
echo "Output: ${OUTPUT_FILE}"
echo
echo "----- LLM Adapter Output -----"
echo
cat "${adapter_output_file}"
