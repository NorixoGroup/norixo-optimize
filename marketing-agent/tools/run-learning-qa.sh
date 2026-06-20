#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-learning-qa.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-learning-qa.sh <scenario-name> --item=<item-id>" >&2
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
LEARNING_INPUT_FILE="${ITEM_DIR}/learning-input.md"
OUTPUT_FILE="${ITEM_DIR}/learning-qa-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: learning QA report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

learning_input_status="FAIL"
required_fields_status="FAIL"
analytics_status="UNKNOWN"
learning_status="NOT EXECUTED"
decision_status="BLOCKED"
overall_status="FAIL"

if [[ -f "${LEARNING_INPUT_FILE}" ]]; then
  learning_input_status="PASS"
fi

has_section_field() {
  local field_name="$1"
  awk -v field="${field_name}" '
    $0 == field {
      getline
      getline
      if (length($0) > 0) {
        found = 1
      }
      exit
    }
    END {
      if (found == 1) {
        exit 0
      }
      exit 1
    }
  ' "${LEARNING_INPUT_FILE}"
}

read_section_value() {
  local field_name="$1"
  awk -v field="${field_name}" '
    $0 == field {
      getline
      getline
      print
      exit
    }
  ' "${LEARNING_INPUT_FILE}"
}

if [[ "${learning_input_status}" == "PASS" ]]; then
  required_fields_ok="YES"

  for field_name in "Analytics" "Campaign" "Platform" "Locale" "Time Window" "Learning Scope" "Status"; do
    if ! has_section_field "${field_name}"; then
      required_fields_ok="NO"
      break
    fi
  done

  if [[ "${required_fields_ok}" == "YES" ]]; then
    required_fields_status="PASS"
  fi

  analytics_status="$(read_section_value "Analytics")"
  request_status="$(read_section_value "Status")"

  if [[ "${required_fields_status}" == "PASS" && "${analytics_status}" == "READY" && "${request_status}" == "READY FOR LEARNING QA" ]]; then
    overall_status="PASS"
  fi
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
LEARNING QA REPORT

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Learning Input

${learning_input_status}

Required Fields

${required_fields_status}

Analytics

${analytics_status}

Learning

${learning_status}

Decision

${decision_status}

--------------------------------

Overall

${overall_status}

Ready for

Learning Provider
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
