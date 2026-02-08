// Use Cloudflare-specific storage that uses postgres-js (edge-compatible)
// This avoids importing db.ts which has pg dependencies
import { DatabaseStorage } from "../../server/storage-cf";
import { getDb } from "../../server/db-cf";
import { insertPizzaSchema, insertOrderSchema, insertReviewSchema, insertSettingsSchema, insertBatchSchema, insertBatchPizzaSchema } from "../../shared/schema";
import { z } from "zod";
import { sendSms } from "../../server/sms";

// Helper to create JSON response
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Helper to parse request body
async function parseBody(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Helper to get URL params
function getParams(request: Request): Record<string, string> {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/", "");
  const segments = path.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  
  // Handle common patterns
  if (segments.length >= 1) params.id = segments[0];
  if (segments.length >= 2) params.subId = segments[1];
  if (segments.length >= 3) params.subSubId = segments[2];
  
  return params;
}

export async function onRequest(context: any) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Get DATABASE_URL from env binding (Cloudflare Pages Functions)
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    return jsonResponse({ error: "DATABASE_URL not configured" }, 500);
  }

  // Create database connection and storage instance
  const db = getDb(databaseUrl);
  const storage = new DatabaseStorage(db);

  try {
    // Health check
    if (path === "/api/health" && method === "GET") {
      return jsonResponse({ status: "ok" });
    }

    // ===== PIZZAS =====
    if (path === "/api/pizzas" && method === "GET") {
      const today = new Date().toISOString().split('T')[0];
      const url = new URL(request.url);
      const batchId = url.searchParams.get("batchId");
      const batchNumber = url.searchParams.get("batchNumber");
      
      let activeBatch = null;
      
      // If batchId or batchNumber is specified, use that
      if (batchId) {
        activeBatch = await storage.getBatchById(batchId);
      } else if (batchNumber) {
        activeBatch = await storage.getBatchByNumber(parseInt(batchNumber));
      } else {
        // Otherwise, find current/next batch
        const batch = await storage.getBatchByDate(today);
        if (batch) {
          activeBatch = batch;
        } else {
          const allBatches = await storage.getBatches();
          const futureBatches = allBatches
            .filter(b => b.serviceDate >= today)
            .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
          activeBatch = futureBatches[0] || null;
        }
      }

      if (activeBatch) {
        const batchPizzas = await storage.getBatchPizzas(activeBatch.id);
        const pizzaIds = batchPizzas.map(bp => bp.pizzaId);
        const allPizzas = await storage.getActivePizzas();
        const batchPizzaList = allPizzas
          .filter(p => pizzaIds.includes(p.id))
          .map(async (pizza) => {
            const available = await storage.getAvailableQuantity(activeBatch.id, pizza.id);
            return {
              ...pizza,
              soldOut: available <= 0,
              batchId: activeBatch.id,
              batchNumber: activeBatch.batchNumber,
              serviceDate: activeBatch.serviceDate,
            };
          });
        
        const pizzasWithAvailability = await Promise.all(batchPizzaList);
        
        // Get next batch info - find the next batch after the current one
        const allBatches = await storage.getBatches();
        const futureBatches = allBatches
          .filter(b => b.serviceDate >= today)
          .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
        
        // Find current batch index in sorted list
        const currentBatchIndex = futureBatches.findIndex(b => b.id === activeBatch.id);
        let nextBatch = null;
        
        if (currentBatchIndex >= 0 && currentBatchIndex < futureBatches.length - 1) {
          // If current batch is found and there's a next one, use it
          nextBatch = futureBatches[currentBatchIndex + 1];
        } else if (currentBatchIndex < 0) {
          // If current batch not in future batches (might be past), find first future batch
          nextBatch = futureBatches.length > 0 ? futureBatches[0] : null;
        }
        
        return jsonResponse({
          pizzas: pizzasWithAvailability,
          currentBatch: {
            id: activeBatch.id,
            batchNumber: activeBatch.batchNumber,
            serviceDate: activeBatch.serviceDate,
          },
          nextBatch: nextBatch ? {
            id: nextBatch.id,
            batchNumber: nextBatch.batchNumber,
            serviceDate: nextBatch.serviceDate,
          } : null,
        });
      } else {
        return jsonResponse({
          pizzas: [],
          currentBatch: null,
          nextBatch: null,
        });
      }
    }

    if (path === "/api/pizzas/all" && method === "GET") {
      const pizzas = await storage.getPizzas();
      return jsonResponse(pizzas);
    }

    if (path === "/api/pizzas/past-experiments" && method === "GET") {
      const pastExperiments = await storage.getPastExperiments();
      return jsonResponse(pastExperiments);
    }

    if (path === "/api/pizzas" && method === "POST") {
      const body = await parseBody(request);
      const pizza = insertPizzaSchema.parse(body);
      const newPizza = await storage.createPizza(pizza);
      return jsonResponse(newPizza, 201);
    }

    if (path.startsWith("/api/pizzas/") && method === "PATCH") {
      // Extract pizza ID from path: /api/pizzas/{id}
      const pathSegments = path.split("/").filter(Boolean);
      const pizzaId = pathSegments[pathSegments.length - 1]; // Last segment is the ID
      const body = await parseBody(request);
      const updates = insertPizzaSchema.partial().parse(body);
      const updated = await storage.updatePizza(pizzaId, updates);
      if (!updated) {
        return jsonResponse({ error: "Pizza not found" }, 404);
      }
      return jsonResponse(updated);
    }

    // ===== SETTINGS =====
    if (path === "/api/settings" && method === "GET") {
      const settings = await storage.getSettings();
      return jsonResponse(settings);
    }

    if (path === "/api/settings" && method === "PATCH") {
      const body = await parseBody(request);
      const updates = insertSettingsSchema.partial().parse(body);
      const updated = await storage.updateSettings(updates);
      return jsonResponse(updated);
    }

    // ===== ORDERS =====
    if (path === "/api/orders" && method === "GET") {
      const userId = url.searchParams.get("userId");
      const orders = userId
        ? await storage.getOrdersByUserId(userId)
        : await storage.getOrders();
      return jsonResponse(orders);
    }

    if (path === "/api/orders" && method === "POST") {
      const body = await parseBody(request);
      const order = insertOrderSchema.parse(body);
      
      if (order.userId) {
        const pendingReviews = await storage.getPendingReviewsByUserId(order.userId);
        if (pendingReviews.length > 0) {
          return jsonResponse({ 
            error: "Please review your previous order before placing a new one. You can find the review link in your order history." 
          }, 400);
        }
      }
      
      const pizza = await storage.getPizzaById(order.pizzaId);
      if (!pizza) {
        return jsonResponse({ error: "Pizza not found" }, 404);
      }
      if (!pizza.active) {
        return jsonResponse({ error: "This pizza is not currently available." }, 400);
      }
      
      if (order.batchId) {
        const batch = await storage.getBatchById(order.batchId);
        if (!batch) {
          return jsonResponse({ error: "Batch not found" }, 404);
        }
        
        if (order.date !== batch.serviceDate) {
          return jsonResponse({ error: "Order date does not match batch service date." }, 400);
        }
        
        const isAvailable = await storage.isPizzaAvailableInBatch(
          order.batchId,
          order.pizzaId,
          order.quantity
        );
        
        if (!isAvailable) {
          const available = await storage.getAvailableQuantity(order.batchId, order.pizzaId);
          return jsonResponse({ 
            error: `Sorry! Only ${available} ${available === 1 ? 'pizza' : 'pizzas'} available for this batch.` 
          }, 400);
        }
      } else if (pizza.soldOut) {
        return jsonResponse({ error: "This pizza is currently sold out." }, 400);
      }
      
      const newOrder = await storage.createOrder(order);
      return jsonResponse(newOrder, 201);
    }

    if (path.startsWith("/api/orders/") && method === "GET") {
      const params = getParams(request);
      const order = await storage.getOrderById(params.id);
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      return jsonResponse(order);
    }

    if (path.startsWith("/api/orders/") && path.endsWith("/status") && method === "PATCH") {
      const params = getParams(request);
      const body = await parseBody(request);
      const { status } = body;
      
      if (!status) {
        return jsonResponse({ error: "Status is required" }, 400);
      }
      
      const order = await storage.getOrderById(params.id);
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      
      const updated = await storage.updateOrderStatus(params.id, status);
      if (!updated) {
        return jsonResponse({ error: "Failed to update order status" }, 500);
      }
      
      // Send SMS notification
      let message: string | null = null;
      if (status === "cooking") {
        message = "Your order is in the oven. ";
      } else if (status === "ready") {
        message = "Your order is ready!";
      } else if (status === "delivered") {
        message = "Enjoy the pie! We await your honest review - Team CrustOps";
      } else if (status === "cancelled") {
        message = "Your order has been cancelled. If you have questions, please contact us.";
      }
      
      if (message) {
        try {
          await sendSms(order.customerPhone, message);
        } catch (smsError) {
          console.error("Failed to send SMS notification:", smsError);
        }
      }
      
      return jsonResponse(updated);
    }

    // ===== REVIEWS =====
    if (path === "/api/reviews" && method === "GET") {
      const pizzaId = url.searchParams.get("pizzaId");
      const orderId = url.searchParams.get("orderId");
      
      if (orderId) {
        const review = await storage.getReviewByOrderId(orderId);
        return jsonResponse(review ? [review] : []);
      }
      
      const reviews = pizzaId
        ? await storage.getReviewsByPizzaId(pizzaId)
        : await storage.getReviews();
      return jsonResponse(reviews);
    }

    if (path === "/api/reviews/pending" && method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return jsonResponse({ error: "userId is required" }, 400);
      }
      const pendingOrders = await storage.getPendingReviewsByUserId(userId);
      return jsonResponse(pendingOrders);
    }

    if (path === "/api/reviews" && method === "POST") {
      const body = await parseBody(request);
      const review = insertReviewSchema.parse(body);
      
      const existingReview = await storage.getReviewByOrderId(review.orderId);
      if (existingReview) {
        return jsonResponse({ error: "Review already submitted for this order" }, 400);
      }
      
      const order = await storage.getOrderById(review.orderId);
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      if (order.status !== "completed" && order.status !== "delivered") {
        return jsonResponse({ error: "Can only review delivered or completed orders" }, 400);
      }
      
      const newReview = await storage.createReview(review);
      return jsonResponse(newReview, 201);
    }

    // ===== AUTH =====
    if (path === "/api/auth/send-otp" && method === "POST") {
      const body = await parseBody(request);
      const { phone } = body;
      if (!phone) {
        return jsonResponse({ error: "Phone number is required" }, 400);
      }
      
      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await storage.createOtpCode({ phone, code, expiresAt });
      
      // In production, send SMS here
      console.log(`OTP for ${phone}: ${code}`);
      
      return jsonResponse({ message: "OTP sent" });
    }

    if (path === "/api/auth/verify-otp" && method === "POST") {
      const body = await parseBody(request);
      const { phone, code } = body;
      if (!phone || !code) {
        return jsonResponse({ error: "Phone and code are required" }, 400);
      }
      
      const otpCode = await storage.getValidOtpCode(phone, code);
      if (!otpCode) {
        return jsonResponse({ error: "Invalid or expired code" }, 400);
      }
      
      let user = await storage.getUserByPhone(phone);
      if (!user) {
        user = await storage.createUser({
          phone,
          name: "Valued Customer",
          email: "",
        });
      }
      
      await storage.deleteOtpCode(otpCode.id);
      
      return jsonResponse({ user });
    }

    // ===== USERS =====
    if (path.startsWith("/api/users/") && method === "PATCH") {
      // Extract user ID from path: /api/users/{userId}
      const pathSegments = path.split("/").filter(Boolean);
      const userId = pathSegments[pathSegments.indexOf("users") + 1];
      const body = await parseBody(request);
      const updated = await storage.updateUser(userId, body);
      if (!updated) {
        return jsonResponse({ error: "User not found" }, 404);
      }
      return jsonResponse(updated);
    }

    // ===== BATCHES =====
    if (path === "/api/batches" && method === "GET") {
      const batches = await storage.getBatches();
      return jsonResponse(batches);
    }

    if (path.startsWith("/api/batches/") && path.endsWith("/next") && method === "GET") {
      const today = new Date().toISOString().split('T')[0];
      let batch = await storage.getBatchByDate(today);
      
      if (!batch) {
        const allBatches = await storage.getBatches();
        const futureBatches = allBatches
          .filter(b => b.serviceDate >= today)
          .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
        batch = futureBatches[0] || null;
      }
      
      if (!batch) {
        return jsonResponse({ error: "No upcoming batches found" }, 404);
      }
      
      return jsonResponse(batch);
    }

    if (path.startsWith("/api/batches/") && !path.includes("/pizzas") && !path.includes("/availability") && method === "GET") {
      // Extract batch ID from path: /api/batches/{batchId}
      const pathSegments = path.split("/").filter(Boolean);
      const batchId = pathSegments[pathSegments.indexOf("batches") + 1];
      const batch = await storage.getBatchById(batchId);
      if (!batch) {
        return jsonResponse({ error: "Batch not found" }, 404);
      }
      return jsonResponse(batch);
    }

    if (path === "/api/batches" && method === "POST") {
      const body = await parseBody(request);
      const batch = insertBatchSchema.parse(body);
      const newBatch = await storage.createBatch(batch);
      return jsonResponse(newBatch, 201);
    }

    if (path.startsWith("/api/batches/") && !path.includes("/pizzas") && method === "PATCH") {
      // Extract batch ID from path: /api/batches/{batchId}
      const pathSegments = path.split("/").filter(Boolean);
      const batchId = pathSegments[pathSegments.indexOf("batches") + 1];
      const body = await parseBody(request);
      const updates = insertBatchSchema.partial().parse(body);
      const updated = await storage.updateBatch(batchId, updates);
      if (!updated) {
        return jsonResponse({ error: "Batch not found" }, 404);
      }
      return jsonResponse(updated);
    }

    if (path.startsWith("/api/batches/") && !path.includes("/pizzas") && method === "DELETE") {
      // Extract batch ID from path: /api/batches/{batchId}
      const pathSegments = path.split("/").filter(Boolean);
      const batchId = pathSegments[pathSegments.indexOf("batches") + 1];
      await storage.deleteBatchPizzasByBatchId(batchId);
      await storage.deleteBatch(batchId);
      return jsonResponse({ message: "Batch deleted" });
    }

    // ===== BATCH PIZZAS =====
    if (path.startsWith("/api/batches/") && path.endsWith("/pizzas") && method === "GET") {
      // Extract batch ID from path: /api/batches/{batchId}/pizzas
      const pathSegments = path.split("/").filter(Boolean);
      const batchId = pathSegments[pathSegments.indexOf("batches") + 1];
      const batchPizzas = await storage.getBatchPizzas(batchId);
      return jsonResponse(batchPizzas);
    }

    if (path.startsWith("/api/batches/") && path.endsWith("/pizzas") && method === "POST") {
      // Extract batch ID from path: /api/batches/{batchId}/pizzas
      const pathSegments = path.split("/").filter(Boolean);
      const batchId = pathSegments[pathSegments.indexOf("batches") + 1];
      const body = await parseBody(request);
      const batchPizza = insertBatchPizzaSchema.parse({
        ...body,
        batchId: batchId,
      });
      const newBatchPizza = await storage.createBatchPizza(batchPizza);
      return jsonResponse(newBatchPizza, 201);
    }

    if (path.startsWith("/api/batches/") && path.includes("/pizzas/") && method === "PATCH") {
      const segments = path.split("/").filter(Boolean);
      const batchId = segments[segments.indexOf("batches") + 1];
      const pizzaId = segments[segments.indexOf("pizzas") + 1];
      
      const batchPizza = await storage.getBatchPizza(batchId, pizzaId);
      if (!batchPizza) {
        return jsonResponse({ error: "Batch pizza not found" }, 404);
      }
      
      const body = await parseBody(request);
      const updates = insertBatchPizzaSchema.partial().parse(body);
      const updated = await storage.updateBatchPizza(batchPizza.id, updates);
      if (!updated) {
        return jsonResponse({ error: "Failed to update batch pizza" }, 404);
      }
      return jsonResponse(updated);
    }

    if (path.startsWith("/api/batches/") && path.includes("/pizzas/") && method === "DELETE") {
      const segments = path.split("/").filter(Boolean);
      const batchId = segments[segments.indexOf("batches") + 1];
      const pizzaId = segments[segments.indexOf("pizzas") + 1];
      
      const batchPizza = await storage.getBatchPizza(batchId, pizzaId);
      if (!batchPizza) {
        return jsonResponse({ error: "Batch pizza not found" }, 404);
      }
      
      await storage.deleteBatchPizza(batchPizza.id);
      return jsonResponse({ message: "Batch pizza deleted" });
    }

    // ===== BATCH AVAILABILITY =====
    if (path.startsWith("/api/batches/") && path.includes("/availability/") && method === "GET") {
      const segments = path.split("/").filter(Boolean);
      const batchId = segments[segments.indexOf("batches") + 1];
      const pizzaId = segments[segments.indexOf("availability") + 1];
      
      const available = await storage.getAvailableQuantity(batchId, pizzaId);
      return jsonResponse({ available });
    }

    // 404 for unmatched routes
    return jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    console.error("API Error:", error);
    if (error instanceof z.ZodError) {
      return jsonResponse({ error: error.errors }, 400);
    }
    return jsonResponse({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    }, 500);
  }
}

