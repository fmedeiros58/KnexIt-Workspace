import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ThemesGroup() {
  return (
    <WriterRibbonGroup title="Temas">
      <RibbonCommandButton label="Temas" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

