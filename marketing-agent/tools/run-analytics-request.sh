#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-analytics-request.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-analytics-request.sh <scenario-name> --item=<item-id>" >&2
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
CAMPAIGN_FILE="${SCENARIO_DIR}/campaign/campaign.md"
PUBLICATION_STATUS_FILE="${ITEM_DIR}/publication-status.md"
OUTPUT_FILE="${ITEM_DIR}/analytics-request.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${PUBLICATION_STATUS_FILE}" ]]; then
  echo "Error: publication status not found: ${PUBLICATION_STATUS_FILE}" >&2
  exit 1
fi

if [[ ! -f "${CAMPAIGN_FILE}" ]]; then
  echo "Error: campaign file not found: ${CAMPAIGN_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: analytics request already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

publication_overall_status="$(awk '/^Overall$/ { getline; getline; print; exit }' "${PUBLICATION_STATUS_FILE}")"

if [[ "${publication_overall_status}" != "PASS" ]]; then
  echo "Error: publication status is not PASS." >&2
  exit 1
fi

campaign_name="$(awk '/^## Nom$/ { getline; getline; print; exit }' "${CAMPAIGN_FILE}")"

if [[ -z "${campaign_name}" ]]; then
  echo "Error: campaign name not found in ${CAMPAIGN_FILE}" >&2
  exit 1
fi

publication_status="READY"
platform="Website"
locale="fr"
time_window="Last 7 Days"
metrics="Standard"
provider="TBD"
status="READY FOR ANALYTICS QA"

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
ANALYTICS REQUEST

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Publication

${publication_status}

Platform

${platform}

Locale

${locale}

Campaign

${campaign_name}

Time Window

${time_window}

Metrics

${metrics}

Provider

${provider}

Status

${status}
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
