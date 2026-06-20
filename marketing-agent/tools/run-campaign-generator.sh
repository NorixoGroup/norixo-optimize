#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-generator.sh <scenario-name>" >&2
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
PLANNER_REPORT_FILE="${SCENARIO_DIR}/campaign-planner-report.md"
CAMPAIGN_DIR="${SCENARIO_DIR}/campaign"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

if [[ ! -f "${PLANNER_REPORT_FILE}" ]]; then
  echo "Error: campaign planner report not found: ${PLANNER_REPORT_FILE}" >&2
  exit 1
fi

extract_single_value() {
  local label="$1"

  awk -v label="${label}" '
    $0 == label ":" {
      getline
      while ($0 ~ /^[[:space:]]*$/) {
        getline
      }
      print
      exit
    }
  ' "${PLANNER_REPORT_FILE}"
}

extract_platforms() {
  awk '
    $0 == "Platforms:" {
      getline
      while (getline) {
        if ($0 == "Status:" || $0 ~ /^Status:$/) {
          exit
        }
        if ($0 ~ /^[[:space:]]*$/) {
          next
        }
        print
      }
    }
  ' "${PLANNER_REPORT_FILE}"
}

campaign_type="$(extract_single_value "Recommended Campaign")"
template_name="$(extract_single_value "Template")"
duration="$(extract_single_value "Duration")"
items_count="$(extract_single_value "Items")"
status="$(extract_single_value "Status")"

platforms=()
while IFS= read -r platform; do
  if [[ -n "${platform}" ]]; then
    platforms+=("${platform}")
  fi
done < <(extract_platforms)

if [[ -z "${campaign_type}" || -z "${template_name}" || -z "${duration}" || -z "${items_count}" || -z "${status}" ]]; then
  echo "Error: campaign planner report is incomplete." >&2
  exit 1
fi

if [[ -d "${CAMPAIGN_DIR}" ]]; then
  echo "Campaign already exists."
  echo "Generation blocked."
  exit 1
fi

mkdir -p "${CAMPAIGN_DIR}"

campaign_readme_file="${CAMPAIGN_DIR}/README.md"
campaign_file="${CAMPAIGN_DIR}/campaign.md"
items_file="${CAMPAIGN_DIR}/items.md"
calendar_file="${CAMPAIGN_DIR}/calendar.md"
qa_file="${CAMPAIGN_DIR}/qa.md"

platforms_block="$(printf '%s\n' "${platforms[@]}")"

cat > "${campaign_readme_file}" <<EOF
# Campaign Structure

This folder was generated from the Campaign Planner report for:

- ${SCENARIO_NAME}

It contains only a structural campaign draft:

- campaign definition
- campaign items
- campaign calendar
- campaign QA

No marketing content is generated here.
EOF

cat > "${campaign_file}" <<EOF
# Campaign

## Scenario

${SCENARIO_NAME}

## Type recommande

${campaign_type}

## Template

${template_name}

## Duree

${duration}

## Nombre d'items

${items_count}

## Plateformes

${platforms_block}

## Statut

DRAFT
EOF

if [[ "${template_name}" == "Feature Launch 7 Days" ]]; then
  item_titles=(
    "Teaser"
    "Announcement"
    "Tutorial"
    "Use Case"
    "FAQ"
    "Comparison"
    "Final CTA"
  )
else
  item_titles=()
  item_index=1
  while [[ ${item_index} -le ${items_count} ]]; do
    item_titles+=("Campaign Item ${item_index}")
    item_index=$((item_index + 1))
  done
fi

{
  echo "# Campaign Items"
  echo
  echo "## Scenario"
  echo
  echo "${SCENARIO_NAME}"
  echo
  echo "## Template"
  echo
  echo "${template_name}"
  echo
  echo "## Items"
  echo

  item_number=1
  previous_item_id=""
  for item_title in "${item_titles[@]}"; do
    item_id="$(printf '%s-item-%02d' "${SCENARIO_NAME}" "${item_number}")"

    echo "### ${item_number}. ${item_title}"
    echo
    echo "- id : ${item_id}"
    echo "- objectif : a preciser"
    echo "- angle : a preciser"
    echo "- format : a preciser"
    echo "- plateformes : $(printf '%s, ' "${platforms[@]}" | sed 's/, $//')"
    if [[ -n "${previous_item_id}" ]]; then
      echo "- dependances : ${previous_item_id}"
    else
      echo "- dependances : aucune"
    fi
    echo "- statut : DRAFT"
    echo

    previous_item_id="${item_id}"
    item_number=$((item_number + 1))
  done
} > "${items_file}"

{
  echo "# Campaign Calendar"
  echo
  echo "## Scenario"
  echo
  echo "${SCENARIO_NAME}"
  echo
  echo "## Duration"
  echo
  echo "${duration}"
  echo
  echo "## Calendar"
  echo

  day_number=1
  for item_title in "${item_titles[@]}"; do
    echo "### Day ${day_number}"
    echo
    echo "- item : ${item_title}"
    echo "- plateforme : $(printf '%s, ' "${platforms[@]}" | sed 's/, $//')"
    echo "- langue : fr source"
    echo "- format : a preciser"
    echo "- objectif : a preciser"
    echo "- statut : DRAFT"
    echo
    day_number=$((day_number + 1))
  done
} > "${calendar_file}"

cat > "${qa_file}" <<EOF
# Campaign QA

## Scenario

${SCENARIO_NAME}

## Structural Review

- planner report trouve : YES
- campaign creee : YES
- items crees : YES
- calendar cree : YES
- publication bloquee : YES
- review requise : YES

## Status

DRAFT
EOF

echo "Campaign structure created."
echo "Scenario: ${SCENARIO_NAME}"
echo "Campaign type: ${campaign_type}"
echo "Template: ${template_name}"
echo "Items: ${items_count}"
