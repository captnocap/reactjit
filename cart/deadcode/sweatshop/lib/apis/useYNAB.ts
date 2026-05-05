import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface YNABConfig { token?: string; }

export function useYNAB(config?: YNABConfig) {
  const keys = useServiceKey('ynab');
  const token = config?.token ?? keys.token;
  const headers = token ? bearer(token) : {};
  const base = 'https://api.ynab.com/v1';

  const budgets = () => useAPI<any>(token ? `${base}/budgets` : null, { headers });
  const accounts = (budgetId: string) =>
    useAPI<any>(token && budgetId ? `${base}/budgets/${budgetId}/accounts` : null, { headers });
  const transactions = (budgetId: string) =>
    useAPI<any>(token && budgetId ? `${base}/budgets/${budgetId}/transactions` : null, { headers });
  const createTransaction = (budgetId: string) =>
    useAPIMutation<any>(`${base}/budgets/${budgetId}/transactions`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });

  return { budgets, accounts, transactions, createTransaction };
}
