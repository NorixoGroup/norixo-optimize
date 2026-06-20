#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-scenario-dashboard-summary.sh <scenario-name>" >&2
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
CAMPAIGN_FILE="${SCENARIO_DIR}/campaign/campaign.md"
CAMPAIGN_ITEMS_DIR="${SCENARIO_DIR}/campaign-items"
SYSTEM_STATUS_INDEX_FILE="${SCENARIO_DIR}/system-status-index.md"
OUTPUT_FILE="${SCENARIO_DIR}/scenario-dashboard-summary.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${CAMPAIGN_ITEMS_DIR}" ]]; then
  echo "Error: campaign items directory not found: ${CAMPAIGN_ITEMS_DIR}" >&2
  exit 1
fi

if [[ ! -f "${CAMPAIGN_FILE}" ]]; then
  echo "Error: campaign file not found: ${CAMPAIGN_FILE}" >&2
  exit 1
fi

if [[ ! -f "${SYSTEM_STATUS_INDEX_FILE}" ]]; then
  echo "Error: system status index not found: ${SYSTEM_STATUS_INDEX_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: scenario dashboard summary already exists: ${OUTPUT_FILE}" >&2
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

read_field_value() {
  local file_path="$1"
  local label="$2"

  awk -v target="${label}" '
    $0 == target {
      getline
      print
      exit
    }
  ' "${file_path}"
}

campaign_name="$(awk '
  /^## Nom$/ {
    getline
    getline
    print
    exit
  }
' "${CAMPAIGN_FILE}")"

items_detected="$(read_field_value "${SYSTEM_STATUS_INDEX_FILE}" "Items detected:")"
items_pass="$(read_field_value "${SYSTEM_STATUS_INDEX_FILE}" "Items PASS:")"
items_missing="$(read_field_value "${SYSTEM_STATUS_INDEX_FILE}" "Items MISSING STATUS:")"
items_fail="$(read_field_value "${SYSTEM_STATUS_INDEX_FILE}" "Items FAIL:")"
overall_status="$(read_field_value "${SYSTEM_STATUS_INDEX_FILE}" "Overall:")"

content_engine="BLOCKED"
image_engine="BLOCKED"
video_engine="BLOCKED"
publication_engine="BLOCKED"
analytics_engine="BLOCKED"
learning_engine="BLOCKED"

image_providers=""
video_providers=""
publication_providers=""
analytics_providers=""
learning_providers=""

add_unique_provider() {
  local value="$1"
  local current_list="$2"

  if [[ -z "${value}" || "${value}" == "UNKNOWN" ]]; then
    echo "${current_list}"
    return
  fi

  if [[ -z "${current_list}" ]]; then
    echo "${value}"
    return
  fi

  case "|${current_list}|" in
    *"|${value}|"*)
      echo "${current_list}"
      ;;
    *)
      echo "${current_list}|${value}"
      ;;
  esac
}

all_content_pass="YES"
all_image_pass="YES"
all_video_pass="YES"
all_publication_pass="YES"
all_analytics_pass="YES"
all_learning_pass="YES"
all_readiness_pass="YES"

item_dirs=()
while IFS= read -r item_dir; do
  item_dirs+=("${item_dir}")
done < <(find "${CAMPAIGN_ITEMS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

for item_dir in "${item_dirs[@]}"; do
  status_file="${item_dir}/system-status.md"

  if [[ ! -f "${status_file}" ]]; then
    all_content_pass="NO"
    all_image_pass="NO"
    all_video_pass="NO"
    all_publication_pass="NO"
    all_analytics_pass="NO"
    all_learning_pass="NO"
    all_readiness_pass="NO"
    continue
  fi

  campaign_item_qa_status="$(read_section_value "${status_file}" "Campaign Item QA")"
  image_status="$(read_section_value "${status_file}" "Image")"
  video_status="$(read_section_value "${status_file}" "Video")"
  publication_status="$(read_section_value "${status_file}" "Publication")"
  analytics_status="$(read_section_value "${status_file}" "Analytics")"
  learning_status="$(read_section_value "${status_file}" "Learning")"
  system_readiness="$(read_section_value "${status_file}" "System Readiness")"

  if [[ "${campaign_item_qa_status}" != "PASS" ]]; then
    all_content_pass="NO"
  fi
  if [[ "${image_status}" != "PASS" ]]; then
    all_image_pass="NO"
  fi
  if [[ "${video_status}" != "PASS" ]]; then
    all_video_pass="NO"
  fi
  if [[ "${publication_status}" != "PASS" ]]; then
    all_publication_pass="NO"
  fi
  if [[ "${analytics_status}" != "PASS" ]]; then
    all_analytics_pass="NO"
  fi
  if [[ "${learning_status}" != "PASS" ]]; then
    all_learning_pass="NO"
  fi
  if [[ "${system_readiness}" != "READY FOR REAL PROVIDERS" ]]; then
    all_readiness_pass="NO"
  fi

  image_providers="$(add_unique_provider "$(read_field_value "${status_file}" "Image Provider:")" "${image_providers}")"
  video_providers="$(add_unique_provider "$(read_field_value "${status_file}" "Video Provider:")" "${video_providers}")"
  publication_providers="$(add_unique_provider "$(read_field_value "${status_file}" "Publication Provider:")" "${publication_providers}")"
  analytics_providers="$(add_unique_provider "$(read_field_value "${status_file}" "Analytics Provider:")" "${analytics_providers}")"
  learning_providers="$(add_unique_provider "$(read_field_value "${status_file}" "Learning Provider:")" "${learning_providers}")"
done

if [[ "${all_content_pass}" == "YES" ]]; then
  content_engine="READY"
fi
if [[ "${all_image_pass}" == "YES" ]]; then
  image_engine="READY"
fi
if [[ "${all_video_pass}" == "YES" ]]; then
  video_engine="READY"
fi
if [[ "${all_publication_pass}" == "YES" ]]; then
  publication_engine="READY"
fi
if [[ "${all_analytics_pass}" == "YES" ]]; then
  analytics_engine="READY"
fi
if [[ "${all_learning_pass}" == "YES" ]]; then
  learning_engine="READY"
fi

scenario_readiness="BLOCKED"
if [[ "${overall_status}" == "PASS" && "${all_readiness_pass}" == "YES" ]]; then
  scenario_readiness="READY FOR REAL PROVIDERS"
fi

join_providers() {
  local raw_list="$1"
  local joined=""
  local value

  if [[ -z "${raw_list}" ]]; then
    echo "UNKNOWN"
    return
  fi

  OLD_IFS="${IFS}"
  IFS='|'
  for value in ${raw_list}; do
    if [[ -z "${joined}" ]]; then
      joined="${value}"
    else
      joined="${joined}, ${value}"
    fi
  done
  IFS="${OLD_IFS}"

  echo "${joined}"
}

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
SCENARIO DASHBOARD SUMMARY

Scenario

${SCENARIO_NAME}

Campaign

${campaign_name}

--------------------------------

Campaign Overview

Items:
${items_detected}

Items PASS:
${items_pass}

Items FAIL:
${items_fail}

Items Missing:
${items_missing}

--------------------------------

Engines

Content:
${content_engine}

Image:
${image_engine}

Video:
${video_engine}

Publication:
${publication_engine}

Analytics:
${analytics_engine}

Learning:
${learning_engine}

--------------------------------

Providers

Image:
$(join_providers "${image_providers}")

Video:
$(join_providers "${video_providers}")

Publication:
$(join_providers "${publication_providers}")

Analytics:
$(join_providers "${analytics_providers}")

Learning:
$(join_providers "${learning_providers}")

--------------------------------

Overall

${overall_status}

Scenario Readiness

${scenario_readiness}

Recommended Next Step

Provider Integration

Future Dashboard

ADMIN DASHBOARD V1
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
