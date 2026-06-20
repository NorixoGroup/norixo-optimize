#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-content-agent.sh <scenario-name>" >&2
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
SCENARIO_FILE="${SCENARIO_DIR}/scenario.md"
BRAIN_FILE="${SCENARIO_DIR}/marketing-brain-report.md"
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${SCENARIO_FILE}" ]]; then
  echo "Error: missing scenario file: ${SCENARIO_FILE}" >&2
  exit 1
fi

if [[ ! -f "${BRAIN_FILE}" ]]; then
  echo "Error: missing marketing brain report: ${BRAIN_FILE}" >&2
  exit 1
fi

if [[ -f "${BRIEF_FILE}" ]]; then
  echo "Editorial brief already exists: ${BRIEF_FILE}"
  echo "No overwrite performed."
  exit 0
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

  if [[ "${value}" == *"["*"]"* ]]; then
    printf '%s' "${fallback}"
    return
  fi

  printf '%s' "${value}"
}

humanize_slug() {
  local slug="$1"

  printf '%s' "${slug}" | tr '-' ' ' | awk '{
    for (i = 1; i <= NF; i++) {
      $i = toupper(substr($i, 1, 1)) substr($i, 2)
    }
    print
  }'
}

slug_part="${SCENARIO_NAME#scenario-[0-9][0-9][0-9]-}"
default_subject="$(humanize_slug "${slug_part}")"

context="$(extract_section "${SCENARIO_FILE}" "Context")"
feature="$(extract_section "${SCENARIO_FILE}" "New Feature or Trigger")"
objective="$(extract_section "${SCENARIO_FILE}" "Objective")"
audience="$(extract_section "${SCENARIO_FILE}" "Audience")"
why_topic="$(extract_section "${BRAIN_FILE}" "Why this topic?")"
why_cta="$(extract_section "${BRAIN_FILE}" "Why this CTA?")"
why_platforms="$(extract_section "${BRAIN_FILE}" "Why these platforms?")"
why_format="$(extract_section "${BRAIN_FILE}" "Why this format?")"

subject_value="$(normalize_value "${feature}" "${default_subject}")"
objective_value="$(normalize_value "${objective}" "Clarifier l'objectif editorial a partir du scenario et du Marketing Brain.")"
audience_value="$(normalize_value "${audience}" "Audience a preciser humainement avant redaction du master content.")"
message_value="$(normalize_value "${why_topic}" "Resumer le sujet en une promesse claire, utile et credible pour l'audience cible.")"
cta_value="$(normalize_value "${why_cta}" "Definir un CTA discret, utile et coherent avec le ton Norixo.")"
platforms_value="$(normalize_value "${why_platforms}" "Facebook, Instagram, Snapchat")"
formats_value="$(normalize_value "${why_format}" "Master content, post Facebook, post Instagram, post Snapchat, prompt image, script video")"
context_value="$(normalize_value "${context}" "Contexte a completer a partir du scenario.")"

cat > "${BRIEF_FILE}" <<EOF
# Editorial Brief

## Sujet

${subject_value}

## Objectif

${objective_value}

## Audience

${audience_value}

## Message principal

${message_value}

## Benefices cles

- clarifier la valeur du sujet pour l'audience cible
- aligner le futur master content avec la decision du Marketing Brain
- preparer des declinaisons coherentes sur plusieurs formats

## Objections possibles

- le scenario reste encore trop generique si les sections sources ne sont pas completees
- le benefice produit doit rester precis et non exagere
- l'angle doit rester utile avant d'etre promotionnel

## CTA recommande

${cta_value}

## Formats recommandes

${formats_value}

## Reseaux recommandes

${platforms_value}

## Points a ne pas oublier

- conserver un ton pedagogique, credible et concret
- ne pas inventer de fonctionnalite ou de resultat
- completer le contexte source avant la redaction finale si necessaire
- garder le contenu coherent avec le futur master content
- maintenir une validation humaine avant toute suite de production

## Context Snapshot

${context_value}
EOF

echo "Editorial brief created: ${BRIEF_FILE}"
