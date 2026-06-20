#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-quality-gate.sh <scenario-name>" >&2
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
DRAFT_FILE="${SCENARIO_DIR}/openai-draft-test.md"
BRIEF_FILE="${SCENARIO_DIR}/editorial-brief.md"
GENERATED_DIR="${SCENARIO_DIR}/generated"
GENERATED_MASTER_FILE="${SCENARIO_DIR}/generated-master-content.md"
GENERATED_FACEBOOK_FILE="${SCENARIO_DIR}/generated-facebook.md"
GENERATED_INSTAGRAM_FILE="${SCENARIO_DIR}/generated-instagram.md"
GENERATED_SNAPCHAT_FILE="${SCENARIO_DIR}/generated-snapchat.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

official_files=(
  "${SCENARIO_DIR}/master-content.md"
  "${SCENARIO_DIR}/facebook.md"
  "${SCENARIO_DIR}/instagram.md"
  "${SCENARIO_DIR}/snapchat.md"
)

generated_source_files=(
  "${GENERATED_MASTER_FILE}"
  "${GENERATED_FACEBOOK_FILE}"
  "${GENERATED_INSTAGRAM_FILE}"
  "${GENERATED_SNAPCHAT_FILE}"
)

missing_official_files=()
missing_generated_source_files=()

for file in "${official_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    missing_official_files+=("${file}")
  fi
done

for file in "${generated_source_files[@]}"; do
  if [[ ! -f "${file}" ]]; then
    missing_generated_source_files+=("${file}")
  fi
done

draft_status="MISSING"
brief_status="MISSING"
official_status="MISSING"
generated_status="INCOMPLETE"
localization_summary_status="PASS"
structure_status="FAIL"
content_review_status="PENDING"
promotion_status="BLOCKED"

if [[ -f "${DRAFT_FILE}" ]]; then
  draft_status="FOUND"
fi

if [[ -f "${BRIEF_FILE}" ]]; then
  brief_status="FOUND"
fi

if [[ ${#missing_official_files[@]} -eq 0 ]]; then
  official_status="FOUND"
fi

if [[ ${#missing_generated_source_files[@]} -eq 0 ]]; then
  generated_status="PASS"
fi

locale_dirs=()
if [[ -d "${GENERATED_DIR}" ]]; then
  while IFS= read -r locale; do
    locale_dirs+=("${locale}")
  done < <(find "${GENERATED_DIR}" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
fi

localization_lines=()
missing_localized_files=()
locale_pass_count=0
locale_fail_count=0

for locale in "${locale_dirs[@]}"; do
  locale_master_file="${GENERATED_DIR}/${locale}/master-content.md"
  locale_facebook_file="${GENERATED_DIR}/${locale}/facebook.md"
  locale_instagram_file="${GENERATED_DIR}/${locale}/instagram.md"
  locale_snapchat_file="${GENERATED_DIR}/${locale}/snapchat.md"

  locale_master_status="$( [[ -f "${locale_master_file}" ]] && echo FOUND || echo MISSING )"
  locale_facebook_status="$( [[ -f "${locale_facebook_file}" ]] && echo FOUND || echo MISSING )"
  locale_instagram_status="$( [[ -f "${locale_instagram_file}" ]] && echo FOUND || echo MISSING )"
  locale_snapchat_status="$( [[ -f "${locale_snapchat_file}" ]] && echo FOUND || echo MISSING )"
  locale_status="PASS"

  if [[ "${locale_master_status}" != "FOUND" ]]; then
    locale_status="FAIL"
    missing_localized_files+=("${locale_master_file}")
  fi

  if [[ "${locale_facebook_status}" != "FOUND" ]]; then
    locale_status="FAIL"
    missing_localized_files+=("${locale_facebook_file}")
  fi

  if [[ "${locale_instagram_status}" != "FOUND" ]]; then
    locale_status="FAIL"
    missing_localized_files+=("${locale_instagram_file}")
  fi

  if [[ "${locale_snapchat_status}" != "FOUND" ]]; then
    locale_status="FAIL"
    missing_localized_files+=("${locale_snapchat_file}")
  fi

  if [[ "${locale_status}" == "PASS" ]]; then
    locale_pass_count=$((locale_pass_count + 1))
  else
    locale_fail_count=$((locale_fail_count + 1))
    localization_summary_status="FAIL"
  fi

  localization_lines+=("Locale: ${locale}")
  localization_lines+=("Master: ${locale_master_status}")
  localization_lines+=("Facebook: ${locale_facebook_status}")
  localization_lines+=("Instagram: ${locale_instagram_status}")
  localization_lines+=("Snapchat: ${locale_snapchat_status}")
  localization_lines+=("Status: ${locale_status}")
  localization_lines+=("")
done

if [[ "${draft_status}" == "FOUND" && "${brief_status}" == "FOUND" && "${official_status}" == "FOUND" && "${generated_status}" == "PASS" && "${localization_summary_status}" == "PASS" ]]; then
  structure_status="PASS"
fi

echo "QUALITY GATE"
echo
echo "SOURCE"
echo
echo "Draft:"
echo "${draft_status}"
echo
echo "Editorial Brief:"
echo "${brief_status}"
echo
echo "Official files:"
echo "${official_status}"
echo
echo "Generated content:"
echo "${generated_status}"
echo
echo "Generated files:"
echo "- generated-master-content.md: $( [[ -f "${GENERATED_MASTER_FILE}" ]] && echo FOUND || echo MISSING )"
echo "- generated-facebook.md: $( [[ -f "${GENERATED_FACEBOOK_FILE}" ]] && echo FOUND || echo MISSING )"
echo "- generated-instagram.md: $( [[ -f "${GENERATED_INSTAGRAM_FILE}" ]] && echo FOUND || echo MISSING )"
echo "- generated-snapchat.md: $( [[ -f "${GENERATED_SNAPCHAT_FILE}" ]] && echo FOUND || echo MISSING )"
echo
echo "LOCALIZATIONS"
echo
if [[ ${#localization_lines[@]} -eq 0 ]]; then
  echo "No localized locale folders found."
  echo
else
  printf '%s\n' "${localization_lines[@]}"
fi
echo "Localization Summary:"
echo "${#locale_dirs[@]} locales checked"
echo "${locale_pass_count} PASS"
echo "${locale_fail_count} FAIL"
echo
echo "Overall Structure:"
echo "${structure_status}"
echo
echo "Content Review:"
echo "${content_review_status}"
echo
echo "Promotion:"
echo "${promotion_status}"
echo

if [[ ${#missing_official_files[@]} -gt 0 ]]; then
  echo "Missing official files:"
  printf '%s\n' "${missing_official_files[@]}"
fi

if [[ ${#missing_generated_source_files[@]} -gt 0 ]]; then
  echo
  echo "Missing generated files:"
  printf '%s\n' "${missing_generated_source_files[@]}"
fi

if [[ ${#missing_localized_files[@]} -gt 0 ]]; then
  echo
  echo "Missing localized files:"
  printf '%s\n' "${missing_localized_files[@]}"
fi
