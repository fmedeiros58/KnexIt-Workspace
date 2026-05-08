import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function HelpSearchGroup() {
  return (
    <WriterRibbonGroup title="Pesquisar ajuda">
      <RibbonCommandButton label="Pesquisar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

