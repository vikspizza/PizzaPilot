import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { api, type User, type Order, type Pizza, type Review } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, Link } from "wouter";
import { Loader2, LogOut, Package, User as UserIcon, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    setIsLoadingUser(true);
    const u = api.getCurrentUser();
    setUser(u);
    if (u) {
      const n = (u && "name" in u ? u.name : (u as Record<string, unknown>)?.name);
      setEditName(typeof n === "string" ? n : "");
    }
    setIsLoadingUser(false);
    if (!u) {
      setLocation("/login");
      return;
    }
  }, [setLocation]);

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: () => user ? api.getOrders(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const { data: pizzas } = useQuery({
    queryKey: ["all-pizzas"],
    queryFn: api.getAllPizzas,
  });

  // Fetch reviews for all completed orders to check which ones have been reviewed
  const { data: allReviews } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => api.getReviews(),
    enabled: !!user,
  });

  const handleLogout = async () => {
    await api.logout();
    setLocation("/");
  };

  const userName = (user && "name" in user ? user.name : (user as Record<string, unknown>)?.name) ?? "";
  const needsName = !String(userName).trim() || String(userName).trim() === "Valued Customer";

  const handleSaveName = async () => {
    const name = editName.trim();
    if (!name) {
      toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    setIsSavingName(true);
    try {
      const updated = await api.updateUser(user.id, { name });
      setUser(updated);
      window.dispatchEvent(new CustomEvent("user-login"));
      toast({ title: "Profile updated", description: "Your name has been saved." });
      setTimeout(() => setLocation("/"), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save name.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSavingName(false);
    }
  };

  if (isLoadingUser || !user) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold">My Profile</h1>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>

        {needsName && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Complete your profile</CardTitle>
              <CardDescription>Add your name so we know who you are.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="profile-name">Your name</Label>
                <Input
                  id="profile-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Alex"
                />
              </div>
              <Button onClick={handleSaveName} disabled={isSavingName || !editName.trim()}>
                {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 h-fit">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.avatarUrl} />
                  <AvatarFallback className="text-2xl">{userName?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
              </div>
              <CardTitle>{userName || "Add your name"}</CardTitle>
              <CardDescription>{user.email || user.phone}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name-edit">Your name</Label>
                <div className="flex gap-2">
                  <Input
                    id="profile-name-edit"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your name"
                  />
                  <Button variant="outline" size="sm" onClick={handleSaveName} disabled={isSavingName || !editName.trim() || editName.trim() === userName}>
                    {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium">Feb 2025</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                   <span className="text-muted-foreground">Total Orders</span>
                   <span className="font-medium">{orders?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" /> Order History
              </CardTitle>
              <CardDescription>View your past experiments.</CardDescription>
            </CardHeader>
            <CardContent>
              {!orders || orders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No orders yet. Time to instantiate some pizza!
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => {
                    const pizza = pizzas?.find(p => p.id === order.pizzaId);
                    const hasReview = allReviews?.some(r => r.orderId === order.id);
                    const canReview = (order.status === "completed" || order.status === "delivered") && !hasReview;
                    return (
                      <div key={order.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card/50">
                        <div className="h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                           {pizza ? (
                             <img src={pizza.imageUrl} alt={pizza.name} className="h-full w-full object-cover" />
                           ) : (
                             <div className="h-full w-full bg-muted" />
                           )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                             <h4 className="font-bold font-display truncate">{pizza?.name || "Unknown Pizza"}</h4>
                             <Badge variant={order.status === "completed" ? "secondary" : "default"}>
                               {order.status}
                             </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Ordered on {new Date(order.date).toLocaleDateString()} at {order.timeSlot}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                             <Badge variant="outline" className="uppercase text-[10px]">{order.type}</Badge>
                             <span>•</span>
                             <span>Qty: {order.quantity}</span>
                             <span>•</span>
                             <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
                          </div>
                          {canReview && (
                            <Link href={`/review/${order.id}`}>
                              <Button variant="outline" size="sm" className="gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Leave Review
                              </Button>
                            </Link>
                          )}
                          {hasReview && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ Reviewed
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
