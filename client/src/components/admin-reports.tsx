import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Download, Loader2 } from "lucide-react";
import { api, type Batch, type Order } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { comparePickupTime, formatPickupTime, todayPacificDateString } from "@/lib/pacific-time";
import { downloadPdf } from "@/lib/report-pdf";

function formatBatchServiceDate(serviceDate: string): string {
  const [year, month, day] = serviceDate.split("-").map(Number);
  if ([year, month, day].some((n) => Number.isNaN(n))) {
    return serviceDate;
  }
  return format(new Date(year, month - 1, day), "EEE, MMM d, yyyy");
}

function formatBatchOptionLabel(batch: Batch): string {
  if (batch.batchNumber > 0) {
    return `Batch #${batch.batchNumber} — ${formatBatchServiceDate(batch.serviceDate)}`;
  }
  return `Batch — ${formatBatchServiceDate(batch.serviceDate)}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone || "—";
}

function pickupLabel(order: Order): string {
  return order.pickupSlot?.pickupTime ? formatPickupTime(order.pickupSlot.pickupTime) : "—";
}

function isSessionExpired(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("session expired");
}

export function AdminReports({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
  });

  const { data: batches, isLoading: batchesLoading, error: batchesError } = useQuery({
    queryKey: ["batches"],
    queryFn: api.getBatches,
  });

  const {
    data: frequentCustomers,
    isLoading: frequentLoading,
    error: frequentError,
  } = useQuery({
    queryKey: ["reports", "frequent-customers"],
    queryFn: () => api.getFrequentCustomers(),
    retry: false,
  });

  useEffect(() => {
    if (isSessionExpired(ordersError) || isSessionExpired(frequentError)) {
      onSessionExpired();
    }
  }, [ordersError, frequentError, onSessionExpired]);

  const sortedBatches = useMemo(() => {
    if (!batches) return [];
    return [...batches].sort((a, b) => {
      if (a.serviceDate === b.serviceDate) {
        return b.batchNumber - a.batchNumber;
      }
      return b.serviceDate.localeCompare(a.serviceDate);
    });
  }, [batches]);

  useEffect(() => {
    if (sortedBatches.length === 0) {
      return;
    }
    if (selectedBatchId && sortedBatches.some((batch) => batch.id === selectedBatchId)) {
      return;
    }
    const today = todayPacificDateString();
    const upcoming = [...sortedBatches]
      .filter((batch) => batch.serviceDate >= today)
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.batchNumber - b.batchNumber)[0];
    setSelectedBatchId((upcoming ?? sortedBatches[0]).id);
  }, [sortedBatches, selectedBatchId]);

  const selectedBatch = sortedBatches.find((batch) => batch.id === selectedBatchId);

  const batchOrders = useMemo(() => {
    if (!orders || !selectedBatchId) {
      return [];
    }
    return orders
      .filter((order) => order.batchId === selectedBatchId && order.status !== "cancelled")
      .sort((a, b) => {
        const byTime = comparePickupTime(
          a.pickupSlot?.pickupTime ?? "",
          b.pickupSlot?.pickupTime ?? "",
        );
        if (byTime !== 0) {
          return byTime;
        }
        return (a.customer?.name ?? "").localeCompare(b.customer?.name ?? "");
      });
  }, [orders, selectedBatchId]);

  const copyBatchOrders = async () => {
    const header = selectedBatch ? formatBatchOptionLabel(selectedBatch) : "Batch orders";
    const lines = batchOrders.map((order) =>
      [pickupLabel(order), order.customer?.name ?? "—", formatPhone(order.customer?.phone ?? "")].join(
        "\t",
      ),
    );
    await copyLines(toast, [header, "Pickup time\tCustomer\tPhone", ...lines].join("\n"));
  };

  const copyThrottledCustomers = async () => {
    const customers = frequentCustomers?.customers ?? [];
    const lines = customers.map((customer) =>
      [customer.name, formatPhone(customer.phone), String(customer.orderCount)].join("\t"),
    );
    await copyLines(toast, ["Customer\tPhone\tOrders", ...lines].join("\n"));
  };

  const downloadBatchOrdersPdf = async () => {
    const title = selectedBatch ? formatBatchOptionLabel(selectedBatch) : "Batch orders";
    const filename = selectedBatch
      ? `batch-${selectedBatch.batchNumber || "orders"}-${selectedBatch.serviceDate}-orders.pdf`
      : "batch-orders.pdf";
    try {
      await downloadPdf({
        title,
        subtitle: "Pickup time, customer name, and phone. Cancelled orders are left off.",
        filename,
        head: ["Pickup time", "Customer", "Phone"],
        body: batchOrders.map((order) => [
          pickupLabel(order),
          order.customer?.name ?? "—",
          formatPhone(order.customer?.phone ?? ""),
        ]),
      });
    } catch (error) {
      toast({
        title: "Could not download PDF",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const downloadThrottledCustomersPdf = async () => {
    const customers = frequentCustomers?.customers ?? [];
    try {
      await downloadPdf({
        title: "Customers who will be throttled",
        subtitle: `At least ${threshold} orders in the last ${lookbackBatches} batches, not counting cancelled orders. Signup asks them to wait for the first ${priorityWindowMinutes} minutes after a batch opens. An invite code still lets them order during that window.`,
        filename: "throttled-customers.pdf",
        head: ["Customer", "Phone", "Orders"],
        body: customers.map((customer) => [
          customer.name,
          formatPhone(customer.phone),
          String(customer.orderCount),
        ]),
      });
    } catch (error) {
      toast({
        title: "Could not download PDF",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const threshold = frequentCustomers?.threshold ?? 3;
  const lookbackBatches = frequentCustomers?.lookbackBatches ?? 6;
  const priorityWindowMinutes = frequentCustomers?.priorityWindowMinutes ?? 30;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between space-y-0">
          <div>
            <CardTitle>Batch order list</CardTitle>
            <CardDescription>
              Pickup time, customer name, and phone. Cancelled orders are left off.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto">
            <div className="flex w-full flex-col gap-2 sm:min-w-[18rem]">
              <Label htmlFor="reports-batch-filter" className="text-sm text-muted-foreground">
                Batch
              </Label>
              <Select
                value={selectedBatchId || undefined}
                onValueChange={setSelectedBatchId}
                disabled={batchesLoading || sortedBatches.length === 0}
              >
                <SelectTrigger id="reports-batch-filter">
                  <SelectValue
                    placeholder={batchesLoading ? "Loading…" : "Select a batch"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {sortedBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {formatBatchOptionLabel(batch)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={batchOrders.length === 0}
                onClick={() => {
                  void copyBatchOrders();
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy list
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={batchOrders.length === 0}
                onClick={() => {
                  void downloadBatchOrdersPdf();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ordersError ? (
            <p className="text-destructive text-sm">
              {ordersError instanceof Error ? ordersError.message : "Failed to load orders."}
            </p>
          ) : batchesError ? (
            <p className="text-destructive text-sm">
              {batchesError instanceof Error ? batchesError.message : "Failed to load batches."}
            </p>
          ) : ordersLoading || batchesLoading ? (
            <Loader2 className="animate-spin" />
          ) : sortedBatches.length === 0 ? (
            <p className="text-muted-foreground">No batches yet.</p>
          ) : batchOrders.length === 0 ? (
            <p className="text-muted-foreground">No active orders for this batch.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {batchOrders.length} {batchOrders.length === 1 ? "order" : "orders"}
                {selectedBatch ? ` · ${formatBatchServiceDate(selectedBatch.serviceDate)}` : ""}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pickup time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{pickupLabel(order)}</TableCell>
                      <TableCell className="font-medium">{order.customer?.name ?? "—"}</TableCell>
                      <TableCell>{formatPhone(order.customer?.phone ?? "")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between space-y-0">
          <div>
            <CardTitle>Customers who will be throttled</CardTitle>
            <CardDescription>
              Customers with at least {threshold} orders in the last {lookbackBatches} batches, not
              counting cancelled orders. Signup asks them to wait for the first{" "}
              {priorityWindowMinutes} minutes after a batch opens. An invite code still lets them
              order during that window.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!frequentCustomers || frequentCustomers.customers.length === 0}
              onClick={() => {
                void copyThrottledCustomers();
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy list
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!frequentCustomers || frequentCustomers.customers.length === 0}
              onClick={() => {
                void downloadThrottledCustomersPdf();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {frequentError ? (
            <p className="text-destructive text-sm">
              {frequentError instanceof Error
                ? frequentError.message
                : "Failed to load throttled customers."}
            </p>
          ) : frequentLoading ? (
            <Loader2 className="animate-spin" />
          ) : !frequentCustomers?.customers.length ? (
            <p className="text-muted-foreground">No customers are at the throttle threshold.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {frequentCustomers.customers.length}{" "}
                {frequentCustomers.customers.length === 1 ? "customer" : "customers"}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Orders</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frequentCustomers.customers.map((customer) => (
                    <TableRow key={customer.customerId}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{formatPhone(customer.phone)}</TableCell>
                      <TableCell>{customer.orderCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function copyLines(
  toast: ReturnType<typeof useToast>["toast"],
  text: string,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "List copied" });
  } catch {
    toast({
      title: "Could not copy",
      description: "Copy the table from the page instead.",
      variant: "destructive",
    });
  }
}
