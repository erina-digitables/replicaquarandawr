# Dawr

A daily tracker for hifz revision: set how many quarters (rub') a day you revise, rate each one as you read it, keep a streak.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and choose **Try it with sample data**, or create an account.

- `/design` shows every UI primitive in light and dark.
- Data is stored in `.data/dev-db.json` (gitignored) by a development stand-in for the real backend. Delete the file to start fresh.
- Password-reset codes are printed in the dev server log until email is connected.

## Where things live

| path | what |
| --- | --- |
| `src/app/(auth)` | sign in, create account, password reset |
| `src/app/(app)` | today, plan, progress, history, settings |
| `src/app/actions` | server actions (every mutation) |
| `src/lib/data` | the data layer: the only code that touches storage |
| `src/lib/dawr.ts` | pure revision logic: streaks, suggestions, stats |
| `src/data/quarters.json` | the 240 quarters: juz, hizb, start surah and ayah |
| `src/styles` | design tokens, generated from `../replica/design/tokens.json` |

Quarter start points come from [quran-meta](https://github.com/quran-center/quran-meta) (MIT).
