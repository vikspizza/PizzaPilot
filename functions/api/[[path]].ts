// Use Cloudflare-specific storage that uses postgres-js (edge-compatible)
// This avoids importing db.ts which has pg dependencies
import { DatabaseStorage } from "../../server/storage-cf";
import { getDb } from "../../server/db-cf";
import { insertPizzaSchema, insertOrderSchema, insertReviewSchema, insertSettingsSchema, insertBatchSchema, insertBatchPizzaSchema, insertSlotListSchema, insertPickupSlotSchema, createOrderRequestSchema } from "../../shared/schema";
import { createOrderFromRequest } from "../../server/order-create";
import { z } from "zod";
import { sendSms } from "../../server/sms";
import { getTryPieContext } from "../../server/try-pie-context";
import { createTryPieHold, releaseTryPieHold } from "../../server/try-pie-hold";
import { normalizePickupTime } from "../../shared/pickup-time";
import {
  createAdminToken,
  getBearerToken,
  verifyAdminPassword,
  verifyAdminToken,
} from "../../shared/admin-auth";
import { requiresAdminAuth } from "../../shared/requires-admin-auth";

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

function getOrderIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/api\/orders\/([^/]+)(?:\/status)?$/);
  return match?.[1];
}

const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "cooking",
  "ready",
  "delivered",
  "completed",
  "cancelled",
];

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
    if (path === "/api/admin/login" && method === "POST") {
      const body = await parseBody(request);
      const password = String(body.password ?? "");
      const expected = env.ADMIN_PASSWORD;

      if (!expected) {
        return jsonResponse({ error: "Admin access is not configured" }, 503);
      }

      if (!verifyAdminPassword(password, expected)) {
        return jsonResponse({ error: "Invalid password" }, 401);
      }

      const token = await createAdminToken(expected);
      return jsonResponse({ token });
    }

    if (requiresAdminAuth(method, path, url.searchParams)) {
      const token = getBearerToken(request.headers.get("Authorization"));
      if (!(await verifyAdminToken(token, env.ADMIN_PASSWORD))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
    }

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
      const phone = url.searchParams.get("phone");
      const orders = phone
        ? await storage.getOrdersByCustomerPhone(phone)
        : await storage.getOrders();
      return jsonResponse(orders);
    }

    if (path === "/api/orders" && method === "POST") {
      const body = await parseBody(request);
      const orderRequest = createOrderRequestSchema.parse(body);
      const requestOrigin = new URL(request.url).origin;
      const siteUrl = env.SITE_URL || requestOrigin;

      const result = await createOrderFromRequest(storage, orderRequest, {
        resendApiKey: env.RESEND_API_KEY,
        emailFrom: env.EMAIL_FROM,
        siteUrl,
        logoBaseUrl: requestOrigin,
      });

      if (!result.ok) {
        return jsonResponse({ error: result.error }, result.status);
      }

      return jsonResponse(result.order, 201);
    }

    if (method === "GET" && /^\/api\/orders\/[^/]+$/.test(path)) {
      const orderId = getOrderIdFromPath(path);
      if (!orderId) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      return jsonResponse(order);
    }

    if (path.endsWith("/status") && method === "PATCH" && /^\/api\/orders\/[^/]+\/status$/.test(path)) {
      const orderId = getOrderIdFromPath(path);
      if (!orderId) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      const body = await parseBody(request);
      const { status } = body;
      
      if (!status || !VALID_ORDER_STATUSES.includes(status)) {
        return jsonResponse({ error: "Invalid status" }, 400);
      }
      
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }
      
      const updated = await storage.updateOrderStatus(orderId, status);
      if (!updated) {
        return jsonResponse({ error: "Order not found" }, 404);
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
          await sendSms(order.customer.phone, message);
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
      const phone = url.searchParams.get("phone");
      if (!phone) {
        return jsonResponse({ error: "phone is required" }, 400);
      }
      const pendingOrders = await storage.getPendingReviewsByCustomerPhone(phone);
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

    if (path.startsWith("/api/batches/") && path.endsWith("/booked-slots") && method === "GET") {
      const segments = path.split("/").filter(Boolean);
      const batchId = segments[segments.indexOf("batches") + 1];
      const batch = await storage.getBatchById(batchId);
      if (!batch) {
        return jsonResponse({ error: "Batch not found" }, 404);
      }
      const bookedSlotIds = await storage.getBookedSlotIds(batch.id, batch.serviceDate);
      return jsonResponse({ bookedSlotIds });
    }

    // ===== TRY A PIE (landing page) =====
    if (path === "/api/try-pie/context" && method === "GET") {
      const context = await getTryPieContext(storage);
      return jsonResponse(context);
    }

    if (path === "/api/try-pie/hold" && method === "POST") {
      const body = await parseBody(request);
      const batchId = String(body.batchId ?? "");
      const pizzaId = String(body.pizzaId ?? "");
      if (!batchId || !pizzaId) {
        return jsonResponse({ error: "batchId and pizzaId are required" }, 400);
      }

      const result = await createTryPieHold(storage, batchId, pizzaId);
      if (!result.ok) {
        return jsonResponse({ error: result.error }, result.status);
      }

      return jsonResponse(
        {
          holdId: result.holdId,
          expiresAt: result.expiresAt,
          expiresInSeconds: result.expiresInSeconds,
        },
        201,
      );
    }

    if (method === "DELETE" && /^\/api\/try-pie\/hold\/[^/]+$/.test(path)) {
      const holdId = path.split("/").pop()!;
      await releaseTryPieHold(storage, holdId);
      return new Response(null, { status: 204 });
    }

    // ===== PICKUP SLOTS (public) =====
    if (path === "/api/pickup-slots" && method === "GET") {
      const slots = await storage.getActivePickupSlots();
      return jsonResponse(slots);
    }

    // ===== SLOT LISTS =====
    if (path === "/api/slot-lists" && method === "GET") {
      const slotLists = await storage.getSlotLists();
      return jsonResponse(slotLists);
    }

    if (path === "/api/slot-lists" && method === "POST") {
      const body = await parseBody(request);
      const slotList = insertSlotListSchema.parse(body);
      const created = await storage.createSlotList(slotList);
      return jsonResponse(created, 201);
    }

    if (path.startsWith("/api/slot-lists/") && path.endsWith("/slots") && method === "GET") {
      const pathSegments = path.split("/").filter(Boolean);
      const slotListId = pathSegments[pathSegments.indexOf("slot-lists") + 1];
      const slots = await storage.getPickupSlots(slotListId);
      return jsonResponse(slots);
    }

    if (path.startsWith("/api/slot-lists/") && path.endsWith("/slots") && method === "POST") {
      const pathSegments = path.split("/").filter(Boolean);
      const slotListId = pathSegments[pathSegments.indexOf("slot-lists") + 1];
      const body = await parseBody(request);
      const pickupTime = normalizePickupTime(body.pickupTime);
      if (!pickupTime) {
        return jsonResponse({ error: "Invalid pickup time" }, 400);
      }
      const pickupSlot = insertPickupSlotSchema.parse({
        pickupTime,
        slotListId,
      });
      const created = await storage.createPickupSlot(pickupSlot);
      return jsonResponse(created, 201);
    }

    if (path.startsWith("/api/slot-lists/") && path.includes("/slots/") && method === "DELETE") {
      const pathSegments = path.split("/").filter(Boolean);
      const slotId = pathSegments[pathSegments.indexOf("slots") + 1];
      await storage.deletePickupSlot(slotId);
      return jsonResponse({ message: "Pickup slot deleted" });
    }

    if (path.startsWith("/api/slot-lists/") && !path.includes("/slots") && method === "PATCH") {
      const pathSegments = path.split("/").filter(Boolean);
      const slotListId = pathSegments[pathSegments.indexOf("slot-lists") + 1];
      const body = await parseBody(request);
      const updates = insertSlotListSchema.partial().parse(body);
      const updated = await storage.updateSlotList(slotListId, updates);
      if (!updated) {
        return jsonResponse({ error: "Slot list not found" }, 404);
      }
      return jsonResponse(updated);
    }

    if (path.startsWith("/api/slot-lists/") && !path.includes("/slots") && method === "DELETE") {
      const pathSegments = path.split("/").filter(Boolean);
      const slotListId = pathSegments[pathSegments.indexOf("slot-lists") + 1];
      await storage.deleteSlotList(slotListId);
      return jsonResponse({ message: "Slot list deleted" });
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

