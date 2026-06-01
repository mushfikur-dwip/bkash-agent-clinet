import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useVerifyTransaction,
  useListPayments,
  getListPaymentsQueryKey,
  useHealthCheck,
  getHealthCheckQueryKey,
} from "@/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CheckCircle2, Search, XCircle, AlertTriangle, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const verifySchema = z.object({
  transaction_id: z.string().min(1, { message: "Transaction ID is required" }),
});

type VerifyState =
  | { type: "idle" }
  | { type: "calling_piprapay" }
  | { type: "saving" }
  | { type: "success"; message: string }
  | { type: "rejected"; message: string }
  | { type: "duplicate"; message: string }
  | { type: "error"; message: string };

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>({ type: "idle" });

  const { data: healthData } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 30000,
    },
  });

  const { data: paymentsData, isLoading: isLoadingPayments } = useListPayments(
    { search: searchTerm },
    {
      query: {
        queryKey: getListPaymentsQueryKey({ search: searchTerm }),
      },
    }
  );

  const verifyMutation = useVerifyTransaction();

  const form = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      transaction_id: "",
    },
  });

  const isPending = verifyState.type === "calling_piprapay" || verifyState.type === "saving";

  async function onSubmit(values: z.infer<typeof verifySchema>) {
    setVerifyState({ type: "calling_piprapay" });

    verifyMutation.mutate(
      {
        data: {
          txid: values.transaction_id.trim(),
          amount: 1,
          customer_mobile: null,
        },
      },
      {
        onSuccess: (data) => {
          if (data.status === "approved") {
            setVerifyState({ type: "success", message: data.message });
            queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
          } else if (data.status === "duplicate") {
            setVerifyState({ type: "duplicate", message: data.message });
          } else {
            setVerifyState({ type: "rejected", message: data.message });
          }
        },
        onError: (err) => {
          setVerifyState({ type: "error", message: err.message || "Failed to verify payment." });
        },
      }
    );
  }

  function handleClear() {
    form.reset({ transaction_id: "" });
    setVerifyState({ type: "idle" });
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setSearchTerm(value), 300);
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    setLocation("/login");
  }

  const pendingLabel =
    verifyState.type === "calling_piprapay" ? "CHECKING DATABASE..." :
    verifyState.type === "saving" ? "SAVING..." : "VERIFY NOW";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border py-4 px-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">PipraPay Terminal</h1>
          </div>
          <div className="flex items-center gap-4">
            {healthData?.status === "ok" ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5 py-1">
                <Activity className="w-3 h-3" /> System Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1.5 py-1">
                <AlertTriangle className="w-3 h-3" /> Checking Status
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          <div className="lg:col-span-4 space-y-6 sticky top-24">
            <Card className="border-border shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Verify Transaction</CardTitle>
                <CardDescription>Enter transaction ID to check the saved webhook payment.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="transaction_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs uppercase font-bold text-muted-foreground">Transaction ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. DF7T30GRH"
                              {...field}
                              className="font-mono h-11"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-2 flex gap-3">
                      <Button
                        type="submit"
                        className="flex-1 h-11 font-semibold"
                        disabled={isPending}
                      >
                        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {pendingLabel}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClear}
                        className="h-11 px-6"
                        disabled={isPending}
                      >
                        CLEAR
                      </Button>
                    </div>
                  </form>
                </Form>

                {verifyState.type !== "idle" && !isPending && (
                  <div className="mt-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
                    {verifyState.type === "success" && (
                      <Alert className="border-success/50 bg-success/10 text-success">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <AlertTitle className="text-success font-bold">Approved</AlertTitle>
                        <AlertDescription>{verifyState.message}</AlertDescription>
                      </Alert>
                    )}
                    {verifyState.type === "rejected" && (
                      <Alert className="border-destructive/50 bg-destructive/10 text-destructive">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <AlertTitle className="text-destructive font-bold">Not Found</AlertTitle>
                        <AlertDescription>{verifyState.message}</AlertDescription>
                      </Alert>
                    )}
                    {verifyState.type === "duplicate" && (
                      <Alert className="border-warning/50 bg-warning/10 text-warning">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        <AlertTitle className="text-warning font-bold">Duplicate</AlertTitle>
                        <AlertDescription>{verifyState.message}</AlertDescription>
                      </Alert>
                    )}
                    {verifyState.type === "error" && (
                      <Alert className="border-destructive/50 bg-destructive/10 text-destructive">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <AlertTitle className="text-destructive font-bold">Error</AlertTitle>
                        <AlertDescription>{verifyState.message}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border shadow-sm bg-card overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Activity className="w-24 h-24" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="font-semibold text-xs uppercase tracking-wider">Total Approved Amount</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">
                    ৳ {paymentsData?.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm bg-card overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <CheckCircle2 className="w-24 h-24" />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="font-semibold text-xs uppercase tracking-wider">Total Payment Count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold tracking-tight">
                    {paymentsData?.total_count?.toLocaleString() ?? "0"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border shadow-md">
              <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Recent Approved Payments</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search transaction or mobile..."
                    className="pl-9 h-9 bg-background"
                    onChange={handleSearch}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold w-[200px]">Transaction ID</TableHead>
                        <TableHead className="font-semibold text-right w-[120px]">Amount</TableHead>
                        <TableHead className="font-semibold">Mobile</TableHead>
                        <TableHead className="font-semibold">Time</TableHead>
                        <TableHead className="font-semibold text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingPayments ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : paymentsData?.payments?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                            No approved payments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paymentsData?.payments?.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-muted/30">
                            <TableCell className="font-mono font-medium text-xs">{payment.txid}</TableCell>
                            <TableCell className="text-right font-mono font-medium">৳ {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">{payment.customer_mobile || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(payment.verified_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20 uppercase tracking-wide text-[10px]">
                                {payment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
