import { Input } from "@/components/ui/input";

export function FormField({
  id,
  label,
  optional,
  optionalLabel = "(optional)",
  type = "text",
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  label: string;
  optional?: boolean;
  /** Text shown after the label when `optional` is set, e.g. a translated "(optional)". */
  optionalLabel?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Neutral helper text shown below the input when there's no error. */
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional && (
          <span className="text-muted-foreground font-normal">
            {" "}
            {optionalLabel}
          </span>
        )}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
      />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        hint && <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}
