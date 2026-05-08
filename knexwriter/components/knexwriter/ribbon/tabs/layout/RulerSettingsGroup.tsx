import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function RulerSettingsGroup() {
  return (
    <WriterRibbonGroup title="Régua">
      <RibbonCommandButton label="Régua" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

