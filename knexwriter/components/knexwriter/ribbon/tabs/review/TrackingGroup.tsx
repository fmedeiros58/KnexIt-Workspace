import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function TrackingGroup() {
  return (
    <WriterRibbonGroup title="Controle">
      <RibbonCommandButton label="Controlar alterações" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

