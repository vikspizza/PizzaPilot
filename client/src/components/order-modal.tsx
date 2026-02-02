import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Pizza, api, type Settings, type Batch, type BatchPizza } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, isThursday, isFriday, isSaturday, setHours, setMinutes, isAfter, startOfDay } from "date-fns";
import { Loader2, ShoppingBag, Bike, Store } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/
);

const formSchema = z.object({
  customerName: z.string().min(2, "Name is too short"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().regex(phoneRegex, "Invalid phone number"),
  quantity: z.number().int().min(1, "Must order at least 1").max(5, "Maximum 5 pizzas per order"),
  type: z.enum(["pickup", "delivery"]),
  date: z.string({ required_error: "Please select a date" }),
  timeSlot: z.string({ required_error: "Please select a time" }),
});

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  pizza: Pizza | null;
}

export function OrderModal({ isOpen, onClose, pizza }: OrderModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<ReturnType<typeof api.getCurrentUser> | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchPizzas, setBatchPizzas] = useState<BatchPizza[]>([]);
  const [availability, setAvailability] = useState<{ available: number } | null>(null);

  // Fetch all batches
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: api.getBatches,
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      quantity: 1,
      type: "pickup",
      date: "",
      timeSlot: "",
    },
  });

  // Load settings and reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      form.reset({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        quantity: 1,
        type: "pickup",
        date: "",
        timeSlot: "",
      });
      
      // Reset batch-related state
      setSelectedBatch(null);
      setBatchPizzas([]);
      setAvailability(null);
      setAvailableDates([]);
      
      const u = api.getCurrentUser();
      setUser(u);
      if (u) {
        form.setValue("customerName", u.name);
        form.setValue("customerEmail", u.email);
        form.setValue("customerPhone", u.phone);
        
        // Check for pending reviews
        api.getPendingReviews(u.id).then(pending => {
          if (pending.length > 0) {
            toast({
              title: "Review Required",
              description: `Please review your previous ${pending.length === 1 ? 'order' : 'orders'} before placing a new one. You can find the review link in your order history.`,
              variant: "destructive",
            });
            onClose();
            setLocation("/profile");
          }
        }).catch(() => {
          // Silently fail if check doesn't work
        });
      }

      api.getSettings().then(s => {
        setSettings(s);
      });
    }
  }, [isOpen, onClose, setLocation, toast, form]);

  // Calculate available dates from batches
  useEffect(() => {
    if (isOpen && batches && batches.length > 0) {
      // Get dates from batches that are today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = format(today, "yyyy-MM-dd");
      
      const futureBatches = batches.filter(b => {
        // Compare as strings to avoid timezone issues
        return b.serviceDate >= todayStr;
      });
      
      // Get unique dates from batches - use serviceDate directly as string to avoid timezone issues
      const batchDateStrings = futureBatches
        .map(b => b.serviceDate)
        .filter((date, index, self) => 
          index === self.findIndex(d => d === date)
        )
        .sort()
        .slice(0, 14); // Next 14 days
      
      console.log("OrderModal: Calculated batch date strings:", batchDateStrings);
      
      // Convert to Date objects for display (only for formatting)
      const batchDates = batchDateStrings.map(dateStr => {
        // Parse as local date to avoid timezone shifts
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day);
      });
      setAvailableDates(batchDates);
      
      // Get current selected date
      const currentDate = form.getValues("date");
      
      // If current selected date is not in available dates, reset it
      if (currentDate && !batchDateStrings.includes(currentDate)) {
        console.log("OrderModal: Resetting invalid date", currentDate, "to", batchDateStrings[0]);
        form.setValue("date", batchDateStrings[0] || "");
        form.setValue("timeSlot", ""); // Also reset time slot
      } else if (!currentDate && batchDateStrings.length > 0) {
        // Auto-select first available date if none selected
        console.log("OrderModal: Auto-selecting first date", batchDateStrings[0]);
        form.setValue("date", batchDateStrings[0]);
      }
    } else if (isOpen && batches && batches.length === 0) {
      // No batches available
      setAvailableDates([]);
      form.setValue("date", "");
      form.setValue("timeSlot", "");
    }
  }, [isOpen, batches, form]);

  // Watch for date changes and find matching batch
  const selectedDate = form.watch("date");
  useEffect(() => {
    // Reset state when date changes
    setSelectedBatch(null);
    setBatchPizzas([]);
    setAvailability(null);

    if (!selectedDate) {
      return;
    }

    // Wait for batches to load
    if (!batches) {
      console.log("OrderModal: Batches not loaded yet");
      return;
    }

    console.log("OrderModal: Selected date:", selectedDate);
    console.log("OrderModal: Available batches:", batches.map(b => ({ id: b.id, serviceDate: b.serviceDate })));

    // Find matching batch
    const batch = batches.find(b => b.serviceDate === selectedDate);
    
    console.log("OrderModal: Found batch:", batch ? { id: batch.id, serviceDate: batch.serviceDate } : "none");
    
    if (batch) {
      setSelectedBatch(batch);
      // Fetch batch pizzas
      api.getBatchPizzas(batch.id).then(bps => {
        setBatchPizzas(bps);
        // Check if pizza is in batch
        const batchPizza = bps.find(bp => bp.pizzaId === pizza?.id);
        if (batchPizza) {
          // Check availability
          api.getBatchAvailability(batch.id, pizza.id).then(avail => {
            setAvailability(avail);
          }).catch(err => {
            console.error("Error fetching availability:", err);
            setAvailability(null);
          });
        } else {
          setAvailability(null);
        }
      }).catch(err => {
        console.error("Error fetching batch pizzas:", err);
        setBatchPizzas([]);
        setAvailability(null);
      });
    }
    // If no batch found, selectedBatch stays null (which shows the error message)
  }, [selectedDate, batches, pizza]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!pizza) return;
    
    // Check batch availability
    if (selectedBatch) {
      const batchPizza = batchPizzas.find(bp => bp.pizzaId === pizza.id);
      if (!batchPizza) {
        toast({
          title: "Not Available",
          description: "This pizza is not available in the selected batch.",
          variant: "destructive",
        });
        return;
      }
      
      if (!availability || availability.available < values.quantity) {
        toast({
          title: "Sold Out",
          description: `Only ${availability?.available || 0} ${availability?.available === 1 ? 'pizza' : 'pizzas'} available for this batch.`,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Fallback to old sold-out check if no batch
      if (pizza.soldOut) {
        toast({
          title: "Sold Out",
          description: "This pizza is currently sold out.",
          variant: "destructive",
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      await api.createOrder({
        ...values,
        pizzaId: pizza.id,
        userId: user?.id,
        batchId: selectedBatch?.id,
      });
      toast({
        title: "Order Confirmed!",
        description: "We've received your order. Check your email for details.",
      });
      onClose();
      setLocation("/success");
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pizza) return null;

  // Generate time slots based on batch or settings
  const timeSlots: string[] = [];
  if (selectedBatch) {
    // Use batch service hours
    for (let i = selectedBatch.serviceStartHour; i < selectedBatch.serviceEndHour; i++) {
      timeSlots.push(`${i}:00`);
      timeSlots.push(`${i}:30`);
    }
  } else if (settings) {
    // Fallback to settings
    for (let i = settings.serviceStartHour; i < settings.serviceEndHour; i++) {
      timeSlots.push(`${i}:00`);
      timeSlots.push(`${i}:30`);
    }
  }

  // Check if pizza is available in selected batch
  const isPizzaInBatch = selectedBatch ? batchPizzas.some(bp => bp.pizzaId === pizza.id) : true;
  const isAvailable = availability ? availability.available > 0 : true;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Order {pizza.name}</DialogTitle>
          <DialogDescription>
            Reserve your pie. Pay when you pick it up.
            {selectedBatch && (
              <span className="block mt-1 text-xs">
                Batch #{selectedBatch.batchNumber} • {(() => {
                  // Parse date string as local date to avoid timezone issues
                  const [year, month, day] = selectedBatch.serviceDate.split("-").map(Number);
                  return format(new Date(year, month - 1, day), "MMM d, yyyy");
                })()}
              </span>
            )}
            {!selectedBatch && selectedDate && !batchesLoading && batches && batches.length > 0 && (
              <span className="block mt-2 text-destructive text-sm font-medium">
                No batch found for the selected date. Please select a different date.
              </span>
            )}
            {!selectedBatch && selectedDate && batchesLoading && (
              <span className="block mt-2 text-muted-foreground text-sm">
                Loading batches...
              </span>
            )}
            {selectedBatch && !isPizzaInBatch && (
              <span className="block mt-2 text-destructive text-sm font-medium">
                This pizza is not available in the selected batch.
              </span>
            )}
            {selectedBatch && isPizzaInBatch && !isAvailable && (
              <span className="block mt-2 text-destructive text-sm font-medium">
                This pizza is sold out for this batch.
              </span>
            )}
            {selectedBatch && isPizzaInBatch && availability && availability.available > 0 && (
              <span className="block mt-2 text-muted-foreground text-sm">
                {availability.available} {availability.available === 1 ? 'pizza' : 'pizzas'} available
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Order Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div>
                          <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                          <FormLabel
                            htmlFor="pickup"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                          >
                            <Store className="mb-2 h-6 w-6" />
                            Pickup
                          </FormLabel>
                        </div>
                        <div>
                          <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                          <FormLabel
                            htmlFor="delivery"
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                          >
                            <Bike className="mb-2 h-6 w-6" />
                            Delivery
                          </FormLabel>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={5} 
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select date" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableDates.map((date) => {
                          const dateStr = format(date, "yyyy-MM-dd");
                          return (
                            <SelectItem key={dateStr} value={dateStr}>
                              {format(date, "EEE, MMM d")}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeSlot"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Your Details</h4>
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Dough" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="jane@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="555-0123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                className="w-full font-bold text-lg h-12" 
                disabled={
                  isSubmitting || 
                  batchesLoading ||
                  !selectedBatch || 
                  !selectedDate || 
                  !form.getValues("timeSlot") ||
                  (selectedBatch && (!isPizzaInBatch || !isAvailable))
                }
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Place Order"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
