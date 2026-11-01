import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { listBills } from './bills';
import { listExpenses } from './expenses';
import { budgetStage, monthKey, moneySummary } from './money';
import { supabase } from './supabaseClient';

// 💰 "Warn me at 80%": after a new spend or bill, tell the person once per month when they reach 80% and 100% of their Night Budget.
export async function checkBudgetWarning() {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u || !u.user) return;
    const { data: prof } = await supabase.from('profiles').select('monthly_budget, budget_warn').eq('id', u.user.id).maybeSingle();
    const budget = (prof && prof.monthly_budget) || 0;
    if (!budget || (prof && prof.budget_warn === false)) return;
    const [bills, expenses] = await Promise.all([listBills().catch(() => []), listExpenses().catch(() => [])]);
    const key = monthKey(new Date());
    const spent = moneySummary(bills, key, new Date(), expenses).spent;
    const stage = budgetStage(spent, budget);
    if (!stage) return;
    const seenKey = `vo_budget_warned_${key}`;
    const seen = Number(await AsyncStorage.getItem(seenKey)) || 0;
    if (seen >= stage) return;
    await AsyncStorage.setItem(seenKey, String(stage));
    const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
    Alert.alert(
      stage === 100 ? '🚨 Night Budget used up' : '⚠️ 80% of your Night Budget used',
      stage === 100
        ? `You've spent ${inr(spent)} of ${inr(budget)} this month. Maybe a chill night in? 🍿`
        : `You've spent ${inr(spent)} of ${inr(budget)} this month. ${inr(budget - spent)} left for the rest of the month.`,
    );
  } catch (e) {}
}
