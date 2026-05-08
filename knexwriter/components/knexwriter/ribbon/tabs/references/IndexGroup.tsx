import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function IndexGroup() {
  return (
    <WriterRibbonGroup title="Índice">
      <RibbonCommandButton label="Índice" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

