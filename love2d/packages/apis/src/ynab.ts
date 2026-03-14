/**
 * YNAB (You Need A Budget) API hooks.
 * Auth: Bearer token. https://app.ynab.com/settings/developer
 */

import { useAPI, bearer, qs, type APIResult } from './base';

const BASE = 'https://api.ynab.com/v1';

// ── Types ───────────────────────────────────────────────

export interface YNABBudget {
  id: string;
  name: string;
  last_modified_on: string;
  first_month: string;
  last_month: string;
  currency_format: { iso_code: string; decimal_digits: number; decimal_separator: string };
}

export interface YNABAccount {
  id: string;
  name: string;
  type: string;
  on_budget: boolean;
  closed: boolean;
  balance: number;
  cleared_balance: number;
  uncleared_balance: number;
  transfer_payee_id: string;
}

export interface YNABCategory {
  id: string;
  name: string;
  category_group_id: string;
  budgeted: number;
  activity: number;
  balance: number;
  goal_type: string | null;
  goal_percentage_complete: number | null;
}

export interface YNABCategoryGroup {
  id: string;
  name: string;
  hidden: boolean;
  categories: YNABCategory[];
}

export interface YNABTransaction {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  cleared: 'cleared' | 'uncleared' | 'reconciled';
  approved: boolean;
  payee_name: string | null;
  category_name: string | null;
  account_name: string;
  subtransactions: Array<{ amount: number; memo: string | null; category_name: string | null }>;
}

export interface YNABMonth {
  month: string;
  income: number;
  budgeted: number;
  activity: number;
  to_be_budgeted: number;
  age_of_money: number | null;
}

// ── Hooks ───────────────────────────────────────────────

export function useYNABBudgets(
  token: string | null,
): APIResult<{ data: { budgets: YNABBudget[] } }> {
  return useAPI(
    token ? `${BASE}/budgets` : null,
    { headers: bearer(token!) },
  );
}

export function useYNABAccounts(
  token: string | null,
  budgetId: string | null,
): APIResult<{ data: { accounts: YNABAccount[] } }> {
  const bid = budgetId ?? 'last-used';
  return useAPI(
    token ? `${BASE}/budgets/${bid}/accounts` : null,
    { headers: bearer(token!) },
  );
}

export function useYNABCategories(
  token: string | null,
  budgetId?: string | null,
): APIResult<{ data: { category_groups: YNABCategoryGroup[] } }> {
  const bid = budgetId ?? 'last-used';
  return useAPI(
    token ? `${BASE}/budgets/${bid}/categories` : null,
    { headers: bearer(token!) },
  );
}

export function useYNABTransactions(
  token: string | null,
  opts?: { budgetId?: string; sinceDate?: string; type?: 'uncategorized' | 'unapproved' },
): APIResult<{ data: { transactions: YNABTransaction[] } }> {
  const bid = opts?.budgetId ?? 'last-used';
  return useAPI(
    token ? `${BASE}/budgets/${bid}/transactions${qs({ since_date: opts?.sinceDate, type: opts?.type })}` : null,
    { headers: bearer(token!) },
  );
}

export function useYNABMonths(
  token: string | null,
  budgetId?: string | null,
): APIResult<{ data: { months: YNABMonth[] } }> {
  const bid = budgetId ?? 'last-used';
  return useAPI(
    token ? `${BASE}/budgets/${bid}/months` : null,
    { headers: bearer(token!) },
  );
}

/** YNAB amounts are in milliunits — divide by 1000 to get dollars */
export function ynabAmount(milliunits: number): number {
  return milliunits / 1000;
}
