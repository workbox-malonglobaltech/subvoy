import { Router, Request, Response } from 'express';
import * as countries from '../services/country-settings.service';

const router = Router();

function clientIp(req: Request): string {
  const xff = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim();
  return xff || req.ip || '';
}

// GET /geo/country — best-effort country from the request IP (PUBLIC; used to
// pre-fill the registration country selector — the user can always change it).
router.get('/country', async (req: Request, res: Response) => {
  // 1) CDN-provided country header wins (accurate, free) if we're ever behind one.
  const hdr = ((req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '') as string).toUpperCase();
  let country = /^[A-Z]{2}$/.test(hdr) && hdr !== 'XX' ? hdr : '';

  // 2) Fall back to a lightweight geo-IP lookup (short timeout; failure is fine).
  if (!country) {
    try {
      const ip = clientIp(req);
      if (ip && !/^(127\.|10\.|192\.168\.|::1|fc00:|fe80:)/.test(ip)) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, { signal: ctrl.signal });
        clearTimeout(timer);
        const txt = (await r.text()).trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(txt)) country = txt;
      }
    } catch { /* ignore — the client falls back to a neutral default */ }
  }

  const currency = country ? await countries.getCountryCurrency(country) : 'USD';
  res.status(200).json({ success: true, data: { country: country || null, currency }, error: null });
});

export default router;
