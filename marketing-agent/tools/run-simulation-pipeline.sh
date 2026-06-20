#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SIMULATIONS_DIR="${MARKETING_AGENT_DIR}/simulations"

SCENARIO_NAME="${1:-}"

if [[ -z "${SCENARIO_NAME}" ]]; then
  echo "Error: missing scenario name." >&2
  echo "Usage: bash marketing-agent/tools/run-simulation-pipeline.sh <scenario-name>" >&2
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
brain_status="NOT RUN"
creation_status="NOT RUN"
qa_status="NOT RUN"
next_action=""

brain_output="$(bash "${SCRIPT_DIR}/run-marketing-brain.sh" 2>&1)"
brain_status="OK"

if [[ -d "${SCENARIO_DIR}" ]]; then
  creation_status="ALREADY EXISTS"
else
  creation_output="$(bash "${SCRIPT_DIR}/create-simulation-scenario.sh" "${SCENARIO_NAME}" 2>&1)"
  creation_status="CREATED"
fi

if qa_output="$(bash "${SCRIPT_DIR}/qa-simulation-scenario.sh" "${SCENARIO_NAME}" 2>&1)"; then
  qa_status="OK"
  next_action="Complete the editorial review and keep the scenario aligned with the registry."
else
  qa_status="INCOMPLETE"
  next_action="Complete the missing scenario files before human QA and scorecard review."
fi

echo "============================"
echo
echo "SIMULATION PIPELINE REPORT"
echo
echo "============================"
echo
echo "Scenario:"
echo
echo "${SCENARIO_NAME}"
echo
echo "Marketing Brain:"
echo
echo "${brain_status}"
echo
echo "Scenario creation:"
echo
echo "${creation_status}"
echo
echo "Scenario QA:"
echo
echo "${qa_status}"
echo
echo "Next human action:"
echo
echo "${next_action}"
echo
echo "----- Marketing Brain Output -----"
echo
echo "${brain_output}"
echo
echo "----- Scenario QA Output -----"
echo
echo "${qa_output}"
