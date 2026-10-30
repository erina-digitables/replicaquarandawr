"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  icon?: ReactNode;
  error?: string;
  hint?: string;
  variant?: "plain" | "password" | "code";
};

export function TextField({ label, icon, error, hint, variant = "plain", className, id, type, ...rest }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const msgId = `${inputId}-msg`;
  const [shown, setShown] = useState(false);
  const inputType = variant === "password" ? (shown ? "text" : "password") : type ?? "text";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="eyebrow">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-text-muted [&_svg]:size-4">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={cn(
            "h-11 w-full rounded-md border bg-surface-2 px-3 text-base text-text placeholder:text-text-muted/70",
            "transition-colors duration-(--t-duration-fast) focus-visible:bg-surface",
            error ? "border-danger" : "border-border-input",
            !!icon && "pl-9",
            variant === "password" && "pr-12",
            variant === "code" && "font-mono uppercase tracking-[0.2em]",
            "disabled:opacity-50",
          )}
          {...rest}
        />
        {variant === "password" && (
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-md text-text-muted hover:text-text [&_svg]:size-4"
          >
            {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={msgId} className={cn("text-xs", error ? "text-danger" : "text-text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
