import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ChangesGroup() {
  return (
    <WriterRibbonGroup title="Alterações">
      <RibbonCommandButton label="Aceitar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

