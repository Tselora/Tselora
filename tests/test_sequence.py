from concurrent.futures import ThreadPoolExecutor

from core.events.sequence import SequenceCounter


def test_sequence_is_monotonic() -> None:
    counter = SequenceCounter()
    values = [counter.next() for _ in range(5)]
    assert values == [1, 2, 3, 4, 5]
    assert counter.current == 5


def test_sequence_is_thread_safe() -> None:
    counter = SequenceCounter()
    n = 100

    def _one() -> int:
        return counter.next()

    with ThreadPoolExecutor(max_workers=8) as pool:
        got = list(pool.map(lambda _: _one(), range(n)))
    assert sorted(got) == list(range(1, n + 1))
