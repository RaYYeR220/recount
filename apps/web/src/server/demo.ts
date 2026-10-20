/** Demo accounts whose passwords are published in the README for judges. */
export const DEMO_PERSONAS = [
  { key: "ada", email: "ada@recount.dev", name: "Ada Lovelace", password: "recount-demo-ada" },
  { key: "rival", email: "rival@recount.dev", name: "Riley Rival", password: "recount-demo-rival" },
] as const;

export const DEMO_PERSONA_EMAILS: readonly string[] = DEMO_PERSONAS.map((p) => p.email);
