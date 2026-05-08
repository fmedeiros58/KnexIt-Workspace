import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ViewsGroup() {
  return (
    <WriterRibbonGroup title="Exibições">
      <RibbonCommandButton label="Modo" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

