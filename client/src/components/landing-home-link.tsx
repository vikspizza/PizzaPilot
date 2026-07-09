import { cn } from "@/lib/utils";

/** Full-page link to the static landing page at `/`. */
export function LandingHomeLink({
  className,
  children = "← Back to home",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href="/"
      className={cn(
        "inline-block text-sm font-semibold px-3 py-2 rounded-full border border-white/35 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-colors",
        className,
      )}
    >
      {children}
    </a>
  );
}
