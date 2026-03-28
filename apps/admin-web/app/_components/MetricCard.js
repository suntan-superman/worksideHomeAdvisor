export function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <div className="muted small-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note ? <p className="muted">{note}</p> : null}
    </article>
  );
}
