'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProviderLandingClient({ source = 'direct-provider' }) {
  const router = useRouter();
  const [category, setCategory] = useState('photographer');
  const [zip, setZip] = useState('');

  const destination = useMemo(() => {
    const search = new URLSearchParams();
    search.set('category', category);
    if (zip.trim()) {
      search.set('zip', zip.trim());
    }
    if (source) {
      search.set('src', source);
    }
    return `/providers/join?${search.toString()}`;
  }, [category, source, zip]);

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
