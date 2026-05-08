import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function TableOfContentsGroup() {
  return (
    <WriterRibbonGroup title="Sumário">
      <RibbonCommandButton label="Sumário" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

