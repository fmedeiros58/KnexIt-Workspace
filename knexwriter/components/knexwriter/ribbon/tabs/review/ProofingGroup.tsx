import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import { RibbonCommandButton } from "../../shared/RibbonCommandButton";

export function ProofingGroup() {
  return (
    <WriterRibbonGroup title="Revisão de texto">
      <RibbonCommandButton label="Ortografia" tooltip="Função em preparação" disabled />
    </WriterRibbonGroup>
  );
}

