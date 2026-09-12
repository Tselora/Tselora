from core.events.ids import new_event_id, new_run_id


def test_event_ids_are_unique() -> None:
    ids = {new_event_id() for _ in range(200)}
    assert len(ids) == 200
    assert all(i.startswith("evt_") for i in ids)


def test_run_ids_are_unique() -> None:
    ids = {new_run_id() for _ in range(200)}
    assert len(ids) == 200
    assert all(i.startswith("run_") for i in ids)
