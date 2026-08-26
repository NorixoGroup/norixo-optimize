"use client";

import { useMemo, useState } from "react";
import type { Tool } from "@/data/tools";
import CopyCalculationButton from "./CopyCalculationButton";

type Props = {
  tool: Tool;
  canonicalUrl?: string;
};

function toNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function calculate(tool: Tool, values: Record<string, string>) {
  const revenue = toNumber(values.revenue);
  const nights = toNumber(values.nights);
  const bookedNights = toNumber(values.bookedNights);
  const availableNights = toNumber(values.availableNights);
  const nightlyRate = toNumber(values.nightlyRate);
  const targetRevenue = toNumber(values.targetRevenue);
  const expenses = toNumber(values.expenses);

  switch (tool.slug) {
    case "airbnb-adr-calculator":
      return nights > 0 ? revenue / nights : null;

    case "airbnb-occupancy-calculator":
      return availableNights > 0 ? (bookedNights / availableNights) * 100 : null;

    case "airbnb-revpar-calculator":
      return isValidRevparValues(values) ? revenue / availableNights : null;

    case "airbnb-revenue-calculator":
      return nightlyRate * bookedNights || null;

    case "airbnb-pricing-calculator":
      return bookedNights > 0 ? targetRevenue / bookedNights : null;

    case "airbnb-profit-calculator":
      return revenue - expenses;

    default:
      return null;
  }
}

function isValidRevparValues(values: Record<string, string>) {
  const revenueValue = values.revenue?.trim();
  const availableNightsValue = values.availableNights?.trim();

  if (!revenueValue || !availableNightsValue) {
    return false;
  }

  const revenue = Number(revenueValue);
  const availableNights = Number(availableNightsValue);

  return (
    Number.isFinite(revenue) &&
    revenue >= 0 &&
    Number.isFinite(availableNights) &&
    Number.isInteger(availableNights) &&
    availableNights > 0
  );
}

function getRevparValidationMessage(values: Record<string, string>) {
  const revenueValue = values.revenue?.trim();
  const availableNightsValue = values.availableNights?.trim();

  if (!revenueValue && !availableNightsValue) {
    return undefined;
  }

  if (revenueValue) {
    const revenue = Number(revenueValue);
    if (!Number.isFinite(revenue) || revenue < 0) {
      return "Enter accommodation revenue as zero or a positive number.";
    }
  }

  if (availableNightsValue) {
    const availableNights = Number(availableNightsValue);
    if (
      !Number.isFinite(availableNights) ||
      !Number.isInteger(availableNights) ||
      availableNights <= 0
    ) {
      return "Enter available nights as a whole number greater than zero.";
    }
  }

  return undefined;
}

function getResultLabel(tool: Tool) {
  switch (tool.slug) {
    case "airbnb-adr-calculator":
      return "Estimated ADR";
    case "airbnb-occupancy-calculator":
      return "Estimated occupancy";
    case "airbnb-revpar-calculator":
      return "Estimated RevPAR";
    case "airbnb-revenue-calculator":
      return "Estimated revenue";
    case "airbnb-pricing-calculator":
      return "Target nightly rate";
    case "airbnb-profit-calculator":
      return "Estimated profit";
    default:
      return "Estimated result";
  }
}

function getSuffix(tool: Tool) {
  switch (tool.slug) {
    case "airbnb-occupancy-calculator":
      return "%";
    default:
      return "";
  }
}

function getInterpretation(tool: Tool, result: number | null) {
  if (result === null) {
    return "Enter your numbers to estimate the result.";
  }

  if (tool.slug === "airbnb-occupancy-calculator") {
    return "Interpret occupancy alongside pricing, availability convention, season, property type, revenue objective, and operating costs. A higher rate is not automatically better; compare figures only when their availability conventions are compatible.";
  }

  if (tool.slug === "airbnb-profit-calculator") {
    if (result < 0) return "Estimated profit is negative. Review pricing, costs, occupancy, and operating expenses.";
    if (result < 500) return "Profit is positive but limited. Pricing and cost structure may need review.";
    return "Profit looks positive. Review whether pricing and occupancy can be optimized further.";
  }

  return "Use this estimate as a starting point, then compare it with local market demand, competitor pricing, listing quality, and guest expectations.";
}

function getRecommendationTitle(tool: Tool) {
  switch (tool.slug) {
    case "airbnb-adr-calculator":
      return "How to interpret ADR";
    case "airbnb-occupancy-calculator":
      return "How to interpret occupancy";
    case "airbnb-revpar-calculator":
      return "How to interpret RevPAR";
    case "airbnb-revenue-calculator":
      return "Revenue is not profit";
    case "airbnb-pricing-calculator":
      return "Use this as a pricing starting point";
    case "airbnb-profit-calculator":
      return "Review your cost structure";
    default:
      return "How to use this result";
  }
}

function getRecommendationBody(tool: Tool) {
  switch (tool.slug) {
    case "airbnb-adr-calculator":
      return "ADR is useful only when compared with occupancy and total revenue. A high ADR can be positive, but not if it causes too many empty nights.";
    case "airbnb-occupancy-calculator":
      return "High occupancy is not always the goal. If your calendar fills too quickly, your nightly rate may be too low for the market.";
    case "airbnb-revpar-calculator":
      return "RevPAR combines occupancy and pricing into one metric. Use it alongside ADR and occupancy rather than looking at booked nights or nightly rate alone.";
    case "airbnb-revenue-calculator":
      return "Revenue is before expenses. To understand real performance, compare revenue with cleaning, utilities, fees, rent, mortgage, maintenance and taxes.";
    case "airbnb-pricing-calculator":
      return "A target nightly rate is only a starting point. Local demand, competition, seasonality, photos, reviews and guest expectations still matter.";
    case "airbnb-profit-calculator":
      return "Profit depends on both revenue and costs. If profit is weak, review expenses, pricing, occupancy, and whether the listing can justify a higher rate.";
    default:
      return "Use this result as a planning estimate, then compare it with your local market and listing quality.";
  }
}

export default function Calculator({ tool, canonicalUrl }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const result = useMemo(() => calculate(tool, values), [tool, values]);
  const revparValidationMessage =
    tool.slug === "airbnb-revpar-calculator"
      ? getRevparValidationMessage(values)
      : undefined;
  const formattedResult =
    result === null
      ? undefined
      : `${getResultLabel(tool)}: ${formatNumber(result)}${getSuffix(tool)}`;
  const calculation =
    formattedResult && canonicalUrl
      ? [
          tool.title,
          "",
          "Inputs",
          ...tool.fields.map((field) => `${field.label}: ${values[field.key] ?? ""}`),
          "",
          "Results",
          formattedResult,
          "",
          "Calculated with:",
          "Norixo",
          canonicalUrl,
        ].join("\n")
      : undefined;

  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <h2 className="text-3xl font-semibold">{tool.formulaLabel}</h2>
      <p className="mt-4 leading-8 text-[#4C5C55]">
        {tool.formulaDescription}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {tool.fields.map((field) => (
          <label key={field.key} className="block">
            <span className="text-sm font-semibold">{field.label}</span>
            <input
              type="number"
              inputMode={
                tool.slug === "airbnb-revpar-calculator" && field.key === "availableNights"
                  ? "numeric"
                  : "decimal"
              }
              min={
                tool.slug === "airbnb-revpar-calculator"
                  ? field.key === "revenue"
                    ? 0
                    : 1
                  : undefined
              }
              step={
                tool.slug === "airbnb-revpar-calculator" && field.key === "availableNights"
                  ? 1
                  : "any"
              }
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-[#10231F]/10 bg-[#FAF7F2] px-4 py-3 outline-none"
            />
          </label>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-[#FAF7F2] p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
          Result
        </p>

        <p className="mt-2 text-2xl font-semibold">
          {formattedResult ?? "Enter your numbers to estimate the result."}
        </p>

        {revparValidationMessage ? (
          <p className="mt-2 text-sm leading-6 text-[#B42318]" role="alert">
            {revparValidationMessage}
          </p>
        ) : null}

        {canonicalUrl ? (
          <CopyCalculationButton
            calculation={calculation}
            calculatorTitle={tool.title}
          />
        ) : null}

        <p className="mt-2 text-sm leading-6 text-[#5F6F68]">
          {getInterpretation(tool, result)}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-[#10231F]/10 bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D96C3B]">
          Norixo recommendation
        </p>
        <h3 className="mt-2 text-xl font-semibold">
          {getRecommendationTitle(tool)}
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#5F6F68]">
          {getRecommendationBody(tool)}
        </p>
      </div>
    </div>
  );
}
