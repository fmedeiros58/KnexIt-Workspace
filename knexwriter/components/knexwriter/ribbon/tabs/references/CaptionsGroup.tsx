import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function CaptionsGroup() {
  return (
    <WriterRibbonGroup title="Legendas">
      <RibbonCommandButton label="Legenda" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

