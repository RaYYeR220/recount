import type { Draft } from "./draft";

/** What every step's fields get from the wizard. */
export type FieldsProps = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  /** Field name to message, for the fields that need fixing. */
  errors: Record<string, string | undefined>;
};
