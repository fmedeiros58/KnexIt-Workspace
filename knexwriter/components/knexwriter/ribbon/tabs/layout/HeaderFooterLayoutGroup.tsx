import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function HeaderFooterLayoutGroup() {
  return (
    <WriterRibbonGroup title="Cabeçalho e rodapé">
      <RibbonCommandButton label="Distâncias" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

