#!/usr/bin/env bash

set -euo pipefail

LEARNING_INPUT_FILE="${1:-}"

if [[ -z "${LEARNING_INPUT_FILE}" ]]; then
  echo "Error: missing learning input path." >&2
  echo "Usage: bash marketing-agent/providers/learning/mock/provider.sh <learning-input-path>" >&2
  exit 1
fi

if [[ ! -f "${LEARNING_INPUT_FILE}" ]]; then
  echo "Error: learning input not found: ${LEARNING_INPUT_FILE}" >&2
  exit 1
fi

echo "LEARNING MOCK PROVIDER"
echo
echo "Provider: mock-learning"
echo "Status: READY"
echo "Learning: DISABLED"
echo "Decision: DISABLED"
echo "Network: DISABLED"
echo "Report Path: N/A"
