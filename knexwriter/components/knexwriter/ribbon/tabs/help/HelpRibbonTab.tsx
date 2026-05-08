import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { HelpSearchGroup } from "./HelpSearchGroup";
import { DocumentationGroup } from "./DocumentationGroup";
import { ShortcutsGroup } from "./ShortcutsGroup";
import { AboutGroup } from "./AboutGroup";

export function HelpRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <HelpSearchGroup />
      <DocumentationGroup />
      <ShortcutsGroup />
      <AboutGroup />
    </RibbonTabLayout>
  );
}
