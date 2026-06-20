#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-system-status-index.sh <scenario-name>" >&2
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
CAMPAIGN_ITEMS_DIR="${SCENARIO_DIR}/campaign-items"
OUTPUT_FILE="${SCENARIO_DIR}/system-status-index.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${CAMPAIGN_ITEMS_DIR}" ]]; then
  echo "Error: campaign items directory not found: ${CAMPAIGN_ITEMS_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: system status index already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

read_section_value() {
  local file_path="$1"
  local label="$2"

  awk -v target="${label}" '
    $0 == target {
      getline
      getline
      print
      exit
    }
  ' "${file_path}"
}

item_dirs=()
while IFS= read -r item_dir; do
  item_dirs+=("${item_dir}")
done < <(find "${CAMPAIGN_ITEMS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

items_detected=0
items_pass=0
items_missing_status=0
items_fail=0

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

{
  echo "SYSTEM STATUS INDEX"
  echo
  echo "Scenario"
  echo
  echo "${SCENARIO_NAME}"
  echo
  echo "--------------------------------"
  echo
  echo "Campaign Items"
  echo

  for item_dir in "${item_dirs[@]}"; do
    item_id="$(basename "${item_dir}")"
    status_file="${item_dir}/system-status.md"
    item_status="MISSING"
    item_readiness="MISSING"

    items_detected=$((items_detected + 1))

    if [[ -f "${status_file}" ]]; then
      item_status="$(read_section_value "${status_file}" "Overall")"
      item_readiness="$(read_section_value "${status_file}" "System Readiness")"
    fi

    case "${item_status}" in
      PASS)
        items_pass=$((items_pass + 1))
        ;;
      MISSING)
        items_missing_status=$((items_missing_status + 1))
        ;;
      *)
        items_fail=$((items_fail + 1))
        ;;
    esac

    echo "${item_id}"
    echo
    echo "System Status:"
    echo "${item_status}"
    echo
    echo "Readiness:"
    echo "${item_readiness}"
    echo
    echo "--------------------------------"
    echo
  done

  overall_status="FAIL"
  if [[ "${items_detected}" -gt 0 && "${items_pass}" -eq "${items_detected}" ]]; then
    overall_status="PASS"
  fi

  echo "Summary"
  echo
  echo "Items detected:"
  echo "${items_detected}"
  echo
  echo "Items PASS:"
  echo "${items_pass}"
  echo
  echo "Items MISSING STATUS:"
  echo "${items_missing_status}"
  echo
  echo "Items FAIL:"
  echo "${items_fail}"
  echo
  echo "Overall:"
  echo "${overall_status}"
  echo
  echo "Next Phase:"
  echo "Provider Integration / Admin Dashboard"
} > "${temp_report_file}"

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
