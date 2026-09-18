"""Read-only REST over EventStore + ProjectionEngine. No live projection."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from core.events.schema import AgentEvent
from core.projection.engine import ProjectionEngine, ProjectionRunMismatchError
from core.projection.models import GraphState, ProjectionState, TimelineState
from server.storage.jsonl import JsonlEventStore

router = APIRouter()


def _store(request: Request) -> JsonlEventStore:
    return request.app.state.store


def _read_events(store: JsonlEventStore, run_id: str) -> list[AgentEvent]:
    try:
        exists = store.has_run(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not exists:
        raise HTTPException(status_code=404, detail=f"unknown run: {run_id}")
    try:
        return store.read(run_id)
    except (json.JSONDecodeError, ValidationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="malformed event log") from exc


def _rebuild(run_id: str, events: list[AgentEvent]) -> ProjectionState:
    try:
        return ProjectionEngine(run_id=run_id).rebuild(events)
    except ProjectionRunMismatchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/v1/runs/{run_id}", response_model=ProjectionState)
def get_run(run_id: str, request: Request) -> ProjectionState:
    events = _read_events(_store(request), run_id)
    return _rebuild(run_id, events)


@router.get("/v1/runs/{run_id}/graph", response_model=GraphState)
def get_graph(run_id: str, request: Request) -> GraphState:
    events = _read_events(_store(request), run_id)
    return _rebuild(run_id, events).graph


@router.get("/v1/runs/{run_id}/timeline", response_model=TimelineState)
def get_timeline(run_id: str, request: Request) -> TimelineState:
    events = _read_events(_store(request), run_id)
    return _rebuild(run_id, events).timeline


@router.get("/v1/runs/{run_id}/events", response_model=list[AgentEvent])
def get_events(run_id: str, request: Request) -> list[AgentEvent]:
    return _read_events(_store(request), run_id)
