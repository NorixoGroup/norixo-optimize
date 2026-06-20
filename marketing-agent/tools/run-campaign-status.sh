#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-status.sh <scenario-name>" >&2
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
OUTPUT_FILE="${SCENARIO_DIR}/campaign-status.md"
PLANNER_REPORT_FILE="${SCENARIO_DIR}/campaign-planner-report.md"
CAMPAIGN_DIR="${SCENARIO_DIR}/campaign"
CAMPAIGN_FILE="${CAMPAIGN_DIR}/campaign.md"
ITEMS_FILE="${CAMPAIGN_DIR}/items.md"
CALENDAR_FILE="${CAMPAIGN_DIR}/calendar.md"
QA_FILE="${CAMPAIGN_DIR}/qa.md"
CAMPAIGN_QA_REPORT_FILE="${SCENARIO_DIR}/campaign-qa-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: campaign status report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

planner_status="MISSING"
campaign_folder_status="MISSING"
campaign_file_status="MISSING"
items_file_status="MISSING"
calendar_file_status="MISSING"
qa_file_status="MISSING"
campaign_qa_report_status="MISSING"
campaign_qa_overall="UNKNOWN"
readiness_status="BLOCKED"
promotion_status="BLOCKED"

if [[ -f "${PLANNER_REPORT_FILE}" ]]; then
  planner_status="FOUND"
fi

if [[ -d "${CAMPAIGN_DIR}" ]]; then
  campaign_folder_status="FOUND"
fi

if [[ -f "${CAMPAIGN_FILE}" ]]; then
  campaign_file_status="FOUND"
fi

if [[ -f "${ITEMS_FILE}" ]]; then
  items_file_status="FOUND"
fi

if [[ -f "${CALENDAR_FILE}" ]]; then
  calendar_file_status="FOUND"
fi

if [[ -f "${QA_FILE}" ]]; then
  qa_file_status="FOUND"
fi

if [[ -f "${CAMPAIGN_QA_REPORT_FILE}" ]]; then
  campaign_qa_report_status="FOUND"
  campaign_qa_overall="$(awk '/^Overall$/ { getline; getline; print; exit }' "${CAMPAIGN_QA_REPORT_FILE}")"
  qa_promotion_value="$(awk '/^Promotion$/ { getline; getline; print; exit }' "${CAMPAIGN_QA_REPORT_FILE}")"

  if [[ -n "${qa_promotion_value}" ]]; then
    promotion_status="${qa_promotion_value}"
  fi
fi

if [[ "${planner_status}" == "FOUND" \
   && "${campaign_folder_status}" == "FOUND" \
   && "${campaign_file_status}" == "FOUND" \
   && "${items_file_status}" == "FOUND" \
   && "${calendar_file_status}" == "FOUND" \
   && "${qa_file_status}" == "FOUND" \
   && "${campaign_qa_report_status}" == "FOUND" \
   && "${campaign_qa_overall}" == "PASS" ]]; then
  readiness_status="READY FOR CONTENT AGENT"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
# CAMPAIGN STATUS

Scenario:
${SCENARIO_NAME}

Planner:
${planner_status}

Campaign:
${campaign_folder_status}

Files:
- campaign.md: ${campaign_file_status}
- items.md: ${items_file_status}
- calendar.md: ${calendar_file_status}
- qa.md: ${qa_file_status}

Campaign QA Report:
${campaign_qa_report_status}

Campaign QA:
${campaign_qa_overall}

Readiness:
${readiness_status}

Promotion:
${promotion_status}

Next phase:
Content Agent per campaign item
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
