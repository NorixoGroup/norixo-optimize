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

They can also create an isolated working folder for one campaign item so a
future item-level Content Agent flow can generate content without touching the
existing scenario outputs.

They can also run a first structural QA check for one isolated campaign item
workspace before any real content generation happens inside that item folder.

They can also create a first provider-independent image request for a validated
campaign item without generating any image or calling any API.

They can also transform that image request into a structured visual prompt that
is ready for a future image provider, while still avoiding any image
generation or API usage.

They can also run a first structural QA pass on an image request and image
prompt pair before any future image provider execution.

They can also call a mock image provider foundation to validate the provider
layer and write a provider report without generating any image or using any
network access.

They can also aggregate the full image preparation state of one campaign item
into a single status report without contacting any provider or generating any
image.

They can also create a first provider-independent video request for a validated
campaign item without generating any video, script, storyboard, or provider
call.

They can also transform that video request into a first structured video script
with placeholder sections, while still avoiding any AI call, provider call, or
storyboard creation.

They can also transform that video script into a first structured storyboard
with placeholder scenes, while still avoiding any provider call or video
generation.

They can also run a first structural QA pass on a video request, video script,
and video storyboard set before any future video provider execution.

They can also call a mock video provider foundation to validate the provider
layer and write a provider report without generating any video or using any
network access.

They can also aggregate the full video preparation state of one campaign item
into a single status report without contacting any provider or generating any
video.

They can also create a first provider-independent publication request for a
validated campaign item once the content, image, and video status layers are
all ready.

They can also run a first structural QA pass on that publication request before
any future publication provider execution.

They can also call a mock publication provider foundation to validate the
provider layer and write a provider report without publishing anything or using
any network access.

They can also aggregate the full publication preparation state of one campaign
item into a single status report without contacting any provider or publishing
any content.

They can also create a first provider-independent analytics request for a
campaign item whose publication status is already structurally validated.

They can also run a first structural QA pass on that analytics request before
any future analytics provider execution.

They can also call a mock analytics provider foundation to validate the
provider layer and write a provider report without collecting any data or using
any network access.

They can also aggregate the full analytics preparation state of one campaign
item into a single status report without contacting any provider or collecting
any data.

They can also create a first provider-independent learning input for a
campaign item whose analytics status is already structurally validated.

They can also run a first structural QA pass on that learning input before any
future learning provider or signal engine execution.

They can also call a mock learning provider foundation to validate the
provider layer and write a provider report without producing any signal,
recommendation, or decision.
