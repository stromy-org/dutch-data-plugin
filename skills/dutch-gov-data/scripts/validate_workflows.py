"""Validate the Dutch government data skill workflows against the local MCP."""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastmcp import Client
from fastmcp.client.transports import UvStdioTransport

STROMY_ROOT = Path(__file__).resolve().parents[5]
NL_GOV_PROJECT = STROMY_ROOT / "MCPs" / "nl-gov-data"
DEFAULT_TOPIC = "woningbouw"
DEFAULT_DOSSIER = "36228"
DEFAULT_ACTOR_QUERY = "Timmermans"
DEFAULT_COMMITTEE_QUERY = "RU"
DEFAULT_WGK_TYPE = "Wet"
FALLBACK_ACTOR_QUERY = "van"


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _source_counts(items: list[dict[str, Any]]) -> dict[str, int]:
    return dict(Counter(item.get("source", "unknown") for item in items))


def _stage_for_event(event: dict[str, Any]) -> str:
    event_type = event.get("event_type")
    if event_type == "dossier":
        return "dossier_record"
    if event_type == "vote":
        return "decision"
    if event_type == "activity":
        return "parliamentary_activity"
    return "dossier_documents"


def _derive_committee_signals(activities: list[dict[str, Any]]) -> list[str]:
    committees: list[str] = []
    seen: set[str] = set()
    for activity in activities:
        for organization in activity.get("organizations", []):
            if "commissie" not in organization.lower():
                continue
            if organization in seen:
                continue
            seen.add(organization)
            committees.append(organization)
    return committees


def _first_result(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    results = payload.get("results")
    if isinstance(results, list) and results:
        first = results[0]
        return first if isinstance(first, dict) else None
    timeline = payload.get("timeline")
    if isinstance(timeline, list) and timeline:
        first = timeline[0]
        return first if isinstance(first, dict) else None
    return None


async def _call_tool(
    client: Client,
    name: str,
    arguments: dict[str, Any] | None = None,
) -> Any:
    result = await client.call_tool(name, arguments or {})
    return result.data if hasattr(result, "data") else result


async def _safe_call_tool(
    client: Client,
    name: str,
    arguments: dict[str, Any] | None = None,
) -> tuple[Any | None, str | None]:
    try:
        return await _call_tool(client, name, arguments), None
    except Exception as exc:  # noqa: BLE001
        return None, f"{name} failed: {exc}"


async def topic_monitor(
    client: Client,
    *,
    keyword: str,
    date_from: str | None = None,
    date_to: str | None = None,
    max_results: int = 15,
) -> dict[str, Any]:
    tool_args = {
        "keyword": keyword,
        "date_from": date_from,
        "date_to": date_to,
        "max_results": max_results,
    }
    payload = await _call_tool(client, "search_documents", tool_args)
    results = [
        {
            "source": item.get("source"),
            "title": item.get("title"),
            "doc_type": item.get("doc_type"),
            "published_at": item.get("published_at"),
            "dossier_number": item.get("dossier_number"),
            "summary": item.get("summary"),
            "content_url": item.get("content_url"),
        }
        for item in payload.get("results", [])
    ]
    return {
        "workflow_type": "topic_monitor",
        "query_params": tool_args,
        "results": results,
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [{"tool": "search_documents", "arguments": tool_args}],
            "returned_count": payload.get("returned_count", len(results)),
            "source_counts": _source_counts(results),
            "warnings": payload.get("warnings", []),
        },
    }


async def dossier_tracker(
    client: Client,
    *,
    dossier_number: str,
    include_narrative_context: bool = True,
    max_narrative_results: int = 5,
) -> dict[str, Any]:
    timeline_payload = await _call_tool(
        client,
        "get_dossier_timeline",
        {"dossier_number": dossier_number},
    )
    timeline = timeline_payload.get("timeline", [])
    staged_results = [
        {
            "source": item.get("source"),
            "event_type": item.get("event_type"),
            "stage": _stage_for_event(item),
            "sort_date": item.get("sort_date"),
            "title": item.get("title"),
            "status": item.get("status"),
            "summary": item.get("summary"),
        }
        for item in timeline
    ]

    metadata: dict[str, Any] = {
        "generated_at": _timestamp(),
        "tool_calls": [
            {
                "tool": "get_dossier_timeline",
                "arguments": {"dossier_number": dossier_number},
            }
        ],
        "dossier": timeline_payload.get("dossier"),
        "returned_count": timeline_payload.get("returned_count", len(staged_results)),
        "stage_counts": dict(Counter(item["stage"] for item in staged_results)),
        "warnings": timeline_payload.get("warnings", []),
    }

    dossier = timeline_payload.get("dossier") or {}
    dossier_title = dossier.get("title")
    if include_narrative_context and dossier_title:
        context_args = {
            "keyword": dossier_title,
            "sources": ["rijksoverheid"],
            "max_results": max_narrative_results,
        }
        context_payload = await _call_tool(client, "search_documents", context_args)
        metadata["tool_calls"].append(
            {"tool": "search_documents", "arguments": context_args}
        )
        metadata["narrative_context"] = context_payload.get("results", [])
        metadata["warnings"].extend(context_payload.get("warnings", []))
        metadata["linkage_notes"] = [
            "Rijksoverheid context is keyword-based and not deterministically linked "
            "to the dossier timeline."
        ]

    return {
        "workflow_type": "dossier_tracker",
        "query_params": {
            "dossier_number": dossier_number,
            "include_narrative_context": include_narrative_context,
        },
        "results": staged_results,
        "metadata": metadata,
    }


async def actor_brief(
    client: Client,
    *,
    query: str,
    fallback_query: str | None = FALLBACK_ACTOR_QUERY,
    max_activity_results: int = 8,
    max_vote_results: int = 8,
) -> dict[str, Any]:
    query_params: dict[str, Any] = {"query": query}
    member_payload = await _call_tool(client, "get_member", query_params)
    results = member_payload.get("results", [])
    used_query = query

    if not results and fallback_query and fallback_query != query:
        query_params = {"query": fallback_query}
        member_payload = await _call_tool(client, "get_member", query_params)
        results = member_payload.get("results", [])
        used_query = fallback_query

    metadata: dict[str, Any] = {
        "generated_at": _timestamp(),
        "tool_calls": [{"tool": "get_member", "arguments": dict(query_params)}],
        "ambiguity": len(results) != 1,
        "warnings": list(member_payload.get("warnings", [])),
    }

    if len(results) != 1:
        return {
            "workflow_type": "actor_brief",
            "query_params": {"query": used_query},
            "results": results,
            "metadata": metadata,
        }

    member = results[0]
    activity_args = {"actor": member.get("name")}
    activity_payload, activity_error = await _safe_call_tool(
        client, "search_activities", activity_args
    )
    metadata["tool_calls"].append(
        {"tool": "search_activities", "arguments": activity_args}
    )
    if activity_error:
        metadata["warnings"].append(activity_error)
        recent_activities = []
    else:
        metadata["warnings"].extend(activity_payload.get("warnings", []))
        recent_activities = activity_payload.get("results", [])[:max_activity_results]

    vote_context: list[dict[str, Any]] = []
    if member.get("active") and member.get("faction"):
        vote_args = {"faction": member.get("faction"), "max_results": max_vote_results}
        vote_payload, vote_error = await _safe_call_tool(
            client, "search_votes", vote_args
        )
        metadata["tool_calls"].append(
            {"tool": "search_votes", "arguments": vote_args}
        )
        if vote_error:
            metadata["warnings"].append(vote_error)
        else:
            metadata["warnings"].extend(vote_payload.get("warnings", []))
            vote_context = vote_payload.get("results", [])[:max_vote_results]
            metadata["vote_scope"] = "faction_proxy"
            metadata["assumptions"] = [
                "Vote context is faction-level proxy context because member-level "
                "vote attribution is not exposed by the MCP."
            ]
    else:
        metadata["inactive_member_note"] = (
            "Vote context is omitted for former MPs unless current faction context is explicit."
        )

    return {
        "workflow_type": "actor_brief",
        "query_params": {"query": used_query},
        "results": [
            {
                "member": member,
                "recent_activities": recent_activities,
                "vote_context": vote_context,
                "committee_signals": _derive_committee_signals(recent_activities),
            }
        ],
        "metadata": metadata,
    }


async def committee_watch(
    client: Client,
    *,
    committee_query: str = DEFAULT_COMMITTEE_QUERY,
    max_results: int = 8,
) -> dict[str, Any]:
    committee_args = {"limit": 25}
    committees_payload = await _call_tool(client, "list_committees", committee_args)
    committees = committees_payload.get("results", [])
    lowered_query = committee_query.lower()
    resolved_committee = next(
        (
            committee
            for committee in committees
            if lowered_query in str(committee.get("abbreviation", "")).lower()
            or lowered_query in str(committee.get("name", "")).lower()
        ),
        committees[0] if committees else None,
    )

    metadata: dict[str, Any] = {
        "generated_at": _timestamp(),
        "tool_calls": [{"tool": "list_committees", "arguments": committee_args}],
        "returned_count": 0,
        "warnings": committees_payload.get("warnings", []),
    }
    activities: list[dict[str, Any]] = []

    if resolved_committee:
        activity_args = {
            "committee": resolved_committee.get("abbreviation") or resolved_committee.get("name"),
            "max_results": max_results,
        }
        activity_payload, activity_error = await _safe_call_tool(
            client, "search_activities", activity_args
        )
        metadata["tool_calls"].append(
            {"tool": "search_activities", "arguments": activity_args}
        )
        if activity_error:
            metadata["warnings"].append(activity_error)
        else:
            metadata["warnings"].extend(activity_payload.get("warnings", []))
            activities = activity_payload.get("results", [])
            metadata["returned_count"] = len(activities)

    return {
        "workflow_type": "committee_watch",
        "query_params": {"committee_query": committee_query, "max_results": max_results},
        "results": [{"committee": resolved_committee, "activities": activities}],
        "metadata": metadata,
    }


async def legislative_scan(
    client: Client,
    *,
    max_results: int = 8,
) -> dict[str, Any]:
    document_args = {"doc_type": "wetgeving", "max_results": max_results}
    vote_args = {"max_results": max_results}
    document_payload, vote_payload = await asyncio.gather(
        _call_tool(client, "search_documents", document_args),
        _call_tool(client, "search_votes", vote_args),
    )
    documents = document_payload.get("results", [])
    votes = vote_payload.get("results", [])
    return {
        "workflow_type": "legislative_scan",
        "query_params": {"max_results": max_results},
        "results": [{"documents": documents, "votes": votes}],
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [
                {"tool": "search_documents", "arguments": document_args},
                {"tool": "search_votes", "arguments": vote_args},
            ],
            "source_counts": _source_counts(documents),
            "returned_count": len(documents) + len(votes),
            "warnings": [
                *document_payload.get("warnings", []),
                *vote_payload.get("warnings", []),
            ],
        },
    }


async def ministry_narrative(
    client: Client,
    *,
    keyword: str,
    max_results: int = 8,
) -> dict[str, Any]:
    narrative_args = {
        "keyword": keyword,
        "sources": ["rijksoverheid"],
        "max_results": max_results,
    }
    activity_args = {"keyword": keyword, "max_results": max_results}
    narrative_payload, activity_payload = await asyncio.gather(
        _call_tool(client, "search_documents", narrative_args),
        _call_tool(client, "search_activities", activity_args),
    )
    government_narrative = narrative_payload.get("results", [])
    parliamentary_activity = activity_payload.get("results", [])
    return {
        "workflow_type": "ministry_narrative",
        "query_params": {"keyword": keyword, "max_results": max_results},
        "results": [
            {
                "government_narrative": government_narrative,
                "parliamentary_activity": parliamentary_activity,
            }
        ],
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [
                {"tool": "search_documents", "arguments": narrative_args},
                {"tool": "search_activities", "arguments": activity_args},
            ],
            "source_counts": {
                **_source_counts(government_narrative),
                "tk_activity": len(parliamentary_activity),
            },
            "linkage_notes": [
                "Government narrative and parliamentary activity are linked by shared topic keywords unless a dossier key is present."
            ],
            "warnings": [
                *narrative_payload.get("warnings", []),
                *activity_payload.get("warnings", []),
            ],
        },
    }


async def parliamentary_landscape(
    client: Client,
    *,
    max_vote_results: int = 10,
) -> dict[str, Any]:
    faction_args = {"limit": 25}
    committee_args = {"limit": 25}
    vote_args = {"max_results": max_vote_results}
    faction_payload, committee_payload, vote_payload = await asyncio.gather(
        _call_tool(client, "list_factions", faction_args),
        _call_tool(client, "list_committees", committee_args),
        _call_tool(client, "search_votes", vote_args),
    )
    factions = faction_payload.get("results", [])
    committees = committee_payload.get("results", [])
    recent_votes = vote_payload.get("results", [])
    return {
        "workflow_type": "parliamentary_landscape",
        "query_params": {"max_vote_results": max_vote_results},
        "results": [
            {
                "factions": factions,
                "committees": committees,
                "recent_votes": recent_votes,
            }
        ],
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [
                {"tool": "list_factions", "arguments": faction_args},
                {"tool": "list_committees", "arguments": committee_args},
                {"tool": "search_votes", "arguments": vote_args},
            ],
            "total_seats": sum(int(faction.get("seats") or 0) for faction in factions),
            "faction_count": len(factions),
            "committee_count": len(committees),
            "warnings": [
                *faction_payload.get("warnings", []),
                *committee_payload.get("warnings", []),
                *vote_payload.get("warnings", []),
            ],
        },
    }


async def legislation_lookup(
    client: Client,
    *,
    title: str = "grondwet",
    max_results: int = 10,
) -> dict[str, Any]:
    tool_args: dict[str, Any] = {"title": title, "max_results": max_results}
    payload = await _call_tool(client, "bwb_search", tool_args)
    results = payload.get("results", [])
    return {
        "workflow_type": "legislation_lookup",
        "query_params": tool_args,
        "results": results,
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [{"tool": "bwb_search", "arguments": tool_args}],
            "returned_count": payload.get("returned_count", len(results)),
            "version_count": payload.get("total_count"),
            "warnings": payload.get("warnings", []),
        },
    }


async def legislative_calendar_watch(
    client: Client,
    *,
    keyword: str | None = None,
    wgk_type: str = DEFAULT_WGK_TYPE,
    ministry: str | None = None,
    max_results: int = 10,
) -> dict[str, Any]:
    tool_args: dict[str, Any] = {
        "keyword": keyword,
        "wgk_type": wgk_type,
        "ministry": ministry,
        "max_results": max_results,
    }
    payload = await _call_tool(client, "wetgevingskalender_search", tool_args)
    results = payload.get("results", [])
    type_counts = dict(Counter(r.get("type", "unknown") for r in results))
    creator_counts = dict(Counter(r.get("creator", "unknown") for r in results))
    return {
        "workflow_type": "legislative_calendar_watch",
        "query_params": tool_args,
        "results": results,
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [
                {"tool": "wetgevingskalender_search", "arguments": tool_args}
            ],
            "returned_count": payload.get("returned_count", len(results)),
            "type_counts": type_counts,
            "creator_counts": creator_counts,
            "warnings": payload.get("warnings", []),
        },
    }


async def law_to_dossier_brief(
    client: Client,
    *,
    dossier_number: str | None = None,
    bwb_identifier: str | None = None,
) -> dict[str, Any]:
    tool_args: dict[str, Any] = {}
    if dossier_number:
        tool_args["dossier_number"] = dossier_number
    if bwb_identifier:
        tool_args["bwb_identifier"] = bwb_identifier
    payload = await _call_tool(client, "get_legislative_brief", tool_args)
    return {
        "workflow_type": "law_to_dossier_brief",
        "query_params": tool_args,
        "results": {
            "law": payload.get("law", []),
            "publications": payload.get("publications", []),
        },
        "metadata": {
            "generated_at": _timestamp(),
            "tool_calls": [
                {"tool": "get_legislative_brief", "arguments": tool_args}
            ],
            "dossier_number": payload.get("dossier_number"),
            "bwb_identifier": payload.get("bwb_identifier"),
            "law_count": payload.get("law_count", 0),
            "publication_count": payload.get("publication_count", 0),
            "warnings": payload.get("warnings", []),
        },
    }


async def organization_lookup(
    client: Client,
    *,
    org_type: str = "Ministerie",
) -> dict[str, Any]:
    tool_args: dict[str, Any] = {"org_type": org_type}
    payload = await _call_tool(client, "roo_list_organizations", tool_args)
    results = payload.get("results", [])
    metadata: dict[str, Any] = {
        "generated_at": _timestamp(),
        "tool_calls": [
            {"tool": "roo_list_organizations", "arguments": tool_args}
        ],
        "returned_count": payload.get("returned_count", len(results)),
        "org_type": org_type,
        "warnings": payload.get("warnings", []),
    }
    if results:
        detail_args = {"uri": results[0].get("uri")}
        detail_payload, detail_error = await _safe_call_tool(
            client, "roo_get_organization", detail_args
        )
        metadata["tool_calls"].append(
            {"tool": "roo_get_organization", "arguments": detail_args}
        )
        if detail_error:
            metadata["warnings"].append(detail_error)
        else:
            metadata["detail_example"] = detail_payload
    return {
        "workflow_type": "organization_lookup",
        "query_params": tool_args,
        "results": results,
        "metadata": metadata,
    }


def _tool_summary(
    tool: str,
    arguments: dict[str, Any],
    payload: Any,
    error: str | None,
) -> dict[str, Any]:
    if error:
        return {
            "tool": tool,
            "arguments": arguments,
            "ok": False,
            "error": error,
        }

    if not isinstance(payload, dict):
        return {
            "tool": tool,
            "arguments": arguments,
            "ok": True,
            "value": payload,
        }

    summary: dict[str, Any] = {
        "tool": tool,
        "arguments": arguments,
        "ok": True,
        "warnings": payload.get("warnings", []),
    }
    if "returned_count" in payload:
        summary["returned_count"] = payload.get("returned_count")
    elif "timeline" in payload and isinstance(payload.get("timeline"), list):
        summary["returned_count"] = len(payload.get("timeline", []))
    first = _first_result(payload)
    if first is not None:
        summary["sample"] = first
    elif payload.get("law") or payload.get("publications"):
        summary["sample"] = {
            "law_count": len(payload.get("law", [])),
            "publication_count": len(payload.get("publications", [])),
        }
    return summary


async def exploratory_test(
    client: Client,
    *,
    dossier_number: str = DEFAULT_DOSSIER,
    keyword: str = DEFAULT_TOPIC,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    warnings: list[str] = []

    async def _record(tool: str, arguments: dict[str, Any]) -> Any | None:
        payload, error = await _safe_call_tool(client, tool, arguments)
        results.append(_tool_summary(tool, arguments, payload, error))
        if error:
            warnings.append(error)
        elif isinstance(payload, dict):
            warnings.extend(payload.get("warnings", []))
        return payload

    rijk_payload, documents_payload, activities_payload, votes_payload = await asyncio.gather(
        _record("rijksoverheid_search", {"endpoint": "documents", "rows": 3}),
        _record("search_documents", {"keyword": keyword, "max_results": 5}),
        _record("search_activities", {"keyword": keyword, "max_results": 10}),
        _record("search_votes", {"max_results": 10}),
    )
    ministries_payload, subjects_payload, factions_payload, committees_payload = await asyncio.gather(
        _record("list_ministries", {"limit": 10}),
        _record("list_subjects", {"limit": 10}),
        _record("list_factions", {"limit": 10}),
        _record("list_committees", {"limit": 10}),
    )
    del ministries_payload, subjects_payload, factions_payload, committees_payload

    await _record(
        "get_dossier_timeline",
        {"dossier_number": dossier_number, "max_results_per_source": 5, "timeline_limit": 20},
    )

    rijk_first = _first_result(rijk_payload)
    if rijk_first:
        await _record(
            "rijksoverheid_get",
            {"endpoint": "documents", "id": rijk_first.get("id")},
        )

    tk_search_payload = await _record(
        "tk_search",
        {
            "entity": "Fractie",
            "filter": "Verwijderd eq false and DatumActief ne null and DatumInactief eq null",
            "orderby": "NaamNL asc",
            "top": 1,
        },
    )
    await _record(
        "tk_count",
        {
            "entity": "Fractie",
            "filter": "Verwijderd eq false and DatumActief ne null and DatumInactief eq null",
        },
    )
    tk_first = _first_result(tk_search_payload)
    if tk_first:
        await _record(
            "tk_get",
            {"entity": "Fractie", "id": tk_first.get("Id")},
        )

    bwb_payload, wgk_payload, legislation_payload, roo_payload = await asyncio.gather(
        _record("bwb_search", {"title": "grondwet", "max_results": 3}),
        _record("wetgevingskalender_search", {"wgk_type": DEFAULT_WGK_TYPE, "max_results": 5}),
        _record("search_legislation", {"keyword": keyword, "max_results": 5}),
        _record("roo_list_organizations", {"org_type": "Ministerie"}),
    )
    del legislation_payload

    await _record(
        "koop_search",
        {"query": f"w.dossiernummer=={dossier_number}", "max_records": 5},
    )
    await _record("get_member", {"query": DEFAULT_ACTOR_QUERY})

    bwb_first = _first_result(bwb_payload)
    if bwb_first:
        await _record("bwb_get", {"identifier": bwb_first.get("identifier"), "max_results": 3})
    wgk_first = _first_result(wgk_payload)
    if wgk_first:
        await _record(
            "wetgevingskalender_get",
            {"identifier": wgk_first.get("identifier"), "max_results": 3},
        )
    roo_first = _first_result(roo_payload)
    if roo_first:
        await _record("roo_get_organization", {"uri": roo_first.get("uri")})
    await _record(
        "get_legislative_brief",
        {"dossier_number": dossier_number, "max_results_per_source": 5},
    )

    return {
        "workflow_type": "exploratory_test",
        "query_params": {"keyword": keyword, "dossier_number": dossier_number},
        "results": results,
        "metadata": {
            "generated_at": _timestamp(),
            "tested_tool_count": len(results),
            "warnings": warnings,
        },
    }


async def _run(args: argparse.Namespace) -> dict[str, Any]:
    if not NL_GOV_PROJECT.exists():
        raise FileNotFoundError(f"nl-gov-data project not found: {NL_GOV_PROJECT}")

    transport = UvStdioTransport(
        command="nlgovdata",
        args=["serve"],
        project_directory=NL_GOV_PROJECT,
    )

    async with Client(transport) as client:
        if args.workflow == "topic-monitor":
            return await topic_monitor(
                client,
                keyword=args.keyword,
                date_from=args.date_from,
                date_to=args.date_to,
                max_results=args.max_results,
            )

        if args.workflow == "dossier-tracker":
            return await dossier_tracker(
                client,
                dossier_number=args.dossier_number,
                include_narrative_context=not args.no_narrative_context,
            )

        if args.workflow == "actor-brief":
            return await actor_brief(client, query=args.actor_query)

        if args.workflow == "committee-watch":
            return await committee_watch(
                client,
                committee_query=args.committee_query,
                max_results=args.max_results,
            )

        if args.workflow == "legislative-scan":
            return await legislative_scan(client, max_results=args.max_results)

        if args.workflow == "ministry-narrative":
            return await ministry_narrative(
                client,
                keyword=args.keyword,
                max_results=args.max_results,
            )

        if args.workflow == "parliamentary-landscape":
            return await parliamentary_landscape(client)

        if args.workflow == "legislation-lookup":
            return await legislation_lookup(client, title=args.bwb_title)

        if args.workflow == "calendar-watch":
            return await legislative_calendar_watch(
                client,
                keyword=args.keyword,
                wgk_type=args.wgk_type,
                max_results=args.max_results,
            )

        if args.workflow == "law-brief":
            return await law_to_dossier_brief(
                client,
                dossier_number=args.dossier_number,
                bwb_identifier=args.bwb_identifier,
            )

        if args.workflow == "org-lookup":
            return await organization_lookup(client, org_type=args.org_type)

        if args.workflow == "exploratory-test":
            return await exploratory_test(
                client,
                dossier_number=args.dossier_number,
                keyword=args.keyword,
            )

        outputs = {
            "topic_monitor": await topic_monitor(
                client,
                keyword=args.keyword,
                date_from=args.date_from,
                date_to=args.date_to,
                max_results=args.max_results,
            ),
            "dossier_tracker": await dossier_tracker(
                client,
                dossier_number=args.dossier_number,
                include_narrative_context=not args.no_narrative_context,
            ),
            "actor_brief": await actor_brief(client, query=args.actor_query),
            "committee_watch": await committee_watch(
                client,
                committee_query=args.committee_query,
                max_results=args.max_results,
            ),
            "legislative_scan": await legislative_scan(
                client,
                max_results=args.max_results,
            ),
            "ministry_narrative": await ministry_narrative(
                client,
                keyword=args.keyword,
                max_results=args.max_results,
            ),
            "parliamentary_landscape": await parliamentary_landscape(client),
            "legislation_lookup": await legislation_lookup(client, title=args.bwb_title),
            "legislative_calendar_watch": await legislative_calendar_watch(
                client,
                keyword=args.keyword,
                wgk_type=args.wgk_type,
                max_results=args.max_results,
            ),
            "law_to_dossier_brief": await law_to_dossier_brief(
                client,
                dossier_number=args.dossier_number,
                bwb_identifier=args.bwb_identifier,
            ),
            "organization_lookup": await organization_lookup(client, org_type=args.org_type),
            "exploratory_test": await exploratory_test(
                client,
                dossier_number=args.dossier_number,
                keyword=args.keyword,
            ),
        }
        return {
            "workflow_type": "validation_bundle",
            "query_params": {
                "keyword": args.keyword,
                "dossier_number": args.dossier_number,
                "actor_query": args.actor_query,
                "committee_query": args.committee_query,
                "wgk_type": args.wgk_type,
            },
            "results": outputs,
            "metadata": {
                "generated_at": _timestamp(),
                "validated_workflows": sorted(outputs),
            },
        }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate Dutch government data workflows against the MCP."
    )
    parser.add_argument(
        "--workflow",
        choices=[
            "all",
            "topic-monitor",
            "dossier-tracker",
            "actor-brief",
            "committee-watch",
            "legislative-scan",
            "ministry-narrative",
            "parliamentary-landscape",
            "legislation-lookup",
            "calendar-watch",
            "law-brief",
            "org-lookup",
            "exploratory-test",
        ],
        default="all",
    )
    parser.add_argument("--keyword", default=DEFAULT_TOPIC)
    parser.add_argument("--date-from")
    parser.add_argument("--date-to")
    parser.add_argument("--max-results", type=int, default=15)
    parser.add_argument("--dossier-number", default=DEFAULT_DOSSIER)
    parser.add_argument("--actor-query", default=DEFAULT_ACTOR_QUERY)
    parser.add_argument("--committee-query", default=DEFAULT_COMMITTEE_QUERY)
    parser.add_argument("--no-narrative-context", action="store_true")
    parser.add_argument("--bwb-title", default="grondwet")
    parser.add_argument("--bwb-identifier")
    parser.add_argument("--wgk-type", default=DEFAULT_WGK_TYPE)
    parser.add_argument("--org-type", default="Ministerie")
    parser.add_argument("--output")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    payload = asyncio.run(_run(args))
    rendered = json.dumps(payload, indent=2, ensure_ascii=False)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
