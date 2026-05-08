import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertPagesGroup() {
  return (
    <WriterRibbonGroup title="Páginas">
      <RibbonCommandButton label="Quebra de página" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

