import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ViewControlsGroup() {
  return (
    <WriterRibbonGroup title="Controles">
      <RibbonCommandButton label="Painéis" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

