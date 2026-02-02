import { Layout } from "@/components/layout";
import { motion } from "framer-motion";

export default function About() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
              About Vik's Pizza
            </h1>
            
            <div className="prose prose-lg max-w-none space-y-6 text-foreground/90">
              <p className="text-lg leading-relaxed">
                DevOps, software development, systems architecture, databases… you name the stack, I've debugged it.
              </p>

              <p className="text-lg leading-relaxed">
                Thirty-five years in tech, powered mostly by caffeine and some deeply questionable pizza.
              </p>

              <p className="text-lg leading-relaxed italic text-muted-foreground">
                (Occasionally a good one slipped through — like a rare bug that's actually a feature.)
              </p>

              <p className="text-lg leading-relaxed font-display font-bold text-primary">
                But that ends now.
              </p>

              <p className="text-lg leading-relaxed">
                Vik's Pizza is pointing its laser-guided focus at pizza, and we're refactoring the entire experience.
              </p>

              <p className="text-lg leading-relaxed">
                We're here to make your everyday pie as awesome as you want your code to be — clean, elegant, efficient, and shockingly delicious.
              </p>

              <div className="space-y-4 pt-4">
                <p className="text-lg leading-relaxed font-display font-bold">
                  We're chasing that bite:
                </p>
                
                <ul className="space-y-3 list-none pl-0">
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span className="text-lg leading-relaxed">The perfect crunch-to-chew ratio</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span className="text-lg leading-relaxed">A crust that supports its toppings like a well-designed load balancer</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span className="text-lg leading-relaxed">A texture light and airy enough to avoid a food coma before that code-review</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary font-bold mt-1">•</span>
                    <span className="text-lg leading-relaxed">And flavor that hits harder than an unexpected passing unit test</span>
                  </li>
                </ul>
              </div>

              <p className="text-lg leading-relaxed pt-6 font-display font-bold text-primary text-xl">
                At Vik's Pizza, we believe pizza should deploy flawlessly.
              </p>

              <p className="text-lg leading-relaxed">
                No regressions. No outages. No soggy bottoms.
              </p>

              <p className="text-lg leading-relaxed font-display font-bold text-foreground">
                Just beautifully engineered pies that scale with your hunger.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

