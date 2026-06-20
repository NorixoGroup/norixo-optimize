#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${ROOT_DIR}/simulations"

if [[ $# -lt 1 ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/qa-simulation-scenario.sh <scenario-name>" >&2
  exit 1
fi

SCENARIO_NAME="$1"

if [[ ! "${SCENARIO_NAME}" =~ ^scenario-[0-9]{3}-[a-z0-9-]+$ ]]; then
  echo "Error: invalid scenario name: ${SCENARIO_NAME}" >&2
  echo "Expected format: scenario-XXX-slug" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

required_files=(
  "README.md"
  "scenario.md"
  "marketing-brain-report.md"
  "master-content.md"
  "facebook.md"
  "instagram.md"
  "snapchat.md"
  "image-prompt.md"
  "video-script.md"
  "storyboard.md"
  "translation-plan.md"
  "publication-plan.md"
  "qa-checklist.md"
  "scenario-scorecard.md"
  "lessons-learned.md"
)

missing_files=()

for file in "${required_files[@]}"; do
  if [[ ! -f "${SCENARIO_DIR}/${file}" ]]; then
    missing_files+=("${file}")
  fi
done

echo "Scenario QA Report"
echo "Scenario: ${SCENARIO_NAME}"
echo "Directory: ${SCENARIO_DIR}"
echo

if [[ ${#missing_files[@]} -eq 0 ]]; then
  echo "Status: OK"
  echo "All required files are present."
  echo
  echo "Reminder: this script checks completeness only."
  echo "Editorial quality and product accuracy still require human validation."
  exit 0
fi

echo "Status: ERROR"
echo "Missing required files:"
for file in "${missing_files[@]}"; do
  echo "- ${file}"
done
echo
echo "Reminder: this script checks completeness only."
echo "Editorial quality and product accuracy still require human validation."
exit 1
