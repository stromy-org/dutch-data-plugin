# Workflow Templates

Use these templates to shape final workflow outputs. The top-level contract is defined in `output-contract.md`.

## Recommended research chains

These are soft defaults rather than mandatory recipes:

- Prefer `get_dossier_timeline` + `koop_search` + `get_legislative_brief` for deterministic dossier work.
- Consider `list_factions` + `list_committees` + `search_votes` for parliamentary context and factional structure.
- Use `get_member` + `search_activities` + `search_votes` for actor research, but treat former MPs as historical profiles.
- Prefer `roo_list_organizations` + `roo_get_organization` when normalizing ministry and organization identities across sources.

For discovery, prefer the skill docs, MCP README, MCP resources, and MCP introspection. Do not rely on external `tool_search` to find this MCP consistently.

## 1. Topic monitor

### Use when

- the user asks for a topic brief, monitor, or update
- the user cares about cross-source signal volume more than native source semantics

### MCP calls

1. `search_documents`

Recommended parameters:

```json
{
  "keyword": "<topic>",
  "date_from": "<optional YYYY-MM-DD>",
  "date_to": "<optional YYYY-MM-DD>",
  "max_results": 25
}
```

### Result shape

Each result should keep:

- `source`
- `title`
- `doc_type`
- `published_at`
- `dossier_number`
- `summary`
- `content_url`

### Metadata

- `returned_count`
- `source_counts`
- `warnings`
- `tool_calls`
- optional `synthesis`

## 2. Dossier tracker

### Use when

- the user gives a dossier number
- the user wants procedural chronology rather than search retrieval

### MCP calls

1. `get_dossier_timeline(dossier_number=...)`
2. optional narrative enrichment from `search_documents(..., sources=["rijksoverheid"])` using dossier title keywords

### Timeline staging

Assign a simple `stage` to every event:

- `dossier_documents`
- `parliamentary_activity`
- `decision`

This stage is downstream convenience only; it does not replace the canonical MCP event type.

### Metadata

- `dossier`
- `stage_counts`
- `warnings`
- `narrative_context`
- `linkage_notes`

## 3. Actor brief

### Use when

- the user asks for an MP or parliamentary actor
- the user wants a quick profile plus parliamentary context

### MCP calls

1. `get_member` (can run in parallel with `list_factions` for context)
2. if one match and active: `search_activities(actor=<member name>)` + `search_votes(faction=<member faction>)` in parallel
3. if one match and inactive: `search_activities(actor=<member name>)` only — see inactive handling below

### Ambiguity handling

If `get_member` returns multiple matches:

- keep `results[]` as the candidate list
- set `metadata.ambiguity=true`
- do not fabricate recent activity for the wrong person

### Inactive member handling

Check `metadata.Functie` in the `get_member` response:

- `"Tweede Kamerlid"` → active, proceed with full workflow
- `"Oud Kamerlid"` → former MP, apply these rules:
  - Note inactive status prominently in the brief
  - `faction` will likely be `null` — check `metadata.Fractielabel` for last known faction
  - `search_activities` returns historical activity only — label it as such
  - Skip `search_votes` by faction (no current faction to proxy)
  - If the former faction still exists in `list_factions`, optionally include faction vote context labeled as "former faction activity — not attributable to this member"
  - If the former faction has dissolved, note it as a political restructuring finding

### Resolved brief shape

Return one object with:

- `member` (include `active` status and `former_faction` when applicable)
- `recent_activities`
- `vote_context` (empty array with explanation for inactive members)
- `committee_signals`

`vote_context` must be labeled faction proxy context when member-level attribution is unavailable.

## 4. Committee watch

### Use when

- the user wants upcoming or recent committee activity
- the user is monitoring a specific committee's agenda

### MCP calls

1. `list_committees` (to resolve committee name/abbreviation)
2. `search_activities(committee=<name or abbreviation>)`

Run both in parallel when the committee name is already known.

### Result shape

- `committee`: resolved committee object
- `activities[]`: normalized activity records

### Metadata

- `returned_count`
- `warnings`
- `tool_calls`

**`workflow_type`**: `committee_watch`

## 5. Legislative scan

### Use when

- the user wants a broad procedural scan of recent legislation and votes
- not focused on a single dossier

### MCP calls

1. `search_documents(doc_type="wetgeving", ...)` + `search_votes(...)` in parallel

### Result shape

- `documents[]`: legislative documents with dossier numbers
- `votes[]`: recent vote results with faction positions

### Metadata

- `source_counts`
- `warnings`
- `tool_calls`

**`workflow_type`**: `legislative_scan`

## 6. Ministry narrative

### Use when

- the user wants to compare government messaging with parliamentary activity on a topic

### MCP calls

1. `search_documents(..., sources=["rijksoverheid"])` or `rijksoverheid_search`
2. optionally `search_activities` for parallel parliamentary movement

Run both in parallel when parameters are independent.

### Result shape

- `government_narrative[]`: Rijksoverheid documents/news
- `parliamentary_activity[]`: TK activities on the same topic

### Metadata

- `source_counts`
- `linkage_notes`: explain whether linkage is keyword-based or dossier-based
- `warnings`

**`workflow_type`**: `ministry_narrative`

Keep ministry narrative and parliamentary activity as separate arrays. Do not claim deterministic linkage unless a dossier key is present.

## 7. Parliamentary landscape

### Use when

- the user asks about the current political composition of parliament
- the user wants a snapshot of factions, seat counts, coalitions, or recent structural changes
- context-building before a deeper policy or actor analysis

### MCP calls

Run all in a single parallel batch:

1. `list_factions`
2. `list_committees`
3. optionally `search_votes(max_results=10)` for recent vote activity

### Result shape

Each result in `results[]`:

- `factions[]`: faction objects with `name`, `abbreviation`, `seats`, `active_since`
- `committees[]`: committee objects with `name`, `abbreviation`, `type` (vaste/tijdelijke/overige)
- `recent_votes[]`: optional recent vote summaries showing faction positions

### Metadata

- `total_seats`: sum of all faction seats
- `faction_count`: number of active factions
- `committee_count`: number of active committees
- `warnings`
- `tool_calls`
- optional `synthesis`: 2-3 observations about notable political structure (new factions, splinters, large seat shifts)

**`workflow_type`**: `parliamentary_landscape`

## 8. Exploratory MCP test pass

Use this when the goal is to test MCP coverage rather than answer one policy question.

### Recommended sequence

**Batch 1 — reference lookups** (all in parallel):
1. `list_ministries(limit=10)`
2. `list_subjects(limit=10)`
3. `list_factions(limit=10)`
4. `list_committees(limit=10)`

**Batch 2 — unified search tools** (all in parallel):
5. `rijksoverheid_search(endpoint="documents", rows=3)`
6. `search_documents(max_results=5)`
7. `search_activities(max_results=10)`
8. `search_votes(max_results=10)`

**Batch 3 — composite and single-record tools** (may depend on IDs from batch 1-2):
9. `get_dossier_timeline(dossier_number=..., max_results_per_source=5, timeline_limit=20)`
10. `rijksoverheid_get(endpoint=..., id=<from batch 2>)`
11. `tk_get(entity=..., id=<from batch 1>)`

**Batch 4 — legislation tools** (all in parallel):
12. `bwb_search(title="grondwet", max_results=3)`
13. `wetgevingskalender_search(wgk_type="Wet", max_results=5)`
14. `search_legislation(keyword="woningbouw", max_results=5)`
15. `roo_list_organizations(org_type="Ministerie")`

**Batch 5 — native search tools** (after unified path):
16. `tk_search(entity=..., filter=..., top=5)`
17. `tk_count(entity=...)`
18. `koop_search(query=..., max_records=5)`
19. `get_member(query=...)`

**Batch 6 — single record fetches** (depends on IDs from prior batches):
20. `bwb_get(identifier=<from batch 4>)`
21. `wetgevingskalender_get(identifier=<from batch 4>)`
22. `roo_get_organization(uri=<from batch 4>)`
23. `get_legislative_brief(dossier_number=...)`

### Rules

- Maximize parallelization within each batch.
- Record tool failures explicitly as findings — do not retry or abandon.
- Use source-native tools after the bounded unified path, not before.

**`workflow_type`**: `exploratory_test`

## 9. Legislation lookup

### Use when

- the user wants to find a specific Dutch law by title or BWB identifier
- the user wants version metadata for a known law

### MCP calls

1. `bwb_search(title=..., regelingsoort=..., ...)` for search
2. `bwb_get(identifier=...)` for version retrieval

### Result shape

Each result should keep:

- `identifier` (BWB identifier)
- `title`
- `type`
- `authority`
- `rechtsgebied` (array of legal areas)
- `geldigheid_start` / `geldigheid_eind`
- `preferred_url`

### Metadata

- `returned_count`
- `version_count` (when multiple toestanden exist)
- `warnings`
- `tool_calls`

**`workflow_type`**: `legislation_lookup`

BWB uses zoekservice.overheid.nl (SRU 1.2). Title search uses keyword matching (`overheidbwb.titel all "..."`). Prefer exact identifiers when available.

## 10. Legislative calendar watch

### Use when

- the user wants to monitor upcoming legislation in the pipeline
- the user wants a bounded view by type, ministry, phase, or topic

### MCP calls

1. `wetgevingskalender_search(keyword=..., wgk_type=..., ministry=..., phase=...)`

Use `phase` to filter by legislative stage: `Voorbereiding`, `Raad van State`, `Tweede Kamer`, `Eerste Kamer`, `Bekendmaking`.

### Result shape

Each result should keep:

- `identifier` (WGK identifier)
- `title`
- `type` (case-sensitive: Wet, Amvb, Regeling)
- `ministry`
- `phase`
- `entry_into_force`
- `modified`

### Metadata

- `returned_count`
- `type_counts`
- `phase_counts`
- `ministry_counts`
- `warnings`
- `tool_calls`

**`workflow_type`**: `legislative_calendar_watch`

## 11. Law-to-dossier brief

### Use when

- the user wants a combined brief for a dossier or BWB identifier
- the user wants to see enacted law + parliamentary publications together

### MCP calls

1. `get_legislative_brief(dossier_number=..., bwb_identifier=...)`

Provide at least one of `dossier_number` or `bwb_identifier`.

### Result shape

- `law[]`: BWB version records
- `publications[]`: KOOP kamerstukken

### Metadata

- `dossier_number`
- `bwb_identifier`
- `law_count`
- `publication_count`
- `warnings`
- `tool_calls`

**`workflow_type`**: `law_to_dossier_brief`

## 12. Organization lookup

### Use when

- the user wants to resolve a Dutch government organization name to its canonical identifier
- the user needs organization codes (KVK, OIN, RSIN)
- normalizing ministry names from BWB/WGK/Rijksoverheid outputs

### MCP calls

1. `roo_list_organizations(org_type="Ministerie")` for listing
2. `roo_get_organization(uri=...)` for detail with identification codes

### Result shape

For listing:

- `label` (organization name)
- `abbreviation`
- `uri` (TOOI URI)

For detail:

- `label`
- `abbreviation`
- `identification` (KVK, OIN, RSIN codes)

Prefer feeding the full TOOI URI returned by `roo_list_organizations` into `roo_get_organization`.

### Metadata

- `returned_count`
- `org_type` (filter used)
- `warnings`
- `tool_calls`

**`workflow_type`**: `organization_lookup`
