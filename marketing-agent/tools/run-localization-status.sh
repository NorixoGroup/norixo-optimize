#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LOCALES_DIR="${MARKETING_AGENT_DIR}/locales"
QUALITY_GATE_SCRIPT="${SCRIPT_DIR}/run-quality-gate.sh"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-localization-status.sh <scenario-name>" >&2
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
GENERATED_DIR="${SCENARIO_DIR}/generated"
OUTPUT_FILE="${SCENARIO_DIR}/localization-status.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${LOCALES_DIR}" ]]; then
  echo "Error: locales directory not found: ${LOCALES_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: localization status already exists: ${OUTPUT_FILE}" >&2
  echo "Refusing to overwrite existing localization status report." >&2
  exit 1
fi

if [[ ! -f "${QUALITY_GATE_SCRIPT}" ]]; then
  echo "Error: quality gate script not found: ${QUALITY_GATE_SCRIPT}" >&2
  exit 1
fi

available_locales=()
while IFS= read -r locale; do
  available_locales+=("${locale}")
done < <(find "${LOCALES_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)

preferred_order=(fr en es de it pt nl ja zh ko ar)
locales=()

for preferred_locale in "${preferred_order[@]}"; do
  for available_locale in "${available_locales[@]}"; do
    if [[ "${available_locale}" == "${preferred_locale}" ]]; then
      locales+=("${available_locale}")
    fi
  done
done

if [[ ${#locales[@]} -eq 0 ]]; then
  echo "Error: no locale profiles found." >&2
  exit 1
fi

quality_gate_output="$(bash "${QUALITY_GATE_SCRIPT}" "${SCENARIO_NAME}")"
source_status="$(printf '%s\n' "${quality_gate_output}" | awk '/^Generated content:$/ { getline; print; exit }')"
english_status="$(printf '%s\n' "${quality_gate_output}" | awk '/^Localization:$/ { getline; print; exit }')"

if [[ -z "${source_status}" ]]; then
  source_status="UNKNOWN"
fi

if [[ -z "${english_status}" ]]; then
  english_status="N/A"
fi

next_recommended_locale="N/A"
status_rows=()

for locale in "${locales[@]}"; do
  if [[ "${locale}" == "fr" ]]; then
    status="SOURCE"
  elif [[ -d "${GENERATED_DIR}/${locale}" ]]; then
    status="GENERATED"
  else
    status="NOT GENERATED"
    if [[ "${next_recommended_locale}" == "N/A" ]]; then
      next_recommended_locale="${locale}"
    fi
  fi

  status_rows+=("$(printf '%-10s %s' "${locale}" "${status}")")
done

cat > "${OUTPUT_FILE}" <<EOF
# LOCALIZATION STATUS

Scenario

${SCENARIO_NAME}

--------------------------------

Locale     Status

$(printf '%s\n' "${status_rows[@]}")

--------------------------------

Quality Gate

Source : ${source_status}

English : ${english_status}

Others : N/A

--------------------------------

Next recommended locale

${next_recommended_locale}
EOF

echo "Localization Status"
echo "Scenario: ${SCENARIO_NAME}"
echo "Status: CREATED"
echo "Output: ${OUTPUT_FILE}"
