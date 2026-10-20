"use client";

import type { ClipboardEvent } from "react";
import { Button, Chit, ErrorText, Field, Hint, Input, Textarea } from "@/components/ui";
import { MAX_OPTION_LENGTH, MAX_OPTIONS, splitPasted, type Draft } from "./draft";
import type { FieldsProps } from "./fields";

/** Title, description and the options, one input each. Pasting a list adds a row per line. */
export function OptionsFields({ draft, update, errors }: FieldsProps) {
  const options = draft.options;
  const nextKey = () => Math.max(0, ...options.map((o) => o.key)) + 1;

  function setLabel(index: number, label: string) {
    update({ options: options.map((o, i) => (i === index ? { ...o, label } : o)) });
  }

  function add() {
    if (options.length >= MAX_OPTIONS) return;
    update({ options: [...options, { key: nextKey(), label: "" }] });
    // Focus the new row once it exists.
    requestAnimationFrame(() => document.getElementById(`option-${options.length}`)?.focus());
  }

  function remove(index: number) {
    update({ options: options.filter((_, i) => i !== index) });
    requestAnimationFrame(() => document.getElementById(`option-${Math.max(0, index - 1)}`)?.focus());
  }

  function paste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const lines = splitPasted(event.clipboardData.getData("text"));
    if (lines.length < 2) return;
    event.preventDefault();
    let key = nextKey();
    const added: Draft["options"] = lines.slice(1).map((label) => ({ key: key++, label }));
    const merged = [...options.slice(0, index), { ...options[index]!, label: lines[0]! }, ...added, ...options.slice(index + 1)];
    // Blank rows after the paste point make room before the list grows.
    const trimmed = merged.filter((o, i) => i <= index + added.length || o.label.trim() !== "" || merged.length <= MAX_OPTIONS);
    update({ options: trimmed.slice(0, MAX_OPTIONS) });
  }

  return (
    <>
      <Field id="title" label="Title" hint="The question voters see first." error={errors.title}>
        <Input value={draft.title} onChange={(e) => update({ title: e.target.value })} placeholder="Where should the spring offsite go?" maxLength={200} autoComplete="off" />
      </Field>
      <Field id="description" label="Description" optional hint="A line or two of context. Shown above the ballot." error={errors.description}>
        <Textarea value={draft.description} onChange={(e) => update({ description: e.target.value })} rows={2} />
      </Field>
      <fieldset aria-describedby={errors.options ? "options-hint options-error" : "options-hint"} className="m-0 grid gap-2 border-0 p-0">
        <legend className="label mb-1.5 p-0">Options</legend>
        <ol className="m-0 grid list-none gap-2 p-0">
          {options.map((option, i) => (
            <li key={option.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5">
              <Chit index={i} size="sm" />
              <Input
                id={`option-${i}`}
                aria-label={`Option ${i + 1}`}
                value={option.label}
                onChange={(e) => setLabel(i, e.target.value)}
                onPaste={(e) => paste(i, e)}
                maxLength={MAX_OPTION_LENGTH + 20}
                autoComplete="off"
                aria-invalid={errors.options && option.label.trim().length > MAX_OPTION_LENGTH ? true : undefined}
              />
              <Button variant="quiet" size="sm" onClick={() => remove(i)} disabled={options.length <= 2} className="text-ink-2">
                Remove<span className="sr-only"> option {i + 1}</span>
              </Button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="line" size="sm" onClick={add} disabled={options.length >= MAX_OPTIONS}>
            Add option
          </Button>
          <Hint id="options-hint">Between 2 and {MAX_OPTIONS}. Paste a list to add one option per line.</Hint>
        </div>
        {errors.options ? <ErrorText id="options-error">{errors.options}</ErrorText> : null}
      </fieldset>
    </>
  );
}
