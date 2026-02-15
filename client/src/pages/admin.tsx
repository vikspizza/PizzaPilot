import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Pizza, type Order, type Batch, type BatchPizza } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Lock, Check, X, ChefHat, Package, Truck, XCircle, Plus, Edit, Trash2, Calendar, Clock } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin") {
      setIsAuthenticated(true);
    } else {
      alert("Wrong password. (Hint: admin)");
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" /> Kitchen Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Enter access code"
                  />
                </div>
                <Button type="submit" className="w-full">Enter Kitchen</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.getOrders(),
  });

  const { data: pizzas, isLoading: pizzasLoading, error: pizzasError } = useQuery({
    queryKey: ["pizzas", "all"],
    queryFn: api.getAllPizzas,
  });

  const updatePizzaMutation = useMutation({
    mutationFn: ({ id, pizza }: { id: string; pizza: Partial<Pizza> }) => 
      api.updatePizza(id, pizza),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pizzas"] });
      queryClient.invalidateQueries({ queryKey: ["pizzas", "all"] });
      toast({ title: "Menu Updated" });
    },
  });

  const togglePizzaActive = (pizza: Pizza) => {
    updatePizzaMutation.mutate({ 
      id: pizza.id, 
      pizza: { active: !pizza.active }
    });
  };

  const togglePizzaSoldOut = (pizza: Pizza) => {
    updatePizzaMutation.mutate({ 
      id: pizza.id, 
      pizza: { soldOut: !pizza.soldOut }
    });
  };

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order Updated", description: "Status updated and customer notified." });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to update order",
        variant: "destructive" 
      });
    },
  });

  const getNextStatus = (currentStatus: Order["status"]): Order["status"] | null => {
    switch (currentStatus) {
      case "pending":
      case "confirmed":
        return "cooking";
      case "cooking":
        return "ready";
      case "ready":
        return "delivered";
      case "delivered":
        return "completed";
      default:
        return null;
    }
  };

  const canTransition = (status: Order["status"]): boolean => {
    return ["pending", "confirmed", "cooking", "ready", "delivered"].includes(status);
  };

  const canCancel = (status: Order["status"]): boolean => {
    return !["completed", "cancelled"].includes(status);
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-display font-bold">Kitchen Dashboard</h1>
          <Badge variant="outline" className="px-3 py-1 text-sm font-mono">
            ADMIN MODE
          </Badge>
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="mb-4">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="menu">Menu Management</TabsTrigger>
            <TabsTrigger value="batches">Batch Management</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <Loader2 className="animate-spin" />
                ) : orders?.length === 0 ? (
                  <p className="text-muted-foreground">No orders yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.map((order) => {
                        const nextStatus = getNextStatus(order.status);
                        const canTransitionOrder = canTransition(order.status);
                        const canCancelOrder = canCancel(order.status);
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">{order.id}</TableCell>
                            <TableCell>
                              <div className="font-medium">{order.customerName}</div>
                              <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                            </TableCell>
                            <TableCell>
                              {pizzas?.find(p => p.id === order.pizzaId)?.name} x{order.quantity}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{order.date}</div>
                              <div className="text-xs text-muted-foreground">{order.timeSlot}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">{order.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  order.status === 'confirmed' || order.status === 'cooking' || order.status === 'ready' 
                                    ? 'default' 
                                    : order.status === 'completed'
                                    ? 'default'
                                    : order.status === 'cancelled'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="capitalize"
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {canTransitionOrder && nextStatus && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: nextStatus })}
                                    disabled={updateOrderStatusMutation.isPending}
                                    className="text-xs"
                                  >
                                    {nextStatus === "cooking" && <ChefHat className="w-3 h-3 mr-1" />}
                                    {nextStatus === "ready" && <Package className="w-3 h-3 mr-1" />}
                                    {nextStatus === "delivered" && <Truck className="w-3 h-3 mr-1" />}
                                    {nextStatus === "completed" && <Check className="w-3 h-3 mr-1" />}
                                    {nextStatus === "cooking" && "Start Cooking"}
                                    {nextStatus === "ready" && "Mark Ready"}
                                    {nextStatus === "delivered" && "Mark Delivered"}
                                    {nextStatus === "completed" && "Complete"}
                                  </Button>
                                )}
                                {canCancelOrder && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm(`Cancel order ${order.id}?`)) {
                                        updateOrderStatusMutation.mutate({ id: order.id, status: "cancelled" });
                                      }
                                    }}
                                    disabled={updateOrderStatusMutation.isPending}
                                    className="text-xs"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="menu">
            <div className="grid gap-4">
              {pizzasLoading ? (
                <Loader2 className="animate-spin" />
              ) : pizzasError ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-destructive">Error loading pizzas: {pizzasError instanceof Error ? pizzasError.message : "Unknown error"}</p>
                  </CardContent>
                </Card>
              ) : pizzas && pizzas.length > 0 ? (
                pizzas.map((pizza) => (
                  <Card key={pizza.id} className={`overflow-hidden transition-opacity ${!pizza.active ? 'opacity-50' : ''} ${pizza.soldOut && pizza.active ? 'border-destructive/30' : ''}`}>
                    <div className="flex items-center p-4 gap-4">
                      <div className={`h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0 ${!pizza.active ? 'grayscale' : ''} ${pizza.soldOut && pizza.active ? 'opacity-70' : ''}`}>
                        {pizza.imageUrl ? (
                          <img 
                            src={pizza.imageUrl} 
                            alt={pizza.name} 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              console.error("Failed to load pizza image:", pizza.name, pizza.imageUrl);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold font-display text-lg ${!pizza.active ? 'text-muted-foreground' : ''}`}>{pizza.name}</h3>
                            {pizza.soldOut && pizza.active && (
                              <Badge variant="destructive" className="text-[10px]">SOLD OUT</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`active-${pizza.id}`} className="text-xs text-muted-foreground">
                                {pizza.active ? "Active" : "Inactive"}
                              </Label>
                              <Switch 
                                id={`active-${pizza.id}`}
                                checked={pizza.active}
                                onCheckedChange={() => togglePizzaActive(pizza)}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`soldout-${pizza.id}`} className="text-xs text-muted-foreground">
                                {pizza.soldOut ? "Sold Out" : "Available"}
                              </Label>
                              <Switch 
                                id={`soldout-${pizza.id}`}
                                checked={pizza.soldOut}
                                onCheckedChange={() => togglePizzaSoldOut(pizza)}
                              />
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{pizza.description}</p>
                        <div className="flex gap-2 mt-2">
                           {pizza.tags.map(tag => (
                             <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                           ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No pizzas found. Add pizzas to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="batches">
            <BatchManagement pizzas={pizzas || []} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

const BATCHES_PER_PAGE = 10;

function BatchManagement({ pizzas }: { pizzas: Pizza[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: api.getBatches,
  });

  const { data: batchPizzas, isLoading: batchPizzasLoading } = useQuery({
    queryKey: ["batchPizzas", selectedBatch?.id],
    queryFn: () => selectedBatch ? api.getBatchPizzas(selectedBatch.id) : Promise.resolve([]),
    enabled: !!selectedBatch,
  });

  const createBatchMutation = useMutation({
    mutationFn: api.createBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Batch Created", description: "Batch has been created successfully." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create batch",
        variant: "destructive",
      });
    },
  });

  const updateBatchMutation = useMutation({
    mutationFn: ({ id, batch }: { id: string; batch: Partial<Batch> }) =>
      api.updateBatch(id, batch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setEditingBatch(null);
      toast({ title: "Batch Updated", description: "Batch has been updated successfully." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update batch",
        variant: "destructive",
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: api.deleteBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setSelectedBatch(null);
      toast({ title: "Batch Deleted", description: "Batch has been deleted successfully." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete batch",
        variant: "destructive",
      });
    },
  });

  const createBatchPizzaMutation = useMutation({
    mutationFn: ({ batchId, batchPizza }: { batchId: string; batchPizza: Omit<BatchPizza, "id" | "batchId" | "createdAt"> }) =>
      api.createBatchPizza(batchId, batchPizza),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batchPizzas"] });
      toast({ title: "Pizza Added", description: "Pizza has been added to batch." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add pizza",
        variant: "destructive",
      });
    },
  });

  const updateBatchPizzaMutation = useMutation({
    mutationFn: ({ batchId, pizzaId, batchPizza }: { batchId: string; pizzaId: string; batchPizza: Partial<Omit<BatchPizza, "id" | "batchId" | "pizzaId" | "createdAt">> }) =>
      api.updateBatchPizza(batchId, pizzaId, batchPizza),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batchPizzas"] });
      toast({ title: "Pizza Updated", description: "Pizza quantity has been updated." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update pizza",
        variant: "destructive",
      });
    },
  });

  const deleteBatchPizzaMutation = useMutation({
    mutationFn: ({ batchId, pizzaId }: { batchId: string; pizzaId: string }) =>
      api.deleteBatchPizza(batchId, pizzaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batchPizzas"] });
      toast({ title: "Pizza Removed", description: "Pizza has been removed from batch." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove pizza",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold">Batch Management</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage batches for service dates
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Batch
        </Button>
      </div>

      {batchesLoading ? (
        <Loader2 className="animate-spin" />
      ) : batches?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No batches yet. Create your first batch to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(() => {
            const sortedBatches = [...(batches || [])].sort((a, b) => b.batchNumber - a.batchNumber);
            const totalPages = Math.ceil(sortedBatches.length / BATCHES_PER_PAGE);
            const startIdx = (currentPage - 1) * BATCHES_PER_PAGE;
            const paginatedBatches = sortedBatches.slice(startIdx, startIdx + BATCHES_PER_PAGE);
            return (
              <>
                <div className="grid gap-4">
                  {paginatedBatches.map((batch) => (
            <Card key={batch.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Batch #{batch.batchNumber}
                      {selectedBatch?.id === batch.id && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {(() => {
                          // Parse date string as local date to avoid timezone issues
                          const [year, month, day] = batch.serviceDate.split("-").map(Number);
                          return format(new Date(year, month - 1, day), "MMM d, yyyy");
                        })()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {batch.serviceStartHour}:00 - {batch.serviceEndHour}:00
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBatch(selectedBatch?.id === batch.id ? null : batch)}
                    >
                      {selectedBatch?.id === batch.id ? "Hide" : "View"} Pizzas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingBatch(batch)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete Batch #${batch.batchNumber}? This will also remove all pizzas from this batch.`)) {
                          deleteBatchMutation.mutate(batch.id);
                        }
                      }}
                      disabled={deleteBatchMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {selectedBatch?.id === batch.id && (
                <CardContent>
                  <BatchPizzasList
                    batch={batch}
                    pizzas={pizzas}
                    batchPizzas={batchPizzas || []}
                    isLoading={batchPizzasLoading}
                    onAddPizza={(pizzaId, maxQuantity) =>
                      createBatchPizzaMutation.mutate({
                        batchId: batch.id,
                        batchPizza: { pizzaId, maxQuantity },
                      })
                    }
                    onUpdatePizza={(pizzaId, maxQuantity) =>
                      updateBatchPizzaMutation.mutate({
                        batchId: batch.id,
                        pizzaId,
                        batchPizza: { maxQuantity },
                      })
                    }
                    onDeletePizza={(pizzaId) =>
                      deleteBatchPizzaMutation.mutate({
                        batchId: batch.id,
                        pizzaId,
                      })
                    }
                  />
                </CardContent>
              )}
            </Card>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-col items-center gap-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {startIdx + 1}-{Math.min(startIdx + BATCHES_PER_PAGE, sortedBatches.length)} of {sortedBatches.length} batches
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((p) => Math.max(1, p - 1));
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((p) => Math.min(totalPages, p + 1));
                            }}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <CreateBatchDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={(batch) => createBatchMutation.mutate(batch)}
        isLoading={createBatchMutation.isPending}
      />

      {editingBatch && (
        <EditBatchDialog
          batch={editingBatch}
          onClose={() => setEditingBatch(null)}
          onUpdate={(updates) => updateBatchMutation.mutate({ id: editingBatch.id, batch: updates })}
          isLoading={updateBatchMutation.isPending}
        />
      )}
    </div>
  );
}

function BatchPizzasList({
  batch,
  pizzas,
  batchPizzas,
  isLoading,
  onAddPizza,
  onUpdatePizza,
  onDeletePizza,
}: {
  batch: Batch;
  pizzas: Pizza[];
  batchPizzas: (BatchPizza & { pizza?: Pizza })[];
  isLoading: boolean;
  onAddPizza: (pizzaId: string, maxQuantity: number) => void;
  onUpdatePizza: (pizzaId: string, maxQuantity: number) => void;
  onDeletePizza: (pizzaId: string) => void;
}) {
  const [isAddingPizza, setIsAddingPizza] = useState(false);
  const [selectedPizzaId, setSelectedPizzaId] = useState("");
  const [maxQuantity, setMaxQuantity] = useState(10);

  const availablePizzas = pizzas.filter(
    (p) => p.active && !batchPizzas.some((bp) => bp.pizzaId === p.id)
  );

  const handleAddPizza = () => {
    if (selectedPizzaId && maxQuantity > 0) {
      onAddPizza(selectedPizzaId, maxQuantity);
      setIsAddingPizza(false);
      setSelectedPizzaId("");
      setMaxQuantity(10);
    }
  };

  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Pizzas in Batch</h3>
        {availablePizzas.length > 0 && (
          <Button size="sm" onClick={() => setIsAddingPizza(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Pizza
          </Button>
        )}
      </div>

      {isAddingPizza && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Pizza</Label>
              <Select value={selectedPizzaId} onValueChange={setSelectedPizzaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a pizza" />
                </SelectTrigger>
                <SelectContent>
                  {availablePizzas.map((pizza) => (
                    <SelectItem key={pizza.id} value={pizza.id}>
                      {pizza.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Quantity</Label>
              <Input
                type="number"
                min="1"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddPizza} disabled={!selectedPizzaId || maxQuantity <= 0}>
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsAddingPizza(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {batchPizzas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pizzas added to this batch yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pizza</TableHead>
              <TableHead>Max Quantity</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchPizzas.map((bp) => {
              const pizza = bp.pizza || pizzas.find((p) => p.id === bp.pizzaId);
              return (
                <BatchPizzaRow
                  key={bp.id}
                  batchPizza={bp}
                  pizza={pizza}
                  batch={batch}
                  onUpdate={onUpdatePizza}
                  onDelete={onDeletePizza}
                />
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function BatchPizzaRow({
  batchPizza,
  pizza,
  batch,
  onUpdate,
  onDelete,
}: {
  batchPizza: BatchPizza;
  pizza?: Pizza;
  batch: Batch;
  onUpdate: (pizzaId: string, maxQuantity: number) => void;
  onDelete: (pizzaId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [maxQuantity, setMaxQuantity] = useState(batchPizza.maxQuantity);
  const { data: availability } = useQuery({
    queryKey: ["availability", batch.id, batchPizza.pizzaId],
    queryFn: () => api.getBatchAvailability(batch.id, batchPizza.pizzaId),
  });

  const handleUpdate = () => {
    if (maxQuantity > 0 && maxQuantity !== batchPizza.maxQuantity) {
      onUpdate(batchPizza.pizzaId, maxQuantity);
      setIsEditing(false);
    }
  };

  if (!pizza) return null;

  return (
    <TableRow>
      <TableCell className="font-medium">{pizza.name}</TableCell>
      <TableCell>
        {isEditing ? (
          <Input
            type="number"
            min="1"
            value={maxQuantity}
            onChange={(e) => setMaxQuantity(parseInt(e.target.value) || 0)}
            className="w-20"
          />
        ) : (
          batchPizza.maxQuantity
        )}
      </TableCell>
      <TableCell>
        <Badge variant={availability && availability.available > 0 ? "default" : "destructive"}>
          {availability ? `${availability.available} available` : "Loading..."}
        </Badge>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpdate}>
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Remove ${pizza.name} from this batch?`)) {
                  onDelete(batchPizza.pizzaId);
                }
              }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function CreateBatchDialog({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (batch: Omit<Batch, "id" | "createdAt">) => void;
  isLoading: boolean;
}) {
  const [batchNumber, setBatchNumber] = useState(1);
  const [serviceDate, setServiceDate] = useState("");
  const [serviceStartHour, setServiceStartHour] = useState(16);
  const [serviceEndHour, setServiceEndHour] = useState(20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      batchNumber,
      serviceDate,
      serviceStartHour,
      serviceEndHour,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
          <DialogDescription>
            Define a new batch with service date and hours
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Number</Label>
            <Input
              type="number"
              min="1"
              value={batchNumber}
              onChange={(e) => setBatchNumber(parseInt(e.target.value) || 1)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Service Date</Label>
            <Input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Hour (24h)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={serviceStartHour}
                onChange={(e) => setServiceStartHour(parseInt(e.target.value) || 16)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Hour (24h)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={serviceEndHour}
                onChange={(e) => setServiceEndHour(parseInt(e.target.value) || 20)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditBatchDialog({
  batch,
  onClose,
  onUpdate,
  isLoading,
}: {
  batch: Batch;
  onClose: () => void;
  onUpdate: (updates: Partial<Omit<Batch, "id" | "createdAt">>) => void;
  isLoading: boolean;
}) {
  const [serviceDate, setServiceDate] = useState(batch.serviceDate);
  const [serviceStartHour, setServiceStartHour] = useState(batch.serviceStartHour);
  const [serviceEndHour, setServiceEndHour] = useState(batch.serviceEndHour);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      serviceDate,
      serviceStartHour,
      serviceEndHour,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Batch #{batch.batchNumber}</DialogTitle>
          <DialogDescription>
            Update batch service date and hours
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Service Date</Label>
            <Input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Hour (24h)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={serviceStartHour}
                onChange={(e) => setServiceStartHour(parseInt(e.target.value) || 16)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>End Hour (24h)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={serviceEndHour}
                onChange={(e) => setServiceEndHour(parseInt(e.target.value) || 20)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
