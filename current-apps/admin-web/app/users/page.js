import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { StatusBadge } from '../_components/StatusBadge';
import { getAdminUsers } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const payload = await getAdminUsers();
  const users = payload.users || [];

  return (
    <AdminSection
      eyebrow="Accounts"
      title="Users"
      description="Review active accounts, billing posture, and who owns seller workspaces."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}
      <DataTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'propertyCount', label: 'Properties' },
          { key: 'activePlanKey', label: 'Plan' },
          {
            key: 'emailVerifiedAt',
            label: 'Verified',
            render: (value) =>
              value ? <StatusBadge tone="success">Verified</StatusBadge> : <StatusBadge tone="warn">Pending</StatusBadge>,
          },
          {
            key: 'lastLoginAt',
            label: 'Last Login',
            render: (value) => formatDateTime(value),
          },
        ]}
        rows={users}
        emptyMessage="No user records are available yet."
      />
    </AdminSection>
  );
}
