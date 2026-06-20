#!/usr/bin/env bash

set -euo pipefail

VIDEO_STORYBOARD_FILE="${1:-}"

if [[ -z "${VIDEO_STORYBOARD_FILE}" ]]; then
  echo "Error: missing video storyboard path." >&2
  echo "Usage: bash marketing-agent/providers/videos/mock/provider.sh <video-storyboard-path>" >&2
  exit 1
fi

if [[ ! -f "${VIDEO_STORYBOARD_FILE}" ]]; then
  echo "Error: video storyboard not found: ${VIDEO_STORYBOARD_FILE}" >&2
  exit 1
fi

echo "VIDEO MOCK PROVIDER"
echo
echo "Provider: mock-video"
echo "Status: READY"
echo "Generation: DISABLED"
echo "Network: DISABLED"
echo "Video Path: N/A"
echo "Preview Path: N/A"
