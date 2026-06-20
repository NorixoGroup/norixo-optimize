#!/usr/bin/env bash

set -euo pipefail

REQUEST_FILE="${1:-}"
OPENAI_API_URL="https://api.openai.com/v1/responses"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-5.4-mini}"
DEFAULT_PROMPT='Return exactly this JSON:

{
  "status":"success",
  "message":"Norixo AI OpenAI provider operational"
}'

if [[ -z "${REQUEST_FILE}" ]]; then
  echo "Error: missing runtime request file." >&2
  exit 1
fi

if [[ ! -f "${REQUEST_FILE}" ]]; then
  echo "Error: runtime request file not found: ${REQUEST_FILE}" >&2
  exit 1
fi

extract_json_string_field() {
  local field="$1"
  local file="$2"

  jq -r --arg field "${field}" '.[$field] // empty' "${file}"
}

request_id="$(extract_json_string_field "requestId" "${REQUEST_FILE}")"
request_timestamp="$(extract_json_string_field "timestamp" "${REQUEST_FILE}")"
prompt="$(extract_json_string_field "prompt" "${REQUEST_FILE}")"

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

now_ms() {
  printf '%s000' "$(date +%s)"
}

emit_response() {
  local status="$1"
  local output="$2"
  local confidence="$3"
  local warnings_json="$4"
  local errors_json="$5"
  local input_tokens="$6"
  local output_tokens="$7"
  local latency_ms="$8"
  local timestamp="$9"

  jq -n \
    --arg requestId "${request_id}" \
    --arg provider "openai" \
    --arg status "${status}" \
    --arg output "${output}" \
    --arg confidence "${confidence}" \
    --argjson warnings "${warnings_json}" \
    --argjson errors "${errors_json}" \
    --argjson inputTokens "${input_tokens}" \
    --argjson outputTokens "${output_tokens}" \
    --argjson estimatedCost "0" \
    --argjson latencyMs "${latency_ms}" \
    --arg timestamp "${timestamp}" \
    '{
      requestId: $requestId,
      provider: $provider,
      status: $status,
      output: $output,
      confidence: $confidence,
      warnings: $warnings,
      errors: $errors,
      usage: {
        inputTokens: $inputTokens,
        outputTokens: $outputTokens,
        estimatedCost: $estimatedCost
      },
      latency: {
        ms: $latencyMs
      },
      timestamp: $timestamp
    }'
}

if [[ -z "${request_id}" ]]; then
  request_id="openai-request"
fi

if [[ -z "${request_timestamp}" ]]; then
  request_timestamp="$(now_iso)"
fi

if [[ -z "${prompt}" ]]; then
  prompt="${DEFAULT_PROMPT}"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  emit_response \
    "failed" \
    "" \
    "0" \
    '["OpenAI provider not executed."]' \
    '["OPENAI_API_KEY missing"]' \
    0 \
    0 \
    0 \
    "$(now_iso)"
  exit 0
fi

payload_file="$(mktemp)"
response_body_file="$(mktemp)"
trap 'rm -f "${payload_file}" "${response_body_file}"' EXIT

jq -n \
  --arg model "${OPENAI_MODEL}" \
  --arg prompt "${DEFAULT_PROMPT}" \
  '{
    model: $model,
    input: $prompt
  }' > "${payload_file}"

started_at_ms="$(now_ms)"
http_status=""
curl_exit=0

if ! http_status="$(
  curl -sS \
    -m 30 \
    -o "${response_body_file}" \
    -w "%{http_code}" \
    -X POST "${OPENAI_API_URL}" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -H "Content-Type: application/json" \
    --data-binary "@${payload_file}"
)"; then
  curl_exit=$?
fi

finished_at_ms="$(now_ms)"
latency_ms="$((finished_at_ms - started_at_ms))"
timestamp="$(now_iso)"

if [[ "${curl_exit}" -ne 0 ]]; then
  emit_response \
    "failed" \
    "" \
    "0" \
    '[]' \
    "$(jq -cn --arg message "OpenAI network error (curl exit ${curl_exit})" '[ $message ]')" \
    0 \
    0 \
    "${latency_ms}" \
    "${timestamp}"
  exit 0
fi

if [[ ! "${http_status}" =~ ^2 ]]; then
  api_error_message="$(
    jq -r '.error.message // .message // "OpenAI API error"' "${response_body_file}" 2>/dev/null || printf '%s' "OpenAI API error"
  )"

  emit_response \
    "failed" \
    "" \
    "0" \
    '[]' \
    "$(jq -cn --arg message "${api_error_message} (HTTP ${http_status})" '[ $message ]')" \
    0 \
    0 \
    "${latency_ms}" \
    "${timestamp}"
  exit 0
fi

provider_output="$(
  jq -r '
    .output_text
    // ([.output[]?.content[]? | select(.type == "output_text") | .text] | join(""))
    // empty
  ' "${response_body_file}" 2>/dev/null
)"

if [[ -z "${provider_output}" ]]; then
  emit_response \
    "failed" \
    "" \
    "0" \
    '["OpenAI response received but no text output could be extracted."]' \
    '["Invalid or unsupported OpenAI response payload."]' \
    "$(jq -r '.usage.input_tokens // 0' "${response_body_file}" 2>/dev/null || printf '0')" \
    "$(jq -r '.usage.output_tokens // 0' "${response_body_file}" 2>/dev/null || printf '0')" \
    "${latency_ms}" \
    "${timestamp}"
  exit 0
fi

input_tokens="$(jq -r '.usage.input_tokens // 0' "${response_body_file}" 2>/dev/null || printf '0')"
output_tokens="$(jq -r '.usage.output_tokens // 0' "${response_body_file}" 2>/dev/null || printf '0')"

emit_response \
  "success" \
  "${provider_output}" \
  "100" \
  '[]' \
  '[]' \
  "${input_tokens}" \
  "${output_tokens}" \
  "${latency_ms}" \
  "${timestamp}"
