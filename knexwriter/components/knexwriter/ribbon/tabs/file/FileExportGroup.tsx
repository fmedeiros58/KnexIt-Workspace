import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FileExportGroup() {
  return (
    <WriterRibbonGroup title="Exportar">
      <RibbonCommandButton label="Exportar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

