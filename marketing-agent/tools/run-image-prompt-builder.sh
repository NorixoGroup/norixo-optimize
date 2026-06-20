#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-image-prompt-builder.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-image-prompt-builder.sh <scenario-name> --item=<item-id>" >&2
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
IMAGE_REQUEST_FILE="${ITEM_DIR}/image-request.md"
OUTPUT_FILE="${ITEM_DIR}/image-prompt.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ ! -f "${IMAGE_REQUEST_FILE}" ]]; then
  echo "Error: image request not found: ${IMAGE_REQUEST_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: image prompt already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

read_section_value() {
  local section_name="$1"
  awk -v section="${section_name}" '
    $0 == section {
      getline
      getline
      print
      exit
    }
  ' "${IMAGE_REQUEST_FILE}"
}

image_type="$(read_section_value "Image Type")"
platform="$(read_section_value "Platform")"
ratio="$(read_section_value "Ratio")"
resolution="$(read_section_value "Resolution")"
language="$(read_section_value "Language")"
overlay="$(read_section_value "Overlay")"
brand="$(read_section_value "Brand")"
visual_goal="$(read_section_value "Visual Goal")"
negative_prompt="$(read_section_value "Negative Prompt")"
request_status="$(read_section_value "Status")"

if [[ -z "${image_type}" || -z "${platform}" || -z "${ratio}" || -z "${resolution}" || -z "${language}" || -z "${overlay}" || -z "${brand}" || -z "${visual_goal}" ]]; then
  echo "Error: image request is incomplete." >&2
  exit 1
fi

if [[ "${request_status}" != "READY" ]]; then
  echo "Error: image request status is not READY." >&2
  exit 1
fi

overlay_text="None"
if [[ "${overlay}" == "YES" ]]; then
  overlay_text="Booking Optimizer"
fi

visual_direction="Modern SaaS marketing visual for a short-term rental optimization tool."
main_scene="A clean dashboard-inspired visual showing a rental listing being improved."
composition="Centered layout, strong headline area, subtle UI cards, premium SaaS aesthetic."
style="Professional, modern, clean, trustworthy, high-contrast."

if [[ "${negative_prompt}" == "Placeholder." ]]; then
  negative_prompt="No clutter, no unrealistic people, no fake logos, no unreadable text, no distorted UI."
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
# IMAGE PROMPT

Scenario:
${SCENARIO_NAME}

Campaign Item:
${ITEM_ID}

Image Type:
${image_type}

Platform:
${platform}

Ratio:
${ratio}

Resolution:
${resolution}

Language:
${language}

Brand:
${brand}

Visual Goal:
${visual_goal}

Visual Direction:
${visual_direction}

Main Scene:
${main_scene}

Composition:
${composition}

Overlay Text:
${overlay_text}

Style:
${style}

Negative Prompt:
${negative_prompt}

Provider:
TBD

Status:
READY FOR IMAGE PROVIDER
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
