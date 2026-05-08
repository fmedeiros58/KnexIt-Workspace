import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function WindowGroup() {
  return (
    <WriterRibbonGroup title="Janela">
      <RibbonCommandButton label="Organizar janela" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

