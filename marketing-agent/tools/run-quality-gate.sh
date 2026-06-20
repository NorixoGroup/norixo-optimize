#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-quality-gate.sh <scenario-name>" >&2
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
DRAFT_FILE="${SCENARIO_DIR}/openai-draft-test.md"
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"

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

missing_official_files=()

for file in "${official_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    missing_official_files+=("${file}")
  fi
done

draft_status="MISSING"
brief_status="MISSING"
official_status="MISSING"
structure_status="FAIL"
content_review_status="PENDING"
promotion_status="BLOCKED"

if [[ -f "${DRAFT_FILE}" ]]; then
  draft_status="FOUND"
fi

if [[ -f "${BRIEF_FILE}" ]]; then
  brief_status="FOUND"
fi

if [[ ${#missing_official_files[@]} -eq 0 ]]; then
  official_status="FOUND"
fi

if [[ "${draft_status}" == "FOUND" && "${brief_status}" == "FOUND" && "${official_status}" == "FOUND" ]]; then
  structure_status="PASS"
fi

echo "QUALITY GATE"
echo
echo "Draft:"
echo "${draft_status}"
echo
echo "Editorial Brief:"
echo "${brief_status}"
echo
echo "Official files:"
echo "${official_status}"
echo
echo "Structure:"
echo "${structure_status}"
echo
echo "Content review:"
echo "${content_review_status}"
echo
echo "Promotion:"
echo "${promotion_status}"
echo

if [[ ${#missing_official_files[@]} -gt 0 ]]; then
  echo "Missing official files:"
  printf '%s\n' "${missing_official_files[@]}"
fi
