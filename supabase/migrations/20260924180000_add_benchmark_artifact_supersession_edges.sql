begin;

create table if not exists public.benchmark_artifact_supersession_edges (
  successor_artifact_id uuid not null
    references public.benchmark_artifacts(id)
    on delete cascade,

  predecessor_artifact_id uuid not null
    references public.benchmark_artifacts(id)
    on delete cascade,

  created_at timestamptz not null
    default timezone('utc', now()),

  constraint benchmark_artifact_supersession_edges_pkey
    primary key (
      successor_artifact_id,
      predecessor_artifact_id
    ),

  constraint benchmark_artifact_supersession_edges_no_self
    check (
      successor_artifact_id <> predecessor_artifact_id
    )
);

create index if not exists benchmark_artifact_supersession_edges_predecessor_idx
  on public.benchmark_artifact_supersession_edges (
    predecessor_artifact_id
  );

create index if not exists benchmark_artifact_supersession_edges_successor_idx
  on public.benchmark_artifact_supersession_edges (
    successor_artifact_id
  );

alter table public.benchmark_artifact_supersession_edges
  enable row level security;

comment on table public.benchmark_artifact_supersession_edges is
  'Append-only benchmark artifact lineage edges. Supports one successor superseding multiple predecessor artifacts without mutating historical benchmark artifacts. Server-side only.';

comment on column public.benchmark_artifact_supersession_edges.successor_artifact_id is
  'Benchmark artifact that supersedes one or more predecessor artifacts.';

comment on column public.benchmark_artifact_supersession_edges.predecessor_artifact_id is
  'Historical benchmark artifact superseded by the successor artifact.';

commit;
