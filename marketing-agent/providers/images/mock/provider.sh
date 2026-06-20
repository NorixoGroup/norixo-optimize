#!/usr/bin/env bash

set -euo pipefail

IMAGE_PROMPT_FILE="${1:-}"

if [[ -z "${IMAGE_PROMPT_FILE}" ]]; then
  echo "Error: missing image prompt path." >&2
  echo "Usage: bash marketing-agent/providers/images/mock/provider.sh <image-prompt-path>" >&2
  exit 1
fi

if [[ ! -f "${IMAGE_PROMPT_FILE}" ]]; then
  echo "Error: image prompt not found: ${IMAGE_PROMPT_FILE}" >&2
  exit 1
fi

echo "IMAGE MOCK PROVIDER"
echo
echo "Provider: mock-image"
echo "Status: READY"
echo "Generation: disabled"
echo "Network: disabled"
echo "Image Path: N/A"
echo "Preview Path: N/A"
