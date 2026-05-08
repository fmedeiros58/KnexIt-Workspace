import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function WriteInsertFieldsGroup() {
  return (
    <WriterRibbonGroup title="Campos">
      <RibbonCommandButton label="Inserir campo" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

