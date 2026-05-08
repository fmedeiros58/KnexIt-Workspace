/**
 * ============================================================================
 * TÍTULO DO ARQUIVO
 * ============================================================================
 * Produto: KnexWriter
 * Setor: Painéis laterais / Panels
 * Arquivo: components/knexwriter/panels/index.ts
 *
 * ============================================================================
 * OBJETIVO DO MÓDULO
 * ============================================================================
 * Centralizar as exportações públicas dos painéis do KnexWriter.
 *
 * Este arquivo deve ser usado pelo Shell/Layout principal para importar os
 * painéis laterais sem conhecer a estrutura interna da pasta.
 *
 * O Shell deve apenas decidir QUANDO cada painel aparece.
 * Cada painel deve decidir COMO seu próprio conteúdo é renderizado.
 *
 * ============================================================================
 * USO ESPERADO NO SHELL
 * ============================================================================
 *
 * import {
 *   LeftNavigationPanel,
 *   RightContextPanel,
 *   ProjectPanel,
 *   SectionPanel,
 *   ContextAnalysisPanel,
 * } from "../panels";
 *
 * ============================================================================
 */

export {
  ContextAnalysisPanel,
} from "./ContextAnalysisPanel";

export type {
  ContextAnalysisPanelProps,
} from "./ContextAnalysisPanel";

export {
  LeftNavigationPanel,
} from "./LeftNavigationPanel";

export type {
  LeftNavigationPanelProps,
} from "./LeftNavigationPanel";

export {
  ProjectPanel,
} from "./ProjectPanel";

export type {
  ProjectPanelProps,
} from "./ProjectPanel";

export {
  RightContextPanel,
} from "./RightContextPanel";

export type {
  RightContextPanelProps,
} from "./RightContextPanel";

export {
  SectionPanel,
} from "./SectionPanel";

export type {
  SectionPanelProps,
} from "./SectionPanel";