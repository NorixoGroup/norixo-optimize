# Local Tools

## Role

This folder contains small local helpers for the `marketing-agent/` workspace.

## Principles

- no link to the Norixo application runtime
- no external API calls
- no internet dependency
- no production impact
- no publication behavior

## Scope

These tools exist only to help prepare, duplicate, and structure local
documentation assets for Norixo AI simulations.

They can also support manual QA checks on scenario completeness without
assessing editorial quality automatically.

They may also provide simple rule-based decision helpers for scenario planning,
without generating content or calling any external service.

They can also chain local planning, scenario creation, and completeness QA into
small simulation pipelines with no production impact.

They can also prepare structured editorial briefs to assist future content
production without generating the final copy automatically.

They can also generate draft working files from an editorial brief without
touching final scenario content.

They can also expose local adapter foundations for future AI integrations while
keeping APIs, network access, and provider calls disabled by default.

They can also route local draft preparation through the Mock LLM Adapter to
validate future integration paths without using any external model.

They can also resolve local providers through a dedicated resolver layer before
reaching the LLM Adapter.

They can also wire a full local runtime flow from editorial brief to runtime
request, adapter, resolver, provider, runtime response, and draft generation
without any external dependency.

They can also run an isolated real OpenAI draft test against a scenario brief
without touching existing draft or final content files.

They can also run a first editorial review pre-check to detect whether an
OpenAI draft exists and whether any official files would block promotion.

They can also run a structural quality gate to confirm whether a scenario has
the minimum draft, brief, official files, source generated content pack, and
all discovered localized packs required for future human review.

They can also assemble a single editorial review report that groups the full
generated content pack into one human validation document without changing the
source files.

They can also generate a first non-official marketing content pack from an
existing editorial brief through the LLM Adapter and the optional OpenAI
provider, while keeping official scenario files untouched.

They can also run a first single-locale localization pipeline against a
generated content pack, using locale profiles and the LLM Adapter without
touching source generated files or official scenario files.

They can also generate a single localization status report to show which
locales exist, which ones are already generated, and which locale should come
next according to the dynamically discovered preferred locale order.

They can also run the same single-locale localization engine for any locale
that has a documented profile, without hardcoding the supported locale list in
the script itself.

They can also prepare a dynamic localization batch plan that lists the
remaining locales to generate and the recommended command order without
launching any translation.

They can also orchestrate a sequential localization batch by calling the
existing Translation Agent one locale at a time, while keeping translation
logic outside of the batch runner itself and only treating complete localized
packs as already generated.

They can also generate a compact localization review summary that aggregates
the structural status of all generated locales without copying any localized
content into the report.

They can also run a first deterministic Campaign Planner that recommends a
campaign type, template, duration, item count, and platforms from a simple
goal string without generating any content.

They can also generate a first structural `campaign/` folder from a Campaign
Planner report, while refusing to overwrite an existing campaign.

They can also run a first structural campaign QA check to verify that a
campaign folder is complete before any future content generation step.

They can also generate a compact campaign status report that summarizes the
planner state, campaign structure, QA state, and readiness for the next phase.

They can also create a first structural bridge between campaign items and the
future Content Agent by turning each item into an independent content request.
