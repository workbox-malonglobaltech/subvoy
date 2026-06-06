import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { Plan } from '../../../src/shared/types';

export function usePlans(audience?: 'personal' | 'business') {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = audience ? `/plans?audience=${audience}` : '/plans';
    api.get<Plan[]>(path)
      .then(setPlans)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, [audience]);

  return { plans, loading, error };
}
