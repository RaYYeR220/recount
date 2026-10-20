import type { ReactNode } from "react";

export type StatusPageProps = {
  title: ReactNode;
  description: ReactNode;
  /** Buttons, usually one brass and one line. */
  actions?: ReactNode;
  /** A quiet line under the buttons. */
  footnote?: ReactNode;
};

/** An empty felt tray with one chit turned face down: nothing to count here. */
function EmptyTray() {
  return (
    <div className="nf-tray" aria-hidden="true">
      <span className="nf-ghost" />
      <span className="nf-ghost" />
      <span className="nf-ghost" />
      <span className="nf-facedown" />
    </div>
  );
}

/** Full-page message for not found, not shared and errors. */
export function StatusPage({ title, description, actions, footnote }: StatusPageProps) {
  return (
    <div className="wrap nf">
      <EmptyTray />
      <h1 className="display">{title}</h1>
      <p className="nf-desc">{description}</p>
      {actions ? <div className="nf-actions">{actions}</div> : null}
      {footnote ? <p className="nf-foot">{footnote}</p> : null}
    </div>
  );
}
