import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function CreateMailingsGroup() {
  return (
    <WriterRibbonGroup title="Criar">
      <RibbonCommandButton label="Envelopes" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

