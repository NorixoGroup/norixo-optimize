#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE_DIR="${MARKETING_AGENT_DIR}/qa/scenario-template"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ ! -d "${TEMPLATE_DIR}" ]]; then
  echo "Error: scenario template directory not found: ${TEMPLATE_DIR}" >&2
  exit 1
fi

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Usage: bash marketing-agent/tools/create-simulation-scenario.sh <scenario-name>" >&2
  exit 1
fi

if [[ ! "${SCENARIO_NAME}" =~ ^scenario-[a-z0-9]+[a-z0-9-]*$ ]]; then
  echo "Error: invalid scenario name. Use lowercase letters, digits, and dashes only, starting with 'scenario-'." >&2
  exit 1
fi

if [[ "${SCENARIO_NAME}" == *".."* ]] || [[ "${SCENARIO_NAME}" == */* ]]; then
  echo "Error: unsafe scenario name." >&2
  exit 1
fi

TARGET_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"

if [[ -e "${TARGET_DIR}" ]]; then
  echo "Error: scenario already exists: ${TARGET_DIR}" >&2
  exit 1
fi

mkdir -p "${TARGET_DIR}"

created_files=()

while IFS= read -r template_file; do
  base_name="$(basename "${template_file}")"
  target_file="${TARGET_DIR}/${base_name}"
  cp "${template_file}" "${target_file}"
  created_files+=("${target_file}")
done < <(find "${TEMPLATE_DIR}" -maxdepth 1 -type f | sort)

echo "Created simulation scenario: ${SCENARIO_NAME}"
printf '%s\n' "${created_files[@]}"
