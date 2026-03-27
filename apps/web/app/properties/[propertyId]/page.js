import { PropertyWorkspaceClient } from './PropertyWorkspaceClient';

export default async function PropertyPage({ params }) {
  const resolvedParams = await params;
  const mapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

  return (
    <PropertyWorkspaceClient
      propertyId={resolvedParams.propertyId}
      mapsApiKey={mapsApiKey}
    />
  );
}
