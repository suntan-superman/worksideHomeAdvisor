import { BRANDING } from '@workside/branding';

const cards = [
  { title: 'Prompt versions', value: '12', note: 'Pricing, improvements, marketing, documents, chat' },
  { title: 'Flagged outputs', value: '3', note: 'Low-confidence or manual review items waiting' },
  { title: 'Active pilot properties', value: '27', note: 'Current seller workspaces across demo + pilot' },
  { title: 'Pricing jobs today', value: '54', note: 'Including retries and cached analyses' },
  { title: 'Document drafts today', value: '16', note: 'All generated with disclaimer injection' },
  { title: 'Notification failures', value: '0', note: 'Email and push pipelines healthy in preview' },
];

export default function AdminHomePage() {
  return (
    <main className="admin-shell">
      <span className="pill">Internal console</span>
      <h1>{BRANDING.companyName} Admin</h1>
      <p className="muted">
        Prompt governance, auditability, feature flags, and support tooling for
        the home seller platform.
      </p>

      <section className="admin-grid">
        {cards.map((card) => (
          <article key={card.title} className="admin-card">
            <div className="muted">{card.title}</div>
            <div className="metric">{card.value}</div>
            <p className="muted">{card.note}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
