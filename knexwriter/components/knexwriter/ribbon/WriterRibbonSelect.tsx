type WriterRibbonSelectOption = {
  label: string;
  value: string;
};

type WriterRibbonSelectProps = {
  value: string;
  options: WriterRibbonSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function WriterRibbonSelect({ value, options, onChange, disabled = false }: WriterRibbonSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}



