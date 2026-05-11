---
name: dutch-gov-data
description: "Track Dutch public affairs signals across Tweede Kamer, Rijksoverheid, KOOP publications, BWB legislation, Wetgevingskalender, and ROO organizations using the `nl-gov-data` MCP. Supports twelve workflows: topic monitoring, dossier tracking, actor briefs, committee watch, legislative scan, ministry narrative, parliamentary landscape snapshot, legislation lookup, legislative calendar watch, law-to-dossier brief, organization lookup, and exploratory MCP testing. Now also supports content deep-reading: fetching and quoting actual document text (motions, bills, letters, debate transcripts, law articles, attachments). Produces structured JSON shaped for downstream Stromy workflows with `workflow_type`, `query_params`, `results`, and `metadata`. Use this skill whenever the user asks about Dutch parliament activity, Tweede Kamer dossiers, Dutch government policy signals, kamerstukken, dossier numbers, Dutch MPs, faction composition, ministry narrative, Dutch laws, legislation, wetgeving, wetgevingskalender, government organizations, OR wants to read/quote/summarize a specific Dutch government document, transcript, law article, or attachment."
---

# Dutch Government Data

## Overview

This skill is the orchestration layer over the `nl-gov-data` MCP. The MCP provides both a metadata surface and a content layer; this skill turns that surface into workflow-ready public-affairs outputs. The hosted remote FastMCP server (`nl-gov-data` as configured in `.mcp.json`) is the only runtime — no local stdio fallback is available in this plugin.

**The MCP now supports full content retrieval.** After metadata discovery, you can fetch and quote the actual text of:
- Kamerstukken (motions, bills, letters, memorie van toelichting)
- Aanhangsel van de Handelingen (kamervragen and answers)
- Handelingen (debate transcripts)
- Consolidated legislation text (BWB)
- Ministerial commitments (Toezeggingen)
- Debate transcripts with speaker attribution (VLOS)
- Rijksoverheid policy documents
- Attachments and beslisnota's (including PDF-only)

**Metadata titles are not evidence. Only quote from content tools.**

Use this skill when the user needs one of these outcomes:

- **Topic monitor**: what is happening on a Dutch policy topic across parliament and government narrative
- **Dossier tracker**: what happened in a specific dossier, in chronological order
- **Actor brief**: who a Dutch parliamentary actor is and what recent parliamentary activity surrounds them
- **Committee watch**: upcoming or recent activity for a specific committee
- **Legislative scan**: broad procedural scan of new legislation and votes
- **Ministry narrative**: what the government is saying on a topic versus parliamentary activity
- **Parliamentary landscape**: snapshot of current faction composition, seat counts, and political structure
- **Legislation lookup**: find a Dutch law by title/identifier, retrieve current version metadata, link to dossier if available
- **Legislative calendar watch**: monitor upcoming legislation by type, ministry, or topic
- **Law-to-dossier brief**: given a dossier number or BWB identifier, produce a brief combining enacted law + pipeline status + parliamentary publications
- **Organization lookup**: resolve Dutch government organization names to canonical TOOI URIs
- **Exploratory test**: systematic MCP coverage test across all tools

The skill keeps the MCP as the canonical data layer. It does not invent cross-source links that the MCP does not support. Where linkage is uncertain, state that clearly in `metadata`.

## MCP runtime

Use the `nl-gov-data` MCP as configured in `.mcp.json` (hosted FastMCP endpoint). If the remote endpoint returns `401 Unauthorized`, treat that as an authentication/configuration issue and report it clearly. There is no local stdio fallback in this plugin — do not attempt to run a local server.

## Data exposure inventory

All exposed data should be treated as public/open government data, but chaining sources can create strategically sensitive public-affairs intelligence. Keep provenance and uncertainty visible.

| Surface | Exposed data | Strategic use |
|---------|--------------|---------------|
| Tweede Kamer members | `get_member`, `tk_search(Persoon)` expose names, active/former status, faction fields when available, role metadata, and source profile metadata. | Actor resolution, former/current status checks, activity anchoring. |
| Faction votes | `search_votes`, `tk_search(Stemming)` expose faction-level decisions, seats, related documents, dossiers, and nested vote metadata. | Coalition/opposition mapping, dossier support analysis, vote-context proxies. |
| Committee activity | `list_committees`, `search_activities`, `tk_search(Activiteit)` expose committee names/abbreviations, schedules, statuses, subjects, actors, and linked organizations. | Committee watch, hearing/debate timing, procedural signal tracking. |
| BWB/WGK legal pipeline | `bwb_search`, `bwb_get`, `wetgevingskalender_search`, `wetgevingskalender_get`, `search_legislation`, `get_legislative_brief` expose enacted-law versions, identifiers, validity dates, legal areas, pipeline phase, ministry, and entry-into-force metadata. | Law status checks, pipeline monitoring, dossier-to-law linkage. |
| ROO organization registry | `roo_list_organizations`, `roo_get_organization` expose canonical TOOI URIs, organization labels/types, and detail identifiers where available. | Ministry/organization normalization across Rijksoverheid, WGK, BWB, and publications. |

## Recommended research chains

These are soft preferences for efficient research, not hard rules:

- Prefer `get_dossier_timeline` + `koop_search(w.dossiernummer==...)` + `get_legislative_brief(dossier_number=...)` when chronology and official publications matter most.
- Consider `list_factions` + `list_committees` + `search_votes` for parliamentary context.
- Use `get_member` + `search_activities(actor=...)` + `search_votes(faction=...)` for actor briefs, but prefer caution for former MPs.
- Prefer `roo_list_organizations` + `roo_get_organization` when normalizing ministries.
- **Use `document_deep_read` after discovery** when the user wants actual text — not just metadata.

| Chain | Tools | Best for |
|-------|-------|----------|
| dossier | `get_dossier_timeline` + `koop_search` + `get_legislative_brief` | Procedural chronology, official publications, enacted-law status. |
| topic | `search_documents` + `search_activities` + `search_legislation` | Policy monitoring across parliament, government narrative, and law pipeline. |
| actor | `get_member` + `search_activities` + faction-level `search_votes` | MP/actor briefs with activity and faction proxy vote context. |
| ministry | `roo_list_organizations` + `rijksoverheid_search` + `wetgevingskalender_search` | Responsible-organization normalization and ministry narrative/pipeline scans. |
| vote_check | `tk_search(Stemming)` with expand chain + `tk_get` | Isolating the vote outcome for a specific motion within a large dossier. |
| **content_deep_read** | `resolve_identifier` → `document_deep_read` | Reading and quoting actual document text after metadata discovery. |
| **motion_brief** | `document_deep_read` + `tk_search(Stemming)` + `fetch_toezeggingen` + reference follow-up | Motion text, outcome, commitments, and government follow-up. |
| **law_text** | `bwb_search` → `fetch_bwb_text(article=...)` | Enacted law article and consolidated legal text. |
| **debate_transcript** | `search_activities`/`tk_search(Verslag)` → `fetch_tk_transcript` | Who said what in plenary/committee context. |
| **attachment_read** | `extract_document_references` → `fetch_attachment` | Beslisnota's, reports, appendices, and PDF-only evidence. |

### vote_check chain — isolating a single motion's vote

`search_votes` filters by dossier, date, and faction, but not by motion content. For large dossiers (e.g., 29435 Nota Ruimte: 646+ vote records), this makes it impossible to isolate one motion's outcome without scanning all records.

**Solution**: Use `tk_search` on entity `Stemming` with a deep expand chain and subject filter:

```
tk_search(
  entity="Stemming",
  expand=["Besluit($expand=Zaak($expand=Kamerstukdossier))"],
  filter="contains(Besluit/Zaak/Onderwerp, '<zoekterm>')",
  top=50
)
```

This returns only the per-faction vote records for motions whose `Onderwerp` contains the search term. Key fields in the response:

- `Besluit/BesluitSoort`: directly gives `"Stemmen - aangenomen"` or `"Stemmen - verworpen"`
- `FractieGrootte`, `ActorFractie`: faction name and size at time of vote
- `Soort`: `"Voor"` or `"Tegen"` per faction record
- `Besluit/Zaak/Onderwerp`: the motion subject line for verification

**When to use**: Whenever the user asks about the outcome of a specific motion, amendment, or vote within a dossier — especially when the dossier is large or contains many sub-items. Prefer this over `search_votes(dossier_number=...)` when you need to isolate a single item.

**Combine with**: `koop_search(query='w.dossiernummer==<nr> AND w.dossierondernummer==<sub>')` to resolve the official publication metadata for the same motion.

For discovery, prefer this skill, the MCP README, MCP resources, and MCP introspection over external `tool_search`, which may not enumerate this MCP reliably.

## Core principles

- Keep outputs structured. Default to JSON-shaped summaries with stable keys.
- Preserve provenance. Always keep `source`, MCP tool names, and warnings visible.
- Prefer deterministic links. Dossier timelines use `get_dossier_timeline`; do not force Rijksoverheid content into the timeline.
- Fail open. If one MCP call partially fails, still return usable output with `metadata.warnings`.
- Separate retrieval from interpretation. The workflow output may include a short synthesis, but the retrieved records remain primary.
- Treat tool errors as findings. Record them and continue with the next bounded call instead of abandoning the whole exploration.

### Content deep-read: when to fetch actual text

The MCP now exposes content tools. Use them whenever the user wants to read, quote, or reason about specific document content — not just discover what documents exist.

**When to use content tools:**

| User says | Use |
|-----------|-----|
| "what does it say", "quote", "summarize this document" | `document_deep_read` |
| "what are the key provisions of article N" | `fetch_bwb_text(article=N)` |
| "what did MP X say in debate Y" | `fetch_tk_transcript` |
| "what did the minister commit to" | `fetch_toezeggingen` |
| "what attachments/beslisnota's are there" | `extract_document_references` → `fetch_attachment` |

**Default content chain:**
1. `resolve_identifier(user_input)` — normalize to canonical identifier
2. `document_deep_read(resolved_identifier)` — fetch best available format
3. If needed: `extract_document_references(identifier)` → `document_deep_read(attachment)`

**Content tool cautions:**
- Only quote from `content.text_chunk` in the tool result — never from metadata titles
- If `pagination.truncated` is true, use `offset=next_offset` to read the next chunk
- If `pdf_quality` is `ocr_needed` or `empty`, state that the PDF text was unreliable
- blg-* attachments are frequently PDF-only; use `fetch_attachment("blg-...")` which handles the XML→PDF fallback
- TekstToezegging does not exist as an OData field — the actual field is `Tekst`

### Sample-then-deepen

Default to wide metadata sampling, then deepen on a shortlist. Avoid taking the first 10 results and synthesizing immediately — it produces a biased, shallow answer. Instead:

1. **Wide net (metadata only)**: call the relevant search tool with `max_results=50–100` and ask only for shape: titles, dates, dossier numbers, sources. Use `source_counts` to confirm coverage per source.
2. **Shortlist (5–15 items)**: rank by recency, dossier overlap, type (prefer Commissiedebat / Wetsvoorstel / Beleidsbrief over Procedurevergadering / Schriftelijke vragen unless the question demands them), and source diversity.
3. **Deepen**: for each shortlisted item call `tk_get` / `bwb_get` / `get_dossier_timeline` to pull the full record. Quote evidence from the deep records, not the metadata snippets.
4. **Acknowledge non-coverage**: if a source returned 0 with a non-empty `source_counts` warning, say so. Don't pretend silence is consensus.

### Keyword strategy

- Multi-word keywords are tokenized as AND. `"asiel migratie"` matches docs where both words appear in any field. This is usually right.
- For broad recall, set `keyword_mode="any"` to OR across tokens.
- For precision, prefer the single most discriminating word (`"spreidingswet"` > `"asiel migratie spreidingswet"`).
- TK's OData `$search` is a no-op — never propose it as a workaround. Use `keyword_mode="any"` for wider recall instead.
- KOOP CQL `dt.title all "..."` tokenizes, so multi-word KOOP works without further intervention.
- Rijksoverheid keyword is unreliable without a subject slug. Default workflow: call `list_subjects` first, pick matching slugs, then `rijksoverheid_search(subject=<slug>)`. Free-text `q=` is best-effort only.

## Required output contract

Every workflow should produce this top-level shape:

```json
{
  "workflow_type": "topic_monitor | dossier_tracker | actor_brief | committee_watch | legislative_scan | ministry_narrative | parliamentary_landscape | legislation_lookup | legislative_calendar_watch | law_to_dossier_brief | organization_lookup | exploratory_test",
  "query_params": {},
  "results": [],
  "metadata": {}
}
```

Read [references/output-contract.md](references/output-contract.md) before finalizing any workflow output.

## Workflow selection

Choose the workflow that matches the user goal:

| User need | Workflow | Primary MCP calls |
|-----------|----------|-------------------|
| "Monitor housing policy in the Netherlands" | Topic monitor | `search_documents` |
| "Track dossier 36228" | Dossier tracker | `get_dossier_timeline`, optional Rijk narrative search |
| "Brief me on Timmermans" | Actor brief | `get_member`, `search_activities(actor=...)`, `search_votes` |
| "Watch committee activity on X" | Committee watch | `list_committees`, `search_activities` |
| "Scan new legislative and vote activity" | Legislative scan | `search_documents`, `search_votes` |
| "What is the ministry saying versus parliament?" | Ministry narrative | `search_documents` or `rijksoverheid_search`, plus TK activity |
| "What does parliament look like right now?" | Parliamentary landscape | `list_factions`, `list_committees`, optionally `search_votes` |
| "Find the Dutch housing law" | Legislation lookup | `bwb_search`, optionally `bwb_get` |
| "What legislation is coming up?" | Legislative calendar watch | `wetgevingskalender_search` |
| "Brief me on dossier 36228 law status" | Law-to-dossier brief | `get_legislative_brief` |
| "Which ministry handles X?" | Organization lookup | `roo_list_organizations`, `roo_get_organization` |
| "Test MCP tool coverage" | Exploratory test | All tools in parallelized sequence |

For the detailed workflow templates, read [references/workflow-templates.md](references/workflow-templates.md).

## Standard workflow

### 1. Confirm the retrieval target

Determine:

- the workflow type
- the query terms or dossier number
- the time window, if any
- the maximum result depth needed

If the request is ambiguous, narrow the retrieval target before calling tools.

### 2. Read from the MCP

Use the smallest MCP surface that answers the question:

- use unified tools for monitoring and briefing flows
- use source-specific tools when you need query power the unified layer lacks (OData filters, CQL queries, specific entity sets) — see [references/tool-reference.md](references/tool-reference.md) for the escalation path
- for discovery, prefer the MCP resources, README, and MCP introspection before external `tool_search`
- resolve Rijksoverheid `subject` and `ministry` filters through `list_subjects` / `list_ministries` first; use canonical slugs where the upstream endpoint expects path segments, and avoid unsupported combined `news` filters such as `subject + ministry` unless the MCP explicitly supports them
- parallelize independent tool calls aggressively — reference lookups (list_*) are always independent, search tools are independent of each other. See parallelization groups in the tool reference
- keep the tool list in `metadata.tool_calls`
- for exploratory MCP testing (template 8), use bounded parameters; for production research, request enough data for comprehensive coverage

### 3. Shape the response

Transform the MCP output into the stable workflow contract:

- `workflow_type`: one of the supported workflow ids
- `query_params`: the exact effective parameters used
- `results`: workflow-specific result objects
- `metadata`: counts, warnings, provenance, assumptions, and optional brief synthesis

### 4. State uncertainty explicitly

Use `metadata` for:

- `warnings`
- `tool_calls`
- `source_counts`
- `assumptions`
- `linkage_notes`

Examples:

- "Rijksoverheid narrative context is keyword-based and not deterministically linked to the dossier."
- "Vote activity is faction-level proxy context when member-level vote attribution is unavailable from the MCP."

## Workflow-specific guidance

### Topic monitor

Goal: chronological document retrieval across Dutch public-affairs sources.

**Step 1 — Wide net**: call with `max_results=50` to sample shape before deepening.

```
search_documents(keyword="spreidingswet", max_results=50)
```

Check `source_counts` in the response: if a source shows `null` or a warning like `"0 results for keyword='spreidingswet' — verify spelling..."`, that source didn't contribute. Do not interpret absence of results as absence of policy signal — note it explicitly.

**Step 2 — Shortlist**: pick 5–15 items by recency + type. Prefer Commissiedebat, Wetsvoorstel, Beleidsbrief. Deprioritize Procedurevergadering and Schriftelijke vragen unless the question is procedural.

**Step 3 — Deep dive**: call `tk_get` on shortlisted TK IDs to pull full records:

```
tk_get(entity="Document", entity_id="<id from results>")
```

Quote from full records, not from the metadata snippet in the search results.

Notes on keyword behavior:

- Multi-word keywords are tokenized — every word must appear (in any field, in any order). `"asiel migratie"` matches "Beleidsbrief Asiel en Migratie" and "Migratie en asielketen".
- For broader recall use `keyword_mode="any"` to OR across tokens.
- For precision, prefer the single most discriminating word (`"spreidingswet"` over `"asiel migratie spreidingswet"`).
- The response includes `source_counts` (per-source totals) and `total_count` (max across sources, NOT a sum). When a source returns 0 with a keyword query, a `warnings[]` entry surfaces the diagnostic — read it.

Shape:

- flat `results[]` with source labels, dates, types, dossier fields, URLs
- `source_counts` — per-source `total_count` map
- `total_count` — max across sources (use `source_counts` for source-level coverage)
- optional `metadata.synthesis` with 2-4 high-signal observations

### Dossier tracker

Goal: procedural chronology for a known dossier.

Use:

- `get_dossier_timeline(dossier_number=...)`
- optionally a Rijk narrative retrieval keyed off dossier title or user topic

Shape:

- ordered `results[]` timeline with stage labels
- `metadata.dossier`
- `metadata.stage_counts`
- `metadata.narrative_context`

Do not merge narrative context into the canonical timeline. Keep it separate in `metadata`.

### Dossier sub-number lookups

- KOOP sub-document references like `36871-63` (motie 63 within dossier 36871) are addressable via `koop_search(query='w.dossiernummer==36871 AND w.dossierondernummer==63')`.
- TK's preferred path for a single sub-document: `tk_search(Document, $filter="HoofdDossier eq 36871 and Volgnummer eq 63")` or by `Identificatie eq 'kst-36871-63'`.
- If the sub-document is a motie and you know the actor, prefer `search_activities(actor=..., dossier_number=36871)` and resolve the related document from the activity's DocumentActor expansion — this often surfaces the correct sub-document with its vote outcome attached.

### Cross-chamber tracking

- TK is one chamber. Once a wetsvoorstel passes "Eindstemming" in TK, it moves to Eerste Kamer (EK), which this MCP does **not** cover today.
- Use `get_dossier_chamber_status` to determine whether a dossier is still in TK, has moved to EK, or is concluded. When it's in EK, surface the EK URL hint and label the brief accordingly — do not claim the dossier is "stalled" just because TK activity stopped.
- Former MPs (`Functie: "Oud Kamerlid"`) are a parallel signal of historical context; combine with chamber status when narrating a dossier's lifecycle.

### Actor brief

Goal: structured actor profile with surrounding parliamentary context.

Use:

- `get_member(query=...)`
- if a single match is returned: `search_activities(actor=<member name>)`
- if a faction is available: `search_votes(faction=<member faction>)` as proxy vote context

Shape:

- if ambiguous: return multiple candidates in `results[]` and mark `metadata.ambiguity=true`
- if resolved: return one brief object containing `member`, `recent_activities`, `vote_context`, and derived `committee_signals`

When member-level votes are not directly available, label the vote section as faction proxy context.

**Inactive member handling**: Check `metadata.Functie` in the `get_member` response. If it reads `"Oud Kamerlid"` (former MP):

- The member is no longer active — note this prominently in the brief
- `faction` will likely be `null` (dissolved or departed). Check `metadata.Fractielabel` for the last known faction, and note it as historical context
- `search_activities` will return only historical activity — this is still valuable, label it accordingly
- For vote context, skip `search_votes` by faction (no current faction to proxy). Instead, note that vote context is unavailable for former members
- If the member's former faction still exists in `list_factions`, you may optionally include faction vote context labeled as "former faction activity — not attributable to this member"
- If the former faction has dissolved (not in `list_factions`), note this as a finding — it signals a political restructuring event worth mentioning in the brief

### Committee watch

Goal: surface what a specific TK committee is actually doing — recent debates, decisions, and procedural signals.

Use:

- `list_committees` to resolve the committee name and abbreviation (case-sensitive, contains-match works on `Voortouwnaam`/`Voortouwafkorting`)
- `search_activities(committee=<NaamNL>, time_window="past")` for recent positions and debates
- `search_activities(committee=<NaamNL>, time_window="future")` for the upcoming calendar
- `search_documents(keyword=<topic>)` to pair the calendar with substantive committee documents

`time_window` semantics:

| Value | When to use | Behavior |
|-------|-------------|----------|
| `"past"` (default) | "What has the committee decided / discussed?" | Clamps `Datum <= today` and sorts latest-first |
| `"future"` | "What is on the calendar?" | Clamps `Datum >= today` and sorts nearest-first |
| `"all"` | Diagnostic only | No clamp; latest-first (may surface far-future Procedurevergaderingen above recent debates — usually noisy, prefer `"past"`/`"future"`) |

Always present the past view AND the calendar view as two separate sections. A single mixed list confuses the reader because procedural meetings (Procedurevergadering) dominate by volume but are administrative, while Commissiedebat / Wetgevingsoverleg are the substantive activities worth leading with.

If the committee has no past activity in the last 6 months, widen `date_from` to 12 months — committees go quiet between cycles.

### Legislation lookup

Goal: find a Dutch law by title or BWB identifier and retrieve version metadata.

Use:

- `bwb_search(title=..., regelingsoort=..., ...)` for search
- `bwb_get(identifier=...)` for version retrieval

Shape:

- `results[]` with BWB records including identifier, title, type, geldigheid dates, URLs
- `metadata.version_count` when multiple toestanden exist

BWB uses zoekservice.overheid.nl (SRU 1.2). Title search uses `overheidbwb.titel all "..."` (keyword matching). Prefer exact identifiers when you already have a canonical BWB id. Returns rich metadata including rechtsgebied, geldigheidsperiode dates, and authority.

### Legislative calendar watch

Goal: monitor upcoming legislation in the Dutch legislative pipeline.

Use:

- `wetgevingskalender_search(keyword=..., wgk_type=..., ministry=..., phase=...)`

WGK type values are case-sensitive: `Wet`, `Amvb`, `Regeling`.
Phase values: `Voorbereiding`, `Raad van State`, `Tweede Kamer`, `Eerste Kamer`, `Bekendmaking`.

Shape:

- `results[]` with planning items including type, ministry, phase, entry_into_force, and identifiers
- `metadata.type_counts`
- `metadata.phase_counts`
- `metadata.ministry_counts`

### Law-to-dossier brief

Goal: produce a combined brief for a dossier or BWB identifier.

Use:

- `get_legislative_brief(dossier_number=..., bwb_identifier=...)`

Shape:

- `results` with `law` (BWB versions), `publications` (KOOP kamerstukken)
- `metadata.law_count`, `metadata.publication_count`

### Organization lookup

Goal: resolve Dutch government organization names to canonical identifiers.

Use:

- `roo_list_organizations(org_type="Ministerie")` for listing
- `roo_get_organization(uri=...)` for detail including identification codes

Results use TOOI URIs as canonical identifiers. Prefer feeding the full URI returned by `roo_list_organizations` into `roo_get_organization`. This is useful for normalizing ministry names from BWB/WGK/Rijksoverheid outputs.

## Payload hygiene

- `get_dossier_timeline` defaults to `verbose=False` — the metadata blobs are intentionally stripped. Re-call with `verbose=True` ONLY for a specific event ID after shortlisting.
- Never call `max_results=200` blindly. Use 50–100 for sampling, then narrow.
- For dossiers older than 5 years, restrict `date_from` to compress the timeline.
- All unified search tools (`search_documents`, `search_activities`, `search_votes`, `search_legislation`) strip `metadata` by default (`compact=True`). Pass `compact=False` only when you need the raw upstream row for a specific record.

## Validation

A validation harness is bundled at `skills/dutch-gov-data/scripts/validate_workflows.py` for development use. Note: the script was written for a local stdio server and will need adaptation to work against the hosted endpoint. Use it as a reference for workflow shapes rather than running it directly.

## Reference files

| File | When to read |
|------|--------------|
| [references/tool-reference.md](references/tool-reference.md) | Before calling MCP tools — parameters, query syntax, parallelization groups |
| [references/workflow-templates.md](references/workflow-templates.md) | When choosing or assembling a workflow |
| [references/output-contract.md](references/output-contract.md) | Before finalizing the structured JSON output |
