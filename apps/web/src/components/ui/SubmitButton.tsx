"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./Button";

export type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  /** Label while the form is submitting, e.g. "Casting…". Defaults to the normal label. */
  pendingLabel?: string;
};

/**
 * A submit button that disables itself while its form is pending, so a double
 * click sends the form once.
 */
export function SubmitButton({ pendingLabel, disabled, children, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
