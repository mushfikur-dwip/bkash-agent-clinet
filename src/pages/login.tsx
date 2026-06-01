import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useLogin();

  function onSubmit(values: z.infer<typeof loginSchema>) {
    setErrorMsg("");
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          if (data.success && data.token) {
            localStorage.setItem("auth_token", data.token);
            setLocation("/");
          } else {
            setErrorMsg("Login failed, please check your credentials.");
          }
        },
        onError: (error) => {
          setErrorMsg(error.message || "An unexpected error occurred during login.");
        },
      }
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background z-0 pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-3xl font-bold tracking-tight text-center">Verify System</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Terminal Access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <Alert variant="destructive" className="mb-6 border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="agent@example.com" 
                        {...field} 
                        className="bg-background/50 h-11 border-border focus-visible:ring-1 focus-visible:ring-primary"
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        className="bg-background/50 h-11 border-border focus-visible:ring-1 focus-visible:ring-primary"
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-11 font-semibold text-sm tracking-wide mt-2 shadow-lg hover:shadow-primary/25 transition-all" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "AUTHENTICATING..." : "LOGIN"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
