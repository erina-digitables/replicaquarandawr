import type { Metadata } from "next";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "Design system · Dawr" };

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-[1040px]">
      <header className="px-4 py-6 sm:px-6">
        <h1 className="font-display text-display text-text">Design system</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every primitive and its states, from <code className="font-mono">replica/design/tokens.json</code>. Light and dark side by side.
        </p>
      </header>
      <div className="grid md:grid-cols-2">
        <div className="mx-auto w-full max-w-(--container-column)">
          <Gallery theme="light" />
        </div>
        <div className="mx-auto w-full max-w-(--container-column)">
          <Gallery theme="dark" />
        </div>
      </div>
    </main>
  );
}
