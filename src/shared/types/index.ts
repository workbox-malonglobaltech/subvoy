// Shared types for frontend and backend

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

export type UserRole = 'user' | 'staff' | 'superadmin';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  hasPassword: boolean;
  role: UserRole;
  suspendedAt: string | null;
}

// ── Admin types ───────────────────────────────────────────────────────────────

export type ErrorLogLevel = 'warn' | 'error' | 'fatal';

export interface ErrorLog {
  id: string;
  level: ErrorLogLevel;
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  userId: string | null;
  context: Record<string, unknown> | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export type AdminNotificationSeverity = 'info' | 'warning' | 'critical';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: AdminNotificationSeverity;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  readBy: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  createdBy: string;
  title: string;
  body: string;
  channel: 'in-app' | 'email' | 'both';
  target: 'all' | 'active';
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  newUsersLast7Days: number;
  errorsLast24h: number;
  unresolvedErrors: number;
  unreadAdminNotifications: number;
}

export interface AdminUserDetail extends User {
  subscriptionCount: number;
  walletNgnBalance: number;
  walletUsdBalance: number;
}

export type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export type SupportedCurrency = 'USD' | 'NGN' | 'GBP' | 'EUR' | 'CAD';

export interface FxRates {
  /** ISO timestamp of when rates were last fetched from the external API */
  fetchedAt: string;
  /** Rates keyed as "USD_NGN", "USD_GBP", etc. — all relative to USD base */
  rates: Record<string, number>;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category: string | null;
  logoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  name: string;
  amount: number;
  currency?: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category?: string;
  logoUrl?: string;
  notes?: string;
}

export interface UpdateSubscriptionInput {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  nextBillingDate?: string;
  category?: string;
  logoUrl?: string;
  notes?: string;
  isActive?: boolean;
}

export type NotificationType = 'payment_reminder' | 'price_change' | 'budget_alert';

export interface AppNotification {
  id: string;
  userId: string;
  subscriptionId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ── Wallet types ──────────────────────────────────────────────────────────────

export interface Wallet {
  id: string;
  userId: string;
  /** NGN balance in whole naira (already divided by 100) */
  ngnBalance: number;
  /** USD balance in whole dollars (already divided by 100) */
  usdBalance: number;
  updatedAt: string;
}

export type WalletTransactionType = 'deposit' | 'payment' | 'conversion' | 'auto_topup';
export type WalletDirection = 'in' | 'out';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTransactionType;
  currency: string;
  /** Amount in whole units (naira or dollars) */
  amount: number;
  direction: WalletDirection;
  description: string;
  /** Wallet balance after this transaction (whole units) */
  balanceAfter: number;
  createdAt: string;
}

export interface WalletTopUpInput {
  /** Amount in whole naira to add */
  amountNgn: number;
  /** Destination: 'ngn' adds to NGN balance, 'usd' converts and adds to dollar card */
  destination: 'ngn' | 'usd';
  /** Mock funding source label */
  fundingSource: string;
}

export interface WalletSettings {
  autoTopupEnabled: boolean;
  /** Threshold in whole dollars — top up when USD balance drops below this */
  thresholdUsd: number;
  /** Amount in whole naira to pull per auto top-up */
  topupNgn: number;
  /** Day of month (1–28) for scheduled top-up, or null */
  scheduledDay: number | null;
}

export interface SubscriptionSummary {
  monthlySpend: number;
  yearlySpend: number;
  activeCount: number;
  due7Days: number;
  due30Days: number;
  byCategory: { category: string; total: number }[];
}
