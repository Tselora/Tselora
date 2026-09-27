# Contributing

This public repository holds **examples and documentation**. The runnable product is the [`tselora`](https://pypi.org/project/tselora/) package on PyPI.

## Examples and docs

1. Fork and clone this repository.
2. `python -m venv .venv && source .venv/bin/activate`
3. `pip install tselora` (add extras if you touch an adapter example).
4. `tselora serve` and run the example you changed.
5. Open a pull request with a short description.

Do not commit `.env`, credentials, or `.agent-devtools/` logs.

## Issues

Use GitHub Issues for bugs in published examples/docs or for questions about the public package. Include `tselora` version (`pip show tselora`) and a minimal reproduction when you can.

## What not to send

Private planning notes, credentials, customer data, or event logs that contain prompts or secrets.
