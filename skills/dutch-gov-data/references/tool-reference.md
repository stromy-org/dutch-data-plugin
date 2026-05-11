# Tool Reference

Concise inventory of all `nl-gov-data` MCP tools, their parameters, query semantics, and parallelization groups.

## Tool layers

The MCP exposes three layers:

| Layer | Tools | When to use |
|-------|-------|-------------|
| **Content** | `resolve_identifier`, `document_deep_read`, `extract_document_references`, `document_formats`, `fetch_official_publication`, `fetch_bwb_text`, `fetch_tk_transcript`, `fetch_rijksoverheid_document`, `fetch_attachment`, `fetch_toezeggingen` | When the user wants to read, quote, or reason about actual document content. Start with `document_deep_read` for most requests. |
| **Unified** | `search_documents`, `search_activities`, `search_votes`, `get_member`, `get_dossier_timeline`, `search_legislation`, `get_legislative_brief` | Default for discovery and metadata workflows. Normalized output across sources. |
| **Native** | `tk_search`, `tk_get`, `tk_count`, `koop_search`, `rijksoverheid_search`, `rijksoverheid_get`, `bwb_search`, `bwb_get`, `wetgevingskalender_search`, `wetgevingskalender_get`, `roo_list_organizations`, `roo_get_organization` | When you need query power the unified layer lacks: OData filters, specific entity sets, CQL queries, single-record fetches. |
| **Reference lists** | `list_factions`, `list_committees`, `list_ministries`, `list_subjects` | Context lookups: resolve faction names, committee abbreviations, ministry IDs, policy subject labels. |

## Content tools

### `resolve_identifier` (primary)
Turn any user input into a fetchable Dutch government identifier.

| Param | Type | Notes |
|-------|------|-------|
| `input` | string | Required. Accepts: kst-*, ah-tk-*, h-tk-*, blg-*, stb-*, stcrt-*, BWBR*, BWBV*, TK GUIDs, KOOP/FRBR URLs, dossier sub-notation (36228-3) |
| `source_hint` | string? | Optional hint if source is ambiguous |

Returns `resolved[]` with `source`, `identifier`, `confidence`, `resolution_path`.

### `document_deep_read` (primary)
One-call content retrieval with auto-resolution and format selection.

| Param | Type | Notes |
|-------|------|-------|
| `input` | string | Required. Same as resolve_identifier input |
| `intent` | string | Default "auto" |
| `max_chars` | int | Default 10000. Increase for large texts. |
| `offset` | int | Default 0. Use `next_offset` from pagination for next chunk. |

Returns content envelope with `source`, `identifier`, `format`, `parser`, `title`, `content.text_chunk`, `pagination`, `references`, `warnings`.

### `extract_document_references` (primary)
Extract all references and attachments from a document.

| Param | Type | Notes |
|-------|------|-------|
| `identifier_or_url` | string | Required. KOOP identifier or URL |
| `include_attachments` | bool | Default true |

Returns `references.koop`, `references.bwb`, `references.attachments` (blg-*), `references.all`.

### `document_formats` (advanced)
Format inventory before fetching.

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string? | KOOP identifier |
| `tk_document_id` | string? | TK Document GUID |
| `tk_document_versie_id` | string? | TK DocumentVersie GUID |

Returns `formats[]` with type (Xml/Pdf/Html/Odt), content_type, size_bytes, url, fetch_strategy.

### `fetch_official_publication` (advanced)
Direct KOOP official publication fetch.

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string | Required. kst-*, ah-tk-*, h-tk-*, stb-*, stcrt-* |
| `format` | string | "auto" (default), "xml", "html", "pdf" |
| `max_chars` | int | Default 10000 |
| `offset` | int | Default 0 |
| `section` | string? | Section filter hint |
| `include_references` | bool | Default true — return extref identifiers |
| `include_attachments` | bool | Default false — return blg-* identifiers |

Parser dispatch: kst-* → OP XML kamerstuk parser; ah-tk-* → aanhangsel parser (vragen/antwoorden); h-tk-* → handeling parser; stb-*/stcrt-* → generic OP XML parser.

### `fetch_bwb_text` (advanced)
BWB consolidated law text.

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string | Required. BWBR*, BWBV*, BWBA* |
| `toestand_url` | string? | Direct locatie_toestand URL from BWB search |
| `article` | string? | Article number (e.g. "1", "24") |
| `chapter` | string? | Chapter hint |
| `max_chars` | int | Default 10000 |
| `offset` | int | Default 0 |

**Critical**: Never construct date URLs manually — always use the `locatie_toestand` URL from `bwb_search` results. Without `toestand_url`, the tool calls `bwb_search` and uses the returned `locatie_toestand`.

### `fetch_tk_transcript` (advanced)
TK debate transcript with speaker attribution.

| Param | Type | Notes |
|-------|------|-------|
| `verslag_id` | string? | TK Verslag GUID (most precise) |
| `vergadering_id` | string? | TK Vergadering GUID |
| `htk_identifier` | string? | h-tk-* KOOP identifier |
| `keyword` | string? | Keyword search across Activiteit |
| `max_turns` | int | Default 50 — activiteithoofd blocks per page |
| `max_chars` | int | Default 15000 |
| `offset` | int | Default 0 |

Returns `meeting` metadata + `activiteiten` (with topic_blocks) + `turns_page` (paginated blocks with speaker info and text). Note: VLOS Tussenpublicaties may have sparse text; Voorpublicaties have none.

### `fetch_rijksoverheid_document` (advanced)
Rijksoverheid document content.

| Param | Type | Notes |
|-------|------|-------|
| `id_or_url` | string | Required. UUID or rijksoverheid.nl URL |
| `include_files` | bool | Default true — return file inventory |
| `max_chars` | int | Default 10000 |
| `offset` | int | Default 0 |

### `fetch_attachment` (advanced)
Attachment fetch with XML→PDF fallback.

| Param | Type | Notes |
|-------|------|-------|
| `identifier_or_url` | string | Required. blg-* or direct URL |
| `preferred_format` | string | "auto" (default), "xml", "pdf" |
| `max_chars` | int | Default 10000 |
| `offset` | int | Default 0 |

**Note**: blg-* XML is frequently 404. The tool automatically falls back to FRBR PDF. If `pdf_quality` is `ocr_needed`, the document has no embedded text.

### `fetch_toezeggingen` (advanced)
Ministerial commitment search.

| Param | Type | Notes |
|-------|------|-------|
| `keyword` | string? | Searches Tekst, Naam, Functie |
| `ministry` | string? | Contains-match on Ministerie |
| `status` | string? | "Openstaand", "Voldaan", "Niet nagekomen" |
| `max_results` | int | Default 50 |

Returns Toezegging records with Nummer, Tekst (the actual field — not TekstToezegging which does not exist), Naam, Functie, Ministerie, Status, DatumNakoming.

---

**Escalation path**: For content requests, start with `document_deep_read`. Fall back to specific fetch tools when you need article targeting (`fetch_bwb_text`), transcript speaker turns (`fetch_tk_transcript`), or attachment handling (`fetch_attachment`).

For metadata-only discovery, start with unified tools. Fall back to native tools when you need:
- Filtering on fields the unified tool doesn't expose (e.g., `tk_search` with OData `$filter` on date ranges, entity relationships)
- A specific TK entity set not covered by unified tools (e.g., `Fractie`, `Commissie`, `Kamerstukdossier`)
- Raw KOOP CQL for precise publication retrieval
- A single record by ID (`tk_get`, `rijksoverheid_get`)
- BWB-specific fields the unified `search_legislation` doesn't expose (e.g., authority, rechtsgebied, abbreviation)
- WGK-specific fields like `wgk_type` or `ministry`
- Organization resolution via ROO

**Discovery guidance**: Prefer this reference, the MCP README, `data://nlgov/schema/*`, `data://nlgov/research-chains`, and MCP tool/resource introspection for discovery. Do not rely on external `tool_search` to enumerate this MCP consistently.

## Unified tools

### `search_documents`
Cross-source document search (TK + Rijksoverheid + KOOP).

| Param | Type | Notes |
|-------|------|-------|
| `keyword` | string? | Free text search |
| `date_from` / `date_to` | string? | ISO date `YYYY-MM-DD` |
| `doc_type` | string? | Filter by document type |
| `dossier_number` | string? | Filter by kamerstukdossier number |
| `organization` | string? | Filter by organization |
| `sources` | string[]? | Restrict to specific sources: `["tk"]`, `["rijksoverheid"]`, `["koop"]` |
| `subject` | string? | Rijksoverheid subject filter |
| `max_results` | int | Default 50 |

### `search_activities`
Normalized parliamentary activities from TK.

| Param | Type | Notes |
|-------|------|-------|
| `keyword` | string? | Free text |
| `actor` | string? | Member name (e.g., `"Omtzigt"`) |
| `committee` | string? | Committee name or abbreviation |
| `dossier_number` | string? | Filter by dossier |
| `type` | string? | Activity type filter |
| `date_from` / `date_to` | string? | ISO date |
| `max_results` | int | Default 20 |

### `search_votes`
Normalized vote results from TK (faction-level).

| Param | Type | Notes |
|-------|------|-------|
| `faction` | string? | Faction name (e.g., `"VVD"`) |
| `dossier_number` | string? | Filter by dossier |
| `outcome` | string? | Filter by outcome |
| `date_from` / `date_to` | string? | ISO date |
| `max_results` | int | Default 20 |

### `get_member`
Resolve TK members by name.

| Param | Type | Notes |
|-------|------|-------|
| `query` | string | Name or partial name. Returns multiple matches if ambiguous. |

Key fields in response: `name`, `faction` (may be `null` for former MPs), `role`, `active`, `metadata.Functie` (`"Tweede Kamerlid"` or `"Oud Kamerlid"`).

### `get_dossier_timeline`
Deterministic chronological timeline for a dossier (TK + KOOP).

| Param | Type | Notes |
|-------|------|-------|
| `dossier_number` | string | Required. e.g., `"36228"` |
| `max_results_per_source` | int | Default 10 |
| `timeline_limit` | int | Default 40 |

### `search_legislation`
Cross-source legislation search (BWB + WGK, opt-in KOOP). Returns normalized results with `record_type` discriminator.

| Param | Type | Notes |
|-------|------|-------|
| `keyword` | string? | Free text (maps to BWB title + WGK keyword) |
| `identifier` | string? | BWB identifier (e.g., `"BWBR0001840"`) |
| `dossier_number` | string? | Filter by dossier |
| `regelingsoort` | string? | BWB type filter (e.g., `"Wet"`, `"AMvB"`) |
| `date_from` / `date_to` | string? | ISO date |
| `sources` | string[]? | Default `["bwb", "wgk"]`. Add `"koop"` for publications. |
| `max_results` | int | Default 50 |

Each result has `record_type`: `"law"` (BWB), `"planning_item"` (WGK), or `"publication"` (KOOP).

### `get_legislative_brief`
Join BWB law + KOOP publications for a dossier or BWB identifier.

| Param | Type | Notes |
|-------|------|-------|
| `dossier_number` | string? | At least one of `dossier_number` or `bwb_identifier` required |
| `bwb_identifier` | string? | BWB identifier (e.g., `"BWBR0001840"`) |
| `max_results_per_source` | int | Default 10 |

Returns `law` (BWB versions), `publications` (KOOP kamerstukken), `law_count`, `publication_count`.

## Native tools

### `tk_search`
OData query on any TK entity set.

| Param | Type | Notes |
|-------|------|-------|
| `entity` | string | Required. Entity set name: `Persoon`, `Fractie`, `Commissie`, `Kamerstukdossier`, `Activiteit`, `Stemming`, `Besluit`, `Zaak`, `Document`, `Agendapunt`, etc. |
| `filter` | string? | OData `$filter` expression |
| `select` | string[]? | Fields to return |
| `expand` | string[]? | Related entities to expand inline |
| `orderby` | string? | Sort expression |
| `top` | int | Default 50 |

**OData filter syntax examples**:
- Equality: `Afkorting eq 'PVV'`
- Contains: `contains(NaamNL,'Democrat')`
- Date comparison: `DatumActief gt 2025-01-01T00:00:00Z`
- Combined: `Afkorting eq 'VVD' and AantalZetels gt 10`
- Null check: `DatumInactief eq null` (active records only)

### `tk_get`
Fetch a single TK entity by GUID.

| Param | Type | Notes |
|-------|------|-------|
| `entity` | string | Entity set name |
| `id` | string | GUID (without `tk:` prefix) |
| `expand` | string[]? | Related entities to expand |

### `tk_count`
Count matching rows in a TK entity set.

| Param | Type | Notes |
|-------|------|-------|
| `entity` | string | Entity set name |
| `filter` | string? | OData `$filter` |

### `rijksoverheid_search`
Faceted search on Rijksoverheid open data.

| Param | Type | Notes |
|-------|------|-------|
| `endpoint` | string | Required: `documents`, `news`, `faq`, `subject`, `ministry` |
| `subject` | string? | Subject/topic filter. Resolve with `list_subjects` first and prefer the canonical `name` slug for path-style endpoints. Broad labels such as `"wonen"` may not be valid subject slugs. |
| `ministry` | string? | Ministry filter. Resolve with `list_ministries` first and prefer the canonical `name` slug for path-style endpoints; full display names can fail on `news`. |
| `type` | string? | Content type filter |
| `modified_since` | string? | ISO date. **Note**: filters by last-modified date, not publication date. Older articles that were recently modified will appear. |
| `rows` | int | Default 25 |
| `offset` | int | Default 0 |

**Rijksoverheid filter rules**:
- Resolve filters first: use `list_subjects` and `list_ministries` to get canonical `name` slugs before filtered Rijksoverheid calls.
- `documents` supports query parameters such as `subject` and `organisationalunit`; it is more tolerant for combined filters than `news`.
- `news` uses path-style filters in the upstream API. Do not combine `subject` + `ministry` for `endpoint="news"` unless the MCP explicitly supports that combination; test evidence shows nested combined paths can return upstream `404`.
- If a combined `news` filter is needed analytically, query one dimension first, then filter or cross-check returned records client-side, and record this fallback in `metadata.assumptions`.
- A `404` from a filtered Rijksoverheid `news` call is usually a filter/path validation issue, not evidence that the whole source is down.

### `rijksoverheid_get`
Fetch a single Rijksoverheid record.

| Param | Type | Notes |
|-------|------|-------|
| `endpoint` | string | Required: same as search |
| `id` | string | UUID or source ID |

### `koop_search`
SRU CQL search on official publications (Staatsblad, Staatscourant, Handelingen, etc.).

| Param | Type | Notes |
|-------|------|-------|
| `query` | string | CQL query. Use field-qualified searches for precision. |
| `collection` | string | Default `"officielepublicaties"` |
| `max_records` | int | Default 50 |
| `start_record` | int | Default 1 (pagination) |
| `sort` | string? | Sort expression |

**CQL query patterns** (different from keyword search):
- Simple keyword: `"woningbouw"` — searches all fields
- Field-qualified: `creator="Omtzigt"` — search specific metadata field
- Boolean: `"woningbouw" AND "huurwoning"`
- Dossier: `w.dossiernummer=="36228"` (exact-match operator `==` required)
- Dossier sub-document: `w.dossiernummer==36871 AND w.dossierondernummer==63`

KOOP is best for: official gazette publications (Staatsblad, Staatscourant), Handelingen transcripts, and formal kamerstukken. For general topic searches, prefer `search_documents` which normalizes across sources.

### `bwb_search`
Structured search on the Basiswettenbestand (Dutch laws and regulations). Queries zoekservice.overheid.nl (SRU 1.2).

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string? | BWB identifier (e.g., `"BWBR0001840"`) |
| `title` | string? | Keyword search via `overheidbwb.titel all "..."` |
| `regelingsoort` | string? | Type: `"wet"`, `"AMvB"`, `"ministeriele-regeling"`, etc. (case-sensitive per BWB) |
| `authority` | string? | Issuing authority (keyword match) |
| `rechtsgebied` | string? | Legal area (keyword match) |
| `dossier_number` | string? | Kamerstukdossier number |
| `abbreviation` | string? | Law abbreviation (e.g., `"Gw"` for Grondwet) |
| `date_from` / `date_to` | string? | Date range for `dcterms.modified` |
| `max_results` | int | Default 50 |

Returns: `identifier`, `title`, `type`, `authority`, `rechtsgebied` (array), `geldigheid_start`, `geldigheid_eind`, `preferred_url`, `locatie_toestand`.

Native BWB outputs prefer canonical BWB identifiers (`BWBR`, `BWBV`, `BWBA`). Publication-style records are filtered and surfaced via warnings.

### `bwb_get`
Retrieve all versions (toestanden) for a BWB identifier.

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string | Required. BWB identifier (e.g., `"BWBR0001840"`) |
| `max_results` | int | Default 20 |

### `wetgevingskalender_search`
Search the Dutch legislative calendar. Queries zoekservice.overheid.nl (SRU 1.2).

| Param | Type | Notes |
|-------|------|-------|
| `keyword` | string? | Free text |
| `wgk_type` | string? | Case-sensitive: `"Wet"`, `"Amvb"`, `"Regeling"` |
| `ministry` | string? | Responsible ministry (keyword match) |
| `phase` | string? | Legislative phase: `"Voorbereiding"`, `"Raad van State"`, `"Tweede Kamer"`, `"Eerste Kamer"`, `"Bekendmaking"` |
| `date_from` / `date_to` | string? | ISO date |
| `max_results` | int | Default 50 |

Returns: `identifier`, `title`, `type`, `ministry`, `phase`, `entry_into_force`, `issued`, `subject` (array), `modified`, `locatie`.

### `wetgevingskalender_get`
Retrieve a single Wetgevingskalender item by identifier.

| Param | Type | Notes |
|-------|------|-------|
| `identifier` | string | Required. WGK identifier (e.g., `"WGK001322"`) |
| `max_results` | int | Default 10 |

### `roo_list_organizations`
List Dutch government organizations from the ROO registry.

| Param | Type | Notes |
|-------|------|-------|
| `org_type` | string? | Filter: `"Gemeente"`, `"Ministerie"`, `"Provincie"`, `"Waterschap"`, `"Zbo"`, `"ZboCluster"`, `"Samenwerkingsorganisatie"`, `"Rijk"`, `"CaribischOpenbaarLichaam"`, `"Overheidsorganisatie"` |

Returns label, abbreviation, and TOOI URI for each organization.

### `roo_get_organization`
Get detailed information about a Dutch government organization.

| Param | Type | Notes |
|-------|------|-------|
| `uri` | string | Required. Prefer the full TOOI URI from `roo_list_organizations`; bare slugs such as `"mnre1034"` are also accepted when resolvable. |

Returns identification codes (KVK, OIN, RSIN), abbreviation, and responsible ministry (for ZBOs).

## Recommended research chains

- Prefer `get_dossier_timeline` + `koop_search` + `get_legislative_brief` for deterministic dossier work.
- Consider `list_factions` + `list_committees` + `search_votes` for political context snapshots.
- Use `get_member` + `search_activities` + `search_votes` for actor research, but treat former MPs as historical profiles unless current faction context is explicit.
- Prefer `roo_list_organizations` + `roo_get_organization` when you need canonical organization normalization across sources.

## Parallelization groups

Tools within the same group are independent and can be called in parallel. Cross-group calls may also be parallel when they don't depend on each other's results.

**Group A — Reference lookups** (always independent, run in parallel):
- `list_factions`
- `list_committees`
- `list_ministries`
- `list_subjects`

**Group B — Search/retrieval** (independent of each other):
- `search_documents`
- `search_activities`
- `search_votes`
- `search_legislation`
- `rijksoverheid_search`
- `koop_search`
- `tk_search`
- `bwb_search`
- `wetgevingskalender_search`
- `roo_list_organizations`

**Group C — Entity resolution** (may feed into Group B):
- `get_member` — result may provide actor name for `search_activities` and faction for `search_votes`

**Group D — Single record fetch** (depends on IDs from prior calls):
- `tk_get`
- `rijksoverheid_get`
- `bwb_get`
- `wetgevingskalender_get`
- `roo_get_organization`

**Group E — Composite** (internally calls multiple sources):
- `get_dossier_timeline`
- `get_legislative_brief`

**Practical parallelization patterns**:
- Actor brief: run `get_member` + `list_factions` in parallel (Group C + A). Then `search_activities` + `search_votes` in parallel (Group B) using resolved member/faction.
- Topic monitor: run `search_documents` alone or alongside reference lookups.
- Landscape snapshot: run all Group A tools in a single parallel batch.
- Legislation lookup: run `bwb_search` alone or `search_legislation` for cross-source.
- Legislative calendar: run `wetgevingskalender_search` alone, optionally with `list_ministries` in parallel.
- Law-to-dossier: run `get_legislative_brief` (internally parallel BWB + KOOP).
- Organization lookup: run `roo_list_organizations`, then `roo_get_organization` using the full returned TOOI URI for detail.
- Exploratory test: run Group A in parallel, then Group B in parallel, then Group D/E as needed.
