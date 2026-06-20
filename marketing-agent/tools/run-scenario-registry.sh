#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
OUTPUT_FILE="${SIMULATIONS_DIR}/scenario-registry.md"
REFRESH_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh)
      REFRESH_MODE="true"
      shift
      ;;
    --refresh=true)
      REFRESH_MODE="true"
      shift
      ;;
    --refresh=false)
      REFRESH_MODE="false"
      shift
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      echo "Usage: bash marketing-agent/tools/run-scenario-registry.sh [--refresh|--refresh=true]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "${SIMULATIONS_DIR}" ]]; then
  echo "Error: simulations directory not found: ${SIMULATIONS_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" && "${REFRESH_MODE}" != "true" ]]; then
  echo "Scenario registry already exists."
  echo "Generation blocked."
  echo "Hint:"
  echo "Run with --refresh to rebuild."
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

read_field_value() {
  local file_path="$1"
  local label="$2"

  awk -v target="${label}" '
    $0 == target {
      getline
      print
      exit
    }
  ' "${file_path}"
}

read_campaign_name() {
  local file_path="$1"

  awk '
    /^## Nom$/ {
      getline
      getline
      print
      exit
    }
  ' "${file_path}"
}

scenario_dirs=()
while IFS= read -r scenario_dir; do
  scenario_dirs+=("${scenario_dir}")
done < <(find "${SIMULATIONS_DIR}" -mindepth 1 -maxdepth 1 -type d -name "scenario-*" | sort)

scenarios_detected=0
healthy_count=0
warnings_count=0
errors_count=0

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

{
  echo "SCENARIO REGISTRY"
  echo
  echo "--------------------------------"
  echo

  for scenario_dir in "${scenario_dirs[@]}"; do
    scenario_name="$(basename "${scenario_dir}")"
    campaign_dir="${scenario_dir}/campaign"
    campaign_file="${campaign_dir}/campaign.md"
    campaign_items_dir="${scenario_dir}/campaign-items"
    dashboard_summary_file="${scenario_dir}/scenario-dashboard-summary.md"
    system_index_file="${scenario_dir}/system-status-index.md"

    dashboard_summary_status="MISSING"
    system_index_status="MISSING"
    campaign_name="UNKNOWN"
    campaign_items_count="0"
    overall_status="WARN"
    readiness_status="BLOCKED"
    scenario_health="warning"

    scenarios_detected=$((scenarios_detected + 1))

    if [[ -d "${campaign_dir}" && -f "${campaign_file}" ]]; then
      campaign_name="$(read_campaign_name "${campaign_file}")"
    fi

    if [[ -d "${campaign_items_dir}" ]]; then
      campaign_items_count="$(find "${campaign_items_dir}" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
    fi

    if [[ -f "${dashboard_summary_file}" ]]; then
      dashboard_summary_status="FOUND"
      overall_status="$(read_section_value "${dashboard_summary_file}" "Overall")"
      readiness_status="$(read_section_value "${dashboard_summary_file}" "Scenario Readiness")"
    fi

    if [[ -f "${system_index_file}" ]]; then
      system_index_status="FOUND"
    fi

    if [[ "${dashboard_summary_status}" == "FOUND" && \
          "${system_index_status}" == "FOUND" && \
          -d "${campaign_dir}" && \
          -d "${campaign_items_dir}" && \
          "${overall_status}" == "PASS" && \
          "${readiness_status}" == "READY FOR REAL PROVIDERS" ]]; then
      scenario_health="healthy"
      healthy_count=$((healthy_count + 1))
    elif [[ "${overall_status}" == "FAIL" ]]; then
      scenario_health="error"
      errors_count=$((errors_count + 1))
    else
      scenario_health="warning"
      warnings_count=$((warnings_count + 1))
    fi

    echo "Scenario"
    echo
    echo "${scenario_name}"
    echo
    echo "Campaign"
    echo
    echo "${campaign_name}"
    echo
    echo "Dashboard Summary"
    echo
    echo "${dashboard_summary_status}"
    echo
    echo "System Index"
    echo
    echo "${system_index_status}"
    echo
    echo "Campaign Items"
    echo
    echo "${campaign_items_count}"
    echo
    echo "Overall"
    echo
    echo "${overall_status}"
    echo
    echo "Readiness"
    echo
    echo "${readiness_status}"
    echo
    echo "--------------------------------"
    echo
  done

  global_status="PASS"
  if [[ "${errors_count}" -gt 0 ]]; then
    global_status="FAIL"
  elif [[ "${warnings_count}" -gt 0 ]]; then
    global_status="WARN"
  fi

  echo "Summary"
  echo
  echo "Scenarios detected:"
  echo "${scenarios_detected}"
  echo
  echo "Healthy:"
  echo "${healthy_count}"
  echo
  echo "Warnings:"
  echo "${warnings_count}"
  echo
  echo "Errors:"
  echo "${errors_count}"
  echo
  echo "Global Status:"
  echo "${global_status}"
  echo
  echo "Next Phase:"
  echo "Admin Dashboard"
} > "${temp_report_file}"

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"

if [[ "${REFRESH_MODE}" == "true" ]]; then
  echo
  echo "Scenario Registry refreshed."
else
  echo
  echo "Scenario Registry generated."
fi
echo "Scenarios detected: ${scenarios_detected}"
echo "Healthy: ${healthy_count}"
echo "Warnings: ${warnings_count}"
echo "Errors: ${errors_count}"
