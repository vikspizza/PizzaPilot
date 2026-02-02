import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function OrderSuccess() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-display font-bold mb-4"
        >
          Order Received!
        </motion.h1>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground text-lg mb-8"
        >
          We've got your pie in the queue. You'll receive a confirmation email shortly with pickup details.
        </motion.p>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-6 bg-muted/50 rounded-lg border border-border mb-8 w-full text-left space-y-2"
        >
          <h3 className="font-bold font-mono text-sm uppercase text-muted-foreground">Next Steps</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Wait for the "Ready for Pickup" text.</li>
            <li>Pay at the counter (Cash or Card).</li>
            <li>Eat the pizza.</li>
            <li>Leave a brutally honest review.</li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/">
            <Button size="lg" className="font-bold">
              Back to Menu <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </Layout>
  );
}
