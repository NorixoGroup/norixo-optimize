#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-learning-input.sh <scenario-name> --item=<item-id>" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --item=*)
      ITEM_ID="${1#--item=}"
      shift
      ;;
    --item)
      ITEM_ID="${2:-}"
      shift 2
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! "${SCENARIO_NAME}" =~ ^scenario-[0-9]{3}-[a-z0-9-]+$ ]]; then
  echo "Error: invalid scenario name: ${SCENARIO_NAME}" >&2
  echo "Expected format: scenario-XXX-slug" >&2
  exit 1
fi

if [[ "${SCENARIO_NAME}" == *".."* ]] || [[ "${SCENARIO_NAME}" == */* ]]; then
  echo "Error: unsafe scenario name." >&2
  exit 1
fi

if [[ -z "${ITEM_ID}" ]]; then
  echo "Error: missing item identifier." >&2
  echo "Usage: bash marketing-agent/tools/run-learning-input.sh <scenario-name> --item=<item-id>" >&2
  exit 1
fi

if [[ "${ITEM_ID}" == *".."* ]] || [[ "${ITEM_ID}" == */* ]]; then
  echo "Error: unsafe item identifier." >&2
  exit 1
fi

if [[ ! "${ITEM_ID}" =~ ^campaign-item-[0-9]{3}$ ]]; then
  echo "Error: invalid campaign item identifier: ${ITEM_ID}" >&2
  echo "Expected format: campaign-item-XXX" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
ITEM_DIR="${SCENARIO_DIR}/campaign-items/${ITEM_ID}"
ANALYTICS_STATUS_FILE="${ITEM_DIR}/analytics-status.md"
ANALYTICS_REQUEST_FILE="${ITEM_DIR}/analytics-request.md"
OUTPUT_FILE="${ITEM_DIR}/learning-input.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_STATUS_FILE}" ]]; then
  echo "Error: analytics status not found: ${ANALYTICS_STATUS_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_REQUEST_FILE}" ]]; then
  echo "Error: analytics request not found: ${ANALYTICS_REQUEST_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: learning input already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

analytics_overall_status="$(awk '/^Overall$/ { getline; getline; print; exit }' "${ANALYTICS_STATUS_FILE}")"

if [[ "${analytics_overall_status}" != "PASS" ]]; then
  echo "Error: analytics status is not PASS." >&2
  exit 1
fi

read_section_value() {
  local field_name="$1"
  awk -v field="${field_name}" '
    $0 == field {
      getline
      getline
      print
      exit
    }
  ' "${ANALYTICS_REQUEST_FILE}"
}

analytics_status="READY"
campaign_name="$(read_section_value "Campaign")"
platform="$(read_section_value "Platform")"
locale="$(read_section_value "Locale")"
time_window="$(read_section_value "Time Window")"
learning_scope="Standard"
status="READY FOR LEARNING QA"

if [[ -z "${campaign_name}" || -z "${platform}" || -z "${locale}" || -z "${time_window}" ]]; then
  echo "Error: missing required analytics request metadata." >&2
  exit 1
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
LEARNING INPUT

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Analytics

${analytics_status}

Campaign

${campaign_name}

Platform

${platform}

Locale

${locale}

Time Window

${time_window}

Learning Scope

${learning_scope}

Status

${status}
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
