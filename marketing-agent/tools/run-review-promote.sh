#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-review-promote.sh <scenario-name>" >&2
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

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
OPENAI_DRAFT_FILE="${SCENARIO_DIR}/openai-draft-test.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

official_files=(
  "${SCENARIO_DIR}/master-content.md"
  "${SCENARIO_DIR}/facebook.md"
  "${SCENARIO_DIR}/instagram.md"
  "${SCENARIO_DIR}/snapchat.md"
)

existing_official_files=()

for file in "${official_files[@]}"; do
  if [[ -f "${file}" ]]; then
    existing_official_files+=("${file}")
  fi
done

openai_draft_status="MISSING"
official_status="READY"
promotion_status="BLOCKED"
reason="Manual review required."

if [[ -f "${OPENAI_DRAFT_FILE}" ]]; then
  openai_draft_status="FOUND"
fi

if [[ ${#existing_official_files[@]} -gt 0 ]]; then
  official_status="ALREADY EXIST"
else
  official_status="NOT FOUND"
fi

if [[ "${openai_draft_status}" != "FOUND" ]]; then
  reason="OpenAI draft missing."
fi

echo "EDITORIAL REVIEW"
echo
echo "Scenario :"
echo "${SCENARIO_NAME}"
echo
echo "OpenAI draft :"
echo "${openai_draft_status}"
echo
echo "Official files :"
echo "${official_status}"
echo
echo "Promotion :"
echo "${promotion_status}"
echo
echo "Reason :"
echo "${reason}"
echo

if [[ ${#existing_official_files[@]} -gt 0 ]]; then
  echo "Blocking files:"
  printf '%s\n' "${existing_official_files[@]}"
  echo
fi

echo "Preview source:"
echo "${OPENAI_DRAFT_FILE}"
