import type { MockBacklinkDiscoveryFixture } from "./mock-backlink-discovery-provider";

export const demoBacklinkDiscoveryFixtures: readonly MockBacklinkDiscoveryFixture[] = [
  {
    query: "airbnb host resources",
    countryCode: "US",
    languageCode: "en",
    items: [
      {
        url: "https://host-resources.example/resources",
        title: "Demonstration host resource directory",
        snippet: "Fictitious preview result for the Norixo dry-run demonstration.",
        rank: 1,
      },
      {
        url: "https://vacation-tools.example/best-airbnb-tools",
        title: "Demonstration vacation rental tools list",
        snippet: "Fictitious preview result for the Norixo dry-run demonstration.",
        rank: 2,
      },
      {
        url: "https://rental-guides.example/airbnb-host-guide",
        title: "Demonstration host guide",
        snippet: "Fictitious preview result for the Norixo dry-run demonstration.",
        rank: 3,
      },
      {
        url: "https://hospitality-lab.example/resources/hosts",
        title: "Demonstration hospitality resources",
        snippet: "Fictitious preview result for the Norixo dry-run demonstration.",
        rank: 4,
      },
      {
        url: "https://partner-preview.example/host-resources",
        title: "Demonstration partner resources",
        snippet: "Fictitious preview result for the Norixo dry-run demonstration.",
        rank: 5,
      },
    ],
  },
];
