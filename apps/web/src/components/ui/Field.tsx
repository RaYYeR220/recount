import {
  Children,
  cloneElement,
  isValidElement,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";
import { ErrorIcon } from "./icons";

export type LabelProps = {
  htmlFor: string;
  /** Adds a quiet "(optional)" after the label. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

export function Label({ htmlFor, optional, className, children }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={cx("label", className)}>
      {children}
      {optional ? <span className="optional"> (optional)</span> : null}
    </label>
  );
}

export function Hint({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={cx("hint", className)}>
      {children}
    </p>
  );
}

/** Error under a field. Say what to do, not what went wrong. */
export function ErrorText({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={cx("error-text", className)}>
      <ErrorIcon />
      <span>{children}</span>
    </p>
  );
}

type ControlA11y = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

export type FieldProps = {
  /** Id of the control; the label, hint and error are wired to it. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** When set, the control is marked invalid and the message is read with it. */
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  /** One control: <Input />, <Select />, <Textarea /> or any element taking id and aria props. */
  children: ReactElement<ControlA11y>;
};

/**
 * Label above, hint below, error under the hint. Passes `id`, `aria-describedby`
 * and `aria-invalid` to its one child, so a field is accessible without extra wiring.
 */
export function Field({ id, label, hint, error, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = Children.only(children);
  const describedBy = [control.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("field", className)}>
      <Label htmlFor={id} optional={optional}>
        {label}
      </Label>
      {isValidElement(control)
        ? cloneElement(control, {
            id,
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : control.props["aria-invalid"],
          })
        : control}
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Monospaced: codes, receipts, YYYY-MM-DD HH:mm. */
  mono?: boolean;
};

export function Input({ mono, className, type = "text", ...rest }: InputProps) {
  return <input type={type} className={cx("input", mono && "input-mono", className)} {...rest} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** A native <select>: filters, time zones, presets. */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cx("select", className)} {...rest}>
      {children}
    </select>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  return <textarea rows={rows} className={cx("textarea", className)} {...rest} />;
}

export type RadioCardProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  title: ReactNode;
  description?: ReactNode;
};

/** A radio button with a title and a line of explanation, as a card. Group them in a <fieldset>. */
export function RadioCard({ title, description, className, id, ...rest }: RadioCardProps) {
  const descId = description && id ? `${id}-desc` : undefined;
  return (
    <label className={cx("radio-card", className)}>
      <input type="radio" id={id} aria-describedby={descId} {...rest} />
      <span>
        <b>{title}</b>
        {description ? (
          <span id={descId} className="radio-desc">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
