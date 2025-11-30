import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onKeyDown, inputMode, ...props }, ref) => {
    const [isClearedZero, setIsClearedZero] = React.useState(false);
    const isNumber = type === "number";
    const renderedType = isNumber ? "text" : type;
    const resolvedInputMode = inputMode ?? (isNumber ? "decimal" : undefined);

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (event) => {
      onFocus?.(event);
      if (!event.defaultPrevented) {
        event.target.select(); // select existing value so typing replaces it
      }
      if (isNumber && (props.value === 0 || props.value === "0")) {
        setIsClearedZero(false);
      }
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (!isNumber) return;
      const value = event.currentTarget.value;
      if ((event.key === "Backspace" || event.key === "Delete") && (value === "0" || value === "")) {
        event.preventDefault();
        setIsClearedZero(true);
      } else {
        setIsClearedZero(false);
      }
    };

    const displayValue =
      isNumber && isClearedZero ? "" : props.value;

    return (
      <input
        type={renderedType}
        inputMode={resolvedInputMode}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        value={displayValue as any}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
