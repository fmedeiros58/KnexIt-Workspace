import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertObjectsGroup() {
  return (
    <WriterRibbonGroup title="Objetos">
      <RibbonCommandButton label="Objeto" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

