import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-sun/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-brand/15 blur-3xl" />
      <header className="relative px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Workido home" className="rounded-lg">
          <Wordmark />
        </Link>
      </header>
      <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
