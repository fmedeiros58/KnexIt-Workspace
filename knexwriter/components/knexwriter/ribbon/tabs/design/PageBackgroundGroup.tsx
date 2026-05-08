import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function PageBackgroundGroup() {
  return (
    <WriterRibbonGroup title="Plano de fundo">
      <RibbonCommandButton label="Plano de fundo" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

