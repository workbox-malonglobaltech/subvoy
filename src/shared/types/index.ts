// Shared types for frontend and backend

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | null;
}

export type UserRole = 'user' | 'staff' | 'superadmin';

// ── Workspaces (multi-tenancy) ──────────────────────────────────────────────────

export type WorkspaceType = 'personal' | 'business';
export type WorkspaceRole = 'owner' | 'admin' | 'member';

/** Obligation kinds a workspace type may contain. */
export type ObligationKind = 'payment' | 'compliance';

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  /** Current user's role in this workspace (when returned in a membership list) */
  role?: WorkspaceRole;
  /** ISO 3166-1 alpha-2 operating country (business), or null */
  country: string | null;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

/** A workspace member joined with the user's identity, for team management UIs. */
export interface WorkspaceMemberDetail {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  createdAt: string;
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked';

/** A pending workspace invitation (admin view). */
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
}

/** Public view of an invite, returned to the accept page by token. */
export interface InviteInfo {
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  /** pending + not expired */
  valid: boolean;
}

// ── Compliance obligations (Business workspaces) ────────────────────────────────

export type ComplianceCadence = 'one_off' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type ComplianceStatus = 'open' | 'submitted' | 'completed';

export interface ComplianceItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  authority: string | null;
  referenceNumber: string | null;
  jurisdiction: string | null;
  cadence: ComplianceCadence;
  dueDate: string;
  reminderOffsets: number[];
  status: ComplianceStatus;
  penaltyNote: string | null;
  /** Monetary penalty for late filing + its currency (independent of subscriptions). */
  penaltyAmount: number | null;
  penaltyCurrency: string | null;
  /** Optional attached document (Supabase Storage path + original filename). */
  documentPath: string | null;
  documentName: string | null;
  isActive: boolean;
  /** Workspace member responsible for this obligation; reminders target them */
  assigneeUserId: string | null;
  /** Derived: due_date < today AND status !== 'completed' */
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplianceItemInput {
  title: string;
  description?: string;
  authority?: string;
  referenceNumber?: string;
  jurisdiction?: string;
  cadence: ComplianceCadence;
  dueDate: string;
  reminderOffsets?: number[];
  penaltyNote?: string;
  penaltyAmount?: number | null;
  penaltyCurrency?: string;
  documentPath?: string | null;
  documentName?: string | null;
  assigneeUserId?: string | null;
}

export interface UpdateComplianceItemInput {
  title?: string;
  description?: string;
  authority?: string;
  referenceNumber?: string;
  jurisdiction?: string;
  cadence?: ComplianceCadence;
  dueDate?: string;
  reminderOffsets?: number[];
  status?: ComplianceStatus;
  penaltyNote?: string;
  penaltyAmount?: number | null;
  penaltyCurrency?: string;
  documentPath?: string | null;
  documentName?: string | null;
  isActive?: boolean;
  assigneeUserId?: string | null;
}

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

/** A per-plan entitlement limit. limitValue === -1 means unlimited. */
export interface PlanLimit {
  plan: string;
  limitKey: string;
  limitValue: number;
}

/** A purchasable plan in the catalog. priceMinor in minor units; 0 = free. */
export interface Plan {
  key: string;
  displayName: string;
  audience: 'personal' | 'business';
  priceMinor: number;
  currency: string;
  interval: 'month' | 'year' | null;
  features: string[];
  sortOrder: number;
}

/** Current usage vs. the effective limit for one limit key. limit === -1 = unlimited. */
export interface BillingUsageItem {
  key: string;
  used: number;
  limit: number;
}

/** A recorded successful plan payment (one row per activation). */
export interface BillingHistoryEntry {
  id: string;
  plan: string;
  provider: string | null;
  amountMinor: number;
  currency: string;
  periodEnd: string | null;
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
  /** Owning workspace (tenant) this subscription belongs to */
  workspaceId: string;
  /** Obligation kind — 'payment' for subscriptions */
  kind: ObligationKind;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  category: string | null;
  /** What the subscription provides, e.g. "Hosting" */
  service: string | null;
  /** The service's web address, e.g. "namecheap.com" */
  website: string | null;
  logoUrl: string | null;
  notes: string | null;
  isActive: boolean;
  /** When true, the autopay job charges this subscription from the wallet on its billing date */
  autopay: boolean;
  /** Skip auto-charge if the amount exceeds this cap (whole currency units); null = no cap */
  autopayMaxAmount: number | null;
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
  service?: string;
  website?: string;
  logoUrl?: string;
  notes?: string;
  autopay?: boolean;
  autopayMaxAmount?: number | null;
}

export interface UpdateSubscriptionInput {
  name?: string;
  amount?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  nextBillingDate?: string;
  category?: string;
  service?: string;
  website?: string;
  logoUrl?: string;
  notes?: string;
  isActive?: boolean;
  autopay?: boolean;
  autopayMaxAmount?: number | null;
}

export type NotificationType = 'payment_reminder' | 'price_change' | 'budget_alert' | 'compliance_reminder';

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
  /** UI default for the autopay toggle when creating a new subscription */
  autopayDefault: boolean;
}

export interface SubscriptionSummary {
  monthlySpend: number;
  yearlySpend: number;
  activeCount: number;
  due7Days: number;
  due30Days: number;
  /** Per-currency category breakdown (no cross-currency summing). */
  byCategory: { category: string; currency: string; total: number }[];
}
