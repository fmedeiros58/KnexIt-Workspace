import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FinishMailingsGroup() {
  return (
    <WriterRibbonGroup title="Concluir">
      <RibbonCommandButton label="Concluir" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

