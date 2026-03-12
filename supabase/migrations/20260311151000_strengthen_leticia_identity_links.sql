-- Ensure a canonical facial identity anchors to a single Leticia person node.

with ranked as (
  select
    person_identity_link_id,
    row_number() over (
      partition by identity_person_id
      order by updated_at desc, created_at desc, person_identity_link_id desc
    ) as rn
  from knex_leticia.person_identity_links
  where identity_person_id is not null
)
delete from knex_leticia.person_identity_links pil
using ranked r
where pil.person_identity_link_id = r.person_identity_link_id
  and r.rn > 1;

create unique index if not exists idx_leticia_identity_links_identity_person_unique
  on knex_leticia.person_identity_links(identity_person_id)
  where identity_person_id is not null;
