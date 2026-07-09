// Real API client - replaces mock-api.ts

import {
  adminAuthHeaders,
  clearAdminToken,
  hasAdminToken,
  setAdminToken,
} from "./admin-session";

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...adminAuthHeaders(),
  };
}

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
  customerId: string;
  customer?: Customer;
  batchId?: string;
  pizzaId: string;
  quantity: number;
  type: "pickup" | "delivery";
  date: string;
  slotId: string;
  pickupSlot?: PickupSlot;
  status: "pending" | "confirmed" | "cooking" | "ready" | "delivered" | "completed" | "cancelled";
  createdAt: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  batchNumber: number;
  serviceDate: string;
  slotListId?: string | null;
  serviceStartHour: number;
  serviceEndHour: number;
  createdAt: string;
}

export interface BatchPizza {
  id: string;
  batchId: string;
  pizzaId: string;
  maxQuantity: number;
  available?: number;
  createdAt: string;
  pizza?: Pizza;
}

export interface SlotList {
  slotListId: string;
  slotListName: string;
  activeYorn: boolean;
  createdAt: string;
}

export interface PickupSlot {
  slotId: string;
  slotListId: string;
  pickupTime: string;
  createdAt: string;
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
  adminLogin: async (password: string): Promise<void> => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Invalid password");
    }

    const { token } = await res.json();
    setAdminToken(token);
  },

  adminLogout: (): void => {
    clearAdminToken();
  },

  hasAdminSession: (): boolean => hasAdminToken(),

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
      headers: jsonHeaders(),
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
      headers: jsonHeaders(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  },

  // Orders
  getOrders: async (phone?: string): Promise<Order[]> => {
    const url = phone ? `/api/orders?phone=${encodeURIComponent(phone)}` : "/api/orders";
    const res = await fetch(url, {
      headers: phone ? undefined : adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch orders");
    return res.json();
  },

  createOrder: async (
    order: {
      pizzaId: string;
      batchId?: string;
      quantity: number;
      type: "pickup" | "delivery";
      date: string;
      slotId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    },
  ): Promise<Order> => {
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
      headers: jsonHeaders(),
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

  getPendingReviews: async (phone: string): Promise<Order[]> => {
    const res = await fetch(`/api/reviews/pending?phone=${encodeURIComponent(phone)}`);
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
      headers: jsonHeaders(),
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
      headers: jsonHeaders(),
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
      headers: adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete batch");
  },

  createBatchPizza: async (batchId: string, batchPizza: Omit<BatchPizza, "id" | "batchId" | "createdAt">): Promise<BatchPizza> => {
    const res = await fetch(`/api/batches/${batchId}/pizzas`, {
      method: "POST",
      headers: jsonHeaders(),
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
      headers: jsonHeaders(),
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
      headers: adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete batch pizza");
  },

  getBatchAvailability: async (batchId: string, pizzaId: string): Promise<{ available: number }> => {
    const res = await fetch(`/api/batches/${batchId}/availability/${pizzaId}`);
    if (!res.ok) throw new Error("Failed to fetch availability");
    return res.json();
  },

  getBookedSlotIds: async (batchId: string): Promise<string[]> => {
    const res = await fetch(`/api/batches/${batchId}/booked-slots`);
    if (!res.ok) throw new Error("Failed to fetch booked slots");
    const data = await res.json();
    return data.bookedSlotIds ?? [];
  },

  getNextBatch: async (): Promise<Batch | null> => {
    const res = await fetch("/api/batches/next");
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error("Failed to fetch next batch");
    }
    return res.json();
  },

  // Slot lists
  getActivePickupSlots: async (): Promise<PickupSlot[]> => {
    const res = await fetch("/api/pickup-slots");
    if (!res.ok) throw new Error("Failed to fetch pickup slots");
    return res.json();
  },

  getSlotLists: async (): Promise<SlotList[]> => {
    const res = await fetch("/api/slot-lists", {
      headers: adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch slot lists");
    return res.json();
  },

  createSlotList: async (slotList: Omit<SlotList, "slotListId" | "createdAt">): Promise<SlotList> => {
    const res = await fetch("/api/slot-lists", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(slotList),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create slot list");
    }
    return res.json();
  },

  updateSlotList: async (
    id: string,
    slotList: Partial<Omit<SlotList, "slotListId" | "createdAt">>,
  ): Promise<SlotList> => {
    const res = await fetch(`/api/slot-lists/${id}`, {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify(slotList),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to update slot list");
    }
    return res.json();
  },

  deleteSlotList: async (id: string): Promise<void> => {
    const res = await fetch(`/api/slot-lists/${id}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete slot list");
  },

  getPickupSlots: async (slotListId: string): Promise<PickupSlot[]> => {
    const res = await fetch(`/api/slot-lists/${slotListId}/slots`);
    if (!res.ok) throw new Error("Failed to fetch pickup slots");
    return res.json();
  },

  createPickupSlot: async (
    slotListId: string,
    pickupSlot: { pickupTime: string },
  ): Promise<PickupSlot> => {
    const res = await fetch(`/api/slot-lists/${slotListId}/slots`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(pickupSlot),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create pickup slot");
    }
    return res.json();
  },

  deletePickupSlot: async (slotListId: string, slotId: string): Promise<void> => {
    const res = await fetch(`/api/slot-lists/${slotListId}/slots/${slotId}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete pickup slot");
  },
};
