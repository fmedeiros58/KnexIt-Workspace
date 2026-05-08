import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertTextGroup() {
  return (
    <WriterRibbonGroup title="Texto">
      <RibbonCommandButton label="Caixa de texto" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

