import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Loader2, Beaker } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PastExperiments() {
  const { data: pastExperiments, isLoading } = useQuery({
    queryKey: ["past-experiments"],
    queryFn: () => api.getPastExperiments(),
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Link href="/" className="inline-block text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
            ← Back to home
          </Link>
          <div className="flex items-center gap-3">
            <Beaker className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
              Past Experiments
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            A catalog of every pizza we've ever offered. Each experiment shows how many batches it has appeared in.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pastExperiments && pastExperiments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pastExperiments.map((experiment, i) => (
              <motion.div
                key={experiment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card className="overflow-hidden h-full flex flex-col border-border/60 shadow-sm hover:shadow-md transition-all group bg-card hover:border-primary/20">
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {experiment.imageUrl ? (
                      <img
                        src={experiment.imageUrl}
                        alt={experiment.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                        <span className="text-sm">No Image</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="bg-background/90 text-foreground backdrop-blur-md font-bold border-border/50">
                        Offered {experiment.offerCount}×
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <h3 className="font-display font-bold text-xl leading-tight group-hover:text-primary transition-colors">
                      {experiment.name}
                    </h3>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 flex-grow">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {experiment.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No past experiments yet. Check back after our first batch!</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
