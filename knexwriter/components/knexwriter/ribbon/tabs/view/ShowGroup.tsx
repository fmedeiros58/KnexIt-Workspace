"use client";

import type { ComponentType, Dispatch, SetStateAction } from "react";
import { Grid2X2, PanelLeft, Ruler } from "lucide-react";
import { WriterRibbonGroup } from "../../WriterRibbonGroup";
import type { WriterRibbonProps } from "../../../shell/KnexWriterShell";

export type ShowGroupProps = Partial<Pick<WriterRibbonProps, "state" | "actions">>;

type OptionalShowActions = {
  setRulerSettings?: Dispatch<
    SetStateAction<WriterRibbonProps["state"]["rulerSettings"]>
  >;
  setIsWritingGridVisible?: Dispatch<SetStateAction<boolean>>;
};

type OptionalShowState = {
  isWritingGridVisible?: boolean;
};

type ShowCheckboxRowProps = {
  label: string;
  checked: boolean;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  title?: string;
  onChange?: () => void;
};

function ShowCheckboxRow({
  label,
  checked,
  icon: Icon,
  disabled = false,
  title,
  onChange,
}: ShowCheckboxRowProps) {
  return (
    <label
      title={title}
      className={[
        "flex h-6 cursor-pointer select-none items-center gap-2 rounded-sm px-1.5 text-[12px] leading-none text-zinc-800",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-zinc-100 active:bg-zinc-200",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-zinc-900"
      />

      <Icon className="h-3.5 w-3.5 text-zinc-600" />

      <span className="truncate">{label}</span>
    </label>
  );
}

export function ShowGroup({ state, actions }: ShowGroupProps) {
  const optionalActions = actions as
    | (typeof actions & OptionalShowActions)
    | undefined;

  const optionalState = state as
    | (typeof state & OptionalShowState)
    | undefined;

  const isRulerVisible = Boolean(state?.rulerSettings?.showRuler);
  const isGridVisible = Boolean(optionalState?.isWritingGridVisible);
  const isNavigationPanelVisible = Boolean(
    state && !state.isWritingNavCollapsed,
  );

  const canToggleRuler =
    Boolean(state) && typeof optionalActions?.setRulerSettings === "function";

  const canToggleGrid =
    typeof optionalActions?.setIsWritingGridVisible === "function";

  const canToggleNavigationPanel =
    Boolean(state) &&
    Boolean(actions) &&
    typeof actions?.setIsWritingNavCollapsed === "function";

  const handleToggleRuler = () => {
    optionalActions?.setRulerSettings?.((current) => ({
      ...current,
      showRuler: !current.showRuler,
    }));
  };

  const handleToggleGrid = () => {
    optionalActions?.setIsWritingGridVisible?.((current) => !current);
  };

  const handleToggleNavigationPanel = () => {
    actions?.setIsWritingNavCollapsed((current) => !current);
  };

  return (
    <WriterRibbonGroup title="Mostrar">
      <div
        data-knexwriter-view-show-group="true"
        className="flex min-w-[158px] flex-col justify-center gap-1 px-1 py-1"
      >
        <ShowCheckboxRow
          label="Régua"
          icon={Ruler}
          checked={isRulerVisible}
          disabled={!canToggleRuler}
          title={
            canToggleRuler
              ? "Mostrar ou ocultar régua"
              : "A régua está preparada, mas a action setRulerSettings ainda precisa ser exposta"
          }
          onChange={canToggleRuler ? handleToggleRuler : undefined}
        />

        <ShowCheckboxRow
          label="Linhas de Grade"
          icon={Grid2X2}
          checked={isGridVisible}
          disabled={!canToggleGrid}
          title={
            canToggleGrid
              ? "Mostrar ou ocultar linhas de grade"
              : "Função preparada. Exponha setIsWritingGridVisible para ativar"
          }
          onChange={canToggleGrid ? handleToggleGrid : undefined}
        />

        <ShowCheckboxRow
          label="Painel de Navegação"
          icon={PanelLeft}
          checked={isNavigationPanelVisible}
          disabled={!canToggleNavigationPanel}
          title="Mostrar ou ocultar o painel de navegação textual"
          onChange={
            canToggleNavigationPanel ? handleToggleNavigationPanel : undefined
          }
        />
      </div>
    </WriterRibbonGroup>
  );
}

export default ShowGroup;