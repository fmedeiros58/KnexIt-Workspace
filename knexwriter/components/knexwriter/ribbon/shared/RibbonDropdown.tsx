type RibbonDropdownOption = { value: string; label: string };

type RibbonDropdownProps = {
  value: string;
  options: RibbonDropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function RibbonDropdown({ value, options, onChange, disabled = false }: RibbonDropdownProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-8 min-w-[120px] rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}


