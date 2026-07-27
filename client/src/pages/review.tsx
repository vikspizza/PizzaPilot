import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { api, type ReviewQuestion } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatPickupTime } from "@/lib/pacific-time";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import { motion } from "framer-motion";

function parseOptions(options: string | null): string[] {
  if (!options) return [];
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function buildReviewSchema(questions: ReviewQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {
    customPriceAmount: z.string().optional(),
  };

  for (const q of questions) {
    if (q.answerType === "stars") {
      shape[q.key] = z.coerce.number().int().min(1).max(5);
    } else if (q.answerType === "choice") {
      const options = parseOptions(q.options);
      shape[q.key] = q.required
        ? z.string().min(1, "Please select an option")
        : z.string().optional();
      if (options.length > 0 && q.required) {
        shape[q.key] = z.enum(options as [string, ...string[]]);
      }
    } else {
      shape[q.key] = q.required
        ? z.string().min(1, "Please enter a response")
        : z.string().optional();
    }
  }

  return z.object(shape).superRefine((data, ctx) => {
    const fairPrice = data.fair_price;
    if (fairPrice === "Other") {
      const custom = String(data.customPriceAmount ?? "").trim();
      if (!custom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a custom price amount",
          path: ["customPriceAmount"],
        });
      }
    }
  });
}

export default function Review() {
  const [, params] = useRoute("/review/:orderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const linkToken =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("t")
      : null;
  const isLinkMode = Boolean(linkToken);
  const orderIdParam = params?.orderId;

  const {
    data: linkContext,
    isLoading: linkLoading,
    error: linkError,
  } = useQuery({
    queryKey: ["review-link", linkToken],
    queryFn: () => api.getReviewByLink(linkToken!),
    enabled: isLinkMode,
    retry: false,
  });

  const { data: fetchedQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ["review-questions"],
    queryFn: () => api.getReviewQuestions(),
    enabled: !isLinkMode,
  });

  const questions = isLinkMode ? linkContext?.questions ?? [] : fetchedQuestions ?? [];

  const orderId = isLinkMode ? linkContext?.order.id : orderIdParam;

  const { data: legacyOrder, isLoading: orderLoading } = useQuery({
    queryKey: ["order", orderIdParam],
    queryFn: () => api.getOrderById(orderIdParam!),
    enabled: !isLinkMode && !!orderIdParam,
  });

  const { data: legacyPizza, isLoading: pizzaLoading } = useQuery({
    queryKey: ["pizza", legacyOrder?.pizzaId],
    queryFn: () => api.getPizzaById(legacyOrder!.pizzaId),
    enabled: !isLinkMode && !!legacyOrder?.pizzaId,
  });

  const { data: existingReview } = useQuery({
    queryKey: ["review", orderIdParam],
    queryFn: () => api.getReviewByOrderId(orderIdParam!),
    enabled: !isLinkMode && !!orderIdParam,
  });

  const order = isLinkMode ? linkContext?.order : legacyOrder;
  const pizza = isLinkMode ? linkContext?.pizza : legacyPizza;
  const alreadyReviewed = isLinkMode
    ? Boolean(linkContext?.alreadyReviewed)
    : Boolean(existingReview);

  const reviewSchema = useMemo(() => buildReviewSchema(questions), [questions]);
  type ReviewFormValues = z.infer<typeof reviewSchema>;

  const defaultValues = useMemo(() => {
    const values: Record<string, string | number | undefined> = {
      customPriceAmount: "",
    };
    for (const q of questions) {
      values[q.key] = q.answerType === "stars" ? undefined : "";
    }
    return values;
  }, [questions]);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues,
    values: defaultValues as ReviewFormValues,
  });

  const [submitted, setSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  const createReviewMutation = useMutation({
    mutationFn: (data: ReviewFormValues) => {
      const answers = questions.map((q) => {
        let value = String(data[q.key] ?? "").trim();
        if (q.key === "fair_price" && value === "Other") {
          value = `Other: ${String(data.customPriceAmount ?? "").trim()}`;
        }
        return { questionId: q.id, questionKey: q.key, value };
      }).filter((a) => a.value.length > 0);

      const payload = { answers };

      if (isLinkMode && linkToken) {
        return api.addReviewByLink(linkToken, payload);
      }

      return api.addReview({
        ...payload,
        orderId: orderId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review", orderId] });
      queryClient.invalidateQueries({ queryKey: ["review-link", linkToken] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast({
        title: "Thank you!",
        description: "Your review has been submitted successfully.",
      });
      if (isLinkMode) {
        setSubmitted(true);
      } else {
        setTimeout(() => {
          setLocation("/profile");
        }, 2000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isLinkMode) {
      return;
    }
    const user = api.getCurrentUser();
    if (!user) {
      setLocation("/login");
    }
  }, [isLinkMode, setLocation]);

  useEffect(() => {
    if (isLinkMode || !existingReview) {
      return;
    }
    toast({
      title: "Already Reviewed",
      description: "You've already submitted a review for this order.",
    });
    setLocation("/profile");
  }, [isLinkMode, existingReview, toast, setLocation]);

  if (!isLinkMode && !orderIdParam) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">Invalid review link</p>
        </div>
      </Layout>
    );
  }

  if (
    (isLinkMode && linkLoading) ||
    (!isLinkMode && (orderLoading || pizzaLoading || questionsLoading))
  ) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (isLinkMode && linkError) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-2">
          <p className="text-muted-foreground">
            {linkError instanceof Error ? linkError.message : "This review link is invalid."}
          </p>
        </div>
      </Layout>
    );
  }

  if (!order || !pizza) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">Order or pizza not found</p>
        </div>
      </Layout>
    );
  }

  if (submitted || alreadyReviewed) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-display font-bold">Thank you!</h1>
          <p className="text-muted-foreground">
            {alreadyReviewed && !submitted
              ? "This review link has already been used."
              : "Your review was submitted. This link no longer works."}
          </p>
          <Button onClick={() => setLocation("/")}>Back to home</Button>
        </div>
      </Layout>
    );
  }

  if (
    !isLinkMode &&
    order.status !== "completed" &&
    order.status !== "delivered"
  ) {
    return (
      <Layout minimal>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">This order hasn't been completed yet.</p>
        </div>
      </Layout>
    );
  }

  const onSubmit = (values: ReviewFormValues) => {
    createReviewMutation.mutate(values);
  };

  const fairPrice = form.watch("fair_price" as keyof ReviewFormValues);

  return (
    <Layout minimal>
      <div className="max-w-3xl mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-display font-bold">Review Your Order</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Thank you for trying one of our handcrafted pies! Your feedback helps us refine every batch and perfect every recipe.
            </p>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Please share your honest thoughts below — we truly value them.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>Order #{order.id.slice(0, 8).toUpperCase()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                {pizza.imageUrl && (
                  <img
                    src={pizza.imageUrl}
                    alt={pizza.name}
                    className="h-24 w-24 rounded-md object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg">{pizza.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{pizza.description}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <p>
                      Ordered on {new Date(order.date).toLocaleDateString()} at{" "}
                      {order.pickupSlot
                        ? formatPickupTime(order.pickupSlot.pickupTime)
                        : "—"}
                    </p>
                    <p>Quantity: {order.quantity}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Review</CardTitle>
              <CardDescription>Help us improve by sharing your honest feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {questions.map((question, index) => {
                    const options = parseOptions(question.options);

                    if (question.answerType === "stars") {
                      return (
                        <FormField
                          key={question.id}
                          control={form.control}
                          name={question.key as keyof ReviewFormValues}
                          render={({ field }) => {
                            const selected = Number(field.value) || 0;
                            const display = hoveredStar ?? selected;
                            return (
                              <FormItem>
                                <FormLabel className="text-base font-semibold">
                                  {index + 1}. {question.prompt}
                                </FormLabel>
                                {question.helpText && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {question.helpText}
                                  </p>
                                )}
                                <FormControl>
                                  <div
                                    className="flex items-center gap-1 pt-1"
                                    onMouseLeave={() => setHoveredStar(null)}
                                  >
                                    {[1, 2, 3, 4, 5].map((star) => {
                                      const filled = star <= display;
                                      return (
                                        <button
                                          key={star}
                                          type="button"
                                          aria-label={`${star} star${star === 1 ? "" : "s"}`}
                                          className="p-1 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          onMouseEnter={() => setHoveredStar(star)}
                                          onClick={() => field.onChange(star)}
                                        >
                                          <Star
                                            className={`h-8 w-8 ${
                                              filled
                                                ? "fill-amber-400 text-amber-400"
                                                : "text-muted-foreground/40"
                                            }`}
                                          />
                                        </button>
                                      );
                                    })}
                                    {selected > 0 && (
                                      <span className="ml-2 text-sm text-muted-foreground">
                                        {selected}/5
                                      </span>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      );
                    }

                    if (question.answerType === "text") {
                      return (
                        <FormField
                          key={question.id}
                          control={form.control}
                          name={question.key as keyof ReviewFormValues}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                {index + 1}. {question.prompt}
                              </FormLabel>
                              {question.helpText && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {question.helpText}
                                </p>
                              )}
                              <FormControl>
                                <Textarea
                                  placeholder="Share your thoughts..."
                                  className="min-h-[120px]"
                                  value={String(field.value ?? "")}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      );
                    }

                    return (
                      <div key={question.id} className="space-y-4">
                        <FormField
                          control={form.control}
                          name={question.key as keyof ReviewFormValues}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                {index + 1}. {question.prompt}
                              </FormLabel>
                              {question.helpText && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  {question.helpText}
                                </p>
                              )}
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  value={String(field.value ?? "")}
                                  className="space-y-3 mt-2"
                                >
                                  {options.map((option) => (
                                    <div key={option} className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value={option}
                                        id={`${question.key}-${option}`}
                                      />
                                      <label
                                        htmlFor={`${question.key}-${option}`}
                                        className="text-sm cursor-pointer flex-1"
                                      >
                                        {option}
                                      </label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {question.key === "fair_price" && fairPrice === "Other" && (
                          <FormField
                            control={form.control}
                            name={"customPriceAmount" as keyof ReviewFormValues}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Please enter amount:</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="e.g., $30"
                                    value={String(field.value ?? "")}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                    name={field.name}
                                    ref={field.ref}
                                    className="max-w-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation(isLinkMode ? "/" : "/profile")}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createReviewMutation.isPending || questions.length === 0}
                      className="flex-1"
                    >
                      {createReviewMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Submit Review
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
