#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-video-qa.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-video-qa.sh <scenario-name> --item=<item-id>" >&2
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
VIDEO_SCRIPT_FILE="${ITEM_DIR}/video-script.md"
VIDEO_STORYBOARD_FILE="${ITEM_DIR}/video-storyboard.md"
OUTPUT_FILE="${ITEM_DIR}/video-qa-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: video QA report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

video_request_status="FAIL"
video_script_status="FAIL"
storyboard_status="FAIL"
required_fields_status="FAIL"
scene_count_status="FAIL"
provider_status="NOT EXECUTED"
generation_status="BLOCKED"
overall_status="FAIL"

if [[ -f "${VIDEO_REQUEST_FILE}" ]]; then
  video_request_status="PASS"
fi

if [[ -f "${VIDEO_SCRIPT_FILE}" ]]; then
  video_script_status="PASS"
fi

if [[ -f "${VIDEO_STORYBOARD_FILE}" ]]; then
  storyboard_status="PASS"
fi

has_section_field() {
  local file_path="$1"
  local field_name="$2"
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
  ' "${file_path}"
}

scene_count=0
if [[ "${storyboard_status}" == "PASS" ]]; then
  scene_count="$(awk '/^Scene [0-9]+$/ { count++ } END { print count + 0 }' "${VIDEO_STORYBOARD_FILE}")"
fi

if [[ "${video_request_status}" == "PASS" && "${video_script_status}" == "PASS" && "${storyboard_status}" == "PASS" ]]; then
  request_fields_ok="YES"
  script_fields_ok="YES"
  storyboard_fields_ok="YES"

  for field_name in "Video Type" "Platform" "Duration" "Language" "Voice" "Subtitles" "Brand" "Status"; do
    if ! has_section_field "${VIDEO_REQUEST_FILE}" "${field_name}"; then
      request_fields_ok="NO"
      break
    fi
  done

  for field_name in "Hook" "Problem" "Solution" "Demonstration" "Benefits" "Call To Action" "Status"; do
    if ! has_section_field "${VIDEO_SCRIPT_FILE}" "${field_name}"; then
      script_fields_ok="NO"
      break
    fi
  done

  for field_name in "Provider" "Status"; do
    if ! has_section_field "${VIDEO_STORYBOARD_FILE}" "${field_name}"; then
      storyboard_fields_ok="NO"
      break
    fi
  done

  if [[ "${request_fields_ok}" == "YES" && "${script_fields_ok}" == "YES" && "${storyboard_fields_ok}" == "YES" ]]; then
    required_fields_status="PASS"
  fi

  if [[ "${scene_count}" -ge 5 ]]; then
    scene_count_status="PASS"
  fi

  if [[ "${required_fields_status}" == "PASS" && "${scene_count_status}" == "PASS" ]]; then
    overall_status="PASS"
  fi
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
VIDEO QA REPORT

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Video Request

${video_request_status}

Video Script

${video_script_status}

Storyboard

${storyboard_status}

Required Fields

${required_fields_status}

Scene Count

${scene_count_status}

Provider

${provider_status}

Generation

${generation_status}

--------------------------------

Overall

${overall_status}

Ready for

Video Provider
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
