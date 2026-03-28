import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { getAdminProperties } from '../../lib/admin-api';
import { formatCurrency, formatDateTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminPropertiesPage() {
  const payload = await getAdminProperties();
  const properties = payload.properties || [];

  return (
    <AdminSection
      eyebrow="Inventory"
      title="Properties"
      description="Inspect workspace coverage, owner assignment, and the latest pricing snapshot per property."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}
      <DataTable
        columns={[
          { key: 'title', label: 'Property' },
          { key: 'ownerEmail', label: 'Owner' },
          { key: 'mediaCount', label: 'Photos' },
          { key: 'flyerCount', label: 'Flyers' },
          {
            key: 'latestPricingMid',
            label: 'Pricing Mid',
            render: (value) => formatCurrency(value),
          },
          {
            key: 'updatedAt',
            label: 'Updated',
            render: (value) => formatDateTime(value),
          },
        ]}
        rows={properties}
        emptyMessage="No property records are available yet."
      />
    </AdminSection>
  );
}
