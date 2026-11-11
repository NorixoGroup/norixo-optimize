import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidenceBackedContactInput,
  persistOrReuseEvidenceBackedResolvedContact,
  resolveBacklinkContacts,
  type ContactResolutionCandidate,
  type ContactResolutionFetcher,
  type ContactResolutionPage,
  type ExistingResolvedContact,
} from "@/lib/backlinks/services/contactResolutionService";

const HOMEPAGE = "https://example.com/";
const ABOUT = "https://example.com/about";

function htmlPage(body: string): ContactResolutionPage {
  return { url: "", status: 200, contentType: "text/html", body };
}

function makeFetcher(pages: Record<string, string>): ContactResolutionFetcher {
  return async (url: string) => {
    const body = pages[url];
    if (body == null) return { url, status: 404, contentType: "text/html", body: "" };
    return { ...htmlPage(body), url };
  };
}

function jsonLd(persons: ReadonlyArray<{ email: string; name?: string; jobTitle?: string }>): string {
  return `<script type="application/ld+json">${JSON.stringify(
    persons.map((p) => ({ "@type": "Person", email: p.email, name: p.name, jobTitle: p.jobTitle })),
  )}</script>`;
}

function jsonLdPersons(
  persons: ReadonlyArray<{ email?: string; name?: string; jobTitle?: string; sameAs?: string | string[] }>,
): string {
  return `<script type="application/ld+json">${JSON.stringify(
    persons.map((p) => ({ "@type": "Person", email: p.email, name: p.name, jobTitle: p.jobTitle, sameAs: p.sameAs })),
  )}</script>`;
}

async function resolve(pages: Record<string, string>, maxPages = 3) {
  return resolveBacklinkContacts({
    homepageUrl: HOMEPAGE,
    domainHostname: "example.com",
    fetchPage: makeFetcher(pages),
    maxPages,
  });
}

function findByEmail(candidates: readonly ContactResolutionCandidate[], email: string): ContactResolutionCandidate | undefined {
  return candidates.find((c) => c.email === email);
}

test("same-page association: a Person entry matching the page's evidenced email is attached", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:jane@example.com">Email Jane</a>
      ${jsonLd([{ email: "jane@example.com", name: "Jane Doe", jobTitle: "Editor" }])}
    </body></html>`,
  });
  const candidate = findByEmail(result.candidates, "jane@example.com");
  assert.equal(candidate?.fullName, "Jane Doe");
  assert.equal(candidate?.roleTitle, "Editor");
});

test("exact e-mail match only: a Person entry for a different address never attaches by mere co-presence", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:info@example.com">Contact</a>
      ${jsonLd([{ email: "someone-else@example.com", name: "Not Info", jobTitle: "Nobody" }])}
    </body></html>`,
  });
  const candidate = findByEmail(result.candidates, "info@example.com");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("cross-page rejection: a Person entry on another page never attaches to an email only evidenced elsewhere", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:jane@example.com">Email Jane</a>
      <a href="/about">About us</a>
    </body></html>`,
    [ABOUT]: `<html><body>
      ${jsonLd([{ email: "jane@example.com", name: "Jane Doe", jobTitle: "Editor" }])}
    </body></html>`,
  });
  const candidate = findByEmail(result.candidates, "jane@example.com");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("intra-page ambiguity: conflicting name/title pairs for one e-mail on the same page reject enrichment, and stay rejected across later pages", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:edgar@example.com">Email Edgar</a>
      <a href="/about">About us</a>
      ${jsonLd([
        { email: "edgar@example.com", name: "Edgar A", jobTitle: "Editor" },
        { email: "edgar@example.com", name: "Edgar B", jobTitle: "Writer" },
      ])}
    </body></html>`,
    [ABOUT]: `<html><body>
      edgar@example.com
      ${jsonLd([{ email: "edgar@example.com", name: "Edgar A", jobTitle: "Editor" }])}
    </body></html>`,
  });
  const candidate = findByEmail(result.candidates, "edgar@example.com");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("persistent cross-page conflict: a consistent pair on one page followed by a different pair for the same e-mail on another page rejects enrichment", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:sam@example.com">Email Sam</a>
      <a href="/about">About us</a>
      ${jsonLd([{ email: "sam@example.com", name: "Sam Rivera", jobTitle: "Editor" }])}
    </body></html>`,
    [ABOUT]: `<html><body>
      sam@example.com
      ${jsonLd([{ email: "sam@example.com", name: "Samuel R.", jobTitle: "Writer" }])}
    </body></html>`,
  });
  const candidate = findByEmail(result.candidates, "sam@example.com");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("field transmission: resolved name/title reach contact persistence input built from the candidate", () => {
  const candidate: ContactResolutionCandidate = {
    email: "jane@example.com",
    contactFormUrl: null,
    linkedinUrl: null,
    fullName: "Jane Doe",
    roleTitle: "Editor",
    evidence: [{ kind: "mailto", value: "jane@example.com", sourceUrl: HOMEPAGE, confidence: "strong" }],
  };
  const input = buildEvidenceBackedContactInput({ domainId: "domain-1", contactKey: "CT-1", candidate });
  assert.equal(input?.full_name, "Jane Doe");
  assert.equal(input?.role_title, "Editor");
});

test("field transmission with a simulated client: full_name/role_title are passed through contact creation, and an existing contact is never overwritten", async () => {
  const candidate: ContactResolutionCandidate = {
    email: "jane@example.com",
    contactFormUrl: null,
    linkedinUrl: null,
    fullName: "Jane Doe",
    roleTitle: "Editor",
    evidence: [{ kind: "mailto", value: "jane@example.com", sourceUrl: HOMEPAGE, confidence: "strong" }],
  };
  const created: Array<Record<string, unknown>> = [];
  const createResult = await persistOrReuseEvidenceBackedResolvedContact({
    workspaceId: "workspace-1",
    domainId: "domain-1",
    actorUserId: "actor-1",
    candidate,
    listContactsByDomain: async () => [],
    createContact: async (_workspaceId, _actorUserId, input) => {
      created.push(input as unknown as Record<string, unknown>);
      return { id: "contact-1" };
    },
  });
  assert.equal(createResult.disposition, "created");
  assert.equal(created[0]?.full_name, "Jane Doe");
  assert.equal(created[0]?.role_title, "Editor");

  const existing: ExistingResolvedContact[] = [
    { id: "contact-1", contact_status: "unverified", email_normalized: "jane@example.com", linkedin_url: null, contact_form_url: null },
  ];
  let createCalled = false;
  const reuseResult = await persistOrReuseEvidenceBackedResolvedContact({
    workspaceId: "workspace-1",
    domainId: "domain-1",
    actorUserId: "actor-1",
    candidate,
    listContactsByDomain: async () => existing,
    createContact: async () => {
      createCalled = true;
      return { id: "should-not-be-created" };
    },
  });
  assert.equal(reuseResult.disposition, "reused");
  assert.equal(reuseResult.id, "contact-1");
  assert.equal(createCalled, false);
});

test("linkedin sameAs: a Person's personal profile matching the page's evidenced LinkedIn URL is attached", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      ${jsonLdPersons([{ name: "Jane Doe", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" }])}
    </body></html>`,
  });
  const candidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe");
  assert.equal(candidate?.fullName, "Jane Doe");
  assert.equal(candidate?.roleTitle, "Editor");
});

test("linkedin sameAs: cross-page rejection — a Person entry on another page never attaches to a LinkedIn URL only evidenced elsewhere", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      <a href="/about">About us</a>
    </body></html>`,
    [ABOUT]: `<html><body>
      ${jsonLdPersons([{ name: "Jane Doe", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" }])}
    </body></html>`,
  });
  const candidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("linkedin sameAs: a company profile URL is never accepted as a personal identity match", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="https://www.linkedin.com/company/example-inc">LinkedIn</a>
      ${jsonLdPersons([{ name: "Example Inc", jobTitle: "Company", sameAs: "https://www.linkedin.com/company/example-inc" }])}
    </body></html>`,
  });
  const candidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/company/example-inc");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("linkedin sameAs: malformed or deceptive LinkedIn-lookalike URLs are never accepted", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      ${jsonLdPersons([{ name: "Jane Doe", jobTitle: "Editor", sameAs: "https://linkedin.com.evil.example/in/jane-doe" }])}
    </body></html>`,
  });
  const candidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("linkedin sameAs: conflicting name/title pairs for one LinkedIn URL on the same page reject enrichment, and stay rejected across later pages", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      <a href="/about">About us</a>
      ${jsonLdPersons([
        { name: "Jane A", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" },
        { name: "Jane B", jobTitle: "Writer", sameAs: "https://www.linkedin.com/in/jane-doe" },
      ])}
    </body></html>`,
    [ABOUT]: `<html><body>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      ${jsonLdPersons([{ name: "Jane A", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" }])}
    </body></html>`,
  });
  const candidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe");
  assert.equal(candidate?.fullName, null);
  assert.equal(candidate?.roleTitle, null);
});

test("cross-channel contradiction: conflicting pairs for a linked email+LinkedIn identity reject enrichment on both channels", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      <a href="mailto:jane@example.com">Email Jane</a>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      <a href="/about">About us</a>
      ${jsonLdPersons([{ email: "jane@example.com", name: "Jane Doe", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" }])}
    </body></html>`,
    [ABOUT]: `<html><body>
      jane@example.com
      ${jsonLdPersons([{ email: "jane@example.com", name: "Janet D.", jobTitle: "Senior Editor" }])}
    </body></html>`,
  });
  const emailCandidate = findByEmail(result.candidates, "jane@example.com");
  const linkedinCandidate = result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe");
  assert.equal(emailCandidate?.fullName, null);
  assert.equal(emailCandidate?.roleTitle, null);
  assert.equal(linkedinCandidate?.fullName, null);
  assert.equal(linkedinCandidate?.roleTitle, null);
});

test("linkedin sameAs: a Person entry never creates a new LinkedIn candidate by itself", async () => {
  const result = await resolve({
    [HOMEPAGE]: `<html><body>
      ${jsonLdPersons([{ name: "Jane Doe", jobTitle: "Editor", sameAs: "https://www.linkedin.com/in/jane-doe" }])}
    </body></html>`,
  });
  assert.equal(result.candidates.find((c) => c.linkedinUrl === "https://www.linkedin.com/in/jane-doe"), undefined);
  assert.equal(result.candidates.length, 0);
});
