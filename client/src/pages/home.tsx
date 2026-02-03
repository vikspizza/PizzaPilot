import { useQuery } from "@tanstack/react-query";
import { api, type Pizza, type Batch } from "@/lib/api";
import { Layout } from "@/components/layout";
import { PizzaCard } from "@/components/pizza-card";
import { OrderModal } from "@/components/order-modal"; // Will create next
import { useState } from "react";
import { Loader2, ArrowDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";


export default function Home() {
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<number | undefined>(undefined);
  
  const { data: menuData, isLoading } = useQuery({
    queryKey: ["pizzas", selectedBatchId, selectedBatchNumber],
    queryFn: () => api.getPizzas(selectedBatchId, selectedBatchNumber),
  });

  const pizzas = menuData?.pizzas || [];
  const currentBatch = menuData?.currentBatch || null;
  const nextBatch = menuData?.nextBatch || null;

  const handleViewNextBatch = () => {
    if (nextBatch) {
      setSelectedBatchId(nextBatch.id);
      setSelectedBatchNumber(undefined);
    }
  };

  const handleBackToCurrent = () => {
    setSelectedBatchId(undefined);
    setSelectedBatchNumber(undefined);
  };

  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  const handleOrder = (pizza: Pizza) => {
    if (pizza.soldOut) return; // Don't open modal for sold out pizzas
    setSelectedPizza(pizza);
    setIsOrderOpen(true);
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative mb-16 md:mb-24 pt-8 md:pt-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Accepting Orders for This Week
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-2"
          >
            Our pizza is a developer's best friend..... and yours too!
          </motion.p>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-display font-bold tracking-tight text-foreground uppercase"
          >
            Instantiate Pizza.<br/>
            <span className="text-primary">Satiate Hunger.</span><br/>
            <span className="text-foreground">WRITE CODE.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            We're <span className="font-bold text-foreground">Vik's Pizza</span>. An experimental test kitchen deploying limited batches of new pizza concepts every week. <span className="block mt-4 font-display font-bold text-xl text-primary">We offer amazing pizza in exchange for your brutally honest review.</span>
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="pt-2"
          >
            <Link href="/faqs">
              <span className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 cursor-pointer">
                Have questions? Check out our FAQs →
              </span>
            </Link>
          </motion.div>

          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.4 }}
             className="pt-4"
          >
             <p className="text-xs text-muted-foreground italic mb-8">
               *<span className="line-through">Pay at pickup</span> <span className="text-primary font-bold not-italic">free for now</span>, but your feedback is the real currency.
             </p>
             <a href="#menu" className="inline-flex flex-col items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors">
               View Current Experiments
               <ArrowDown className="animate-bounce mt-2" size={20} />
             </a>
          </motion.div>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="space-y-12 max-w-4xl mx-auto">
        <div className="flex items-end justify-between border-b border-border/40 pb-4">
          <div>
            <h2 className="text-3xl font-display font-bold">Current Menu</h2>
            {currentBatch ? (
              <p className="text-muted-foreground mt-1">
                Batch #{currentBatch.batchNumber} • {currentBatch.serviceDate ? (() => {
                  // Parse date string as local date to avoid timezone issues
                  const [year, month, day] = currentBatch.serviceDate.split("-").map(Number);
                  return format(new Date(year, month - 1, day), "MMM d, yyyy");
                })() : "Available Now"}
              </p>
            ) : (
              <p className="text-muted-foreground mt-1">No active batches at this time</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedBatchId && (
              <Button
                variant="ghost"
                onClick={handleBackToCurrent}
                className="text-sm"
              >
                ← Back to Current
              </Button>
            )}
            {nextBatch && !selectedBatchId && (
              <Button
                variant="outline"
                onClick={handleViewNextBatch}
                className="flex items-center gap-2"
              >
                View Batch #{nextBatch.batchNumber}
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pizzas && pizzas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pizzas.map((pizza) => (
              <PizzaCard 
                key={pizza.id} 
                pizza={pizza} 
                onOrder={handleOrder} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No pizzas available at this time. Check back soon!</p>
          </div>
        )}
      </section>

      {/* Order Modal */}
      <OrderModal 
        isOpen={isOrderOpen} 
        onClose={() => setIsOrderOpen(false)} 
        pizza={selectedPizza} 
      />
    </Layout>
  );
}
