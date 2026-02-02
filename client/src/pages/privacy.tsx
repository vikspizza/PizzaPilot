import { Layout } from "@/components/layout";
import { motion } from "framer-motion";

export default function Privacy() {
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
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
                🍕 Vik's Pizza Privacy Policy
              </h1>
              <p className="text-muted-foreground italic">
                (Version 1.0 — Because privacy matters… almost as much as pizza.)
              </p>
            </div>
            
            <div className="prose prose-lg max-w-none space-y-6 text-foreground/90">
              <p className="text-lg leading-relaxed">
                Welcome to Vik's Pizza.
              </p>

              <p className="text-lg leading-relaxed">
                This Privacy Policy explains how we collect, process, store, and protect your personal data, particularly your pizza preferences, which—let's be honest—are the most sensitive data you own.
              </p>

              <p className="text-lg leading-relaxed">
                By participating in our limited-batch pizza program, you agree to the following extremely serious, totally real, definitely legally binding policies.
              </p>

              <div className="space-y-6 pt-4">
                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">1. Data We Collect</h2>
                  
                  <div className="space-y-3">
                    <h3 className="text-xl font-display font-bold text-foreground">1.1 Pizza Preference Data ("PPD")</h3>
                    <p className="text-lg leading-relaxed">
                      This includes, but is not limited to:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Your preferred crust crispiness</li>
                      <li>Topping enthusiasm levels</li>
                      <li>Hydration tolerance</li>
                      <li>Chili-oil risk appetite</li>
                      <li>Pineapple stance (strictly opt-in & logged with elevated security)</li>
                      <li>Your emotional response to ricotta</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-display font-bold text-foreground">1.2 Feedback & Review Data</h3>
                    <p className="text-lg leading-relaxed">
                      We collect your reviews because they directly improve our pizza.
                      <br />
                      We do not collect your browser history, your GitHub commits, or your Slack DMs.
                      <br />
                      <span className="italic">(Unless they mention pizza, in which case… maybe.)</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl font-display font-bold text-foreground">1.3 Operational Data</h3>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Order timing</li>
                      <li>Queue positioning</li>
                      <li>Slice-to-mouth latency metrics</li>
                      <li>Crust structural-integrity performance</li>
                    </ul>
                  </div>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">2. How We Use Your Data</h2>
                  <p className="text-lg leading-relaxed">
                    Your data is used solely to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Enhance flavor precision</li>
                    <li>Improve dough architecture</li>
                    <li>Optimize topping distribution</li>
                    <li>Tune bake algorithms</li>
                    <li>Reduce the probability of a soggy bottom event</li>
                  </ul>
                  <p className="text-lg leading-relaxed font-display font-bold text-primary">
                    We do not sell your data.
                    <br />
                    We barely have time to sell pizza.
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">3. Data Storage</h2>
                  <p className="text-lg leading-relaxed">
                    All PPD is stored securely in a heavily fortified artisanal dough locker, guarded by:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>A sourdough starter named Cerberus</li>
                    <li>Three layers of metaphorical encryption</li>
                    <li>A pizza peel we wield with surprising authority</li>
                  </ul>
                  <p className="text-lg leading-relaxed">
                    In the unlikely event of a breach, attackers may learn that you like extra basil.
                    <br />
                    We deeply regret this possibility.
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">4. User Rights</h2>
                  <p className="text-lg leading-relaxed">
                    You have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Access your pizza preferences</li>
                    <li>Update your pizza preferences</li>
                    <li>Purge your pizza preferences (a.k.a. "Dough-Right-to-Be-Forgotten")</li>
                    <li>Contest any topping choices attributed to you in error</li>
                    <li>Deny pineapple at any time, for any reason</li>
                  </ul>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">5. Third-Party Sharing</h2>
                  <p className="text-lg leading-relaxed">
                    We do not share your data with:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Advertisers</li>
                    <li>Trackers</li>
                    <li>Analytics platforms</li>
                    <li>Your coworkers</li>
                  </ul>
                  <p className="text-lg leading-relaxed">
                    We may share anonymized aggregates like:
                    <br />
                    <span className="italic">"70% of users experienced 20% more joy after chili oil."</span>
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">6. Cookies</h2>
                  <p className="text-lg leading-relaxed font-display font-bold text-primary">
                    Our cookies are chocolate-chunk.
                    <br />
                    Not digital.
                    <br />
                    We do not track you.
                    <br />
                    We merely feed you.
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">7. Policy Updates</h2>
                  <p className="text-lg leading-relaxed">
                    We may update this policy occasionally as the law, our business, or your pizza preferences evolve.
                    <br />
                    Updates will be published with proper ceremony, possibly involving fresh mozzarella.
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="text-2xl font-display font-bold text-foreground">8. Contact</h2>
                  <p className="text-lg leading-relaxed">
                    Questions? Concerns?
                    <br />
                    Want your data removed or your pizza hotter?
                    <br />
                    Email: <a href="mailto:privacy@vikspizza.com" className="text-primary hover:underline font-display font-bold">privacy@vikspizza.com</a>
                  </p>
                  <p className="text-lg leading-relaxed italic text-muted-foreground">
                    Or just shout loudly: "HEY, MY PREFERENCES!"
                    <br />
                    Someone will appear holding a pizza peel.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}







