import { supabase } from './supabaseClient';

// 🎯 Budgets: month (Night Budget), week, and tonight (only counts on the day it was set)
const pad = (n) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function getBudgets() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { month: 0, week: 0, tonight: 0, warn: true };
  const { data } = await supabase.from('profiles').select('monthly_budget, week_budget, tonight_budget, tonight_date, budget_warn').eq('id', user.id).maybeSingle();
  const d = data || {};
  return {
    month: d.monthly_budget || 0,
    week: d.week_budget || 0,
    tonight: d.tonight_date === todayStr() ? d.tonight_budget || 0 : 0,
    warn: d.budget_warn !== false,
  };
}

// kind: 'tonight' | 'week' | 'month'; amount 0 removes it
export async function saveBudget(kind, amount) {
  const { data: { user } } = await supabase.auth.getUser();
  const n = Math.max(0, Math.min(10000000, Math.round(Number(amount) || 0))) || null;
  const row = kind === 'tonight' ? { tonight_budget: n, tonight_date: n ? todayStr() : null } : kind === 'week' ? { week_budget: n } : { monthly_budget: n };
  const { error } = await supabase.from('profiles').update(row).eq('id', user.id);
  if (error) throw error;
}

export async function setBudgetWarn(on) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('profiles').update({ budget_warn: on }).eq('id', user.id);
  if (error) throw error;
}
