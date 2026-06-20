#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LOCALES_DIR="${MARKETING_AGENT_DIR}/locales"
TRANSLATION_AGENT_DOC="${MARKETING_AGENT_DIR}/agents/translation-agent.md"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-localization-batch-plan.sh <scenario-name>" >&2
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
OUTPUT_FILE="${SCENARIO_DIR}/localization-batch-plan.md"
SOURCE_LOCALE="fr"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${LOCALES_DIR}" ]]; then
  echo "Error: locales directory not found: ${LOCALES_DIR}" >&2
  exit 1
fi

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: localization batch plan already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

available_locales=()
while IFS= read -r locale; do
  available_locales+=("${locale}")
done < <(find "${LOCALES_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)

if [[ ${#available_locales[@]} -eq 0 ]]; then
  echo "Error: no locale profiles found." >&2
  exit 1
fi

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

ordered_locales=()
seen_locales=""

append_locale_if_missing() {
  local locale="$1"

  if [[ -z "${locale}" ]]; then
    return
  fi

  if [[ " ${seen_locales} " == *" ${locale} "* ]]; then
    return
  fi

  ordered_locales+=("${locale}")
  seen_locales="${seen_locales} ${locale}"
}

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

already_generated_rows=()
remaining_locales=()
recommended_rows=()
command_rows=()

for locale in "${generated_locales[@]}"; do
  if [[ "${locale}" != "${SOURCE_LOCALE}" ]]; then
    already_generated_rows+=("${locale}")
  fi
done

for locale in "${ordered_locales[@]}"; do
  if [[ "${locale}" == "${SOURCE_LOCALE}" ]]; then
    continue
  fi

  if [[ " ${generated_locales[*]} " == *" ${locale} "* ]]; then
    continue
  fi

  remaining_locales+=("${locale}")
done

if [[ ${#remaining_locales[@]} -eq 0 ]]; then
  recommended_rows+=("No remaining locales.")
  command_rows+=("No localization commands remaining.")
else
  index=1
  for locale in "${remaining_locales[@]}"; do
    recommended_rows+=("${index}. ${locale}")
    command_rows+=("MARKETING_AGENT_PROVIDER=openai bash marketing-agent/tools/run-translation-agent.sh ${SCENARIO_NAME} --locale=${locale}")
    index=$((index + 1))
  done
fi

already_generated_block="None"
remaining_block="None"

if [[ ${#already_generated_rows[@]} -gt 0 ]]; then
  already_generated_block="$(printf '%s\n' "${already_generated_rows[@]}")"
fi

if [[ ${#remaining_locales[@]} -gt 0 ]]; then
  remaining_block="$(printf '%s\n' "${remaining_locales[@]}")"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
# LOCALIZATION BATCH PLAN

Scenario:
${SCENARIO_NAME}

Source:
${SOURCE_LOCALE}

Already generated:
${already_generated_block}

Remaining:
${remaining_block}

Recommended order:
$(printf '%s\n' "${recommended_rows[@]}")

Commands:
$(printf '%s\n' "${command_rows[@]}")
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"
