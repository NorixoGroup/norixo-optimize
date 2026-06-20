#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-video-script-builder.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-video-script-builder.sh <scenario-name> --item=<item-id>" >&2
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
VIDEO_REQUEST_FILE="${ITEM_DIR}/video-request.md"
OUTPUT_FILE="${ITEM_DIR}/video-script.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${VIDEO_REQUEST_FILE}" ]]; then
  echo "Error: video request not found: ${VIDEO_REQUEST_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: video script already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

read_request_value() {
  local section_name="$1"
  awk -v section="${section_name}" '
    $0 == section {
      getline
      getline
      print
      exit
    }
  ' "${VIDEO_REQUEST_FILE}"
}

video_type="$(read_request_value "Video Type")"
platform="$(read_request_value "Platform")"
duration="$(read_request_value "Duration")"
language="$(read_request_value "Language")"
voice="$(read_request_value "Voice")"
subtitles="$(read_request_value "Subtitles")"
brand="$(read_request_value "Brand")"
video_goal="$(read_request_value "Video Goal")"
provider="$(read_request_value "Provider")"
request_status="$(read_request_value "Status")"

if [[ -z "${video_type}" || -z "${platform}" || -z "${duration}" || -z "${language}" || -z "${voice}" || -z "${subtitles}" || -z "${brand}" || -z "${video_goal}" ]]; then
  echo "Error: video request is incomplete." >&2
  exit 1
fi

if [[ "${request_status}" != "READY" ]]; then
  echo "Error: video request status is not READY." >&2
  exit 1
fi

if [[ -z "${provider}" ]]; then
  provider="TBD"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
VIDEO SCRIPT

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Hook

Placeholder.

Problem

Placeholder.

Solution

Placeholder.

Demonstration

Placeholder.

Benefits

Placeholder.

Call To Action

Placeholder.

Voice

${voice}

Language

${language}

Subtitles

${subtitles}

Estimated Duration

${duration}

Provider

${provider}

Status

READY FOR STORYBOARD
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
