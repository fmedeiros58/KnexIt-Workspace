import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertTablesGroup() {
  return (
    <WriterRibbonGroup title="Tabelas">
      <RibbonCommandButton label="Tabela" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

