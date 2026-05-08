import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ParagraphLayoutGroup() {
  return (
    <WriterRibbonGroup title="Parágrafo">
      <RibbonCommandButton label="Recuo" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

