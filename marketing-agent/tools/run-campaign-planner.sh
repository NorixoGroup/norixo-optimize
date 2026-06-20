#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"
GOAL=""

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-planner.sh <scenario-name> --goal=\"...\"" >&2
  exit 1
fi

shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --goal=*)
      GOAL="${1#--goal=}"
      shift
      ;;
    --goal)
      GOAL="${2:-}"
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

if [[ -z "${GOAL}" ]]; then
  echo "Error: missing goal." >&2
  echo "Usage: bash marketing-agent/tools/run-campaign-planner.sh <scenario-name> --goal=\"...\"" >&2
  exit 1
fi

SCENARIO_DIR="${SIMULATIONS_DIR}/${SCENARIO_NAME}"
OUTPUT_FILE="${SCENARIO_DIR}/campaign-planner-report.md"

if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Error: scenario directory not found: ${SCENARIO_DIR}" >&2
  exit 1
fi

goal_normalized="$(printf '%s' "${GOAL}" | tr '[:upper:]' '[:lower:]')"

campaign_type="General Awareness"
template="General Awareness 3 Days"
duration="3 days"
items="3"
platforms=("Facebook" "Instagram")

case "${goal_normalized}" in
  *launch*)
    campaign_type="Feature Launch"
    template="Feature Launch 7 Days"
    duration="7 days"
    items="7"
    platforms=("Facebook" "Instagram" "LinkedIn" "X")
    ;;
  *tutorial*)
    campaign_type="Tutorial"
    template="Tutorial 5 Days"
    duration="5 days"
    items="5"
    platforms=("Facebook" "Instagram")
    ;;
  *seo*)
    campaign_type="Evergreen SEO"
    template="Evergreen SEO 5 Days"
    duration="5 days"
    items="5"
    platforms=("Facebook" "Instagram")
    ;;
  *comparison*)
    campaign_type="Comparison"
    template="Comparison 5 Days"
    duration="5 days"
    items="5"
    platforms=("Facebook" "Instagram" "Snapchat")
    ;;
  *testimonial*)
    campaign_type="Testimonial"
    template="Testimonial 4 Days"
    duration="4 days"
    items="4"
    platforms=("Facebook" "Instagram")
    ;;
  *update*)
    campaign_type="Product Update"
    template="Product Update 4 Days"
    duration="4 days"
    items="4"
    platforms=("Facebook" "Instagram")
    ;;
  *newsletter*)
    campaign_type="Newsletter"
    template="Newsletter 3 Days"
    duration="3 days"
    items="3"
    platforms=("Facebook" "Instagram")
    ;;
esac

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
Campaign Planner Report

Scenario:
${SCENARIO_NAME}

Goal:
${GOAL}

Recommended Campaign:

${campaign_type}

Template:

${template}

Duration:

${duration}

Items:

${items}

Platforms:

$(printf '%s\n' "${platforms[@]}")

Status:

READY
EOF

cat "${temp_report_file}"

if [[ -f "${OUTPUT_FILE}" ]]; then
  echo "Error: campaign planner report already exists: ${OUTPUT_FILE}" >&2
  exit 1
fi

cp "${temp_report_file}" "${OUTPUT_FILE}"
