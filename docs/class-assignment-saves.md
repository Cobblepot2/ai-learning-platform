# Reliable class project assignment

**Coordinated deployment required:** ship `supabase/migrations/20261112130000_atomic_class_assignments.sql` and this application code in the same release window. Pause assignment edits, apply the migration, deploy the matching code immediately, reload existing class tabs and verify a save before reopening edits. Do not apply the migration as an earlier standalone release: it revokes the direct writes used by the old application, while the new application needs the added column and RPC.

The migration adds `classes.projects_version` and the transactional `replace_class_projects` RPC. Direct authenticated inserts/deletes on `class_projects` are revoked so writes cannot bypass the version check. The class owner can still read assignments; student membership, roster imports and join codes are unchanged.

The class page shows selections immediately. It sends one save at a time and combines any further clicks into the latest unsent selection. **Saving…** becomes **Saved** only after the last selection is acknowledged. A failed request keeps the choices and offers **Retry save**. A version conflict requires **Reload assignments**; the UI explains that a lost response can follow a successful save, and reloading discards unsaved choices in that tab.

Each save checks the expected version, replaces the selected project set and increments the version in one database transaction under a class-row lock. A failed insertion rolls the entire change back. The API verifies the instructor, class ownership and available projects; the RPC also checks class ownership and ownership of generated projects. Existing callers must send `expectedVersion` with the project list.

The assignment catalogue loads all owned project IDs and titles with keyset pagination, independently of the home page's 50-project preview. Read failures, including failures partway through pagination, return a retryable 503 before any assignment write; a failed/partial read is never used as an empty allow-list. An unavailable project is still rejected when the complete catalogue was read successfully. Deliberate version conflicts use SQLSTATE `PT409`, separate from PostgreSQL's retryable `40001` serialization failure.

Manual checks:

1. Delay the first save, select A, then B, then unselect A. Keep clicking available while saving. After **Saved**, refresh: only B remains.
2. Unselect the final project, wait for **Saved**, refresh: the list remains empty.
3. Fail a save, check that the choices remain, then retry. A lost response after a committed save may produce a conflict on retry; reload to inspect the saved state.
4. Open two tabs at the same version. Save in one, then try the other: it must show a conflict and require reload rather than overwrite the first tab.
5. Confirm students and another class owner cannot assign projects to this class.
