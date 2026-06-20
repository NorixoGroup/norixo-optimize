#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-analytics-status.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-analytics-status.sh <scenario-name> --item=<item-id>" >&2
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
ANALYTICS_REQUEST_FILE="${ITEM_DIR}/analytics-request.md"
ANALYTICS_QA_REPORT_FILE="${ITEM_DIR}/analytics-qa-report.md"
ANALYTICS_PROVIDER_REPORT_FILE="${ITEM_DIR}/analytics-provider-report.md"
OUTPUT_FILE="${ITEM_DIR}/analytics-status.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: analytics status report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

analytics_request_status="MISSING"
analytics_qa_status="UNKNOWN"
provider_name="UNKNOWN"
provider_status="UNKNOWN"
collection_status="UNKNOWN"
network_status="UNKNOWN"
overall_status="FAIL"
ready_for_real_provider="NO"

if [[ -f "${ANALYTICS_REQUEST_FILE}" ]]; then
  analytics_request_status="FOUND"
fi

if [[ -f "${ANALYTICS_QA_REPORT_FILE}" ]]; then
  analytics_qa_status="$(awk '/^Overall$/ { getline; getline; print; exit }' "${ANALYTICS_QA_REPORT_FILE}")"
fi

read_provider_value() {
  local label="$1"
  awk -v target="${label}" '
    $0 == target {
      getline
      print
      exit
    }
  ' "${ANALYTICS_PROVIDER_REPORT_FILE}"
}

if [[ -f "${ANALYTICS_PROVIDER_REPORT_FILE}" ]]; then
  provider_name="$(read_provider_value "Provider:")"
  provider_status="$(read_provider_value "Status:")"
  collection_status="$(read_provider_value "Collection:")"
  network_status="$(read_provider_value "Network:")"
  ready_for_real_provider="$(read_provider_value "Ready for real analytics provider:")"
fi

if [[ "${analytics_request_status}" == "FOUND" && "${analytics_qa_status}" == "PASS" && "${provider_name}" != "UNKNOWN" && "${provider_status}" == "READY" ]]; then
  overall_status="PASS"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
ANALYTICS STATUS

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Analytics Request

${analytics_request_status}

Analytics QA

${analytics_qa_status}

Analytics Provider

${provider_name}

Provider Status

${provider_status}

Collection

${collection_status}

Network

${network_status}

--------------------------------

Overall

${overall_status}

Ready for Real Analytics Provider

${ready_for_real_provider}

Next Phase

Real Analytics Collection
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
