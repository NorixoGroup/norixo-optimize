#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-video-storyboard-builder.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-video-storyboard-builder.sh <scenario-name> --item=<item-id>" >&2
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
VIDEO_SCRIPT_FILE="${ITEM_DIR}/video-script.md"
OUTPUT_FILE="${ITEM_DIR}/video-storyboard.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${VIDEO_SCRIPT_FILE}" ]]; then
  echo "Error: video script not found: ${VIDEO_SCRIPT_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: video storyboard already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

read_script_value() {
  local section_name="$1"
  awk -v section="${section_name}" '
    $0 == section {
      getline
      getline
      print
      exit
    }
  ' "${VIDEO_SCRIPT_FILE}"
}

voice="$(read_script_value "Voice")"
language="$(read_script_value "Language")"
estimated_duration="$(read_script_value "Estimated Duration")"
provider="$(read_script_value "Provider")"
script_status="$(read_script_value "Status")"

if [[ -z "${voice}" || -z "${language}" || -z "${estimated_duration}" ]]; then
  echo "Error: video script is incomplete." >&2
  exit 1
fi

if [[ "${script_status}" != "READY FOR STORYBOARD" ]]; then
  echo "Error: video script status is not READY FOR STORYBOARD." >&2
  exit 1
fi

if [[ -z "${provider}" ]]; then
  provider="TBD"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
VIDEO STORYBOARD

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Scene 1

Duration:
5 s

Visual:
Placeholder.

Screen Text:
Placeholder.

Voice:
Placeholder.

Transition:
Fade

Asset:
Placeholder.

--------------------------------

Scene 2

Duration:
15 s

Visual:
Placeholder.

Screen Text:
Placeholder.

Voice:
Placeholder.

Transition:
Cut

Asset:
Placeholder.

--------------------------------

Scene 3

Duration:
20 s

Visual:
Placeholder.

Screen Text:
Placeholder.

Voice:
Placeholder.

Transition:
Slide

Asset:
Placeholder.

--------------------------------

Scene 4

Duration:
20 s

Visual:
Placeholder.

Screen Text:
Placeholder.

Voice:
Placeholder.

Transition:
Fade

Asset:
Placeholder.

--------------------------------

Scene 5

Duration:
30 s

Visual:
Placeholder.

Screen Text:
Placeholder.

Voice:
Placeholder.

Transition:
Fade Out

Asset:
Placeholder.

--------------------------------

Provider

${provider}

Status

READY FOR VIDEO QA
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
