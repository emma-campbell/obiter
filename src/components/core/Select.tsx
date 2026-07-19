import { Check, ChevronDown } from "lucide-react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Icon } from "./Icon";
import "./Select.css";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  "aria-label": string;
  disabled?: boolean;
}

/**
 * Obiter Select — a branded dropdown over Base UI's Select (ADR 0001). Replaces
 * a native <select>; Base UI brings the keyboard navigation, typeahead, focus
 * management, and a real popup menu. The trigger shows the selected label via
 * the value→label `items` map; the look lives in Select.css keyed off Base UI's
 * [data-highlighted] / [data-selected] state.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  disabled = false,
  "aria-label": label,
}: SelectProps<T>) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <BaseSelect.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next != null) onValueChange(next as T);
      }}
      disabled={disabled}
    >
      <BaseSelect.Trigger className="select" aria-label={label}>
        <BaseSelect.Value className="select__value" />
        <BaseSelect.Icon className="select__icon">
          <Icon icon={ChevronDown} size={14} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="select__positioner" sideOffset={4}>
          <BaseSelect.Popup className="select__popup">
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  label={o.label}
                  className="select__item"
                >
                  <BaseSelect.ItemText className="select__item-text">{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="select__item-indicator">
                    <Icon icon={Check} size={14} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
