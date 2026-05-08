import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function InsertLinksGroup() {
  return (
    <WriterRibbonGroup title="Links">
      <RibbonCommandButton label="Link" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

