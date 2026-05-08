import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FileNewGroup() {
  return (
    <WriterRibbonGroup title="Novo">
      <RibbonCommandButton label="Novo" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

