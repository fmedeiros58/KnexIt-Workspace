import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function AboutGroup() {
  return (
    <WriterRibbonGroup title="Sobre">
      <RibbonCommandButton label="Sobre o KnexWriter" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

