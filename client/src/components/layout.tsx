import { Link, useLocation } from "wouter";
import { ShoppingBag, Lock, User, Sun, Moon } from "lucide-react";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [user, setUser] = useState<ReturnType<typeof api.getCurrentUser> | null>(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setUser(api.getCurrentUser());
  }, [location]); // Re-check user on navigation

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans selection:bg-primary/10">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full">
          <Link href="/" className="block">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-0 group cursor-pointer">
              <img 
                src={theme === "dark" ? "/attached_assets/generated_images/vikspizza_dark4_1.png" : "/attached_assets/generated_images/vikspizza_color4_1.png"} 
                alt="Vik's Pizza" 
                className="w-full h-auto object-contain transition-opacity duration-300 group-hover:opacity-80"
              />
            </div>
          </Link>

          <nav className="flex items-center gap-6 py-3 max-w-4xl mx-auto px-4 justify-end">
            <a 
              href="/" 
              onClick={(e) => {
                e.preventDefault();
                if (location === "/") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  window.location.href = "/";
                }
              }}
              className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${location === "/" ? "text-primary" : "text-foreground/80"}`}
            >
              Home
            </a>
            <a 
              href="/#menu" 
              onClick={(e) => {
                e.preventDefault();
                if (location === "/") {
                  document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
                } else {
                  window.location.href = "/#menu";
                }
              }}
              className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${location === "/" ? "text-foreground/80" : "text-foreground/80"}`}
            >
              Menu
            </a>
            <Link href="/about">
              <div className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${location === "/about" ? "text-primary" : "text-foreground/80"}`}>
                About
              </div>
            </Link>
            <Link href="/faqs">
              <div className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${location === "/faqs" ? "text-primary" : "text-foreground/80"}`}>
                FAQs
              </div>
            </Link>
            
            {user ? (
              <Link href="/profile">
                <div className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 cursor-pointer ${location === "/profile" ? "text-primary" : "text-foreground/80"}`}>
                  <User size={14} />
                  Profile
                </div>
              </Link>
            ) : (
              <Link href="/login">
                <div className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 cursor-pointer ${location === "/login" ? "text-primary" : "text-foreground/80"}`}>
                  <User size={14} />
                  Login
                </div>
              </Link>
            )}

            <div className="h-4 w-px bg-border/60" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="h-8 w-8 p-0"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun size={16} className="text-foreground/80" />
              ) : (
                <Moon size={16} className="text-foreground/80" />
              )}
            </Button>
            
            <div className="h-4 w-px bg-border/60" />
            
            <Link href="/admin">
              <div className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 cursor-pointer ${location.startsWith("/admin") ? "text-primary" : "text-foreground/80"}`}>
                <Lock size={14} />
                Ops
              </div>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 relative z-10">
        {/* Code background - subtle and faded */}
        <div 
          className="fixed inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 0 }}
        >
          <pre 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-mono whitespace-pre text-left"
            style={{
              opacity: theme === "dark" ? 0.04 : 0.05,
              filter: 'blur(4px)',
              color: 'hsl(var(--foreground))',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              fontSize: 'clamp(2rem, 8vw, 6rem)',
              lineHeight: '1.5',
              maxWidth: '90vw',
            }}
          >
{`require("Pizza")

var hunger = new Queue();
hunger.enqueue("lunch");

var myPie = new Pizza("Margherita", "Neapolitan");
myPie.addTopping("basil").optimize("flavor");

if (hunger.peek() === "lunch") {
    myPie.bake(900, "wood-fire");
}

return myPie.serve("First In, First Delicious");`}
          </pre>
        </div>
        {children}
      </main>

      <footer className="border-t border-border/40 bg-card/30">
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-display font-bold text-foreground">VIK'S PIZZA</span>
            <span>123 Dough Lane, Food District</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 justify-center md:justify-end">
            <span>© 2025 Vik's Pizza</span>
            <Link href="/privacy">
              <div className="hover:underline hover:text-primary transition-colors cursor-pointer">Privacy Policy</div>
            </Link>
            <Link href="/admin">
              <div className="hover:underline hover:text-primary transition-colors cursor-pointer">Admin Access</div>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
