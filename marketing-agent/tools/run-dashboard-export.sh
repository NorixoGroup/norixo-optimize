#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
DASHBOARD_DATA_DIR="${MARKETING_AGENT_DIR}/dashboard-data"
REGISTRY_FILE="${SIMULATIONS_DIR}/scenario-registry.md"
OUTPUT_FILE="${DASHBOARD_DATA_DIR}/scenario-registry.json"
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
      echo "Usage: bash marketing-agent/tools/run-dashboard-export.sh [--refresh|--refresh=true]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${REGISTRY_FILE}" ]]; then
  echo "Error: scenario registry not found: ${REGISTRY_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" && "${REFRESH_MODE}" != "true" ]]; then
  echo "Dashboard export already exists."
  echo "Generation blocked."
  echo "Hint:"
  echo "Run with --refresh to rebuild."
  exit 1
fi

mkdir -p "${DASHBOARD_DATA_DIR}"

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

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
global_status="$(read_field_value "${REGISTRY_FILE}" "Global Status:")"
scenarios_count="$(read_field_value "${REGISTRY_FILE}" "Scenarios detected:")"
healthy_count="$(read_field_value "${REGISTRY_FILE}" "Healthy:")"
warnings_count="$(read_field_value "${REGISTRY_FILE}" "Warnings:")"
errors_count="$(read_field_value "${REGISTRY_FILE}" "Errors:")"

scenario_rows=()
while IFS= read -r row; do
  scenario_rows+=("${row}")
done < <(
  awk '
    function reset_scenario() {
      scenario = ""
      campaign = "UNKNOWN"
      dashboard_summary = "MISSING"
      system_index = "MISSING"
      campaign_items = "0"
      overall = "WARN"
      readiness = "BLOCKED"
      current = ""
    }

    function flush_scenario() {
      if (scenario != "") {
        print scenario "\t" campaign "\t" dashboard_summary "\t" system_index "\t" campaign_items "\t" overall "\t" readiness
      }
    }

    BEGIN {
      reset_scenario()
    }

    $0 == "Scenario" {
      flush_scenario()
      reset_scenario()
      current = "Scenario"
      next
    }

    $0 == "Campaign" {
      current = "Campaign"
      next
    }

    $0 == "Dashboard Summary" {
      current = "Dashboard Summary"
      next
    }

    $0 == "System Index" {
      current = "System Index"
      next
    }

    $0 == "Campaign Items" {
      current = "Campaign Items"
      next
    }

    $0 == "Overall" {
      current = "Overall"
      next
    }

    $0 == "Readiness" {
      current = "Readiness"
      next
    }

    $0 == "Summary" {
      flush_scenario()
      exit
    }

    NF == 0 {
      next
    }

    current == "Scenario" {
      scenario = $0
      current = ""
      next
    }

    current == "Campaign" {
      campaign = $0
      current = ""
      next
    }

    current == "Dashboard Summary" {
      dashboard_summary = $0
      current = ""
      next
    }

    current == "System Index" {
      system_index = $0
      current = ""
      next
    }

    current == "Campaign Items" {
      campaign_items = $0
      current = ""
      next
    }

    current == "Overall" {
      overall = $0
      current = ""
      next
    }

    current == "Readiness" {
      readiness = $0
      current = ""
      next
    }
  ' "${REGISTRY_FILE}"
)

temp_output_file="$(mktemp)"
trap 'rm -f "${temp_output_file}"' EXIT

{
  echo "{"
  echo "  \"generatedAt\": \"$(json_escape "${generated_at}")\","
  echo "  \"globalStatus\": \"$(json_escape "${global_status}")\","
  echo "  \"summary\": {"
  echo "    \"scenarios\": ${scenarios_count},"
  echo "    \"healthy\": ${healthy_count},"
  echo "    \"warnings\": ${warnings_count},"
  echo "    \"errors\": ${errors_count}"
  echo "  },"
  echo "  \"scenarios\": ["

  scenario_total="${#scenario_rows[@]}"
  scenario_index=0
  for row in "${scenario_rows[@]}"; do
    IFS=$'\t' read -r scenario_id campaign_name dashboard_summary system_index campaign_items status readiness <<< "${row}"
    scenario_index=$((scenario_index + 1))
    trailing_comma=","
    if [[ "${scenario_index}" -eq "${scenario_total}" ]]; then
      trailing_comma=""
    fi

    echo "    {"
    echo "      \"id\": \"$(json_escape "${scenario_id}")\","
    echo "      \"campaign\": \"$(json_escape "${campaign_name}")\","
    echo "      \"dashboardSummary\": \"$(json_escape "${dashboard_summary}")\","
    echo "      \"systemIndex\": \"$(json_escape "${system_index}")\","
    echo "      \"campaignItems\": ${campaign_items},"
    echo "      \"status\": \"$(json_escape "${status}")\","
    echo "      \"readiness\": \"$(json_escape "${readiness}")\""
    echo "    }${trailing_comma}"
  done

  echo "  ]"
  echo "}"
} > "${temp_output_file}"

cp "${temp_output_file}" "${OUTPUT_FILE}"

cat "${temp_output_file}"

if [[ "${REFRESH_MODE}" == "true" ]]; then
  echo
  echo "Dashboard export refreshed."
else
  echo
  echo "Dashboard export generated."
fi
echo "Scenarios detected: ${scenarios_count}"
echo "Healthy: ${healthy_count}"
echo "Warnings: ${warnings_count}"
echo "Errors: ${errors_count}"
