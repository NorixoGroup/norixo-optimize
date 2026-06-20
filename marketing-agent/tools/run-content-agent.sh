#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LLM_ADAPTER_SCRIPT="${SCRIPT_DIR}/run-llm-adapter.sh"

SCENARIO_NAME="${1:-}"
GENERATE_MODE="false"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-content-agent.sh <scenario-name>" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --generate)
      GENERATE_MODE="true"
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

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
SCENARIO_FILE="${SCENARIO_DIR}/scenario.md"
BRAIN_FILE="${SCENARIO_DIR}/marketing-brain-report.md"
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"
GENERATED_MASTER_FILE="${SCENARIO_DIR}/generated-master-content.md"
GENERATED_FACEBOOK_FILE="${SCENARIO_DIR}/generated-facebook.md"
GENERATED_INSTAGRAM_FILE="${SCENARIO_DIR}/generated-instagram.md"
GENERATED_SNAPCHAT_FILE="${SCENARIO_DIR}/generated-snapchat.md"

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

json_escape_file() {
  local file="$1"

  awk '
    BEGIN { first = 1 }
    {
      gsub(/\\/,"\\\\")
      gsub(/"/,"\\\"")
      gsub(/\r/,"")
      if (!first) {
        printf "\\n"
      }
      printf "%s", $0
      first = 0
    }
  ' "${file}"
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

if [[ "${GENERATE_MODE}" == "false" ]]; then
  if [[ -f "${BRIEF_FILE}" ]]; then
    echo "Editorial brief already exists: ${BRIEF_FILE}"
    echo "No overwrite performed."
    exit 0
  fi

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
  exit 0
fi

if [[ "${MARKETING_AGENT_PROVIDER:-}" != "openai" ]]; then
  echo "Generation requires MARKETING_AGENT_PROVIDER=openai" >&2
  exit 1
fi

if [[ ! -f "${BRIEF_FILE}" ]]; then
  echo "Error: editorial brief not found: ${BRIEF_FILE}" >&2
  exit 1
fi

if [[ ! -f "${LLM_ADAPTER_SCRIPT}" ]]; then
  echo "Error: LLM adapter script not found: ${LLM_ADAPTER_SCRIPT}" >&2
  exit 1
fi

target_files=(
  "${GENERATED_MASTER_FILE}"
  "${GENERATED_FACEBOOK_FILE}"
  "${GENERATED_INSTAGRAM_FILE}"
  "${GENERATED_SNAPCHAT_FILE}"
)

existing_generated_files=()

for file in "${target_files[@]}"; do
  if [[ -f "${file}" ]]; then
    existing_generated_files+=("${file}")
  fi
done

if [[ ${#existing_generated_files[@]} -gt 0 ]]; then
  echo "Content Agent Generation Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo
  echo "Status: BLOCKED"
  echo "Reason: generated files already exist."
  echo
  printf '%s\n' "${existing_generated_files[@]}"
  exit 1
fi

prompt_file="$(mktemp)"
runtime_request_file="$(mktemp)"
adapter_output_file="$(mktemp)"
runtime_response_file="$(mktemp)"
trap 'rm -f "${prompt_file}" "${runtime_request_file}" "${adapter_output_file}" "${runtime_response_file}"' EXIT

cat > "${prompt_file}" <<EOF
You are generating a Norixo marketing content pack from an editorial brief.

Use only the editorial brief below.
Do not invent features, metrics, releases, guarantees, or unsupported claims.
Keep the tone professional, modern, expert, accessible, and never too commercial.

Return plain text only with exactly these four blocks and these exact markers:

===MASTER_CONTENT===
[full master marketing content in Markdown with sections:
# Master Marketing Content
## Titre
## Introduction
## Probleme
## Solution Norixo
## Benefices
## CTA discret]
===END_MASTER_CONTENT===

===FACEBOOK===
[Markdown content for Facebook]
===END_FACEBOOK===

===INSTAGRAM===
[Markdown content for Instagram]
===END_INSTAGRAM===

===SNAPCHAT===
[Markdown content for Snapchat]
===END_SNAPCHAT===

Editorial brief:

$(cat "${BRIEF_FILE}")
EOF

cat > "${runtime_request_file}" <<EOF
{
  "requestId": "${SCENARIO_NAME}-content-agent-generate",
  "provider": "auto",
  "role": "content-agent-generator",
  "scenario": "${SCENARIO_NAME}",
  "prompt": "$(json_escape_file "${prompt_file}")",
  "constraints": ["structured-blocks", "no-overwrite", "generated-content-pack"],
  "language": "fr",
  "metadata": {
    "source": "editorial-brief.md",
    "taskType": "content-pack-generation",
    "providerMode": "openai"
  },
  "expectedOutput": {
    "format": "text",
    "type": "content-pack"
  },
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

bash "${LLM_ADAPTER_SCRIPT}" --request-file "${runtime_request_file}" > "${adapter_output_file}"

awk '
  /----- Runtime Response -----/ { capture=1; next }
  /^Response :$/ { capture=0 }
  capture { print }
' "${adapter_output_file}" | sed '/^[[:space:]]*$/d' > "${runtime_response_file}"

if [[ ! -s "${runtime_response_file}" ]]; then
  echo "Error: runtime response could not be extracted from LLM Adapter output." >&2
  exit 1
fi

runtime_status="$(jq -r '.status // empty' "${runtime_response_file}")"
runtime_output="$(jq -r '.output // empty' "${runtime_response_file}")"
runtime_first_error="$(jq -r '(.errors // [])[0] // empty' "${runtime_response_file}")"

if [[ "${runtime_status}" != "success" ]]; then
  echo "Content Agent Generation Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo
  echo "Status: ERROR"
  if [[ -n "${runtime_first_error}" ]]; then
    echo "Reason: ${runtime_first_error}"
  else
    echo "Reason: unknown runtime error."
  fi
  exit 1
fi

extract_block() {
  local label="$1"
  local text="$2"

  printf '%s\n' "${text}" | awk -v start="===${label}===" -v stop="===END_${label}===" '
    $0 == start { capture=1; next }
    $0 == stop { capture=0; exit }
    capture { print }
  '
}

master_block="$(extract_block "MASTER_CONTENT" "${runtime_output}")"
facebook_block="$(extract_block "FACEBOOK" "${runtime_output}")"
instagram_block="$(extract_block "INSTAGRAM" "${runtime_output}")"
snapchat_block="$(extract_block "SNAPCHAT" "${runtime_output}")"

if [[ -z "${master_block}" || -z "${facebook_block}" || -z "${instagram_block}" || -z "${snapchat_block}" ]]; then
  echo "Content Agent Generation Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo
  echo "Status: ERROR"
  echo "Reason: structured blocks could not be fully extracted."
  exit 1
fi

printf '%s\n' "${master_block}" > "${GENERATED_MASTER_FILE}"
printf '%s\n' "${facebook_block}" > "${GENERATED_FACEBOOK_FILE}"
printf '%s\n' "${instagram_block}" > "${GENERATED_INSTAGRAM_FILE}"
printf '%s\n' "${snapchat_block}" > "${GENERATED_SNAPCHAT_FILE}"

echo "Content Agent Generation Report"
echo "Scenario: ${SCENARIO_NAME}"
echo
echo "Status: CREATED"
echo
echo "Created files:"
printf '%s\n' \
  "${GENERATED_MASTER_FILE}" \
  "${GENERATED_FACEBOOK_FILE}" \
  "${GENERATED_INSTAGRAM_FILE}" \
  "${GENERATED_SNAPCHAT_FILE}"
