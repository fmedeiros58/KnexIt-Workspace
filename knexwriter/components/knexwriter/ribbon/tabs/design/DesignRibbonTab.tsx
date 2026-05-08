import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { DocumentFormattingGroup } from "./DocumentFormattingGroup";
import { PageBackgroundGroup } from "./PageBackgroundGroup";
import { StyleSetGroup } from "./StyleSetGroup";
import { ThemesGroup } from "./ThemesGroup";

/**
 * Aba Design do KnexWriter.
 *
 * Esta aba organiza os comandos visuais do documento, seguindo a lógica do Word:
 * - Temas
 * - Conjunto de estilos
 * - Formatação do documento
 * - Plano de fundo da página
 *
 * A responsabilidade deste arquivo é apenas montar a aba.
 * A lógica específica de cada grupo deve permanecer nos respectivos componentes.
 */
export function DesignRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout aria-label="Aba Design">
      <ThemesGroup />
      <StyleSetGroup />
      <DocumentFormattingGroup />
      <PageBackgroundGroup />
    </RibbonTabLayout>
  );
}
