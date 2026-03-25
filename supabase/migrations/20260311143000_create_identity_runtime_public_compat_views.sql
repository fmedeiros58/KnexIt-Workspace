-- Compatibility views for identity runtime tables when PostgREST exposes only `public`.

create or replace view public.identity_runtime_config as
select * from knex_identity_runtime.identity_runtime_config;

create or replace view public.identity_entities as
select * from knex_identity_runtime.identity_entities;

grant select, insert, update, delete on public.identity_runtime_config to service_role;
grant select, insert, update, delete on public.identity_entities to service_role;
grant select, insert, update, delete on public.identity_image_assets to service_role;
grant select, insert, update, delete on public.identity_image_embeddings to service_role;
grant select, insert, update, delete on public.identity_capture_embeddings to service_role;
grant select, insert, update, delete on public.identity_embedding_matches to service_role;
grant select, insert, update, delete on public.identity_interpretation_layers to service_role;
grant select, insert, update, delete on public.identity_persons to service_role;
grant select, insert, update, delete on public.identity_person_profiles to service_role;
grant select, insert, update, delete on public.identity_person_reference_images to service_role;
