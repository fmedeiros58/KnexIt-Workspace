import type { RibbonCommandDefinition } from "./ribbonSharedTypes";
import { RibbonCommandButton } from "./RibbonCommandButton";

type RibbonIconButtonProps = {
  command: RibbonCommandDefinition;
};

export function RibbonIconButton({ command }: RibbonIconButtonProps) {
  return <RibbonCommandButton command={command} label={command.label} />;
}


