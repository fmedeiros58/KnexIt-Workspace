"""
FILE: services/internet_search_service.py
RESPONSIBILITY: Lightweight internet search enrichment for chat context.
FLOW ROLE: Optional external grounding before generation.
READS: User prompt/query.
RAM WRITES: None.
PERSISTS: None.
PRIMARY RISK: External endpoint instability or noisy snippets.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Dict, List
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def _env_bool(name: str, *, default: bool = False) -> bool:
    raw = str(os.getenv(name, "1" if default else "0")).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _env_float(name: str, *, default: float, low: float, high: float) -> float:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        parsed = float(raw)
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


def _env_int(name: str, *, default: int, low: int, high: int) -> int:
    raw = str(os.getenv(name, str(default))).strip()
    try:
        parsed = int(raw)
    except ValueError:
        parsed = default
    return max(low, min(high, parsed))


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _extract_related_topics(raw_topics: List[dict], *, max_results: int) -> List[Dict[str, str]]:
    results: List[Dict[str, str]] = []
    for topic in raw_topics:
        if len(results) >= max_results:
            break
        if not isinstance(topic, dict):
            continue
        if isinstance(topic.get("Topics"), list):
            nested = _extract_related_topics(topic.get("Topics") or [], max_results=max_results - len(results))
            results.extend(nested)
            if len(results) >= max_results:
                break
            continue

        text = _normalize(str(topic.get("Text") or ""))
        url = _normalize(str(topic.get("FirstURL") or ""))
        if not text:
            continue
        results.append({"title": text.split(" - ")[0][:120], "snippet": text[:360], "url": url})
    return results


@dataclass
class InternetSearchService:
    def should_search(self, query: str) -> bool:
        if not _env_bool("ANM_INTERNET_SEARCH_ENABLED", default=False):
            return False
        normalized = _normalize(query).lower()
        if len(normalized) < 18:
            return False
        if _env_bool("ANM_INTERNET_SEARCH_ALWAYS", default=False):
            return True
        return any(
            token in normalized
            for token in (
                "pesquise",
                "cite fontes",
                "fonte",
                "noticia",
                "noticias",
                "latest",
                "atual",
                "atualizado",
                "who is",
                "what is",
                "verifique",
            )
        )

    def search(self, *, query: str) -> Dict[str, object]:
        if not self.should_search(query):
            return {}

        timeout_seconds = _env_float("ANM_INTERNET_SEARCH_TIMEOUT_SECONDS", default=2.5, low=0.8, high=8.0)
        max_results = _env_int("ANM_INTERNET_SEARCH_MAX_RESULTS", default=3, low=1, high=8)
        started = time.perf_counter()
        try:
            params = urlencode(
                {
                    "q": query,
                    "format": "json",
                    "no_redirect": "1",
                    "no_html": "1",
                    "skip_disambig": "1",
                }
            )
            endpoint = f"https://api.duckduckgo.com/?{params}"
            request = Request(
                endpoint,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "knexit-anm/1.0",
                },
            )
            with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310
                payload = json.loads(response.read().decode("utf-8", errors="ignore"))
        except Exception:
            return {}

        items: List[Dict[str, str]] = []
        abstract_text = _normalize(str(payload.get("AbstractText") or ""))
        abstract_url = _normalize(str(payload.get("AbstractURL") or ""))
        heading = _normalize(str(payload.get("Heading") or ""))
        if abstract_text:
            items.append(
                {
                    "title": heading or query[:120],
                    "snippet": abstract_text[:360],
                    "url": abstract_url,
                }
            )

        related = payload.get("RelatedTopics")
        if isinstance(related, list):
            remaining = max(0, max_results - len(items))
            if remaining > 0:
                items.extend(_extract_related_topics(related, max_results=remaining))

        # Deduplicate by url + title.
        dedup: List[Dict[str, str]] = []
        seen = set()
        for item in items:
            key = f"{item.get('url','')}|{item.get('title','')}".strip().lower()
            if key in seen:
                continue
            seen.add(key)
            dedup.append(item)
            if len(dedup) >= max_results:
                break

        if not dedup:
            return {}

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            "provider": "duckduckgo_instant_answer",
            "query": _normalize(query)[:320],
            "elapsed_ms": elapsed_ms,
            "results": dedup,
        }
