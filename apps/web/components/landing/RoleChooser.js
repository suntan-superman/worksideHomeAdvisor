import Link from 'next/link';

export function RoleChooser({ roles = [] }) {
  return (
    <section className="landing-role-grid">
      {roles.map((role) => (
        <article key={role.href} className="landing-role-card">
          <span className="label">{role.eyebrow}</span>
          <h2>{role.title}</h2>
          <p>{role.body}</p>
          <ul className="landing-bullet-list">
            {role.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="landing-role-actions">
            <Link href={role.href} className="button-primary">
              {role.cta}
            </Link>
            {role.secondaryHref ? (
              <Link href={role.secondaryHref} className="button-secondary">
                {role.secondaryCta}
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
