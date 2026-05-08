import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ArrangeGroup() {
  return (
    <WriterRibbonGroup title="Organizar">
      <RibbonCommandButton label="Organizar" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

