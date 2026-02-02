import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Home, RefreshCw, Search, Pizza, FileText } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
                🍕 Vik's Pizza 404 Error Page
              </h1>
              <p className="text-muted-foreground italic">
                (Crust Not Found)
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-primary">
                ERROR 404: Crust Not Found
              </h2>

              <p className="text-lg text-foreground/90 leading-relaxed max-w-2xl mx-auto">
                The slice you're looking for has:
              </p>

              <ul className="list-disc list-inside space-y-2 text-foreground/90 max-w-xl mx-auto text-left">
                <li>Burned to a crisp</li>
                <li>Fallen off the peel</li>
                <li>Been eaten by someone in QA</li>
                <li>Or never existed because someone typo'd the endpoint again</li>
              </ul>
            </div>

            <div className="space-y-6 pt-8">
              <h3 className="text-2xl font-display font-bold text-foreground">
                Possible Solutions:
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <Card className="bg-card/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-6 w-6 text-primary" />
                      <h4 className="text-xl font-display font-bold">🔁 Reload the Page</h4>
                    </div>
                    <p className="text-foreground/80 text-sm leading-relaxed">
                      Sometimes the oven just needed another 90 seconds.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => window.location.reload()}
                      className="w-full"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reload
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-card/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Search className="h-6 w-6 text-primary" />
                      <h4 className="text-xl font-display font-bold">🔍 Check Your URL</h4>
                    </div>
                    <p className="text-foreground/80 text-sm leading-relaxed mb-2">
                      Did you mean:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-foreground/70 ml-2">
                      <li>/menu</li>
                      <li>/order</li>
                      <li>/pizza-is-life</li>
                    </ul>
                    <p className="text-foreground/80 text-xs italic mt-2">
                      Or were you trying to SSH into the oven again?
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Home className="h-6 w-6 text-primary" />
                      <h4 className="text-xl font-display font-bold">📦 Return to Home Base</h4>
                    </div>
                    <p className="text-foreground/80 text-sm leading-relaxed">
                      🏠 Take me home (I miss my pizza)
                    </p>
                    <Link href="/">
                      <Button variant="outline" className="w-full">
                        <Home className="mr-2 h-4 w-4" />
                        Go Home
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                <Card className="bg-card/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-primary" />
                      <h4 className="text-xl font-display font-bold">🍕 File a Ticket</h4>
                    </div>
                    <p className="text-foreground/80 text-sm leading-relaxed mb-2">
                      If you think this error is our fault (it is), please report:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-foreground/70 ml-2">
                      <li>Browser</li>
                      <li>OS</li>
                      <li>Emotional state</li>
                      <li>Preferred toppings</li>
                    </ul>
                    <p className="text-foreground/80 text-xs italic mt-2">
                      We promise to fix it before the next batch drops.
                    </p>
                    <a href="mailto:privacy@vikspizza.com">
                      <Button variant="outline" className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        Contact Us
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-6">
                <Card className="bg-primary/10 border-primary/20 max-w-xl mx-auto">
                  <CardContent className="pt-6 text-center">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <Pizza className="h-6 w-6 text-primary" />
                      <h4 className="text-xl font-display font-bold text-foreground">
                        🔥 Or… go get a pizza
                      </h4>
                    </div>
                    <p className="text-foreground/90 text-sm leading-relaxed">
                      Honestly, everything's easier after that.
                    </p>
                    <Link href="/">
                      <Button className="mt-4 font-bold">
                        <Pizza className="mr-2 h-4 w-4" />
                        Order Pizza
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
