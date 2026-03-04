-- Rollback for RAG v2 pipeline schema.

drop table if exists rag_v2.process_memory;
drop table if exists rag_v2.citations;
drop table if exists rag_v2.generation_runs;
drop table if exists rag_v2.retrieval_runs;
drop table if exists rag_v2.embeddings;
drop table if exists rag_v2.chunks;
drop table if exists rag_v2.document_pages;
drop table if exists rag_v2.documents;
drop function if exists rag_v2.set_updated_at();
drop schema if exists rag_v2;

