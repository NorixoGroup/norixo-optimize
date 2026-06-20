#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REGISTRY_FILE="${MARKETING_AGENT_DIR}/simulations/scenario-registry.md"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

if [[ ! -f "${REGISTRY_FILE}" ]]; then
  echo "Error: scenario registry not found: ${REGISTRY_FILE}" >&2
  exit 1
fi

if [[ ! -d "${SIMULATIONS_DIR}" ]]; then
  echo "Error: simulations directory not found: ${SIMULATIONS_DIR}" >&2
  exit 1
fi

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

priority_to_score() {
  case "$1" in
    High) echo "90" ;;
    Medium) echo "75" ;;
    Low) echo "60" ;;
    *) echo "50" ;;
  esac
}

registry_rows="$(
  awk -F'|' '
    function trim(s) {
      gsub(/^[ \t]+|[ \t]+$/, "", s)
      return s
    }
    $0 ~ /^\|/ {
      id = trim($2)
      if (id == "" || id == "ID" || id ~ /^-+$/) {
        next
      }
      print id "\t" trim($3) "\t" trim($4) "\t" trim($5) "\t" trim($6) "\t" trim($7) "\t" trim($8) "\t" trim($9)
    }
  ' "${REGISTRY_FILE}"
)"

if [[ -z "${registry_rows}" ]]; then
  echo "Error: no scenario rows found in registry: ${REGISTRY_FILE}" >&2
  exit 1
fi

has_feature_rows="no"
has_guide_rows="no"
has_city_rows="no"
existing_scenarios_count=0
has_booking_optimizer_done="no"
has_booking_done="no"

while IFS= read -r scenario_dir; do
  scenario_name="$(basename "${scenario_dir}")"
  if [[ "${scenario_name}" == "simulations" ]]; then
    continue
  fi
  existing_scenarios_count=$((existing_scenarios_count + 1))
  if [[ "${scenario_name}" == *"booking-optimizer"* ]]; then
    has_booking_optimizer_done="yes"
  fi
done < <(find "${SIMULATIONS_DIR}" -maxdepth 1 -type d | sort)

best_id=""
best_name=""
best_priority=""
best_score=0
best_reason=""
best_slug=""

while IFS=$'\t' read -r id name family status qa regression priority notes; do
  if [[ "${family}" == "Feature Launch" ]] || [[ "${family}" == "Release Communication" ]]; then
    has_feature_rows="yes"
  fi
  if [[ "${name}" == *"Guide"* ]] || [[ "${family}" == "Educational Content" ]]; then
    has_guide_rows="yes"
  fi
  if [[ "${name}" == *"City"* ]] || [[ "${family}" == "Local Marketing" ]]; then
    has_city_rows="yes"
  fi
  if [[ "${name}" == *"Booking"* ]] && [[ "${status}" == "Done" ]]; then
    has_booking_done="yes"
  fi

  if [[ "${status}" != "Planned" ]] && [[ "${status}" != "In Progress" ]]; then
    continue
  fi

  score="$(priority_to_score "${priority}")"
  reason="Scenario planned in the registry."

  if [[ "${name}" == "Booking Optimizer" ]]; then
    if [[ "${has_booking_done}" == "yes" ]] && [[ "${has_booking_optimizer_done}" == "no" ]]; then
      score=$((score + 2))
      reason="La famille Booking n'est couverte que par le scenario 001."
    else
      reason="Booking reste une famille prioritaire a renforcer."
    fi
  elif [[ "${family}" == "Educational Content" ]]; then
    score=$((score + 1))
    reason="La famille educational content reste sous-couverte."
  elif [[ "${family}" == "Local Marketing" ]]; then
    score=$((score + 1))
    reason="La famille local marketing n'a pas encore de scenario dedie."
  else
    reason="$(trim "${notes}")"
  fi

  if (( score > best_score )); then
    best_score="${score}"
    best_id="${id}"
    best_name="${name}"
    best_priority="${priority}"
    best_reason="${reason}"
  fi
done <<< "${registry_rows}"

if [[ -z "${best_id}" ]]; then
  echo "Error: no candidate scenario found in registry." >&2
  exit 1
fi

best_slug="$(printf '%s' "${best_name}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9][^a-z0-9]*/-/g; s/^-//; s/-$//')"
recommended_scenario="scenario-${best_id}-${best_slug}"

echo "============================"
echo
echo "MARKETING BRAIN REPORT"
echo
echo "============================"
echo
echo "Topics analyses :"
echo

if [[ "${has_feature_rows}" == "yes" ]]; then
  echo "✓ nouvelles fonctionnalites"
fi

if [[ "${has_guide_rows}" == "yes" ]]; then
  echo "✓ guides"
fi

if [[ "${has_city_rows}" == "yes" ]]; then
  echo "✓ villes"
fi

if (( existing_scenarios_count > 0 )); then
  echo "✓ scenarios existants"
fi

echo
echo "Sujet recommande :"
echo
echo "Scenario ${best_id}"
echo "${best_name}"
echo
echo "Raison :"
echo
echo "${best_reason}"
echo
echo "Priorite :"
echo
printf '%s\n' "${best_priority}" | tr '[:lower:]' '[:upper:]'
echo
echo "Confiance :"
echo
echo "${best_score} %"
echo
echo "Action recommandee :"
echo
echo "Creer ${recommended_scenario}"
