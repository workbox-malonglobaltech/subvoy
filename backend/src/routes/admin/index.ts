/**
 * Admin router — aggregates all /admin/* sub-routers.
 * Mounted at /admin in src/index.ts.
 */

import { Router } from 'express';
import usersRouter        from './users';
import statsRouter        from './stats';
import errorsRouter       from './errors';
import notificationsRouter from './notifications';
import announcementsRouter from './announcements';
import auditRouter        from './audit';
import limitsRouter       from './limits';
import countrySettingsRouter from './country-settings';

const router = Router();

router.use('/users',         usersRouter);
router.use('/stats',         statsRouter);
router.use('/errors',        errorsRouter);
router.use('/notifications', notificationsRouter);
router.use('/announcements', announcementsRouter);
router.use('/audit',         auditRouter);
router.use('/limits',        limitsRouter);
router.use('/country-settings', countrySettingsRouter);

export default router;
