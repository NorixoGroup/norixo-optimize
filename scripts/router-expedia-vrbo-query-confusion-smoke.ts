import { detectPlatform } from "../lib/extractors/router";

const cases = [
  {
    name: "expedia-normal-hotel",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information",
    expected: "expedia",
  },
  {
    name: "expedia-query-ref-vrbo",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information?ref=vrbo",
    expected: "expedia",
  },
  {
    name: "expedia-query-campaign-vacation-rental",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information?campaign=vacation-rental",
    expected: "expedia",
  },
  {
    name: "expedia-query-campaign-vacation-rentals",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information?campaign=vacation-rentals",
    expected: "expedia",
  },
  {
    name: "expedia-query-ref-homeaway",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information?ref=homeaway",
    expected: "expedia",
  },
  {
    name: "expedia-query-ref-abritel",
    url: "https://www.expedia.com/Paris-Hotels-Test-Hotel.h12345.Hotel-Information?ref=abritel",
    expected: "expedia",
  },
  {
    name: "expedia-vacation-rental-path",
    url: "https://www.expedia.com/vacation-rentals/example-property",
    expected: "vrbo",
  },
  {
    name: "expedia-private-vacation-home-path",
    url: "https://www.expedia.com/private-vacation-home/example-property",
    expected: "vrbo",
  },
  {
    name: "vrbo-canonical",
    url: "https://www.vrbo.com/en-ca/cottage-rental/p4708780",
    expected: "vrbo",
  },
  {
    name: "abritel-canonical",
    url: "https://www.abritel.fr/location-vacances/p1718754",
    expected: "vrbo",
  },
  {
    name: "homeaway-canonical",
    url: "https://www.homeaway.com/vacation-rental/p123456",
    expected: "vrbo",
  },
  {
    name: "evil-expedia-lookalike",
    url: "https://expedia.com.evil.example/vacation-rentals/test",
    expected: "other",
  },
  {
    name: "evil-vrbo-lookalike",
    url: "https://vrbo.com.evil.example/vacation-rental/p123",
    expected: "other",
  },
] as const;

let failures = 0;

for (const test of cases) {
  const actual = detectPlatform(test.url);
  const ok = actual === test.expected;

  console.log(
    `${test.name}=${ok ? "PASS" : "FAIL"} expected=${test.expected} actual=${actual}`,
  );

  if (!ok) failures += 1;
}

console.log(`ROUTER_QUERY_CONFUSION_FAILURES=${failures}`);

process.exitCode = failures === 0 ? 0 : 1;
