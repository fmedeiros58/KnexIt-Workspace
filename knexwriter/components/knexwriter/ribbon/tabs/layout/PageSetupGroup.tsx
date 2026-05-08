import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function PageSetupGroup() {
  return (
    <WriterRibbonGroup title="Configurar página">
      <RibbonCommandButton label="Margens" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

