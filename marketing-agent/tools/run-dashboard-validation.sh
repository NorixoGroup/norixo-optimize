#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARKETING_AGENT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DASHBOARD_DATA_DIR="${MARKETING_AGENT_DIR}/dashboard-data"
REGISTRY_JSON_FILE="${DASHBOARD_DATA_DIR}/scenario-registry.json"
OUTPUT_FILE="${DASHBOARD_DATA_DIR}/dashboard-validation-report.md"
REFRESH_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --refresh)
      REFRESH_MODE="true"
      shift
      ;;
    --refresh=true)
      REFRESH_MODE="true"
      shift
      ;;
    --refresh=false)
      REFRESH_MODE="false"
      shift
      ;;
    *)
      echo "Error: unknown argument: $1" >&2
      echo "Usage: bash marketing-agent/tools/run-dashboard-validation.sh [--refresh|--refresh=true]" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${DASHBOARD_DATA_DIR}"

if [[ -f "${OUTPUT_FILE}" && "${REFRESH_MODE}" != "true" ]]; then
  echo "Dashboard validation report already exists."
  echo "Generation blocked."
  echo "Hint:"
  echo "Run with --refresh to rebuild."
  exit 1
fi

json_status="FAIL"
metadata_status="FAIL"
summary_status="FAIL"
collection_status="FAIL"
fields_status="FAIL"
overall_status="FAIL"
dashboard_ready="NO"

if [[ -f "${REGISTRY_JSON_FILE}" ]]; then
  validation_output="$(ruby -rjson -e '
    begin
      data = JSON.parse(File.read(ARGV[0]))

      json_status = "PASS"
      metadata_status =
        data.is_a?(Hash) &&
        data["generatedAt"].is_a?(String) &&
        !data["generatedAt"].empty? &&
        data["globalStatus"].is_a?(String) &&
        !data["globalStatus"].empty? ? "PASS" : "FAIL"

      summary = data["summary"]
      summary_status =
        summary.is_a?(Hash) &&
        summary["scenarios"].is_a?(Integer) &&
        summary["healthy"].is_a?(Integer) &&
        summary["warnings"].is_a?(Integer) &&
        summary["errors"].is_a?(Integer) ? "PASS" : "FAIL"

      scenarios = data["scenarios"]
      collection_status = scenarios.is_a?(Array) ? "PASS" : "FAIL"

      fields_status =
        scenarios.is_a?(Array) &&
        scenarios.all? do |scenario|
          scenario.is_a?(Hash) &&
          scenario["id"].is_a?(String) &&
          !scenario["id"].empty? &&
          scenario["campaign"].is_a?(String) &&
          !scenario["campaign"].empty? &&
          scenario["status"].is_a?(String) &&
          !scenario["status"].empty? &&
          scenario["readiness"].is_a?(String) &&
          !scenario["readiness"].empty?
        end ? "PASS" : "FAIL"

      overall_status =
        [json_status, metadata_status, summary_status, collection_status, fields_status].all? { |status| status == "PASS" } ? "PASS" : "FAIL"

      dashboard_ready = overall_status == "PASS" ? "YES" : "NO"

      puts "json=#{json_status}"
      puts "metadata=#{metadata_status}"
      puts "summary=#{summary_status}"
      puts "collection=#{collection_status}"
      puts "fields=#{fields_status}"
      puts "overall=#{overall_status}"
      puts "dashboard_ready=#{dashboard_ready}"
    rescue JSON::ParserError
      puts "json=FAIL"
      puts "metadata=FAIL"
      puts "summary=FAIL"
      puts "collection=FAIL"
      puts "fields=FAIL"
      puts "overall=FAIL"
      puts "dashboard_ready=NO"
    end
  ' "${REGISTRY_JSON_FILE}")"

  while IFS='=' read -r key value; do
    case "${key}" in
      json)
        json_status="${value}"
        ;;
      metadata)
        metadata_status="${value}"
        ;;
      summary)
        summary_status="${value}"
        ;;
      collection)
        collection_status="${value}"
        ;;
      fields)
        fields_status="${value}"
        ;;
      overall)
        overall_status="${value}"
        ;;
      dashboard_ready)
        dashboard_ready="${value}"
        ;;
    esac
  done <<< "${validation_output}"
fi

temp_report_file="$(mktemp)"
trap 'rm -f "${temp_report_file}"' EXIT

cat > "${temp_report_file}" <<EOF
DASHBOARD DATA VALIDATION

--------------------------------

JSON

${json_status}

Metadata

${metadata_status}

Summary

${summary_status}

Scenario Collection

${collection_status}

Scenario Fields

${fields_status}

--------------------------------

Overall

${overall_status}

Dashboard Ready

${dashboard_ready}

Next Phase

React Admin Dashboard
EOF

cp "${temp_report_file}" "${OUTPUT_FILE}"

cat "${temp_report_file}"

if [[ "${REFRESH_MODE}" == "true" ]]; then
  echo
  echo "Dashboard validation refreshed."
else
  echo
  echo "Dashboard validation generated."
fi
echo "Overall: ${overall_status}"
echo "Dashboard Ready: ${dashboard_ready}"
