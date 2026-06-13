/** Curated country list for the registration selector (ISO 3166-1 alpha-2 + name).
 *  Not exhaustive — covers the markets we serve first; admins enable more via
 *  country settings. The geo-IP default pre-selects when the code is present. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AE', name: 'United Arab Emirates' },
];
