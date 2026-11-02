import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { listBills } from './bills';
import { listExpenses } from './expenses';
import { getBudgets } from './budget';
import { budgetStage, monthKey, moneySummary, todaySummary } from './money';
import { supabase } from './supabaseClient';

// 💰 "Warn me at 80%": after a new spend or bill, tell the person once per month when they reach 80% and 100% of their Night Budget.
export async function checkBudgetWarning() {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u || !u.user) return;
    const bs = await getBudgets();
    const budget = bs.month;
    if ((!budget && !bs.tonight) || !bs.warn) return;
    const [bills, expenses] = await Promise.all([listBills().catch(() => []), listExpenses().catch(() => [])]);
    const inr0 = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
    // 🎯 tonight's budget: warn once at 80% and once at 100%, per day
    if (bs.tonight) {
      const t = todaySummary(bills, expenses, budget, new Date(), bs.tonight);
      const st = budgetStage(t.today, bs.tonight);
      const k = `vo_tonight_warned_${new Date().toDateString()}`;
      if (st && (Number(await AsyncStorage.getItem(k)) || 0) < st) {
        await AsyncStorage.setItem(k, String(st));
        return Alert.alert(
          st === 100 ? "🚨 Tonight's budget used up" : "⚠️ 80% of tonight's budget used",
          st === 100 ? `You've spent ${inr0(t.today)} of ${inr0(bs.tonight)} tonight. Water and a ride home? 💧🚕` : `${inr0(t.today)} of ${inr0(bs.tonight)} spent. ${inr0(bs.tonight - t.today)} left for tonight.`,
        );
      }
    }
    if (!budget) return;
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
