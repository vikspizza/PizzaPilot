import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().min(10, "Please enter a valid phone number"),
});

const otpSchema = z.object({
  code: z.string().min(6, "Please enter the 6-digit code"),
});

function OtpForm({ 
  onSubmit, 
  isLoading, 
  onBack 
}: { 
  onSubmit: (values: { code: string }) => void; 
  isLoading: boolean; 
  onBack: () => void;
}) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length >= 6) {
      onSubmit({ code });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center justify-center space-y-2">
        <label htmlFor="otp-input" className="sr-only">Verification Code</label>
        <input
          id="otp-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter 6-digit code"
          className="w-48 h-12 text-center text-2xl tracking-widest font-mono border border-input rounded-md bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          autoComplete="one-time-code"
          autoFocus
          data-testid="input-otp-code"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Check your console for the verification code
        </p>
      </div>
      <Button type="submit" className="w-full font-bold" disabled={isLoading || code.length < 6} data-testid="button-verify">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        Verify & Login
      </Button>
      <Button 
        type="button" 
        variant="ghost" 
        className="w-full text-xs text-muted-foreground"
        onClick={onBack}
        disabled={isLoading}
        data-testid="button-go-back"
      >
        Wrong number? Go back
      </Button>
    </form>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const phoneForm = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const handleSendOtp = async (values: z.infer<typeof phoneSchema>) => {
    setIsLoading(true);
    try {
      await api.sendOtp(values.phone);
      setPhoneNumber(values.phone);
      setStep("otp");
      toast({ title: "Code sent!", description: "We sent a verification code to your phone." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send code", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (values: z.infer<typeof otpSchema>) => {
    setIsLoading(true);
    try {
      await api.verifyOtp(phoneNumber, values.code);
      toast({ title: "Welcome back!", description: "You successfully logged in." });
      setLocation("/");
    } catch (error) {
      toast({ title: "Error", description: "Invalid code. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh] py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-display font-bold">
              {step === "phone" ? "Sign in to CRUSTOPS" : "Verify your number"}
            </CardTitle>
            <CardDescription>
              {step === "phone" 
                ? "Enter your mobile number to access your profile and orders." 
                : `Enter the 6-digit code sent to ${phoneNumber}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === "phone" ? (
              <Form {...phoneForm}>
                <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
                  <FormField
                    control={phoneForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" type="tel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    Send Code
                  </Button>
                </form>
              </Form>
            ) : (
              <OtpForm 
                onSubmit={handleVerifyOtp} 
                isLoading={isLoading} 
                onBack={() => setStep("phone")} 
              />
            )}
          </CardContent>
          <CardFooter>
             <p className="text-xs text-center text-muted-foreground w-full">
               By continuing, you agree to our{" "}
               <Link href="/privacy">
                 <span className="text-primary hover:underline cursor-pointer">Privacy Policy</span>
               </Link>
               .
             </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
