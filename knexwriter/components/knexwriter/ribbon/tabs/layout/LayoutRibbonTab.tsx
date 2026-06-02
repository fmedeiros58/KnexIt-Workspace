import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { ArrangeGroup } from "./ArrangeGroup";
import { HeaderFooterLayoutGroup } from "./HeaderFooterLayoutGroup";
import PageSetupGroup from "./PageSetupGroup";
import { ParagraphLayoutGroup } from "./ParagraphLayoutGroup";
import { RulerSettingsGroup } from "./RulerSettingsGroup";

export function LayoutRibbonTab(_props: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <PageSetupGroup />
      <ParagraphLayoutGroup />
      <RulerSettingsGroup />
      <HeaderFooterLayoutGroup />
      <ArrangeGroup />
    </RibbonTabLayout>
  );
}

export default LayoutRibbonTab;