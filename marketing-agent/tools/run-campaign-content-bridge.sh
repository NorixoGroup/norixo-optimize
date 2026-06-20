#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-content-bridge.sh <scenario-name>" >&2
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
ITEMS_FILE="${SCENARIO_DIR}/campaign/items.md"
OUTPUT_FILE="${SCENARIO_DIR}/campaign-content-requests.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ITEMS_FILE}" ]]; then
  echo "Error: campaign items file not found: ${ITEMS_FILE}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: campaign content requests already exist: ${OUTPUT_FILE}" >&2
  exit 1
fi

items_raw="$(awk '
  /^### [0-9]+\. / {
    if (started) {
      print "<<<ITEM_END>>>"
    }
    started=1
    print $0
    next
  }

  started {
    print $0
  }

  END {
    if (started) {
      print "<<<ITEM_END>>>"
    }
  }
' "${ITEMS_FILE}")"

if [[ -z "${items_raw}" ]]; then
  echo "Error: no campaign items found in ${ITEMS_FILE}" >&2
  exit 1
fi

temp_items_file="$(mktemp)"
temp_report_file="$(mktemp)"
trap 'rm -f "${temp_items_file}" "${temp_report_file}"' EXIT

printf '%s\n' "${items_raw}" > "${temp_items_file}"

ready_count=0
blocked_count=0
request_blocks=""
item_index=1

while IFS= read -r line; do
  if [[ "${line}" == "<<<ITEM_END>>>" ]]; then
    title="$(printf '%s\n' "${current_block}" | awk '/^### / { sub(/^### /, "", $0); print; exit }')"
    item_id="$(printf '%s\n' "${current_block}" | awk -F': ' '/^- id : / { print $2; exit }')"
    item_goal="$(printf '%s\n' "${current_block}" | awk -F': ' '/^- objectif : / { print $2; exit }')"

    if [[ -z "${item_id}" ]]; then
      item_id="UNKNOWN"
    fi

    if [[ -z "${item_goal}" ]]; then
      item_goal="UNSPECIFIED"
    fi

    request_blocks="${request_blocks}Item ${item_index}

Title:
${title}

ID:
${item_id}

Goal:
${item_goal}

Status:
READY FOR CONTENT AGENT

--------------------------------

"

    ready_count=$((ready_count + 1))
    item_index=$((item_index + 1))
    current_block=""
    continue
  fi

  if [[ -n "${current_block:-}" ]]; then
    current_block="${current_block}"$'\n'"${line}"
  else
    current_block="${line}"
  fi
done < "${temp_items_file}"

cat > "${temp_report_file}" <<EOF
# CAMPAIGN CONTENT REQUESTS

Scenario

${SCENARIO_NAME}

--------------------------------

${request_blocks}Summary

Items:
${ready_count}

Ready:
${ready_count}

Blocked:
${blocked_count}
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
