import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function DocumentFormattingGroup() {
  return (
    <WriterRibbonGroup title="Formatação">
      <RibbonCommandButton label="Formatação" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

