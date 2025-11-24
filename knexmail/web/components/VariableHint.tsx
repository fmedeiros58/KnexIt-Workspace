"use client";

type Props = {
  variables: string[];
};

export default function VariableHint({ variables }: Props) {
  if (!variables.length) return null;
  return (
    <div className="text-xs text-slate-600">
      Placeholders disponíveis:{" "}
      <span className="font-semibold">{variables.join(", ")}</span>
    </div>
  );
}

