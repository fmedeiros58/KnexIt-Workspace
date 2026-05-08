import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function FileSaveGroup() {
  return (
    <WriterRibbonGroup title="Salvar">
      <RibbonCommandButton label="Salvar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

