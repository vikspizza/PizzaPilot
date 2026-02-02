import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPizzaSchema, insertOrderSchema, insertReviewSchema, insertSettingsSchema, insertBatchSchema, insertBatchPizzaSchema } from "@shared/schema";
import { z } from "zod";
import { sendSms } from "./sms";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ===== PIZZAS =====
  app.get("/api/pizzas", async (_req, res) => {
    try {
      // Get the next available batch (today or future)
      const today = new Date().toISOString().split('T')[0];
      const batch = await storage.getBatchByDate(today);
      
      // If no batch for today, find the next future batch
      let activeBatch = batch;
      if (!activeBatch) {
        const allBatches = await storage.getBatches();
        const futureBatches = allBatches
          .filter(b => b.serviceDate >= today)
          .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
        activeBatch = futureBatches[0] || null;
      }

      if (activeBatch) {
        // Get pizzas from this batch
        const batchPizzas = await storage.getBatchPizzas(activeBatch.id);
        const pizzaIds = batchPizzas.map(bp => bp.pizzaId);
        
        // Get pizza details
        const allPizzas = await storage.getActivePizzas();
        const batchPizzaList = allPizzas
          .filter(p => pizzaIds.includes(p.id))
          .map(async (pizza) => {
            // Calculate availability for this pizza in the batch
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
        return res.json(pizzasWithAvailability);
      } else {
        // No active batch, return empty array or all active pizzas
        const pizzas = await storage.getActivePizzas();
        res.json(pizzas.map(p => ({ ...p, soldOut: true }))); // Mark all as sold out if no batch
      }
    } catch (error) {
      console.error("Error fetching pizzas:", error);
      res.status(500).json({ error: "Failed to fetch pizzas" });
    }
  });

  app.get("/api/pizzas/all", async (_req, res) => {
    try {
      const pizzas = await storage.getPizzas();
      res.json(pizzas);
    } catch (error) {
      console.error("Error fetching all pizzas:", error);
      res.status(500).json({ error: "Failed to fetch pizzas" });
    }
  });

  app.post("/api/pizzas", async (req, res) => {
    try {
      const pizza = insertPizzaSchema.parse(req.body);
      const newPizza = await storage.createPizza(pizza);
      res.status(201).json(newPizza);
    } catch (error) {
      console.error("Error creating pizza:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create pizza" });
    }
  });

  app.patch("/api/pizzas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertPizzaSchema.partial().parse(req.body);
      const updated = await storage.updatePizza(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Pizza not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating pizza:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update pizza" });
    }
  });

  // ===== ORDERS =====
  app.get("/api/orders", async (req, res) => {
    try {
      const { userId } = req.query;
      const orders = userId
        ? await storage.getOrdersByUserId(userId as string)
        : await storage.getOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const order = insertOrderSchema.parse(req.body);
      
      // Check for pending reviews if user is logged in
      if (order.userId) {
        const pendingReviews = await storage.getPendingReviewsByUserId(order.userId);
        if (pendingReviews.length > 0) {
          return res.status(400).json({ 
            error: "Please review your previous order before placing a new one. You can find the review link in your order history." 
          });
        }
      }
      
      // Check if pizza exists and is active
      const pizza = await storage.getPizzaById(order.pizzaId);
      if (!pizza) {
        return res.status(404).json({ error: "Pizza not found" });
      }
      if (!pizza.active) {
        return res.status(400).json({ 
          error: "This pizza is not currently available." 
        });
      }
      
      // Check batch availability if batchId is provided
      if (order.batchId) {
        const batch = await storage.getBatchById(order.batchId);
        if (!batch) {
          return res.status(404).json({ error: "Batch not found" });
        }
        
        // Verify order date matches batch service date
        if (order.date !== batch.serviceDate) {
          return res.status(400).json({ 
            error: "Order date does not match batch service date." 
          });
        }
        
        // Check if pizza is available in this batch
        const isAvailable = await storage.isPizzaAvailableInBatch(
          order.batchId,
          order.pizzaId,
          order.quantity
        );
        
        if (!isAvailable) {
          const available = await storage.getAvailableQuantity(order.batchId, order.pizzaId);
          return res.status(400).json({ 
            error: `Sorry! Only ${available} ${available === 1 ? 'pizza' : 'pizzas'} available for this batch.` 
          });
        }
      } else {
        // Fallback to old logic if no batchId (for backward compatibility)
        if (pizza.soldOut) {
          return res.status(400).json({ 
            error: "This pizza is currently sold out." 
          });
        }
        
        // Validate daily limit
        const settings = await storage.getSettings();
        const ordersForDay = await storage.getOrdersByDate(order.date);
        const totalQuantity = ordersForDay.reduce((sum, o) => sum + o.quantity, 0);
        
        if (totalQuantity + order.quantity > settings.maxPiesPerDay) {
          return res.status(400).json({ 
            error: "Sorry! We just sold out for that date while you were ordering." 
          });
        }
      }

      const newOrder = await storage.createOrder(order);
      res.status(201).json(newOrder);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const validStatuses = ["pending", "confirmed", "cooking", "ready", "delivered", "completed", "cancelled"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Get order before updating to send SMS
      const order = await storage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const updated = await storage.updateOrderStatus(id, status);
      if (!updated) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Send SMS notification based on status
      try {
        let message = "";
        switch (status) {
          case "cooking":
            message = "Your order is in the oven.";
            break;
          case "ready":
            message = "Your order is ready!";
            break;
          case "delivered":
            message = "Enjoy the pie! We await your honest review - Team CrustOps";
            break;
          case "cancelled":
            message = "Your order has been cancelled. If you have questions, please contact us.";
            break;
        }

        if (message) {
          await sendSms(order.customerPhone, message);
        }
      } catch (smsError) {
        // Log SMS error but don't fail the status update
        console.error("Failed to send SMS notification:", smsError);
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // ===== REVIEWS =====
  app.get("/api/reviews", async (req, res) => {
    try {
      const { pizzaId, orderId } = req.query;
      if (orderId) {
        const review = await storage.getReviewByOrderId(orderId as string);
        res.json(review ? [review] : []);
      } else if (pizzaId) {
        const reviews = await storage.getReviewsByPizzaId(pizzaId as string);
        res.json(reviews);
      } else {
        const reviews = await storage.getReviews();
        res.json(reviews);
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const review = insertReviewSchema.parse(req.body);
      
      // Check if review already exists for this order
      const existingReview = await storage.getReviewByOrderId(review.orderId);
      if (existingReview) {
        return res.status(400).json({ error: "Review already submitted for this order" });
      }
      
      // Verify order exists and is completed
      const order = await storage.getOrderById(review.orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.status !== "completed" && order.status !== "delivered") {
        return res.status(400).json({ error: "Can only review delivered or completed orders" });
      }
      
      const newReview = await storage.createReview(review);
      res.status(201).json(newReview);
    } catch (error) {
      console.error("Error creating review:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  app.get("/api/reviews/pending", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }
      const pendingOrders = await storage.getPendingReviewsByUserId(userId as string);
      res.json(pendingOrders);
    } catch (error) {
      console.error("Error fetching pending reviews:", error);
      res.status(500).json({ error: "Failed to fetch pending reviews" });
    }
  });

  // ===== SETTINGS =====
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const updates = insertSettingsSchema.partial().parse(req.body);
      const updated = await storage.updateSettings(updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating settings:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ===== AUTHENTICATION =====
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP with 10-minute expiration
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await storage.createOtpCode({ phone, code, expiresAt });

      // TODO: Send actual SMS via Twilio
      console.log(`OTP for ${phone}: ${code}`);
      
      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: "Phone and code are required" });
      }

      // Verify OTP
      const otpCode = await storage.getValidOtpCode(phone, code);
      if (!otpCode) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }

      // Delete used OTP
      await storage.deleteOtpCode(otpCode.id);

      // Find or create user
      let user = await storage.getUserByPhone(phone);
      if (!user) {
        user = await storage.createUser({
          phone,
          name: "Valued Customer",
          email: "",
        });
      }

      res.json({ user });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = await storage.updateUser(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ===== BATCHES =====
  app.get("/api/batches", async (_req, res) => {
    try {
      const batches = await storage.getBatches();
      res.json(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ error: "Failed to fetch batches" });
    }
  });

  app.get("/api/batches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const batch = await storage.getBatchById(id);
      if (!batch) {
        return res.status(404).json({ error: "Batch not found" });
      }
      res.json(batch);
    } catch (error) {
      console.error("Error fetching batch:", error);
      res.status(500).json({ error: "Failed to fetch batch" });
    }
  });

  app.get("/api/batches/:id/pizzas", async (req, res) => {
    try {
      const { id } = req.params;
      const batchPizzas = await storage.getBatchPizzas(id);
      res.json(batchPizzas);
    } catch (error) {
      console.error("Error fetching batch pizzas:", error);
      res.status(500).json({ error: "Failed to fetch batch pizzas" });
    }
  });

  app.post("/api/batches", async (req, res) => {
    try {
      const batch = insertBatchSchema.parse(req.body);
      const newBatch = await storage.createBatch(batch);
      res.status(201).json(newBatch);
    } catch (error) {
      console.error("Error creating batch:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create batch" });
    }
  });

  app.patch("/api/batches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertBatchSchema.partial().parse(req.body);
      const updated = await storage.updateBatch(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Batch not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating batch:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update batch" });
    }
  });

  app.delete("/api/batches/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBatchPizzasByBatchId(id);
      await storage.deleteBatch(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ error: "Failed to delete batch" });
    }
  });

  app.post("/api/batches/:id/pizzas", async (req, res) => {
    try {
      const { id } = req.params;
      const batchPizza = insertBatchPizzaSchema.parse({
        ...req.body,
        batchId: id,
      });
      const newBatchPizza = await storage.createBatchPizza(batchPizza);
      res.status(201).json(newBatchPizza);
    } catch (error) {
      console.error("Error creating batch pizza:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create batch pizza" });
    }
  });

  app.patch("/api/batches/:batchId/pizzas/:pizzaId", async (req, res) => {
    try {
      const { batchId, pizzaId } = req.params;
      const batchPizza = await storage.getBatchPizza(batchId, pizzaId);
      if (!batchPizza) {
        return res.status(404).json({ error: "Batch pizza not found" });
      }
      const updates = insertBatchPizzaSchema.partial().parse(req.body);
      const updated = await storage.updateBatchPizza(batchPizza.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Failed to update batch pizza" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating batch pizza:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update batch pizza" });
    }
  });

  app.delete("/api/batches/:batchId/pizzas/:pizzaId", async (req, res) => {
    try {
      const { batchId, pizzaId } = req.params;
      const batchPizza = await storage.getBatchPizza(batchId, pizzaId);
      if (!batchPizza) {
        return res.status(404).json({ error: "Batch pizza not found" });
      }
      await storage.deleteBatchPizza(batchPizza.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting batch pizza:", error);
      res.status(500).json({ error: "Failed to delete batch pizza" });
    }
  });

  app.get("/api/batches/:id/availability/:pizzaId", async (req, res) => {
    try {
      const { id, pizzaId } = req.params;
      const available = await storage.getAvailableQuantity(id, pizzaId);
      res.json({ available });
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // Get next available batch
  app.get("/api/batches/next", async (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let batch = await storage.getBatchByDate(today);
      
      // If no batch for today, find the next future batch
      if (!batch) {
        const allBatches = await storage.getBatches();
        const futureBatches = allBatches
          .filter(b => b.serviceDate >= today)
          .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
        batch = futureBatches[0] || null;
      }
      
      if (!batch) {
        return res.status(404).json({ error: "No upcoming batches found" });
      }
      
      res.json(batch);
    } catch (error) {
      console.error("Error fetching next batch:", error);
      res.status(500).json({ error: "Failed to fetch next batch" });
    }
  });

  return httpServer;
}
