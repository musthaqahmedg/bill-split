# 🧪 VibeOut tests with Maestro (free, open source)

Each flow checks one part of the app against what Musthaq and Gautham asked for (the brief is noted at the top of every flow).

## One-time setup (Windows laptop, ~15 min)
1. Install Maestro: https://maestro.mobile.dev (Windows: install via WSL, or the official installer)
2. Open the Android emulator from Android Studio and install **Expo Go** on it from the Play Store
3. In `bill-split-mobile`, run `npx expo start` and copy the `exp://…:8081` link it prints

## Run
```
maestro test .maestro/ -e APP_URL=exp://<that-link>
```
Every flow shows ✅ or ❌, and screenshots land in the folder you run it from.

## Notes
- Flows start as a brand-new guest, so they never touch real accounts.
- `assertWithAI` checks are marked optional: they need a Maestro account and only add a note, they never fail the run.
- Bill scanning needs the camera, so the "Who had what?" screen and the friends' bill page are tested in the browser instead (`npm run test:screens`).
