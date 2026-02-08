// Real API client - replaces mock-api.ts

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Pizza {
  id: string;
  name: string;
  description: string;
  tags: string[];
  imageUrl?: string;
  active: boolean;
  soldOut: boolean;
  price: string;
  batchId?: string;
  batchNumber?: number;
  serviceDate?: string;
}

export interface Order {
  id: string;
  userId?: string;
  batchId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pizzaId: string;
  quantity: number;
  type: "pickup" | "delivery";
  date: string;
  timeSlot: string;
  status: "pending" | "confirmed" | "cooking" | "ready" | "delivered" | "completed" | "cancelled";
  createdAt: string;
}

export interface Batch {
  id: string;
  batchNumber: number;
  serviceDate: string;
  serviceStartHour: number;
  serviceEndHour: number;
  createdAt: string;
}

export interface BatchPizza {
  id: string;
  batchId: string;
  pizzaId: string;
  maxQuantity: number;
  createdAt: string;
  pizza?: Pizza;
}

export interface Review {
  id: string;
  orderId: string;
  pizzaId: string;
  rating: number; // Keep for backward compatibility
  comment: string; // Keep for backward compatibility, now stores additionalThoughts
  author: string;
  overallRating?: string;
  fairPrice?: string;
  customPriceAmount?: string;
  crustFlavor?: string;
  crustQuality?: string;
  toppingsBalance?: string;
  wouldOrderAgain?: string;
  createdAt: string;
}

export interface Settings {
  id: number;
  maxPiesPerDay: number;
  serviceDays: number[];
  serviceStartHour: number;
  serviceEndHour: number;
}

const STORAGE_KEYS = {
  CURRENT_USER: "tk_current_user",
};

function getStorage<T>(key: string, defaultVal: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultVal;
  }
}

function setStorage<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val));
}

export const api = {
  // User Auth
  getCurrentUser: (): User | null => {
    return getStorage(STORAGE_KEYS.CURRENT_USER, null);
  },

  sendOtp: async (phone: string): Promise<void> => {
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) throw new Error("Failed to send OTP");
  },

  verifyOtp: async (phone: string, code: string): Promise<User> => {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    if (!res.ok) throw new Error("Invalid code");
    const data = await res.json();
    setStorage(STORAGE_KEYS.CURRENT_USER, data.user);
    return data.user;
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update user");
    const user = await res.json();
    setStorage(STORAGE_KEYS.CURRENT_USER, user);
    return user;
  },

  // Pizzas
  getPizzas: async (batchId?: string, batchNumber?: number): Promise<{ pizzas: Pizza[], currentBatch: { id: string, batchNumber: number, serviceDate: string } | null, nextBatch: { id: string, batchNumber: number, serviceDate: string } | null }> => {
    let url = "/api/pizzas";
    if (batchId) {
      url += `?batchId=${batchId}`;
    } else if (batchNumber) {
      url += `?batchNumber=${batchNumber}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch pizzas");
    return res.json();
  },

  getAllPizzas: async (): Promise<Pizza[]> => {
    const res = await fetch("/api/pizzas/all");
    if (!res.ok) throw new Error("Failed to fetch pizzas");
    return res.json();
  },

  getPastExperiments: async (): Promise<Array<Pizza & { offerCount: number }>> => {
    const res = await fetch("/api/pizzas/past-experiments");
    if (!res.ok) throw new Error("Failed to fetch past experiments");
    return res.json();
  },

  updatePizza: async (id: string, pizza: Partial<Pizza>): Promise<Pizza> => {
    const res = await fetch(`/api/pizzas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pizza),
    });
    if (!res.ok) throw new Error("Failed to update pizza");
    return res.json();
  },

  // Settings
  getSettings: async (): Promise<Settings> => {
    const res = await fetch("/api/settings");
    if (!res.ok) throw new Error("Failed to fetch settings");
    return res.json();
  },

  updateSettings: async (settings: Partial<Settings>): Promise<Settings> => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  },

  // Orders
  getOrders: async (userId?: string): Promise<Order[]> => {
    const url = userId ? `/api/orders?userId=${userId}` : "/api/orders";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch orders");
    return res.json();
  },

  createOrder: async (order: Omit<Order, "id" | "createdAt" | "status">): Promise<Order> => {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create order");
    }
    return res.json();
  },

  updateOrderStatus: async (id: string, status: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update order");
    return res.json();
  },

  // Reviews
  getReviews: async (pizzaId?: string): Promise<Review[]> => {
    const url = pizzaId ? `/api/reviews?pizzaId=${pizzaId}` : "/api/reviews";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    return res.json();
  },

  getReviewByOrderId: async (orderId: string): Promise<Review | null> => {
    const res = await fetch(`/api/reviews?orderId=${orderId}`);
    if (!res.ok) throw new Error("Failed to fetch review");
    const reviews = await res.json();
    return reviews.find((r: Review) => r.orderId === orderId) || null;
  },

  getPendingReviews: async (userId: string): Promise<Order[]> => {
    const res = await fetch(`/api/reviews/pending?userId=${userId}`);
    if (!res.ok) throw new Error("Failed to fetch pending reviews");
    return res.json();
  },

  addReview: async (review: Omit<Review, "id" | "createdAt">): Promise<Review> => {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to add review");
    }
    return res.json();
  },

  // Order by ID
  getOrderById: async (orderId: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${orderId}`);
    if (!res.ok) throw new Error("Failed to fetch order");
    return res.json();
  },

  // Pizza by ID
  getPizzaById: async (pizzaId: string): Promise<Pizza> => {
    const allPizzas = await api.getAllPizzas();
    const pizza = allPizzas.find(p => p.id === pizzaId);
    if (!pizza) throw new Error("Pizza not found");
    return pizza;
  },

  // Batches
  getBatches: async (): Promise<Batch[]> => {
    const res = await fetch("/api/batches");
    if (!res.ok) throw new Error("Failed to fetch batches");
    return res.json();
  },

  getBatchById: async (id: string): Promise<Batch> => {
    const res = await fetch(`/api/batches/${id}`);
    if (!res.ok) throw new Error("Failed to fetch batch");
    return res.json();
  },

  getBatchPizzas: async (batchId: string): Promise<BatchPizza[]> => {
    const res = await fetch(`/api/batches/${batchId}/pizzas`);
    if (!res.ok) throw new Error("Failed to fetch batch pizzas");
    return res.json();
  },

  createBatch: async (batch: Omit<Batch, "id" | "createdAt">): Promise<Batch> => {
    const res = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create batch");
    }
    return res.json();
  },

  updateBatch: async (id: string, batch: Partial<Omit<Batch, "id" | "createdAt">>): Promise<Batch> => {
    const res = await fetch(`/api/batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update batch");
    }
    return res.json();
  },

  deleteBatch: async (id: string): Promise<void> => {
    const res = await fetch(`/api/batches/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete batch");
  },

  createBatchPizza: async (batchId: string, batchPizza: Omit<BatchPizza, "id" | "batchId" | "createdAt">): Promise<BatchPizza> => {
    const res = await fetch(`/api/batches/${batchId}/pizzas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPizza),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create batch pizza");
    }
    return res.json();
  },

  updateBatchPizza: async (batchId: string, pizzaId: string, batchPizza: Partial<Omit<BatchPizza, "id" | "batchId" | "pizzaId" | "createdAt">>): Promise<BatchPizza> => {
    const res = await fetch(`/api/batches/${batchId}/pizzas/${pizzaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPizza),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update batch pizza");
    }
    return res.json();
  },

  deleteBatchPizza: async (batchId: string, pizzaId: string): Promise<void> => {
    const res = await fetch(`/api/batches/${batchId}/pizzas/${pizzaId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete batch pizza");
  },

  getBatchAvailability: async (batchId: string, pizzaId: string): Promise<{ available: number }> => {
    const res = await fetch(`/api/batches/${batchId}/availability/${pizzaId}`);
    if (!res.ok) throw new Error("Failed to fetch availability");
    return res.json();
  },

  getNextBatch: async (): Promise<Batch | null> => {
    const res = await fetch("/api/batches/next");
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to fetch next batch");
    }
    return res.json();
  },
};
