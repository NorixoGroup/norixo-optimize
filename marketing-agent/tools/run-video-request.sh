#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-video-request.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-video-request.sh <scenario-name> --item=<item-id>" >&2
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
QA_REPORT_FILE="${ITEM_DIR}/qa-report.md"
OUTPUT_FILE="${ITEM_DIR}/video-request.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${QA_REPORT_FILE}" ]]; then
  echo "Error: campaign item QA report not found: ${QA_REPORT_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: video request already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

qa_overall_status="$(awk '/^Overall$/ { getline; getline; print; exit }' "${QA_REPORT_FILE}")"

if [[ "${qa_overall_status}" != "PASS" ]]; then
  echo "Error: campaign item QA is not PASS." >&2
  exit 1
fi

video_type="Product Demo"
platform="Website Demo"
ratio="16:9"
duration="90 seconds"
language="fr"
voice="Female"
subtitles="YES"
brand="Norixo"
visual_style="Modern SaaS"
video_goal="Present Booking Optimizer"
source_label="Campaign Item"
status="READY"
provider="TBD"

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
VIDEO REQUEST

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Video Type

${video_type}

Platform

${platform}

Ratio

${ratio}

Duration

${duration}

Language

${language}

Voice

${voice}

Subtitles

${subtitles}

Brand

${brand}

Visual Style

${visual_style}

Video Goal

${video_goal}

Source

${source_label}

Status

${status}

Provider

${provider}

--------------------------------

Ready for Video Agent
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
