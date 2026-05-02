# Output Contract

The skill should emit structured JSON that downstream Stromy workflows can consume directly.

## Base shape

```json
{
  "workflow_type": "topic_monitor | dossier_tracker | actor_brief | committee_watch | legislative_scan | ministry_narrative | parliamentary_landscape | legislation_lookup | legislative_calendar_watch | law_to_dossier_brief | organization_lookup | exploratory_test",
  "query_params": {},
  "results": [],
  "metadata": {}
}
```

## Field semantics

### `workflow_type`

Stable workflow identifier. Use lowercase snake_case:

- `topic_monitor`
- `dossier_tracker`
- `actor_brief`
- `committee_watch`
- `legislative_scan`
- `ministry_narrative`
- `parliamentary_landscape`
- `legislation_lookup`
- `legislative_calendar_watch`
- `law_to_dossier_brief`
- `organization_lookup`
- `exploratory_test`

### `query_params`

The effective retrieval parameters actually used. Include defaults when they materially affect the result.

Examples:

```json
{
  "keyword": "woningbouw",
  "date_from": "2026-01-01",
  "max_results": 15
}
```

```json
{
  "dossier_number": "36228",
  "include_narrative_context": true
}
```

### `results`

Workflow-specific records only. Keep them stable and avoid mixing unrelated object shapes in one array unless a shared discriminator field is present.

Recommended discriminators:

- topic monitor: one document-like shape per result
- dossier tracker: one timeline-event-like shape per result with `event_type` and `stage`
- actor brief: either candidate member objects or a single resolved brief object

### `metadata`

Use `metadata` for everything that is not a primary result record:

- `tool_calls`
- `warnings`
- `source_counts`
- `returned_count`
- `ambiguity`
- `assumptions`
- `linkage_notes`
- `narrative_context`
- `synthesis`

Rich source-native `metadata` is useful for analyst depth and traceability, but it should be treated as optional depth rather than the minimum stable contract.

## Minimal examples

### Topic monitor

```json
{
  "workflow_type": "topic_monitor",
  "query_params": {
    "keyword": "woningbouw",
    "max_results": 10
  },
  "results": [
    {
      "source": "tk",
      "title": "Motie over woningbouw",
      "doc_type": "motie",
      "published_at": "2026-04-10",
      "dossier_number": "36228"
    }
  ],
  "metadata": {
    "source_counts": {
      "tk": 1
    },
    "warnings": []
  }
}
```

### Dossier tracker

```json
{
  "workflow_type": "dossier_tracker",
  "query_params": {
    "dossier_number": "36228"
  },
  "results": [
    {
      "event_type": "document",
      "stage": "dossier_documents",
      "sort_date": "2026-04-09",
      "title": "Motie over woningbouw"
    }
  ],
  "metadata": {
    "dossier": {
      "number": 36228,
      "title": "Wijziging Woningwet"
    },
    "warnings": []
  }
}
```

### Actor brief

```json
{
  "workflow_type": "actor_brief",
  "query_params": {
    "query": "Timmermans"
  },
  "results": [
    {
      "member": {
        "name": "Frans Timmermans",
        "faction": "GL-PvdA"
      },
      "recent_activities": [],
      "vote_context": []
    }
  ],
  "metadata": {
    "ambiguity": false,
    "warnings": [
      "Vote context is faction-level proxy context."
    ]
  }
}
```

### Parliamentary landscape

```json
{
  "workflow_type": "parliamentary_landscape",
  "query_params": {},
  "results": [
    {
      "factions": [
        {"name": "D66", "abbreviation": "D66", "seats": 26, "active_since": "1966-10-13"}
      ],
      "committees": [
        {"name": "Vaste commissie voor Financiën", "abbreviation": "FIN"}
      ],
      "recent_votes": []
    }
  ],
  "metadata": {
    "total_seats": 150,
    "faction_count": 17,
    "committee_count": 15,
    "warnings": [],
    "synthesis": "Notable: NSC dissolved, CDA surged to 18 seats"
  }
}
```

## Contract rules

- Keep `results` primary and `metadata` explanatory.
- Preserve MCP warnings verbatim where possible.
- Do not hide missing data. Put the gap in `metadata.warnings` or `metadata.assumptions`.
- Keep provenance fields from MCP outputs when they matter to downstream traceability.
