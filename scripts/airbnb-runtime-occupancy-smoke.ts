import assert from "node:assert/strict";

import type { CapturedNetworkPayload } from "../lib/brightdata";
import {
  collectAirbnbRuntimeCalendarCandidatesFromDomNodes,
  collectAirbnbRuntimeCalendarCandidatesFromPayloads,
  normalizeAirbnbExtractedOccupancyObservation,
  selectAirbnbFinalOccupancyObservation,
  type AirbnbRuntimeCalendarDomNode,
} from "../lib/extractors/airbnb";
import type { OccupancyObservation } from "../lib/extractors/types";

function makePayload(url: string, body: unknown): CapturedNetworkPayload {
  return {
    url,
    contentType: "application/json",
    bodyText: JSON.stringify(body),
  };
}

function makeUnavailableDay(date: string) {
  return {
    date,
    availabilityStatus: "unavailable",
  };
}

function makeAvailableDay(date: string) {
  return {
    date,
    availabilityStatus: "available",
  };
}

function isoDayFromOffset(daysFromToday: number): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + daysFromToday);
  return value.toISOString().slice(0, 10);
}

function makeBootstrapUnavailableObservation(): OccupancyObservation {
  return {
    status: "unavailable",
    rate: null,
    unavailableDays: 0,
    availableDays: 0,
    observedDays: 0,
    windowDays: 60,
    source: null,
    message: "Donnees d'occupation non disponibles pour cette annonce",
  };
}

function makeBootstrapAvailableObservation(): OccupancyObservation {
  return {
    status: "available",
    rate: 55,
    unavailableDays: 11,
    availableDays: 9,
    observedDays: 20,
    windowDays: 60,
    source: "calendar_section:bootstrap",
    message: null,
  };
}

function makeAllUnavailableSixtyDayObservation(): OccupancyObservation {
  return {
    status: "available",
    rate: 100,
    unavailableDays: 60,
    availableDays: 0,
    observedDays: 60,
    windowDays: 60,
    source: "alt:data.merlin.pdpAvailabilityCalendar.calendarMonths",
    message: null,
  };
}

function main() {
  const validPayload = makePayload("https://example.test/api/v3/calendar", {
    stayCalendar: {
      days: [
        makeUnavailableDay(isoDayFromOffset(1)),
        makeUnavailableDay(isoDayFromOffset(2)),
        makeAvailableDay(isoDayFromOffset(3)),
        makeAvailableDay(isoDayFromOffset(4)),
        makeUnavailableDay(isoDayFromOffset(5)),
        makeAvailableDay(isoDayFromOffset(6)),
        makeUnavailableDay(isoDayFromOffset(7)),
      ],
    },
  });

  const validCandidates =
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([validPayload]);
  const validSelected = selectAirbnbFinalOccupancyObservation({
    bootstrapObservation: makeBootstrapUnavailableObservation(),
    runtimePayloadObservation: makeAllUnavailableSixtyDayObservation(),
    runtimeDomObservation: null,
  });
  const validFinalObservation =
    normalizeAirbnbExtractedOccupancyObservation(validSelected);

  assert.ok(validCandidates.length > 0);
  assert.ok(validFinalObservation != null);
  assert.ok(validFinalObservation.observedDays > 0);
  assert.equal(
    validFinalObservation.availableDays + validFinalObservation.unavailableDays,
    validFinalObservation.observedDays
  );
  assert.equal(validFinalObservation.status, "available");

  const duplicatePayload = makePayload("https://example.test/api/v3/availability", {
    availabilityCalendar: {
      calendarDays: [
        makeUnavailableDay(isoDayFromOffset(8)),
        makeUnavailableDay(isoDayFromOffset(8)),
        makeAvailableDay(isoDayFromOffset(9)),
        makeAvailableDay(isoDayFromOffset(10)),
        makeAvailableDay(isoDayFromOffset(11)),
        makeUnavailableDay(isoDayFromOffset(12)),
        makeAvailableDay(isoDayFromOffset(13)),
        makeUnavailableDay(isoDayFromOffset(14)),
      ],
    },
  });
  const duplicatePayloadObservation =
    normalizeAirbnbExtractedOccupancyObservation(
      selectAirbnbFinalOccupancyObservation({
        bootstrapObservation: makeBootstrapUnavailableObservation(),
        runtimePayloadObservation: {
          status: "available",
          rate: 57,
          unavailableDays: 4,
          availableDays: 3,
          observedDays: 7,
          windowDays: 60,
          source: "runtime_payload:0:availability",
          message: null,
        },
        runtimeDomObservation: null,
      })
    );

  assert.equal(duplicatePayloadObservation?.observedDays, 7);

  const missingDatePayload = makePayload("https://example.test/api/v3/calendar", {
    stayCalendar: {
      days: [
        { availabilityStatus: "available" },
        { availabilityStatus: "unavailable" },
      ],
    },
  });
  const noDateResolved = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: null,
      runtimeDomObservation: null,
    })
  );
  assert.equal(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([missingDatePayload]).length,
    0
  );
  assert.equal(noDateResolved, null);

  const missingStatusPayload = makePayload("https://example.test/api/v3/calendar", {
    stayCalendar: {
      days: [
        { date: isoDayFromOffset(15) },
        { date: isoDayFromOffset(16) },
        { date: isoDayFromOffset(17) },
        { date: isoDayFromOffset(18) },
        { date: isoDayFromOffset(19) },
        { date: isoDayFromOffset(20) },
        { date: isoDayFromOffset(21) },
      ],
    },
  });
  const noStatusResolved = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: null,
      runtimeDomObservation: null,
    })
  );
  assert.equal(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([missingStatusPayload]).length,
    0
  );
  assert.equal(noStatusResolved, null);

  const availableStatusPayload = makePayload("https://example.test/api/v3/checkin", {
    calendarMonths: [
      {
        days: [
          { date: isoDayFromOffset(22), status: "bookable" },
          { date: isoDayFromOffset(23), availability: "open" },
          { date: isoDayFromOffset(24), availabilityStatus: "available" },
          { date: isoDayFromOffset(25), isAvailable: true },
          { date: isoDayFromOffset(26), available: true },
          { date: isoDayFromOffset(27), availableForCheckin: true },
          { date: isoDayFromOffset(28), isReservable: true },
        ],
      },
    ],
  });
  const availableStatusResolved =
    normalizeAirbnbExtractedOccupancyObservation(
      selectAirbnbFinalOccupancyObservation({
        bootstrapObservation: makeBootstrapUnavailableObservation(),
        runtimePayloadObservation: {
          status: "available",
          rate: 0,
          unavailableDays: 0,
          availableDays: 7,
          observedDays: 7,
          windowDays: 60,
          source: "runtime_payload:0:checkin",
          message: null,
        },
        runtimeDomObservation: null,
      })
    );
  assert.ok(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([availableStatusPayload]).length > 0
  );
  assert.equal(availableStatusResolved?.availableDays, 7);

  const unavailableStatusPayload = makePayload(
    "https://example.test/api/v3/checkout",
    {
      calendarMonths: [
        {
          days: [
            { date: isoDayFromOffset(29), status: "blocked" },
            { date: isoDayFromOffset(30), availability: "booked" },
            { date: isoDayFromOffset(31), availabilityStatus: "unavailable" },
            { date: isoDayFromOffset(32), isUnavailable: true },
            { date: isoDayFromOffset(33), isBlocked: true },
            { date: isoDayFromOffset(34), available: false },
            { date: isoDayFromOffset(35), isBookable: false },
          ],
        },
      ],
    }
  );
  const unavailableStatusResolved =
    normalizeAirbnbExtractedOccupancyObservation(
      selectAirbnbFinalOccupancyObservation({
        bootstrapObservation: makeBootstrapUnavailableObservation(),
        runtimePayloadObservation: {
          status: "available",
          rate: 100,
          unavailableDays: 7,
          availableDays: 0,
          observedDays: 7,
          windowDays: 60,
          source: "runtime_payload:0:checkout",
          message: null,
        },
        runtimeDomObservation: null,
      })
    );
  assert.ok(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([unavailableStatusPayload]).length > 0
  );
  assert.equal(unavailableStatusResolved?.unavailableDays, 7);

  const loggingOnlyPayload = makePayload("https://example.test/api/v3/calendar", {
    loggingData: {
      eventDate: "2099-06-01",
      message: "calendar rendered",
      sample: "no availability signal here",
    },
  });
  const loggingOnlyResolved = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: null,
      runtimeDomObservation: null,
    })
  );
  assert.equal(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([loggingOnlyPayload]).length,
    0
  );
  assert.equal(loggingOnlyResolved, null);

  const weakPayload = makePayload("https://example.test/api/v3/calendar", {
    stayCalendar: {
      days: [
        makeUnavailableDay(isoDayFromOffset(36)),
        makeAvailableDay(isoDayFromOffset(37)),
      ],
    },
  });
  const strongPayload = makePayload("https://example.test/api/v3/calendarMonths", {
    calendarMonths: [
      {
        days: [
          makeUnavailableDay(isoDayFromOffset(38)),
          makeUnavailableDay(isoDayFromOffset(39)),
          makeAvailableDay(isoDayFromOffset(40)),
          makeAvailableDay(isoDayFromOffset(41)),
          makeUnavailableDay(isoDayFromOffset(42)),
          makeAvailableDay(isoDayFromOffset(43)),
          makeUnavailableDay(isoDayFromOffset(44)),
          makeAvailableDay(isoDayFromOffset(45)),
          makeUnavailableDay(isoDayFromOffset(46)),
        ],
      },
    ],
  });
  const multiPayloadResolved = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: {
        status: "available",
        rate: 56,
        unavailableDays: 5,
        availableDays: 4,
        observedDays: 9,
        windowDays: 60,
        source: "runtime_payload:1:calendar",
        message: null,
      },
      runtimeDomObservation: null,
    })
  );
  assert.ok(
    collectAirbnbRuntimeCalendarCandidatesFromPayloads([weakPayload, strongPayload]).length > 0
  );
  assert.equal(multiPayloadResolved?.observedDays, 9);

  const bootstrapAvailable = makeBootstrapAvailableObservation();
  const preservedBootstrap = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: bootstrapAvailable,
      runtimePayloadObservation: makeAllUnavailableSixtyDayObservation(),
      runtimeDomObservation: null,
    })
  );
  assert.deepEqual(preservedBootstrap, {
    ...bootstrapAvailable,
    status: "available",
    message: null,
  });

  const unchangedUnavailable = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: null,
      runtimeDomObservation: null,
    })
  );
  assert.equal(unchangedUnavailable, null);

  const domNodes = [
    {
      dataDate: isoDayFromOffset(47),
      ariaLabel: "Date disponible",
      text: "1",
      className: "calendar-day available",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(48),
      ariaLabel: "Date indisponible",
      text: "2",
      className: "calendar-day blocked",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(49),
      ariaLabel: "Date disponible",
      text: "3",
      className: "calendar-day available",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(50),
      ariaLabel: "Date indisponible",
      text: "4",
      className: "calendar-day blocked",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(51),
      ariaLabel: "Date disponible",
      text: "5",
      className: "calendar-day available",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(52),
      ariaLabel: "Date indisponible",
      text: "6",
      className: "calendar-day blocked",
      disabled: false,
      ariaDisabled: "false",
    },
    {
      dataDate: isoDayFromOffset(53),
      ariaLabel: "Date disponible",
      text: "7",
      className: "calendar-day available",
      disabled: false,
      ariaDisabled: "false",
    },
  ] satisfies ReadonlyArray<AirbnbRuntimeCalendarDomNode>;

  const domCandidates = collectAirbnbRuntimeCalendarCandidatesFromDomNodes(domNodes);
  assert.equal(domCandidates.length, 1);

  const domResolved = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: null,
      runtimeDomObservation: {
        status: "available",
        rate: 43,
        unavailableDays: 3,
        availableDays: 4,
        observedDays: 7,
        windowDays: 60,
        source: "runtime_dom_calendar",
        message: null,
      },
    })
  );
  assert.equal(domResolved?.observedDays, 7);

  const deterministicA = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: makeAllUnavailableSixtyDayObservation(),
      runtimeDomObservation: null,
    })
  );
  const deterministicB = normalizeAirbnbExtractedOccupancyObservation(
    selectAirbnbFinalOccupancyObservation({
      bootstrapObservation: makeBootstrapUnavailableObservation(),
      runtimePayloadObservation: makeAllUnavailableSixtyDayObservation(),
      runtimeDomObservation: null,
    })
  );
  assert.deepEqual(deterministicA, deterministicB);

  assert.ok(deterministicA != null);
  assert.equal(deterministicA.observedDays, 60);
  assert.equal(deterministicA.availableDays, 0);
  assert.equal(deterministicA.unavailableDays, 60);
  assert.ok(!String(deterministicA.source ?? "").includes("http"));
  assert.ok(!String(deterministicA.source ?? "").includes("token"));

  const runtimeOnlyFinalObservation =
    normalizeAirbnbExtractedOccupancyObservation(
      selectAirbnbFinalOccupancyObservation({
        bootstrapObservation: makeBootstrapUnavailableObservation(),
        runtimePayloadObservation: makeAllUnavailableSixtyDayObservation(),
        runtimeDomObservation: null,
      })
    );
  assert.ok(runtimeOnlyFinalObservation != null);

  const runtimeOnlyWarning =
    runtimeOnlyFinalObservation == null
      ? "occupancy_observation_unavailable"
      : null;
  assert.equal(runtimeOnlyWarning, null);

  const noRuntimeWarning =
    unchangedUnavailable == null
      ? "occupancy_observation_unavailable"
      : null;
  assert.equal(noRuntimeWarning, "occupancy_observation_unavailable");

  console.log("PASS — Airbnb runtime occupancy smoke");
}

main();
