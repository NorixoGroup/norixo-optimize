#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LOCALES_DIR="${MARKETING_AGENT_DIR}/locales"
QUALITY_GATE_SCRIPT="${SCRIPT_DIR}/run-quality-gate.sh"
TRANSLATION_AGENT_DOC="${MARKETING_AGENT_DIR}/agents/translation-agent.md"

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

if [[ ! -f "${QUALITY_GATE_SCRIPT}" ]]; then
  echo "Error: quality gate script not found: ${QUALITY_GATE_SCRIPT}" >&2
  exit 1
fi

available_locales=()
while IFS= read -r locale; do
  available_locales+=("${locale}")
done < <(find "${LOCALES_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)

preferred_order=()
if [[ -f "${TRANSLATION_AGENT_DOC}" ]]; then
  while IFS= read -r locale; do
    preferred_order+=("${locale}")
  done < <(
    awk '
      /^## Langues supportees$/ { capture=1; next }
      capture && /^## / { exit }
      capture && /^[[:space:]]*-[[:space:]]+/ {
        sub(/^[[:space:]]*-[[:space:]]+/, "", $0)
        print $0
      }
    ' "${TRANSLATION_AGENT_DOC}"
  )
fi

generated_locales=()
if [[ -d "${GENERATED_DIR}" ]]; then
  while IFS= read -r locale; do
    generated_locales+=("${locale}")
  done < <(find "${GENERATED_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
fi

source_locale=""
if [[ -f "${SCENARIO_DIR}/editorial-brief.md" ]] && grep -q "^## Sujet$" "${SCENARIO_DIR}/editorial-brief.md"; then
  source_locale="fr"
fi

locales=()
seen_locales=""

append_locale_if_missing() {
  local locale="$1"

  if [[ -z "${locale}" ]]; then
    return
  fi

  if [[ " ${seen_locales} " == *" ${locale} "* ]]; then
    return
  fi

  locales+=("${locale}")
  seen_locales="${seen_locales} ${locale}"
}

append_locale_if_missing "${source_locale}"

for preferred_locale in "${preferred_order[@]}"; do
  for available_locale in "${available_locales[@]}"; do
    if [[ "${available_locale}" == "${preferred_locale}" ]]; then
      append_locale_if_missing "${available_locale}"
    fi
  done
done

for available_locale in "${available_locales[@]}"; do
  append_locale_if_missing "${available_locale}"
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
  if [[ -n "${source_locale}" && "${locale}" == "${source_locale}" ]]; then
    status="SOURCE"
  elif [[ " ${generated_locales[*]} " == *" ${locale} "* ]]; then
    status="GENERATED"
  else
    status="NOT GENERATED"
    if [[ "${next_recommended_locale}" == "N/A" ]]; then
      next_recommended_locale="${locale}"
    fi
  fi

  status_rows+=("$(printf '%-10s %s' "${locale}" "${status}")")
done

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
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

if [[ ! -f "${OUTPUT_FILE}" ]]; then
  cp "${temp_report_file}" "${OUTPUT_FILE}"
fi

cat "${temp_report_file}"
