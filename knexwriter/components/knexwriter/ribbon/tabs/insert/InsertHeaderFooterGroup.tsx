import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertHeaderFooterGroup() {
  return (
    <WriterRibbonGroup title="Cabeçalho e rodapé">
      <RibbonCommandButton label="Cabeçalho" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

