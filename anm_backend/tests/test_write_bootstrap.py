import unittest

from anm_backend.api.routes_write import (
    add_process_memory,
    attach_reference,
    continue_writing,
    create_project,
    create_section,
    get_chunk,
    get_project,
    get_project_summary,
    get_chunk_versions,
    insert_chunk,
    get_section_summary,
    list_project_sections,
    list_projects,
    patch_chunk,
    patch_project,
    patch_section,
    process_memory,
    summarize_project,
    summarize_section,
)
from anm_backend.api.schemas import (
    WriteChunkPatchRequest,
    WriteContinueRequest,
    WriteInsertRequest,
    WriteProjectPatchRequest,
    WriteProcessMemoryCreateRequest,
    WriteProjectCreateRequest,
    WriteReferenceAttachRequest,
    WriteSectionPatchRequest,
    WriteSectionCreateRequest,
)
from anm_backend.contracts import EngineResponse
from anm_backend.main import create_app


class DummyRequest:
    def __init__(self, app):
        self.app = app


class WriteBootstrapTests(unittest.TestCase):
    def test_write_domain_bootstrap_routes_and_state(self) -> None:
        app = create_app()
        request = DummyRequest(app)

        self.assertIsNotNone(getattr(app.state, "write_service", None))
        self.assertIsNotNone(getattr(app.state, "write_repository", None))

        paths = {getattr(route, "path", "") for route in app.routes}
        self.assertIn("/write/projects", paths)
        self.assertIn("/write/projects/{project_id}/sections", paths)
        self.assertIn("/write/projects/{project_id}", paths)
        self.assertIn("/write/sections/{section_id}", paths)
        self.assertIn("/write/insert", paths)
        self.assertIn("/write/projects/{project_id}/assist", paths)
        self.assertIn("/write/continue", paths)
        self.assertIn("/write/chunks/{chunk_id}", paths)
        self.assertIn("/write/chunks/{chunk_id}/versions", paths)
        self.assertIn("/write/projects/{project_id}/summarize", paths)
        self.assertIn("/write/projects/{project_id}/summary", paths)
        self.assertIn("/write/sections/{section_id}/summarize", paths)
        self.assertIn("/write/sections/{section_id}/summary", paths)

        created = create_project(
            request,
            WriteProjectCreateRequest(title="Documento de teste", objective="Bootstrap do modo escrita"),
        )
        project_id = created.project.project_id
        self.assertTrue(project_id)
        self.assertEqual(created.project.title, "Documento de teste")

        section = create_section(
            request,
            project_id,
            WriteSectionCreateRequest(
                title="Introducao",
                kind="section",
                order=0,
                objective="Contextualizar o problema central",
                outline_notes="Definir contexto, lacuna e direcao dos proximos capitulos.",
                status="drafting",
                content="Texto inicial",
            ),
        )
        section_id = section.section.section_id
        self.assertEqual(section.section.title, "Introducao")

        reference = attach_reference(
            request,
            project_id,
            WriteReferenceAttachRequest(document_id=12, source_path="data/rag/bulk/doc-12.txt", note="fonte base"),
        )
        self.assertEqual(reference.reference.document_id, 12)

        fetched = get_project(request, project_id)
        self.assertEqual(fetched.project.project_id, project_id)
        self.assertEqual(len(fetched.project.sections), 1)
        self.assertEqual(len(fetched.project.references), 1)

        updated_project = patch_project(
            request,
            project_id,
            WriteProjectPatchRequest(
                title="Documento de teste atualizado",
                description="Descricao atualizada de escopo",
                status="in_progress",
                metadata={"editor": "frontend-alpha"},
            ),
        )
        self.assertEqual(updated_project.project.title, "Documento de teste atualizado")
        self.assertEqual(updated_project.project.status, "in_progress")

        sections_payload = list_project_sections(request, project_id, include_chunks=True, include_summaries=False)
        self.assertEqual(sections_payload.project_id, project_id)
        self.assertEqual(len(sections_payload.sections), 1)

        updated_section = patch_section(
            request,
            section_id,
            WriteSectionPatchRequest(
                objective="Contextualizar e delimitar o problema principal",
                outline_notes="Atualizar lacuna de pesquisa e transicao metodologica.",
                status="review",
                order=1,
            ),
        )
        self.assertEqual(updated_section.section.status, "review")
        self.assertEqual(updated_section.section.order, 1)

        listed = list_projects(request, limit=10)
        self.assertTrue(any(item.project_id == project_id for item in listed.projects))

        memory_payload = process_memory(request, project_id)
        self.assertEqual(memory_payload.project_id, project_id)
        self.assertIn("sections", memory_payload.process_memory)

        memory_item = add_process_memory(
            request,
            project_id,
            WriteProcessMemoryCreateRequest(
                section_id=section_id,
                memory_type="terminology",
                title="Termo padrao",
                content="Usar 'framework de evidencia' como termo padrao do manuscrito.",
                priority=800,
                is_active=True,
            ),
        )
        self.assertEqual(memory_item.memory.memory_type, "terminology")

        inserted_payload = insert_chunk(
            request,
            WriteInsertRequest(
                project_id=project_id,
                section_id=section_id,
                content="Trecho inserido manualmente para guiar o inicio da secao.",
                source_type="user_inserted",
                role="user",
                update_embedding=True,
                summarize_section=False,
                summarize_project=False,
            ),
        )
        self.assertEqual(inserted_payload.chunk.source_type, "user_inserted")
        self.assertTrue(inserted_payload.applied["update_embedding"])
        inserted_chunk_id = inserted_payload.chunk.chunk_id

        fetched_chunk = get_chunk(request, inserted_chunk_id)
        self.assertEqual(fetched_chunk.chunk.chunk_id, inserted_chunk_id)
        self.assertEqual(fetched_chunk.chunk.version, 1)

        edited_chunk_payload = patch_chunk(
            request,
            inserted_chunk_id,
            WriteChunkPatchRequest(
                content="Trecho manual revisado para maior clareza de escopo.",
                edit_source="user_edit",
                update_embedding=True,
                summarize_section=False,
                summarize_project=False,
                metadata={"reviewer": "editor-a"},
            ),
        )
        self.assertEqual(edited_chunk_payload.chunk.chunk_id, inserted_chunk_id)
        self.assertEqual(edited_chunk_payload.chunk.version, 2)
        self.assertEqual(edited_chunk_payload.version_record.version_number, 2)
        self.assertEqual(edited_chunk_payload.version_record.edit_source, "user_edit")

        versions_payload = get_chunk_versions(request, inserted_chunk_id)
        self.assertEqual(versions_payload.chunk_id, inserted_chunk_id)
        self.assertEqual(len(versions_payload.versions), 2)
        self.assertEqual(versions_payload.versions[0].version_number, 2)
        self.assertEqual(versions_payload.versions[1].version_number, 1)

        repository = app.state.write_repository
        repository.append_chunk(
            project_id=project_id,
            section_id=section_id,
            role="assistant",
            text="A introducao apresenta o problema e delimita o escopo do texto.",
            metadata={"source": "test"},
        )
        repository.append_chunk(
            project_id=project_id,
            section_id=section_id,
            role="assistant",
            text="Tambem define os objetivos e os criterios de avaliacao do manuscrito.",
            metadata={"source": "test"},
        )

        section_summary_first = summarize_section(request, section_id)
        self.assertTrue(section_summary_first.updated)
        self.assertEqual(section_summary_first.summary.summary_version, 1)
        self.assertEqual(section_summary_first.summary.source_chunk_count, 3)
        self.assertIsNotNone(section_summary_first.summary.last_chunk_id_processed)

        section_summary_second = summarize_section(request, section_id)
        self.assertFalse(section_summary_second.updated)
        self.assertEqual(section_summary_second.summary.summary_version, 1)

        repository.append_chunk(
            project_id=project_id,
            section_id=section_id,
            role="assistant",
            text="Por fim, a secao indica a estrutura dos proximos capitulos.",
            metadata={"source": "test"},
        )
        section_summary_third = summarize_section(request, section_id)
        self.assertTrue(section_summary_third.updated)
        self.assertEqual(section_summary_third.summary.summary_version, 2)
        self.assertEqual(section_summary_third.summary.source_chunk_count, 4)

        section_summary_get = get_section_summary(request, section_id)
        self.assertEqual(section_summary_get.summary.summary_version, 2)

        project_summary_first = summarize_project(request, project_id)
        self.assertTrue(project_summary_first.updated)
        self.assertEqual(project_summary_first.summary.summary_version, 1)
        self.assertEqual(project_summary_first.summary.source_chunk_count, 4)

        project_summary_second = summarize_project(request, project_id)
        self.assertFalse(project_summary_second.updated)
        self.assertEqual(project_summary_second.summary.summary_version, 1)

        project_summary_get = get_project_summary(request, project_id)
        self.assertEqual(project_summary_get.summary.summary_version, 1)

        continue_service = app.state.write_continue_service

        def fake_invoke_llm(*args, **kwargs):
            return EngineResponse(
                trace_id=kwargs.get("trace_id", "trace-test"),
                model="test-model",
                text=(
                    "A secao avanca ao delimitar criterios operacionais para a analise.\n\n"
                    "Em seguida, conecta esses criterios ao framework de evidencia adotado.\n\n"
                    "Por fim, prepara a transicao para a secao metodologica."
                ),
                usage={"completion_tokens": 96},
                raw={"choices": [{"message": {"content": "ok"}}]},
            )

        continue_service._invoke_llm = fake_invoke_llm  # type: ignore[method-assign]

        continue_payload = continue_writing(
            request,
            WriteContinueRequest(
                project_id=project_id,
                section_id=section_id,
                instruction="continue e aprofunde a secao de introducao",
                top_k_chunks=4,
                top_k_memories=4,
                min_paragraphs=2,
                max_paragraphs=4,
                max_tokens=900,
                temperature=0.2,
            ),
        )
        self.assertEqual(continue_payload.project_id, project_id)
        self.assertEqual(continue_payload.section_id, section_id)
        self.assertTrue(continue_payload.chunk.text.strip())
        self.assertGreaterEqual(len(continue_payload.retrieved_chunk_ids), 1)
        self.assertIn(memory_item.memory.memory_id, continue_payload.retrieved_memory_ids)
        self.assertEqual(continue_payload.top_k_applied["chunks"], 4)
        self.assertEqual(continue_payload.top_k_applied["memories"], 4)
        self.assertEqual(continue_payload.parameters["paragraphs_min"], 2)
        self.assertEqual(continue_payload.parameters["paragraphs_max"], 4)


if __name__ == "__main__":
    unittest.main()
