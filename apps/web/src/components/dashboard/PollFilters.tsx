"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { Input, Select } from "@/components/ui";

export type StatusFilter = "" | "open" | "scheduled" | "closed";

const SEARCH_DELAY_MS = 350;

function href(q: string, status: StatusFilter): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

/**
 * Search and status filter. Both live in the URL: a plain GET form without
 * JavaScript, and with it the list follows the typing after a short pause.
 */
export function PollFilters({ q, status }: { q: string; status: StatusFilter }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hydrated = useRef(false);

  // The fields are uncontrolled (typing before hydration must survive); when the URL
  // changes some other way, such as "Clear filters" or Back, bring them in line.
  useEffect(() => {
    const search = form.current?.elements.namedItem("q");
    const select = form.current?.elements.namedItem("status");
    if (!(search instanceof HTMLInputElement) || !(select instanceof HTMLSelectElement)) return;
    if (!hydrated.current) {
      hydrated.current = true;
      // A search or status chosen before the script ran still counts: follow it.
      if (search.value !== q || select.value !== status) {
        startTransition(() => router.replace(href(search.value, select.value as StatusFilter), { scroll: false }));
        return;
      }
    }
    if (document.activeElement !== search) search.value = q;
    select.value = status;
  }, [q, status, router]);

  function go(nextText: string, nextStatus: StatusFilter) {
    window.clearTimeout(timer.current);
    startTransition(() => router.replace(href(nextText, nextStatus), { scroll: false }));
  }

  return (
    <Form ref={form} action="/dashboard" role="search" aria-label="Filter polls" className="flex flex-[1_1_480px] flex-wrap items-center gap-3.5" onSubmit={() => window.clearTimeout(timer.current)}>
      <label className="relative min-w-0 flex-[1_1_280px] sm:max-w-[420px]">
        <span className="sr-only">Search polls by title</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3">
          <circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search polls by title"
          autoComplete="off"
          enterKeyHint="search"
          className="pl-10"
          onChange={(event) => {
            const value = event.target.value;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => go(value, status), SEARCH_DELAY_MS);
          }}
        />
      </label>
      <label className="min-w-[180px] max-[900px]:flex-1 sm:flex-none">
        <span className="sr-only">Status</span>
        <Select
          name="status"
          defaultValue={status}
          onChange={(event) => {
            const search = event.target.form?.elements.namedItem("q");
            go(search instanceof HTMLInputElement ? search.value : q, event.target.value as StatusFilter);
          }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="scheduled">Scheduled</option>
          <option value="closed">Closed</option>
        </Select>
      </label>
      {pending ? <span className="text-sm text-ink-3">Updating…</span> : null}
    </Form>
  );
}
