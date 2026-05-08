import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ZoomGroup() {
  return (
    <WriterRibbonGroup title="Zoom">
      <RibbonCommandButton label="Zoom" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

