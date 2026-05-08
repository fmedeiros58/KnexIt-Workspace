import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FileRecentGroup() {
  return (
    <WriterRibbonGroup title="Recentes">
      <RibbonCommandButton label="Recentes" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

