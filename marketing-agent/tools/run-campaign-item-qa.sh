#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-item-qa.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-campaign-item-qa.sh <scenario-name> --item=<item-id>" >&2
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
OUTPUT_FILE="${ITEM_DIR}/qa-report.md"
MASTER_FILE="${ITEM_DIR}/master-content.md"
FACEBOOK_FILE="${ITEM_DIR}/facebook.md"
INSTAGRAM_FILE="${ITEM_DIR}/instagram.md"
SNAPCHAT_FILE="${ITEM_DIR}/snapchat.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: campaign item QA report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

master_status="FAIL"
facebook_status="FAIL"
instagram_status="FAIL"
snapchat_status="FAIL"
overall_status="FAIL"
promotion_status="BLOCKED"

if [[ -f "${MASTER_FILE}" ]]; then
  master_status="PASS"
fi

if [[ -f "${FACEBOOK_FILE}" ]]; then
  facebook_status="PASS"
fi

if [[ -f "${INSTAGRAM_FILE}" ]]; then
  instagram_status="PASS"
fi

if [[ -f "${SNAPCHAT_FILE}" ]]; then
  snapchat_status="PASS"
fi

if [[ "${master_status}" == "PASS" && "${facebook_status}" == "PASS" && "${instagram_status}" == "PASS" && "${snapchat_status}" == "PASS" ]]; then
  overall_status="PASS"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
CAMPAIGN ITEM QA REPORT

Scenario

${SCENARIO_NAME}

Item

${ITEM_ID}

-----------------------

Master Content

${master_status}

Facebook

${facebook_status}

Instagram

${instagram_status}

Snapchat

${snapchat_status}

-----------------------

Overall

${overall_status}

Ready for:

Real Content Generation

Promotion:

${promotion_status}
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
