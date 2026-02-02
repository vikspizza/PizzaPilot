import { z } from "zod";
import { PIZZA_IMAGES } from "./pizza-images";

// --- Types ---

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
}

export interface Pizza {
  id: string;
  name: string;
  description: string;
  tags: string[];
  imageUrl?: string; // We'll use the ID to look up the real imported image, or this as fallback
  active: boolean;
  price: number; // Added price (even if free/pay at pickup, we should show value)
}

export interface Order {
  id: string;
  userId?: string; // Link order to user
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pizzaId: string;
  quantity: number;
  type: "pickup" | "delivery";
  date: string; // ISO Date string (YYYY-MM-DD)
  timeSlot: string; // e.g., "16:00", "16:30"
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  pizzaId: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

export interface Settings {
  maxPiesPerDay: number;
  serviceDays: number[]; // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
  serviceStartHour: number; // 16 = 4PM
  serviceEndHour: number; // 20 = 8PM
}

// --- Mock Data ---

const DEFAULT_SETTINGS: Settings = {
  maxPiesPerDay: 15, // Small batch!
  serviceDays: [4, 5, 6], // Thu, Fri, Sat
  serviceStartHour: 16,
  serviceEndHour: 20,
};

const INITIAL_PIZZAS: Pizza[] = [
  {
    id: "3",
    name: "Truffle Shuffle",
    description: "Wild mushrooms, garlic confit, taleggio, mozzarella, white truffle oil, fresh rosemary.",
    tags: ["veg", "white pie", "rich"],
    imageUrl: PIZZA_IMAGES["3"],
    active: true,
    price: 24,
  },
  {
    id: "4",
    name: "CrustGPT",
    description: "Green tangy Pesto, Pecorino Romano, Tomatoes. Finished with Ricotta Lemon Honey drizzle and arugula greens.",
    tags: ["veg", "pesto", "fresh"],
    imageUrl: PIZZA_IMAGES["4"],
    active: true,
    price: 23,
  },
  {
    id: "5",
    name: "Señor Crustobal",
    description: "Taco chili oil, mozzerella, corn, yellow onions. Finished with cilantro, tangy sour cream, chipotle and lime drizzle, pico de gallo and avocado slices.",
    tags: ["fusion", "spicy", "loaded"],
    imageUrl: PIZZA_IMAGES["5"],
    active: true,
    price: 25,
  },
];

// --- LocalStorage Helpers ---

const STORAGE_KEYS = {
  PIZZAS: "tk_pizzas_v2",
  ORDERS: "tk_orders",
  REVIEWS: "tk_reviews",
  SETTINGS: "tk_settings",
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

// --- API Functions (Simulated) ---

export const api = {
  // User Auth (Mock)
  getCurrentUser: async (): Promise<User | null> => {
    return getStorage(STORAGE_KEYS.CURRENT_USER, null);
  },

  login: async (provider: "google" | "facebook" | "phone", data?: any): Promise<User> => {
    await delay(800);
    const mockUser: User = {
      id: "u_" + Math.random().toString(36).substr(2, 9),
      name: provider === "phone" ? "Valued Customer" : "Alex Dough",
      email: provider === "phone" ? "" : "alex@example.com",
      phone: provider === "phone" ? data?.phone : "555-0199",
      avatarUrl: provider === "google" ? "https://github.com/shadcn.png" : undefined,
    };
    setStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
    return mockUser;
  },

  sendOtp: async (phone: string): Promise<void> => {
    await delay(1000);
    // Simulate sending OTP
    console.log(`OTP sent to ${phone}`);
  },

  verifyOtp: async (phone: string, code: string): Promise<User> => {
    await delay(1000);
    // Simulate verification - accept any code for mockup
    if (code.length < 4) throw new Error("Invalid code");
    
    const mockUser: User = {
      id: "u_" + Math.random().toString(36).substr(2, 9),
      name: "Valued Customer",
      email: "",
      phone: phone,
    };
    setStorage(STORAGE_KEYS.CURRENT_USER, mockUser);
    return mockUser;
  },

  logout: async (): Promise<void> => {
    await delay(300);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  updateUser: async (user: User): Promise<User> => {
    await delay(400);
    setStorage(STORAGE_KEYS.CURRENT_USER, user);
    return user;
  },

  // Pizzas
  getPizzas: async (): Promise<Pizza[]> => {
    await delay(300);
    return getStorage(STORAGE_KEYS.PIZZAS, INITIAL_PIZZAS);
  },
  
  updatePizza: async (pizza: Pizza): Promise<void> => {
    await delay(300);
    const pizzas = getStorage(STORAGE_KEYS.PIZZAS, INITIAL_PIZZAS);
    const index = pizzas.findIndex((p) => p.id === pizza.id);
    if (index >= 0) {
      pizzas[index] = pizza;
    } else {
      pizzas.push(pizza);
    }
    setStorage(STORAGE_KEYS.PIZZAS, pizzas);
  },

  // Settings
  getSettings: async (): Promise<Settings> => {
    await delay(200);
    return getStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  updateSettings: async (settings: Settings): Promise<void> => {
    await delay(200);
    setStorage(STORAGE_KEYS.SETTINGS, settings);
  },

  // Orders
  getOrders: async (userId?: string): Promise<Order[]> => {
    await delay(400);
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, []);
    if (userId) {
      return orders.filter(o => o.userId === userId);
    }
    return orders;
  },

  createOrder: async (order: Omit<Order, "id" | "createdAt" | "status">): Promise<Order> => {
    await delay(800);
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, []);
    
    // Validate limits again to be safe
    const ordersForDay = orders.filter(o => o.date === order.date).reduce((acc, o) => acc + o.quantity, 0);
    const settings = getStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    
    if (ordersForDay + order.quantity > settings.maxPiesPerDay) {
      throw new Error("Sorry! We just sold out for that date while you were ordering.");
    }

    const newOrder: Order = {
      ...order,
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      status: "confirmed", 
      createdAt: new Date().toISOString(),
    };
    
    orders.push(newOrder);
    setStorage(STORAGE_KEYS.ORDERS, orders);
    return newOrder;
  },

  // Reviews
  getReviews: async (pizzaId?: string): Promise<Review[]> => {
    await delay(300);
    const reviews = getStorage<Review[]>(STORAGE_KEYS.REVIEWS, []);
    if (pizzaId) {
      return reviews.filter(r => r.pizzaId === pizzaId);
    }
    return reviews;
  },

  addReview: async (review: Omit<Review, "id" | "createdAt">): Promise<Review> => {
    await delay(500);
    const reviews = getStorage<Review[]>(STORAGE_KEYS.REVIEWS, []);
    const newReview: Review = {
      ...review,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    reviews.push(newReview);
    setStorage(STORAGE_KEYS.REVIEWS, reviews);
    return newReview;
  }
};

// Helper
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
