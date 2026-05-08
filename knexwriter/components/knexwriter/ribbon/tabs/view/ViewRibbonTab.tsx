"use client";

import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";
import { RibbonTabLayout } from "../../shared/RibbonTabLayout";
import { ShowGroup } from "./ShowGroup";
import { ViewControlsGroup } from "./ViewControlsGroup";
import { ViewsGroup } from "./ViewsGroup";
import { WindowGroup } from "./WindowGroup";
import { ZoomGroup } from "./ZoomGroup";

export function ViewRibbonTab({ state, actions }: WriterRibbonProps) {
  return (
    <RibbonTabLayout>
      <ViewsGroup />
      <ViewControlsGroup />
      <ShowGroup state={state} actions={actions} />
      <ZoomGroup />
      <WindowGroup />
    </RibbonTabLayout>
  );
}

export default ViewRibbonTab;
