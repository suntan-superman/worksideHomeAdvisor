import { PropertyWorkspaceClient } from './PropertyWorkspaceClient';

export default async function PropertyPage({ params }) {
  const resolvedParams = await params;

  return <PropertyWorkspaceClient propertyId={resolvedParams.propertyId} />;
}
