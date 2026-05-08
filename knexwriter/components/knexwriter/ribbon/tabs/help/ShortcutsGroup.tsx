import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ShortcutsGroup() {
  return (
    <WriterRibbonGroup title="Atalhos">
      <RibbonCommandButton label="Atalhos" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

