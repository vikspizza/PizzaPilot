import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { api, type Order, type Pizza } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const reviewSchema = z.object({
  overallRating: z.enum(["Needs improvement", "Good", "Awesome", "Mind-blowing!"]),
  fairPrice: z.enum(["$15–$17", "$18–$20", "$21–$23", "$24–$26", "Other"]),
  customPriceAmount: z.string().optional(),
  crustFlavor: z.enum([
    "Underdeveloped / bland",
    "Good flavor",
    "Very flavorful",
    "Exceptional — delicious on its own",
  ]),
  crustQuality: z.enum([
    "Too dense / underbaked",
    "Too chewy",
    "Good structure but could be lighter",
    "Light, airy, and delicious",
    "Perfect — crisp outside, airy inside",
  ]),
  toppingsBalance: z.enum([
    "Not well / flavors clashed",
    "Mostly good but something felt off",
    "Well-balanced and tasty",
    "Fantastic — perfectly harmonious",
  ]),
  wouldOrderAgain: z.enum(["No", "Maybe", "Yes", "Definitely — put it on the permanent menu!"]),
  additionalThoughts: z.string().optional(),
}).refine((data) => {
  if (data.fairPrice === "Other") {
    return data.customPriceAmount && data.customPriceAmount.trim().length > 0;
  }
  return true;
}, {
  message: "Please enter a custom price amount",
  path: ["customPriceAmount"],
});

export default function Review() {
  const [, params] = useRoute("/review/:orderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orderId = params?.orderId;

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.getOrderById(orderId!),
    enabled: !!orderId,
  });

  const { data: pizza, isLoading: pizzaLoading } = useQuery({
    queryKey: ["pizza", order?.pizzaId],
    queryFn: () => api.getPizzaById(order!.pizzaId),
    enabled: !!order?.pizzaId,
  });

  const { data: existingReview } = useQuery({
    queryKey: ["review", orderId],
    queryFn: () => api.getReviewByOrderId(orderId!),
    enabled: !!orderId,
  });

  const form = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      overallRating: undefined,
      fairPrice: undefined,
      customPriceAmount: "",
      crustFlavor: undefined,
      crustQuality: undefined,
      toppingsBalance: undefined,
      wouldOrderAgain: undefined,
      additionalThoughts: "",
    },
  });

  const user = api.getCurrentUser();

  const createReviewMutation = useMutation({
    mutationFn: (data: z.infer<typeof reviewSchema>) => {
      // Map overallRating to numeric rating for backward compatibility
      const ratingMap: Record<string, number> = {
        "Needs improvement": 2,
        "Good": 3,
        "Awesome": 4,
        "Mind-blowing!": 5,
      };
      
      return api.addReview({
        orderId: orderId!,
        pizzaId: order!.pizzaId,
        rating: ratingMap[data.overallRating] || 3,
        comment: data.additionalThoughts || "",
        author: user?.name || "Anonymous",
        overallRating: data.overallRating,
        fairPrice: data.fairPrice === "Other" ? `Other: ${data.customPriceAmount}` : data.fairPrice,
        customPriceAmount: data.customPriceAmount,
        crustFlavor: data.crustFlavor,
        crustQuality: data.crustQuality,
        toppingsBalance: data.toppingsBalance,
        wouldOrderAgain: data.wouldOrderAgain,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review", orderId] });
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast({
        title: "Thank you!",
        description: "Your review has been submitted successfully.",
      });
      setTimeout(() => {
        setLocation("/profile");
      }, 2000);
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
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (existingReview) {
      toast({
        title: "Already Reviewed",
        description: "You've already submitted a review for this order.",
      });
      setLocation("/profile");
    }
  }, [existingReview, toast, setLocation]);

  if (!orderId) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">Invalid review link</p>
        </div>
      </Layout>
    );
  }

  if (orderLoading || pizzaLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!order || !pizza) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">Order or pizza not found</p>
        </div>
      </Layout>
    );
  }

  if (order.status !== "completed" && order.status !== "delivered") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <p className="text-muted-foreground">This order hasn't been completed yet.</p>
        </div>
      </Layout>
    );
  }

  const onSubmit = (values: z.infer<typeof reviewSchema>) => {
    createReviewMutation.mutate(values);
  };

  const fairPrice = form.watch("fairPrice");

  return (
    <Layout>
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
                    <p>Ordered on {new Date(order.date).toLocaleDateString()} at {order.timeSlot}</p>
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
                  {/* Question 1: Overall Rating */}
                  <FormField
                    control={form.control}
                    name="overallRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          1️⃣ What did you think of this recipe overall?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {["Needs improvement", "Good", "Awesome", "Mind-blowing!"].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`overall-${option}`} />
                                <label
                                  htmlFor={`overall-${option}`}
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


                  {/* Question 2: Crust Flavor */}
                  <FormField
                    control={form.control}
                    name="crustFlavor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          2️⃣ How was the crust flavor?
                        </FormLabel>
                        <p className="text-sm text-muted-foreground mb-2">(Flavor, depth, fermentation, savoriness)</p>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {[
                              "Underdeveloped / bland",
                              "Good flavor",
                              "Very flavorful",
                              "Exceptional — delicious on its own",
                            ].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`flavor-${option}`} />
                                <label
                                  htmlFor={`flavor-${option}`}
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

                  {/* Question 3: Crust Quality */}
                  <FormField
                    control={form.control}
                    name="crustQuality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          3️⃣ How was the crust quality & texture?
                        </FormLabel>
                        <p className="text-sm text-muted-foreground mb-2">(Choose the closest match)</p>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {[
                              "Too dense / underbaked",
                              "Too chewy",
                              "Good structure but could be lighter",
                              "Light, airy, and delicious",
                              "Perfect — crisp outside, airy inside",
                            ].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`quality-${option}`} />
                                <label
                                  htmlFor={`quality-${option}`}
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

                  {/* Question 4: Toppings Balance */}
                  <FormField
                    control={form.control}
                    name="toppingsBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          4️⃣ How well did the toppings work together?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {[
                              "Not well / flavors clashed",
                              "Mostly good but something felt off",
                              "Well-balanced and tasty",
                              "Fantastic — perfectly harmonious",
                            ].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`toppings-${option}`} />
                                <label
                                  htmlFor={`toppings-${option}`}
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

                  {/* Question 5: Would Order Again */}
                  <FormField
                    control={form.control}
                    name="wouldOrderAgain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          5️⃣ Would you order this pizza again?
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {[
                              "No",
                              "Maybe",
                              "Yes",
                              "Definitely — put it on the permanent menu!",
                            ].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`order-${option}`} />
                                <label
                                  htmlFor={`order-${option}`}
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
                      {/* Question 6: Fair Price */}
                      <FormField
                    control={form.control}
                    name="fairPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          6️⃣ In your opinion, what is a fair price for this pizza?
                        </FormLabel>
                        <p className="text-sm text-muted-foreground mb-2">(What would you comfortably pay for it?)</p>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3 mt-2"
                          >
                            {["$15–$17", "$18–$20", "$21–$23", "$24–$26", "Other"].map((option) => (
                              <div key={option} className="flex items-center space-x-2">
                                <RadioGroupItem value={option} id={`price-${option}`} />
                                <label
                                  htmlFor={`price-${option}`}
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

                  {/* Custom Price Input */}
                  {fairPrice === "Other" && (
                    <FormField
                      control={form.control}
                      name="customPriceAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Please enter amount:</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., $30"
                              {...field}
                              className="max-w-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Question 7: Additional Thoughts */}
                  <FormField
                    control={form.control}
                    name="additionalThoughts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">
                          7️⃣ Any additional thoughts, suggestions, or flavor notes?
                        </FormLabel>
                        <p className="text-sm text-muted-foreground mb-2">
                          Please share anything that would help us improve this recipe.
                        </p>
                        <FormControl>
                          <Textarea
                            placeholder="Share your thoughts..."
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />∫
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/profile")}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createReviewMutation.isPending}
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
