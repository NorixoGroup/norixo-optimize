#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-draft-generator.sh <scenario-name>" >&2
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
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BRIEF_FILE}" ]]; then
  echo "Error: editorial brief not found: ${BRIEF_FILE}" >&2
  exit 1
fi

extract_section() {
  local file="$1"
  local heading="$2"

  awk -v heading="${heading}" '
    $0 == "## " heading { capture=1; next }
    capture && /^## / { exit }
    capture { print }
  ' "${file}" | sed '/^[[:space:]]*$/d'
}

normalize_value() {
  local value="$1"
  local fallback="$2"

  if [[ -z "${value}" ]]; then
    printf '%s' "${fallback}"
    return
  fi

  printf '%s' "${value}"
}

sujet="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Sujet")" "Sujet a preciser")"
objectif="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Objectif")" "Objectif a preciser")"
audience="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Audience")" "Audience a preciser")"
message_principal="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Message principal")" "Message principal a preciser")"
cta="$(normalize_value "$(extract_section "${BRIEF_FILE}" "CTA recommande")" "CTA a preciser")"
formats="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Formats recommandes")" "Formats a preciser")"
reseaux="$(normalize_value "$(extract_section "${BRIEF_FILE}" "Reseaux recommandes")" "Reseaux a preciser")"

created_files=()
skipped_files=()

create_if_missing() {
  local target_file="$1"
  local content="$2"

  if [[ -f "${target_file}" ]]; then
    skipped_files+=("${target_file}")
    return
  fi

  printf '%s\n' "${content}" > "${target_file}"
  created_files+=("${target_file}")
}

create_if_missing "${SCENARIO_DIR}/draft-master-content.md" "# Draft Master Content

## Titre

${sujet}

## Introduction

- contexte : ${objectif}
- audience : ${audience}

## Probleme

- quel probleme concret le sujet doit-il clarifier ?
- quelle friction ou confusion doit etre reduite ?

## Solution Norixo

- message principal : ${message_principal}
- comment Norixo aide-t-il sans surpromesse ?

## Benefices

- benefice 1 a preciser
- benefice 2 a preciser
- benefice 3 a preciser

## Conclusion

- resume final a formuler
- transition vers un CTA discret

## CTA

${cta}
"

create_if_missing "${SCENARIO_DIR}/draft-facebook.md" "# Draft Facebook

## Accroche

- partir du sujet : ${sujet}

## Corps

- rappeler le probleme
- expliquer la logique Norixo
- garder un ton utile et pedagogique

## CTA

${cta}
"

create_if_missing "${SCENARIO_DIR}/draft-instagram.md" "# Draft Instagram

## Hook

- accroche courte a formuler a partir du sujet : ${sujet}

## Corps

- message principal : ${message_principal}
- garder une structure courte et lisible

## Hashtags

- hashtags a definir selon le sujet
- reseaux recommandes : ${reseaux}
"

create_if_missing "${SCENARIO_DIR}/draft-snapchat.md" "# Draft Snapchat

## Message tres court

- condensat du sujet : ${sujet}
- une seule idee forte

## CTA

${cta}
"

echo "Draft Generator Report"
echo "Scenario: ${SCENARIO_NAME}"
echo

if [[ ${#created_files[@]} -gt 0 ]]; then
  echo "Created files:"
  printf '%s\n' "${created_files[@]}"
  echo
fi

if [[ ${#skipped_files[@]} -gt 0 ]]; then
  echo "Skipped existing files:"
  printf '%s\n' "${skipped_files[@]}"
  echo
fi

echo "Brief source: ${BRIEF_FILE}"
echo "Formats reference: ${formats}"
