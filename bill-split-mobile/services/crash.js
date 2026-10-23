// 🚨 Crash reports (Sentry). When the app breaks for anyone, we get an email with the exact error.
// No names, phone numbers, emails or bill contents are sent: only the error, the screen, the phone model and the user id.
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = 'https://74f1c8a7381e5f20d7913a2b55a9347b@o4512303918481408.ingest.de.sentry.io/4512303942008912';

let on = false;
export function initCrash() {
  if (on) return;
  try {
    Sentry.init({
      dsn: DSN,
      environment: __DEV__ ? 'expo-go' : 'preview',
      release: `vibeout@${Constants.expoConfig?.version || '1.0.0'}`,
      sendDefaultPii: false, // no IP address or personal details
      tracesSampleRate: 0, // errors only, no performance tracking (keeps us on the free plan)
      enableAutoSessionTracking: true,
      beforeBreadcrumb: (b) => (b.category === 'console' ? null : b), // console logs can contain names
    });
    on = true;
  } catch (e) {}
}

export function crashUser(uid) {
  try {
    Sentry.setUser(uid ? { id: uid } : null);
  } catch (e) {}
}

export function crashScreen(name) {
  try {
    Sentry.setTag('screen', name);
    Sentry.addBreadcrumb({ category: 'navigation', message: name, level: 'info' });
  } catch (e) {}
}

export function crashReport(error, where) {
  try {
    Sentry.captureException(error, where ? { tags: { where } } : undefined);
  } catch (e) {}
}

export const wrapApp = (C) => {
  try {
    return Sentry.wrap(C);
  } catch (e) {
    return C;
  }
};
