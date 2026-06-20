#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
ANALYTICS_PROVIDER_SCRIPT="${MARKETING_AGENT_DIR}/providers/analytics/mock/provider.sh"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-analytics-provider.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-analytics-provider.sh <scenario-name> --item=<item-id>" >&2
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
OUTPUT_FILE="${ITEM_DIR}/analytics-provider-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_REQUEST_FILE}" ]]; then
  echo "Error: analytics request not found: ${ANALYTICS_REQUEST_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_QA_REPORT_FILE}" ]]; then
  echo "Error: analytics QA report not found: ${ANALYTICS_QA_REPORT_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ANALYTICS_PROVIDER_SCRIPT}" ]]; then
  echo "Error: mock analytics provider not found: ${ANALYTICS_PROVIDER_SCRIPT}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: analytics provider report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

qa_overall_status="$(awk '/^Overall$/ { getline; getline; print; exit }' "${ANALYTICS_QA_REPORT_FILE}")"

if [[ "${qa_overall_status}" != "PASS" ]]; then
  echo "Error: analytics QA is not PASS." >&2
  exit 1
fi

provider_output="$(bash "${ANALYTICS_PROVIDER_SCRIPT}" "${ANALYTICS_REQUEST_FILE}")"
provider_name="$(printf '%s\n' "${provider_output}" | awk -F': ' '/^Provider:/ { print $2; exit }')"
provider_status="$(printf '%s\n' "${provider_output}" | awk -F': ' '/^Status:/ { print $2; exit }')"
collection_status="$(printf '%s\n' "${provider_output}" | awk -F': ' '/^Collection:/ { print $2; exit }')"
network_status="$(printf '%s\n' "${provider_output}" | awk -F': ' '/^Network:/ { print $2; exit }')"
report_path="$(printf '%s\n' "${provider_output}" | awk -F': ' '/^Report Path:/ { print $2; exit }')"

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
ANALYTICS PROVIDER REPORT

Scenario:
${SCENARIO_NAME}

Campaign Item:
${ITEM_ID}

Provider:
${provider_name}

Status:
${provider_status}

Collection:
${collection_status}

Network:
${network_status}

Report Path:
${report_path}

Ready for real analytics provider:
YES
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
