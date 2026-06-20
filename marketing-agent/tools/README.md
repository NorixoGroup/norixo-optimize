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
