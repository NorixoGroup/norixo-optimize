#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
QUALITY_GATE_SCRIPT="${SCRIPT_DIR}/run-quality-gate.sh"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-localization-review-summary.sh <scenario-name>" >&2
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
OUTPUT_FILE="${SCENARIO_DIR}/localization-review-summary.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${QUALITY_GATE_SCRIPT}" ]]; then
  echo "Error: quality gate script not found: ${QUALITY_GATE_SCRIPT}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: localization review summary already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

quality_gate_output="$(bash "${QUALITY_GATE_SCRIPT}" "${SCENARIO_NAME}")"

official_status="$(printf '%s\n' "${quality_gate_output}" | awk '/^Official files:$/ { getline; print; exit }')"
generated_status="$(printf '%s\n' "${quality_gate_output}" | awk '/^Generated content:$/ { getline; print; exit }')"
promotion_status="$(printf '%s\n' "${quality_gate_output}" | awk '/^Promotion:$/ { getline; print; exit }')"
locale_summary_line="$(printf '%s\n' "${quality_gate_output}" | awk '/^Localization Summary:$/ { getline; print; exit }')"
locale_pass_line="$(printf '%s\n' "${quality_gate_output}" | awk '/PASS$/ && $1 ~ /^[0-9]+$/ { print; exit }')"
locale_fail_line="$(printf '%s\n' "${quality_gate_output}" | awk '/FAIL$/ && $1 ~ /^[0-9]+$/ { print; exit }')"

source_status="PENDING"
if [[ "${official_status}" == "FOUND" && "${generated_status}" == "PASS" ]]; then
  source_status="APPROVED"
fi

generated_locale_count="$(printf '%s\n' "${locale_summary_line}" | awk '{print $1}')"
locale_pass_count="$(printf '%s\n' "${locale_pass_line}" | awk '{print $1}')"
locale_fail_count="$(printf '%s\n' "${locale_fail_line}" | awk '{print $1}')"

if [[ -z "${generated_locale_count}" ]]; then
  generated_locale_count="0"
fi

if [[ -z "${locale_pass_count}" ]]; then
  locale_pass_count="0"
fi

if [[ -z "${locale_fail_count}" ]]; then
  locale_fail_count="0"
fi

pending_review_count="${generated_locale_count}"

locale_rows=()
while IFS='|' read -r locale status; do
  if [[ -n "${locale}" && -n "${status}" ]]; then
    locale_rows+=("$(printf '%-10s %s' "${locale}" "${status}")")
  fi
done < <(
  printf '%s\n' "${quality_gate_output}" | awk '
    /^LOCALIZATIONS$/ { in_localizations=1; next }
    /^Localization Summary:$/ { in_localizations=0; exit }
    !in_localizations { next }
    /^Locale: / {
      locale = substr($0, 9)
      next
    }
    /^Status: / {
      status = substr($0, 9)
      if (locale != "") {
        print locale "|" status
        locale = ""
      }
    }
  '
)

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
# LOCALIZATION REVIEW SUMMARY

Scenario

${SCENARIO_NAME}

--------------------------------

SOURCE

fr

Status:
${source_status}

--------------------------------

LOCALIZATIONS

Locale      Status

$(printf '%s\n' "${locale_rows[@]}")

--------------------------------

Summary

Generated locales:
${generated_locale_count}

PASS:
${locale_pass_count}

FAIL:
${locale_fail_count}

Pending review:
${pending_review_count}

Promotion:
${promotion_status}

--------------------------------

Next phase

Image Agent
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
