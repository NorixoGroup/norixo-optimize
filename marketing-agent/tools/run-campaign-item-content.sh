#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
ITEM_ARG=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-item-content.sh <scenario-name> --item=<item-id>" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --item=*)
      ITEM_ARG="${1#--item=}"
      shift
      ;;
    --item)
      ITEM_ARG="${2:-}"
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

if [[ -z "${ITEM_ARG}" ]]; then
  echo "Error: missing item identifier." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-item-content.sh <scenario-name> --item=<item-id>" >&2
  exit 1
fi

if [[ "${ITEM_ARG}" == *".."* ]] || [[ "${ITEM_ARG}" == */* ]]; then
  echo "Error: unsafe item identifier." >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
REQUESTS_FILE="${SCENARIO_DIR}/campaign-content-requests.md"
CAMPAIGN_ITEMS_DIR="${SCENARIO_DIR}/campaign-items"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${REQUESTS_FILE}" ]]; then
  echo "Error: campaign content requests not found: ${REQUESTS_FILE}" >&2
  exit 1
fi

resolved_item_id=""
resolved_item_goal=""
resolved_item_title=""

if [[ "${ITEM_ARG}" =~ ^campaign-item-([0-9]{3})$ ]]; then
  item_number="${BASH_REMATCH[1]}"
  item_number="${item_number#0}"
  item_number="${item_number#0}"
  item_number="${item_number#0}"
  if [[ -z "${item_number}" ]]; then
    item_number="0"
  fi

  request_block="$(awk -v target="Item ${item_number}" '
    $0 == target { capture=1; print; next }
    capture && /^--------------------------------$/ { exit }
    capture { print }
  ' "${REQUESTS_FILE}")"

  resolved_item_title="$(printf '%s\n' "${request_block}" | awk '/^Title:$/ { getline; print; exit }')"
  resolved_item_id="$(printf '%s\n' "${request_block}" | awk '/^ID:$/ { getline; print; exit }')"
  resolved_item_goal="$(printf '%s\n' "${request_block}" | awk '/^Goal:$/ { getline; print; exit }')"
else
  request_block="$(awk -v target="${ITEM_ARG}" '
    /^ID:$/ {
      getline
      if ($0 == target) {
        found=1
      }
    }
    found && /^--------------------------------$/ { exit }
    found { print }
  ' "${REQUESTS_FILE}")"

  resolved_item_id="$(printf '%s\n' "${request_block}" | awk '/^ID:$/ { getline; print; exit }')"
  resolved_item_goal="$(printf '%s\n' "${request_block}" | awk '/^Goal:$/ { getline; print; exit }')"
  resolved_item_title="$(printf '%s\n' "${request_block}" | awk '/^Title:$/ { getline; print; exit }')"
fi

if [[ -z "${resolved_item_id}" ]]; then
  echo "Error: campaign item not found in requests: ${ITEM_ARG}" >&2
  exit 1
fi

target_item_dir="${CAMPAIGN_ITEMS_DIR}/${ITEM_ARG}"

if [[ -d "${target_item_dir}" ]]; then
  echo "Error: campaign item content already exists: ${target_item_dir}" >&2
  exit 1
fi

mkdir -p "${target_item_dir}"

for filename in master-content.md facebook.md instagram.md snapchat.md; do
  cat > "${target_item_dir}/${filename}" <<EOF
Generated content placeholder.
Status: READY FOR CONTENT AGENT.
Scenario: ${SCENARIO_NAME}
Requested item: ${ITEM_ARG}
Resolved item id: ${resolved_item_id}
Title: ${resolved_item_title}
Goal: ${resolved_item_goal}
Target file: ${filename}
EOF
done

echo "Campaign item content structure created."
echo "Scenario: ${SCENARIO_NAME}"
echo "Requested item: ${ITEM_ARG}"
echo "Resolved item id: ${resolved_item_id}"
echo "Directory: ${target_item_dir}"
