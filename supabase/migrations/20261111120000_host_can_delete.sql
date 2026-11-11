-- ─────────────────────────────────────────────────────────────────
-- Hosts can delete their own meetup.
--
-- Deleting a meetup cascades to its participants and nudges (existing
-- foreign keys), which also removes any stored live locations. Only the
-- creator may delete; everyone else gets nothing back from the delete.
-- ─────────────────────────────────────────────────────────────────

create policy "hosts delete their meetups"
  on public.meetups for delete to authenticated
  using (created_by = auth.uid());

grant delete on public.meetups to authenticated;
