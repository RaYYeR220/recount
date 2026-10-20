import type { CountScene } from "@/lib/countScene";

/** The table's figures as a data table, for screen readers (the canvas is decorative). */
export function RoundsTable({ scene, title }: { scene: CountScene; title: string }) {
  return (
    <table className="sr-only">
      <caption>{title}: votes in each tray, round by round</caption>
      <thead>
        <tr>
          <th scope="col">Tray</th>
          {scene.rounds.map((r) => (
            <th key={r.index} scope="col">
              Round {r.number}: {r.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scene.trays.map((tray) => (
          <tr key={tray.id}>
            <th scope="row">{tray.label}</th>
            {scene.rounds.map((r) => {
              const t = r.trays[tray.id]!;
              return <td key={r.index}>{t.state === "out" ? "Eliminated" : t.state === "elected" ? `${t.tally}, elected` : t.tally}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
