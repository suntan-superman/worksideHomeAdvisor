'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildLandingSearchParams } from '@workside/utils';

export function ProviderLandingClient({
  source = 'direct-provider',
  campaign = '',
  medium = '',
  adset = '',
  ad = '',
  anonymousId = '',
}) {
  const router = useRouter();
  const [category, setCategory] = useState('photographer');
  const [zip, setZip] = useState('');

  const destination = useMemo(() => {
    const search = buildLandingSearchParams(
      {
        source,
        campaign,
        medium,
        adset,
        ad,
        anonymousId,
        roleIntent: 'provider',
      },
      {
        category,
        zip: zip.trim(),
      },
    );
    return `/providers/join?${search.toString()}`;
  }, [ad, adset, anonymousId, campaign, category, medium, source, zip]);

  return (
    <form
      className="landing-provider-capture"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(destination);
      }}
    >
      <label>
        Service category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="photographer">Photographers</option>
          <option value="cleaning_service">Cleaning services</option>
          <option value="inspector">Home inspectors</option>
          <option value="real_estate_attorney">Real estate attorneys</option>
          <option value="title_company">Title companies</option>
        </select>
      </label>
      <label>
        Primary ZIP
        <input
          type="text"
          value={zip}
          onChange={(event) => setZip(event.target.value)}
          placeholder="93312"
          autoComplete="postal-code"
        />
      </label>
      <button type="submit" className="button-primary">
        Join provider network
      </button>
    </form>
  );
}
