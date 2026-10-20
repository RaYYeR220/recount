"use client";

import { useEffect, useRef } from "react";

/**
 * The page's ?next= as a hidden field, read from the address once hydrated. The form
 * itself stays in the static shell, so nothing swaps it out while someone is typing;
 * the server action checks the value (safeNext) whatever it says.
 */
export function NextField() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = new URLSearchParams(window.location.search).get("next") ?? "";
  }, []);
  return <input ref={ref} type="hidden" name="next" defaultValue="" />;
}
