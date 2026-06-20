#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"
LOCALES_DIR="${MARKETING_AGENT_DIR}/locales"
LLM_ADAPTER_SCRIPT="${SCRIPT_DIR}/run-llm-adapter.sh"

SCENARIO_NAME="${1:-}"
LOCALE=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-translation-agent.sh <scenario-name> --locale=<locale>" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --locale=*)
      LOCALE="${1#--locale=}"
      shift
      ;;
    --locale)
      LOCALE="${2:-}"
      shift 2
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

if [[ -z "${LOCALE}" ]]; then
  echo "Error: missing locale." >&2
  echo "Usage: bash marketing-agent/tools/run-translation-agent.sh <scenario-name> --locale=<locale>" >&2
  exit 1
fi

if [[ "${MARKETING_AGENT_PROVIDER:-}" != "openai" ]]; then
  echo "Localization requires MARKETING_AGENT_PROVIDER=openai" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
LOCALE_PROFILE="${LOCALES_DIR}/${LOCALE}/profile.md"
SOURCE_MASTER_FILE="${SCENARIO_DIR}/generated-master-content.md"
SOURCE_FACEBOOK_FILE="${SCENARIO_DIR}/generated-facebook.md"
SOURCE_INSTAGRAM_FILE="${SCENARIO_DIR}/generated-instagram.md"
SOURCE_SNAPCHAT_FILE="${SCENARIO_DIR}/generated-snapchat.md"
TARGET_DIR="${SCENARIO_DIR}/generated/${LOCALE}"
TARGET_MASTER_FILE="${TARGET_DIR}/master-content.md"
TARGET_FACEBOOK_FILE="${TARGET_DIR}/facebook.md"
TARGET_INSTAGRAM_FILE="${TARGET_DIR}/instagram.md"
TARGET_SNAPCHAT_FILE="${TARGET_DIR}/snapchat.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${LOCALE_PROFILE}" ]]; then
  echo "Unknown locale: ${LOCALE}" >&2
  exit 1
fi

if [[ ! -f "${LLM_ADAPTER_SCRIPT}" ]]; then
  echo "Error: LLM adapter script not found: ${LLM_ADAPTER_SCRIPT}" >&2
  exit 1
fi

source_files=(
  "${SOURCE_MASTER_FILE}"
  "${SOURCE_FACEBOOK_FILE}"
  "${SOURCE_INSTAGRAM_FILE}"
  "${SOURCE_SNAPCHAT_FILE}"
)

missing_source_files=()
for file in "${source_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    missing_source_files+=("${file}")
  fi
done

if [[ ${#missing_source_files[@]} -gt 0 ]]; then
  echo "Error: source generated content pack incomplete." >&2
  printf '%s\n' "${missing_source_files[@]}" >&2
  exit 1
fi

target_files=(
  "${TARGET_MASTER_FILE}"
  "${TARGET_FACEBOOK_FILE}"
  "${TARGET_INSTAGRAM_FILE}"
  "${TARGET_SNAPCHAT_FILE}"
)

existing_target_files=()
for file in "${target_files[@]}"; do
  if [[ -f "${file}" ]]; then
    existing_target_files+=("${file}")
  fi
done

if [[ ${#existing_target_files[@]} -gt 0 ]]; then
  echo "Translation Agent Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo "Locale: ${LOCALE}"
  echo
  echo "Status: BLOCKED"
  echo "Reason: localized files already exist."
  echo
  printf '%s\n' "${existing_target_files[@]}"
  exit 1
fi

mkdir -p "${TARGET_DIR}"

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

prompt_file="$(mktemp)"
runtime_request_file="$(mktemp)"
adapter_output_file="$(mktemp)"
runtime_response_file="$(mktemp)"
trap 'rm -f "${prompt_file}" "${runtime_request_file}" "${adapter_output_file}" "${runtime_response_file}"' EXIT

cat > "${prompt_file}" <<EOF
You are the Norixo Localization Agent.

Translate and culturally adapt the following generated marketing content pack from French into the target locale defined below.

Use the locale profile below.
Do not invent features, metrics, promises, or unsupported claims.
Keep meaning, CTA intent, product coherence, and platform intent consistent with the source.

Return plain text only with exactly these four blocks and these exact markers:

===MASTER_CONTENT===
[localized Markdown master content]
===END_MASTER_CONTENT===

===FACEBOOK===
[localized Markdown Facebook content]
===END_FACEBOOK===

===INSTAGRAM===
[localized Markdown Instagram content]
===END_INSTAGRAM===

===SNAPCHAT===
[localized Markdown Snapchat content]
===END_SNAPCHAT===

Locale profile:

$(cat "${LOCALE_PROFILE}")

Source MASTER CONTENT:

$(cat "${SOURCE_MASTER_FILE}")

Source FACEBOOK:

$(cat "${SOURCE_FACEBOOK_FILE}")

Source INSTAGRAM:

$(cat "${SOURCE_INSTAGRAM_FILE}")

Source SNAPCHAT:

$(cat "${SOURCE_SNAPCHAT_FILE}")
EOF

cat > "${runtime_request_file}" <<EOF
{
  "requestId": "${SCENARIO_NAME}-translation-${LOCALE}",
  "provider": "auto",
  "role": "localization-agent",
  "scenario": "${SCENARIO_NAME}",
  "prompt": "$(json_escape_file "${prompt_file}")",
  "constraints": ["structured-blocks", "no-overwrite", "single-locale", "localization-pack"],
  "language": "${LOCALE}",
  "metadata": {
    "source": "generated-content-pack",
    "taskType": "localization",
    "providerMode": "openai",
    "locale": "${LOCALE}"
  },
  "expectedOutput": {
    "format": "text",
    "type": "localized-content-pack"
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
  echo "Translation Agent Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo "Locale: ${LOCALE}"
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
  echo "Translation Agent Report"
  echo "Scenario: ${SCENARIO_NAME}"
  echo "Locale: ${LOCALE}"
  echo
  echo "Status: ERROR"
  echo "Reason: structured blocks could not be fully extracted."
  exit 1
fi

printf '%s\n' "${master_block}" > "${TARGET_MASTER_FILE}"
printf '%s\n' "${facebook_block}" > "${TARGET_FACEBOOK_FILE}"
printf '%s\n' "${instagram_block}" > "${TARGET_INSTAGRAM_FILE}"
printf '%s\n' "${snapchat_block}" > "${TARGET_SNAPCHAT_FILE}"

echo "Translation Agent Report"
echo "Scenario: ${SCENARIO_NAME}"
echo "Locale: ${LOCALE}"
echo
echo "Status: CREATED"
echo
echo "Created files:"
printf '%s\n' \
  "${TARGET_MASTER_FILE}" \
  "${TARGET_FACEBOOK_FILE}" \
  "${TARGET_INSTAGRAM_FILE}" \
  "${TARGET_SNAPCHAT_FILE}"
