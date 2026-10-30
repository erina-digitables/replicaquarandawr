import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

// A plain-language starting point. Have it reviewed before launch, and fill in the
// operator's name and contact address (replica-deploy checklist).
const processors = [
  ["Supabase", "Database and sign-in. Stores your account and revision logs.", "https://supabase.com/privacy"],
  ["Vercel", "Hosts the app and runs the nightly clean-up job.", "https://vercel.com/legal/privacy-policy"],
  ["Resend", "Sends account emails: confirmation and password-reset codes.", "https://resend.com/legal/privacy-policy"],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-(--container-column) flex-col gap-6 px-4 py-10 text-text">
      <h1 className="font-display text-xl">Privacy</h1>
      <section className="flex flex-col gap-2 text-sm text-text-muted">
        <h2 className="font-display text-base font-extrabold text-text">What we keep</h2>
        <p>Your name, username, email address, time zone, daily goal and the quarters you log with their ratings. Passwords are stored only as a hash by our sign-in provider; nobody can read them.</p>
        <p>No ads, no tracking scripts, and we never sell or share your data.</p>
      </section>
      <section className="flex flex-col gap-2 text-sm text-text-muted">
        <h2 className="font-display text-base font-extrabold text-text">Who processes it</h2>
        <ul className="flex flex-col gap-2">
          {processors.map(([name, what, href]) => (
            <li key={name}>
              <a className="font-bold text-accent underline-offset-2 hover:underline" href={href}>
                {name}
              </a>
              : {what}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2 text-sm text-text-muted">
        <h2 className="font-display text-base font-extrabold text-text">Deleting your data</h2>
        <p>
          Settings → Account → Delete my account removes your account and every log immediately. Sample accounts are deleted automatically after a day.
        </p>
      </section>
      <Link href="/" className="text-sm font-bold text-accent underline-offset-2 hover:underline">
        Back to Dawr
      </Link>
    </main>
  );
}
