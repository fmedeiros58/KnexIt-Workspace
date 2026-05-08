import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FileOpenGroup() {
  return (
    <WriterRibbonGroup title="Abrir">
      <RibbonCommandButton label="Abrir" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

