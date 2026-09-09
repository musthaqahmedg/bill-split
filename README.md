# 💸 Bill Split

Fair restaurant & bar bill splitting for groups. Scan a receipt, mark what you ate, settle up through Razorpay.

## 🎯 The Problem

Splitting equally is unfair when one person had three cocktails and another had a lassi. Bill Split handles:
- Items at different prices (drinks, mains, sides)
- Shared items split only among people who shared them
- Veg/non-veg preference groupings
- Recurring friend groups

## ✨ How It Works

1. **Scan** — Upload receipt photo
2. **Extract** — OCR pulls line items & prices (Google Cloud Vision)
3. **Select** — Each person marks items they ate
4. **Settle** — App calculates who owes whom
5. **Pay** — Instant settlement via Razorpay

## 🛠️ Tech Stack

| Layer | Web (v1) | Mobile (Current) |
|-------|----------|------------------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, Shadcn/ui | React Native, Expo |
| State | React Query, Zustand | Supabase Client |
| Backend | Next.js API Routes | Supabase (PostgreSQL, Realtime) |
| Auth | Clerk (planned) | Supabase Phone OTP |
| OCR | Google Cloud Vision API | Google Cloud Vision API |
| Payments | Razorpay | Razorpay |
| Hosting | Vercel | Expo Go (dev) |

## 📱 Status

**Active Development**

✅ **Done:**
- Web prototype with drag-and-drop receipt upload
- OCR endpoint (Google Vision + mock fallback)
- Mobile app scaffolded (React Native + Expo)
- Supabase auth (Phone OTP working on device)
- Deployed to Vercel with auto-deploy

🔧 **In Progress:**
- End-to-end OTP login verification

📋 **Next:**
- Database schema (users, bills, items, splits, payments)
- Receipt upload screen (camera/gallery)
- Item selection with live subtotals
- Settlement calculation (who owes whom)
- Razorpay integration
- Real-time updates (Supabase Realtime)

## 📁 Project Structure
bill-split/
├── app/ # Next.js web prototype
│ └── api/
│ └── extract-receipt/ # OCR endpoint
├── components/ # Web UI components
├── docs/ # Screenshots
└── bill-split-mobile/ # React Native + Expo
├── App.tsx
├── screens/
│ └── LoginScreen.js
└── services/
└── supabaseClient.js


## 🚀 Running Locally

**Web:**
```bash
npm install
npm run dev
```
Add `NEXT_PUBLIC_GOOGLE_VISION_API_KEY` to `.env.local` for live OCR.

**Mobile:**
```bash
cd bill-split-mobile
npm install
npm start -- --clear
```
Create `.env.local` with Supabase URL & anon key. Scan QR with Expo Go.

## 📧 Contact

- Email: musthaq258@gmail.com
- GitHub: github.com/musthaqahmedg
- LinkedIn: linkedin.com/in/musthaqahmed
