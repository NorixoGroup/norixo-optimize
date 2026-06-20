#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LOCALES_DIR="${MARKETING_AGENT_DIR}/locales"
TRANSLATION_AGENT_DOC="${MARKETING_AGENT_DIR}/agents/translation-agent.md"
TRANSLATION_AGENT_SCRIPT="${SCRIPT_DIR}/run-translation-agent.sh"

SCENARIO_NAME="${1:-}"
MODE=""
SOURCE_LOCALE="fr"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-localization-batch.sh <scenario-name> --dry-run|--execute" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --execute)
      MODE="execute"
      shift
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

if [[ -z "${MODE}" ]]; then
  echo "Error: missing execution mode." >&2
  echo "Usage: bash marketing-agent/tools/run-localization-batch.sh <scenario-name> --dry-run|--execute" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
GENERATED_DIR="${SCENARIO_DIR}/generated"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -d "${LOCALES_DIR}" ]]; then
  echo "Error: locales directory not found: ${LOCALES_DIR}" >&2
  exit 1
fi

if [[ ! -f "${TRANSLATION_AGENT_SCRIPT}" ]]; then
  echo "Error: translation agent script not found: ${TRANSLATION_AGENT_SCRIPT}" >&2
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

locale_pack_is_complete() {
  local locale="$1"
  local locale_dir="${GENERATED_DIR}/${locale}"

  [[ -f "${locale_dir}/master-content.md" ]] \
    && [[ -f "${locale_dir}/facebook.md" ]] \
    && [[ -f "${locale_dir}/instagram.md" ]] \
    && [[ -f "${locale_dir}/snapchat.md" ]]
}

generated_locales=()
if [[ -d "${GENERATED_DIR}" ]]; then
  while IFS= read -r locale; do
    if locale_pack_is_complete "${locale}"; then
      generated_locales+=("${locale}")
    fi
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

remaining_locales=()
for locale in "${ordered_locales[@]}"; do
  if [[ "${locale}" == "${SOURCE_LOCALE}" ]]; then
    continue
  fi

  if [[ " ${generated_locales[*]} " == *" ${locale} "* ]]; then
    continue
  fi

  remaining_locales+=("${locale}")
done

if [[ "${MODE}" == "dry-run" ]]; then
  echo "Batch mode"
  echo
  echo "DRY RUN"
  echo
  if [[ ${#remaining_locales[@]} -eq 0 ]]; then
    echo "No remaining locales."
  else
    index=1
    for locale in "${remaining_locales[@]}"; do
      echo "${index}. ${locale}"
      index=$((index + 1))
    done
  fi
  echo
  echo "Total:"
  echo "${#remaining_locales[@]} locales"
  exit 0
fi

if [[ "${MARKETING_AGENT_PROVIDER:-}" != "openai" ]]; then
  echo "Batch execution requires MARKETING_AGENT_PROVIDER=openai" >&2
  exit 1
fi

echo "Batch mode"
echo
echo "EXECUTE"
echo

if [[ ${#remaining_locales[@]} -eq 0 ]]; then
  echo "No remaining locales."
  echo
  echo "Total:"
  echo "0 locales"
  exit 0
fi

success_count=0

for locale in "${remaining_locales[@]}"; do
  echo "Locale : ${locale}"
  echo

  if bash "${TRANSLATION_AGENT_SCRIPT}" "${SCENARIO_NAME}" "--locale=${locale}" > /tmp/marketing-agent-localization-batch.log 2>&1; then
    echo "SUCCESS"
    echo
    success_count=$((success_count + 1))
  else
    cat /tmp/marketing-agent-localization-batch.log
    echo
    echo "FAILED"
    echo
    echo "Batch stopped."
    exit 1
  fi
done

echo "Batch complete."
echo
echo "Total:"
echo "${success_count} locales"
