import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function CompareGroup() {
  return (
    <WriterRibbonGroup title="Comparar">
      <RibbonCommandButton label="Comparar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

