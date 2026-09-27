# Reproduction and lineage

Tselora can emit and project:

- `checkpoint.created` (allowlisted payload: id, label, instance id, opaque `app_restore_ref`)
- fork / child-run linkage (`parent_run_id`, `child_run_id`, source checkpoint)

SDK helpers (from the installed package): `create_checkpoint`, `prepare_fork`, `link_forked_child`.

**The application owns resume.** Tselora does not serialize or restore arbitrary Python process state. Visualization “replay” is re-projection of the event log, not generic re-execution.
