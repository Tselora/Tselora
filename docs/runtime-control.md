# Runtime control

Control is **cooperative**. The collector accepts intents; the SDK runtime must poll/honor them. The UI (when present) is never the source of truth—meaningful transitions should appear as events.

Typical collector routes (package `server.api.commands`):

- `POST /v1/runs/{run_id}/control/register`
- `POST /v1/runs/{run_id}/commands`
- `POST /v1/runs/{run_id}/control/unregister`

SDK: `configure_control`, `check_control`, `ControlSession`.

If the application ignores a command, the log will not pretend the run paused. This is not a production multi-tenant control plane.
