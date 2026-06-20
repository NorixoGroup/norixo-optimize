#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ID=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-system-status.sh <scenario-name> --item=<item-id>" >&2
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
  echo "Usage: bash marketing-agent/tools/run-system-status.sh <scenario-name> --item=<item-id>" >&2
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
CAMPAIGN_ITEM_QA_FILE="${ITEM_DIR}/qa-report.md"
IMAGE_STATUS_FILE="${ITEM_DIR}/image-status.md"
VIDEO_STATUS_FILE="${ITEM_DIR}/video-status.md"
PUBLICATION_STATUS_FILE="${ITEM_DIR}/publication-status.md"
ANALYTICS_STATUS_FILE="${ITEM_DIR}/analytics-status.md"
LEARNING_STATUS_FILE="${ITEM_DIR}/learning-status.md"
OUTPUT_FILE="${ITEM_DIR}/system-status.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${ITEM_DIR}" ]]; then
  echo "Error: campaign item directory not found: ${ITEM_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: system status report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

read_section_value() {
  local file_path="$1"
  local label="$2"

  awk -v target="${label}" '
    $0 == target {
      getline
      getline
      print
      exit
    }
  ' "${file_path}"
}

campaign_item_qa_status="FAIL"
image_status="FAIL"
video_status="FAIL"
publication_status="FAIL"
analytics_status="FAIL"
learning_status="FAIL"

image_provider="UNKNOWN"
video_provider="UNKNOWN"
publication_provider="UNKNOWN"
analytics_provider="UNKNOWN"
learning_provider="UNKNOWN"

content_execution="BLOCKED"
image_generation_status="UNKNOWN"
video_generation_status="UNKNOWN"
publication_execution_status="UNKNOWN"
analytics_collection_status="UNKNOWN"
learning_execution_status="UNKNOWN"
decision_execution_status="UNKNOWN"

if [[ -f "${CAMPAIGN_ITEM_QA_FILE}" ]]; then
  campaign_item_qa_status="$(read_section_value "${CAMPAIGN_ITEM_QA_FILE}" "Overall")"
fi

if [[ -f "${IMAGE_STATUS_FILE}" ]]; then
  image_status="$(read_section_value "${IMAGE_STATUS_FILE}" "Overall")"
  image_provider="$(read_section_value "${IMAGE_STATUS_FILE}" "Image Provider")"
  image_generation_status="$(read_section_value "${IMAGE_STATUS_FILE}" "Generation")"
fi

if [[ -f "${VIDEO_STATUS_FILE}" ]]; then
  video_status="$(read_section_value "${VIDEO_STATUS_FILE}" "Overall")"
  video_provider="$(read_section_value "${VIDEO_STATUS_FILE}" "Video Provider")"
  video_generation_status="$(read_section_value "${VIDEO_STATUS_FILE}" "Generation")"
fi

if [[ -f "${PUBLICATION_STATUS_FILE}" ]]; then
  publication_status="$(read_section_value "${PUBLICATION_STATUS_FILE}" "Overall")"
  publication_provider="$(read_section_value "${PUBLICATION_STATUS_FILE}" "Publication Provider")"
  publication_execution_status="$(read_section_value "${PUBLICATION_STATUS_FILE}" "Publication")"
fi

if [[ -f "${ANALYTICS_STATUS_FILE}" ]]; then
  analytics_status="$(read_section_value "${ANALYTICS_STATUS_FILE}" "Overall")"
  analytics_provider="$(read_section_value "${ANALYTICS_STATUS_FILE}" "Analytics Provider")"
  analytics_collection_status="$(read_section_value "${ANALYTICS_STATUS_FILE}" "Collection")"
fi

if [[ -f "${LEARNING_STATUS_FILE}" ]]; then
  learning_status="$(read_section_value "${LEARNING_STATUS_FILE}" "Overall")"
  learning_provider="$(read_section_value "${LEARNING_STATUS_FILE}" "Learning Provider")"
  learning_execution_status="$(read_section_value "${LEARNING_STATUS_FILE}" "Learning")"
  decision_execution_status="$(read_section_value "${LEARNING_STATUS_FILE}" "Decision")"
fi

if [[ "${campaign_item_qa_status}" == "PASS" ]]; then
  content_execution="READY"
fi

overall_status="FAIL"
system_readiness="BLOCKED"

if [[ "${campaign_item_qa_status}" == "PASS" && \
      "${image_status}" == "PASS" && \
      "${video_status}" == "PASS" && \
      "${publication_status}" == "PASS" && \
      "${analytics_status}" == "PASS" && \
      "${learning_status}" == "PASS" ]]; then
  overall_status="PASS"
  system_readiness="READY FOR REAL PROVIDERS"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
SYSTEM STATUS

Scenario

${SCENARIO_NAME}

Campaign Item

${ITEM_ID}

--------------------------------

Campaign Item QA

${campaign_item_qa_status}

Image

${image_status}

Video

${video_status}

Publication

${publication_status}

Analytics

${analytics_status}

Learning

${learning_status}

--------------------------------

Providers

Image Provider:
${image_provider}

Video Provider:
${video_provider}

Publication Provider:
${publication_provider}

Analytics Provider:
${analytics_provider}

Learning Provider:
${learning_provider}

--------------------------------

Execution

Content:
${content_execution}

Image Generation:
${image_generation_status}

Video Generation:
${video_generation_status}

Publication:
${publication_execution_status}

Analytics Collection:
${analytics_collection_status}

Learning:
${learning_execution_status}

Decision:
${decision_execution_status}

--------------------------------

Overall

${overall_status}

System Readiness

${system_readiness}

Next Phase

Provider Integration / Admin Dashboard
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
