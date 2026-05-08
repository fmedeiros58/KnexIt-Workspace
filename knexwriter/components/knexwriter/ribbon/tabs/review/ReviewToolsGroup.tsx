import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ReviewToolsGroup() {
  return (
    <WriterRibbonGroup title="Ferramentas">
      <RibbonCommandButton label="Análise textual" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

