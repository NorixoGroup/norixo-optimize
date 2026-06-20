#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
QUALITY_GATE_SCRIPT="${SCRIPT_DIR}/run-quality-gate.sh"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-review-report.sh <scenario-name>" >&2
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
MASTER_FILE="${SCENARIO_DIR}/generated-master-content.md"
FACEBOOK_FILE="${SCENARIO_DIR}/generated-facebook.md"
INSTAGRAM_FILE="${SCENARIO_DIR}/generated-instagram.md"
SNAPCHAT_FILE="${SCENARIO_DIR}/generated-snapchat.md"
REPORT_FILE="${SCENARIO_DIR}/review-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

required_files=(
  "${MASTER_FILE}"
  "${FACEBOOK_FILE}"
  "${INSTAGRAM_FILE}"
  "${SNAPCHAT_FILE}"
)

missing_files=()

for file in "${required_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    missing_files+=("${file}")
  fi
done

if [[ ${#missing_files[@]} -gt 0 ]]; then
  echo "Error: generated content pack incomplete." >&2
  printf '%s\n' "${missing_files[@]}" >&2
  exit 1
fi

if [[ -f "${REPORT_FILE}" ]]; then
  echo "Error: review report already exists: ${REPORT_FILE}" >&2
  echo "Refusing to overwrite existing review report." >&2
  exit 1
fi

if [[ ! -f "${QUALITY_GATE_SCRIPT}" ]]; then
  echo "Error: quality gate script not found: ${QUALITY_GATE_SCRIPT}" >&2
  exit 1
fi

quality_gate_status="$(
  bash "${QUALITY_GATE_SCRIPT}" "${SCENARIO_NAME}" | awk '
    /^Structure:$/ { getline; print; exit }
  '
)"

if [[ -z "${quality_gate_status}" ]]; then
  quality_gate_status="UNKNOWN"
fi

cat > "${REPORT_FILE}" <<EOF
# REVIEW REPORT

Scenario
---------

${SCENARIO_NAME}

Quality Gate
------------

${quality_gate_status}

----------------------------

MASTER CONTENT

$(cat "${MASTER_FILE}")

----------------------------

FACEBOOK

$(cat "${FACEBOOK_FILE}")

----------------------------

INSTAGRAM

$(cat "${INSTAGRAM_FILE}")

----------------------------

SNAPCHAT

$(cat "${SNAPCHAT_FILE}")

----------------------------

Reviewer Notes

____________________________________

Decision

[ ] Approved

[ ] Needs revision

[ ] Rejected
EOF

echo "Review Report"
echo "Scenario: ${SCENARIO_NAME}"
echo "Status: CREATED"
echo "Output: ${REPORT_FILE}"
