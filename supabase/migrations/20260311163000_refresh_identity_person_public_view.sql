create or replace view public.identity_persons as
select * from knex_identity_runtime.identity_persons;

grant select, insert, update, delete on public.identity_persons to service_role;
