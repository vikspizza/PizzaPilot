import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQs() {
  const faqs = [
    {
      question: "Why Vik's Pizza?",
      answer: (
        <>
          Because we genuinely believe your everyday, go-to pizza should be both affordable and awesome—
          not just the thing you settle for between meetings.
          <br /><br />
          We're on a mission to deliver pizza that feels handcrafted, thoughtful, and shockingly delicious…
          the way you wish your code deployments felt.
        </>
      ),
    },
    {
      question: "Why the tech theme?",
      answer: (
        <>
          Because tech is who we are, what we do, and—let's be honest—how our brains work.
          <br /><br />
          We express love through tastier abstractions.
        </>
      ),
    },
    {
      question: "Why limited batches?",
      answer: (
        <>
          Because great flavor doesn't scale infinitely—
          it scales intentionally.
          <br /><br />
          We make pies in small, focused batches so every pizza:
          <ul className="list-disc list-inside mt-3 space-y-2 ml-4">
            <li>Gets handcrafted attention</li>
            <li>Uses properly fermented dough</li>
            <li>Hits the oven at peak performance</li>
            <li>Arrives with flavor that would pass any code review</li>
          </ul>
          <br />
          Quality-in, quality-out. That's Vik's Pizza.
        </>
      ),
    },
    {
      question: "Is it really free?",
      answer: (
        <>
          Yes — free as in beer. Or in this case, pizza.
          <br /><br />
          We don't charge money during this early phase.
          But we do ask for your honest, constructive, thoughtful review.
          <br /><br />
          Your feedback is the CI pipeline that helps us:
          <ul className="list-disc list-inside mt-3 space-y-2 ml-4">
            <li>Fine-tune recipes</li>
            <li>Optimize crust algorithms</li>
            <li>Improve flavor performance</li>
            <li>Shape what Vik's Pizza becomes</li>
          </ul>
          <br />
          We take every review seriously.
          <br />
          Your taste buds are basically our product managers.
        </>
      ),
    },
    {
      question: "How do I get a pie?",
      answer: (
        <>
          We open orders on select days, in limited quantities.
          Think of it as a pizza drop—
          except instead of NFTs, you get something actually edible.
          <br /><br />
          Join the queue early. FIFO rules apply.
        </>
      ),
    },
    {
      question: "Why only certain service days?",
      answer: (
        <>
          Because we believe in slow fermentation, not rushed iteration.
          Dough needs time. Craft needs focus.
          <br /><br />
          Also, we still have day jobs…
          for now.
        </>
      ),
    },
    {
      question: "What style of pizza is Vik's Pizza?",
      answer: (
        <>
          We specialize in a Neo-NY / artisan hybrid:
          <ul className="list-disc list-inside mt-3 space-y-2 ml-4">
            <li>crisp bottom</li>
            <li>airy, open crumb</li>
            <li>high-temp blistering</li>
            <li>toppings balanced like a well-designed microservice</li>
          </ul>
          <br />
          Light enough to eat before a meeting.
          Delicious enough to justify turning your camera off afterward.
        </>
      ),
    },
    {
      question: "Can I request custom toppings?",
      answer: (
        <>
          Right now? No.
          <br /><br />
          We're perfecting our base flavors first—
          like writing a rock-solid API before taking feature requests.
          <br /><br />
          But trust us, fun stuff is coming.
        </>
      ),
    },
    {
      question: "Will you ever charge for pizza?",
      answer: (
        <>
          Eventually, yes.
          <br /><br />
          But early testers (that's you!) will always have a special place in our flavor history.
          We may even bribe you with perks later.
        </>
      ),
    },
    {
      question: "Do you deliver?",
      answer: (
        <>
          Usually no, but occasionally yes.
          <br /><br />
          We're like distributed systems:
          delivery is possible, but we prefer local operations.
        </>
      ),
    },
    {
      question: "Is your pizza healthy?",
      answer: (
        <>
          Healthy is subjective.
          <br /><br />
          But our dough is fermented for days, our ingredients are clean, and we avoid grease bombs.
          <br /><br />
          Vik's Pizza wants you awake during your code review—not asleep at your keyboard.
        </>
      ),
    },
    {
      question: "How can I support Vik's Pizza?",
      answer: (
        <>
          Simple:
          <ul className="list-disc list-inside mt-3 space-y-2 ml-4">
            <li>Eat pizza</li>
            <li>Give honest feedback</li>
            <li>Tell a friend (or your entire engineering team)</li>
          </ul>
          <br />
          If you want to go full fanboy/fangirl, we won't stop you.
        </>
      ),
    },
  ];

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
              Frequently Asked Questions
            </h1>
            
            <p className="text-lg text-muted-foreground">
              Everything you need to know about Vik's Pizza, our pizza, and how we operate.
            </p>

            <div className="mt-8">
              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border border-border/40 rounded-lg px-6 bg-card/30"
                  >
                    <AccordionTrigger className="text-left font-display font-bold text-lg hover:no-underline py-6">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground/90 leading-relaxed pb-6">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

