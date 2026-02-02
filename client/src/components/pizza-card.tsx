import { type Pizza } from "@/lib/api";
import { Badge } from "@/components/ui/badge"; // Assuming shadcn badge exists or I'll standard styling
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Plus, Star } from "lucide-react";
import { motion } from "framer-motion";

interface PizzaCardProps {
  pizza: Pizza;
  onOrder: (pizza: Pizza) => void;
}

export function PizzaCard({ pizza, onOrder }: PizzaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden h-full flex flex-col border-border/60 shadow-sm hover:shadow-md transition-all group bg-card hover:border-primary/20">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {pizza.imageUrl ? (
            <img 
              src={pizza.imageUrl} 
              alt={pizza.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                console.error("Failed to load image:", pizza.imageUrl, e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
              <span className="text-sm">No Image</span>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-md px-2 py-1 rounded-md font-mono text-xs font-bold shadow-sm border border-border/50">
            ${pizza.price}
          </div>
          {pizza.soldOut && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="bg-destructive text-destructive-foreground px-3 py-1 font-bold rotate-[-10deg] shadow-lg border-2 border-white">SOLD OUT</span>
            </div>
          )}
        </div>
        
        <CardHeader className="p-4 pb-2">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-display font-bold text-xl leading-tight group-hover:text-primary transition-colors">
              {pizza.name}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pizza.tags.map(tag => (
              <span key={tag} className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/50">
                {tag}
              </span>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="p-4 pt-2 flex-grow">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {pizza.description}
          </p>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <Button 
            onClick={() => onOrder(pizza)} 
            disabled={pizza.soldOut}
            className="w-full font-bold cursor-pointer"
            variant={pizza.soldOut ? "secondary" : "default"}
          >
            {pizza.soldOut ? "Sold Out" : (
              <>
                Add to Order <Plus size={16} className="ml-2" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
