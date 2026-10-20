import { notFound } from "next/navigation";

/** Prerendered as a 404 for a signed-in viewer; the proxy rewrites unshared manage pages here. */
export default function ManageNotFoundStatus(): never {
  notFound();
}
