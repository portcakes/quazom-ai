"use client";

import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@quazom-ai/ui/components/ui/combobox";

type Props = {
  value: string;
  onChange: (timezone: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Searchable picker over the runtime's IANA timezone list. We fall back to a
 * small hand-rolled set if the runtime doesn't expose
 * `Intl.supportedValuesOf` (older browsers) so the user can still pick
 * something reasonable.
 */
export function TimezonePicker({
  value,
  onChange,
  disabled,
  placeholder = "Search timezone…",
}: Props) {
  const timezones = useMemo(() => listTimezones(), []);

  return (
    <Combobox
      value={value}
      onValueChange={(next: string | null) => {
        if (typeof next === "string" && next.length > 0) {
          onChange(next);
        }
      }}
      items={timezones}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>No timezone matches that search.</ComboboxEmpty>
        <ComboboxList>
          {timezones.map((tz) => (
            <ComboboxItem key={tz} value={tz}>
              {tz}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Halifax",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

function listTimezones(): string[] {
  type IntlWithSupportedValues = typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const intlWithSupport = Intl as IntlWithSupportedValues;
  if (typeof intlWithSupport.supportedValuesOf === "function") {
    try {
      const zones = intlWithSupport.supportedValuesOf("timeZone");
      if (zones.length > 0) return zones;
    } catch {
      // fall through
    }
  }
  return [...FALLBACK_TIMEZONES];
}
