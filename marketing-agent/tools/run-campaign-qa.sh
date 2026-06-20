#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-qa.sh <scenario-name>" >&2
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
CAMPAIGN_DIR="${SCENARIO_DIR}/campaign"
OUTPUT_FILE="${SCENARIO_DIR}/campaign-qa-report.md"
CAMPAIGN_FILE="${CAMPAIGN_DIR}/campaign.md"
ITEMS_FILE="${CAMPAIGN_DIR}/items.md"
CALENDAR_FILE="${CAMPAIGN_DIR}/calendar.md"
QA_FILE="${CAMPAIGN_DIR}/qa.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

missing_structure_files=()
for file in "${CAMPAIGN_FILE}" "${ITEMS_FILE}" "${CALENDAR_FILE}" "${QA_FILE}"; do
  if [[ ! -f "${file}" ]]; then
    missing_structure_files+=("${file}")
  fi
done

campaign_status="FAIL"
items_status="FAIL"
calendar_status="FAIL"
qa_status="FAIL"
promotion_status="BLOCKED"
review_status="REQUIRED"
overall_status="FAIL"

expected_items_count=0
actual_items_count=0
calendar_items_count=0
duplicate_item_ids=0

if [[ ${#missing_structure_files[@]} -eq 0 ]]; then
  campaign_status="PASS"

  expected_items_count="$(awk -F': ' '/^- 7 items prevus$/ { print 7; found=1 } END { if (!found) print 0 }' "${ITEMS_FILE}")"
  if [[ "${expected_items_count}" == "0" ]]; then
    expected_items_count="$(awk -F': ' '/items? prevus/ { gsub(/[^0-9]/, "", $0); if ($0 != "") { print $0; exit } }' "${ITEMS_FILE}")"
  fi

  actual_items_count="$(grep -c '^### [0-9]\+\. ' "${ITEMS_FILE}" || true)"
  duplicate_item_ids="$(grep '^- id : ' "${ITEMS_FILE}" | sed 's/^- id : //' | sort | uniq -d | wc -l | tr -d ' ')"

  if [[ -z "${expected_items_count}" ]]; then
    expected_items_count=0
  fi

  if [[ "${actual_items_count}" -ge 1 && "${expected_items_count}" -ge 1 && "${actual_items_count}" -eq "${expected_items_count}" && "${duplicate_item_ids}" -eq 0 ]]; then
    items_status="PASS"
  fi

  calendar_items_count="$(grep -c '^### Day ' "${CALENDAR_FILE}" || true)"
  if [[ "${calendar_items_count}" -eq "${expected_items_count}" && "${calendar_items_count}" -ge 1 ]]; then
    calendar_status="PASS"
  fi

  qa_review_value="$(awk -F': ' '/^- review requise : / { print $2; exit }' "${QA_FILE}")"
  qa_promotion_value="$(awk -F': ' '/^- promotion bloquee : / { print $2; exit }' "${QA_FILE}")"

  if [[ "${qa_review_value}" == "YES" && "${qa_promotion_value}" == "YES" ]]; then
    qa_status="PASS"
  fi
fi

if [[ "${campaign_status}" == "PASS" && "${items_status}" == "PASS" && "${calendar_status}" == "PASS" && "${qa_status}" == "PASS" ]]; then
  overall_status="PASS"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
CAMPAIGN QA REPORT

Scenario

${SCENARIO_NAME}

----------------------------

Campaign

${campaign_status}

Items

${items_status}

Calendar

${calendar_status}

QA

${qa_status}

Promotion

${promotion_status}

Review

${review_status}

----------------------------

Overall

${overall_status}

Ready for:

Content Generation
EOF

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: campaign QA report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"

if [[ ${#missing_structure_files[@]} -gt 0 ]]; then
  echo
  echo "Missing campaign files:"
  printf '%s\n' "${missing_structure_files[@]}"
fi
