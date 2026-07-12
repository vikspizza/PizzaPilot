import { insertOrderSchema, type CreateOrderRequest, type OrderWithCustomer } from "@shared/schema";
import type { IStorage } from "./storage";
import { sendOrderConfirmationEmail, type OrderEmailConfig } from "./order-email";
import { getHeldSlotIds, releaseTryPieHold, validateTryPieHoldForOrder } from "./try-pie-hold";
import type { HoldStore } from "./try-pie-hold-store";

export type CreateOrderResult =
  | { ok: true; order: OrderWithCustomer }
  | { ok: false; status: number; error: string };

export async function createOrderFromRequest(
  storage: IStorage,
  orderRequest: CreateOrderRequest,
  options: OrderEmailConfig,
  holdStore?: HoldStore,
): Promise<CreateOrderResult> {
  const customer = await storage.upsertCustomer({
    phone: orderRequest.customerPhone,
    name: orderRequest.customerName,
    email: orderRequest.customerEmail,
  });

  const order = insertOrderSchema.parse({
    batchId: orderRequest.batchId ?? undefined,
    customerId: customer.id,
    pizzaId: orderRequest.pizzaId,
    quantity: orderRequest.quantity,
    type: orderRequest.type,
    date: orderRequest.date,
    slotId: orderRequest.slotId,
  });

  const pendingReviews = await storage.getPendingReviewsByCustomerPhone(customer.phone);
  if (pendingReviews.length > 0) {
    return {
      ok: false,
      status: 400,
      error:
        "Please review your previous order before placing a new one. You can find the review link in your order history.",
    };
  }

  const pizza = await storage.getPizzaById(order.pizzaId);
  if (!pizza) {
    return { ok: false, status: 404, error: "Pizza not found" };
  }
  if (!pizza.active) {
    return { ok: false, status: 400, error: "This pizza is not currently available." };
  }

  if (order.batchId) {
    const batch = await storage.getBatchById(order.batchId);
    if (!batch) {
      return { ok: false, status: 404, error: "Batch not found" };
    }

    if (order.date !== batch.serviceDate) {
      return {
        ok: false,
        status: 400,
        error: "Order date does not match batch service date.",
      };
    }

    if (await storage.hasExistingBatchOrder(order.batchId, customer.phone, customer.email)) {
      return {
        ok: false,
        status: 400,
        error:
          "You already have an order for this batch. Only one order per batch is allowed per phone number or email.",
      };
    }

    const orderBookedSlotIds = await storage.getBookedSlotIds(order.batchId, order.date);
    if (orderBookedSlotIds.includes(order.slotId)) {
      return {
        ok: false,
        status: 400,
        error: "That pickup time is no longer available. Please choose another slot.",
      };
    }

    if (orderRequest.holdId) {
      const holdResult = await validateTryPieHoldForOrder(
        orderRequest.holdId,
        order.batchId,
        order.pizzaId,
        order.date,
        order.slotId,
        holdStore,
      );
      if (!holdResult.ok) {
        return holdResult;
      }
    } else {
      const heldSlotIds = await getHeldSlotIds(order.batchId, order.date, holdStore);
      if (heldSlotIds.includes(order.slotId)) {
        return {
          ok: false,
          status: 400,
          error: "That pickup time is no longer available. Please choose another slot.",
        };
      }
    }

    const isAvailable = await storage.isPizzaAvailableInBatch(
      order.batchId,
      order.pizzaId,
      orderRequest.quantity,
    );
    if (!isAvailable) {
      const available = await storage.getAvailableQuantity(order.batchId, order.pizzaId);
      return {
        ok: false,
        status: 400,
        error: `Sorry! Only ${available} ${available === 1 ? "pizza" : "pizzas"} available for this batch.`,
      };
    }
  } else {
    const bookedSlotIds = await storage.getBookedSlotIds(null, order.date);
    if (bookedSlotIds.includes(order.slotId)) {
      return {
        ok: false,
        status: 400,
        error: "That pickup time is no longer available. Please choose another slot.",
      };
    }

    if (pizza.soldOut) {
      return { ok: false, status: 400, error: "This pizza is currently sold out." };
    }

    const settings = await storage.getSettings();
    const ordersForDay = await storage.getOrdersByDate(order.date);
    const totalQuantity = ordersForDay.reduce((sum, existingOrder) => sum + existingOrder.quantity, 0);
    if (totalQuantity + orderRequest.quantity > settings.maxPiesPerDay) {
      return {
        ok: false,
        status: 400,
        error: "Sorry! We just sold out for that date while you were ordering.",
      };
    }
  }

  const newOrder = await storage.createOrder(order);

  if (orderRequest.holdId) {
    await releaseTryPieHold(orderRequest.holdId, holdStore);
  }

  try {
    await sendOrderConfirmationEmail(newOrder, pizza, options);
  } catch (error) {
    console.error("Failed to send order confirmation email:", error);
  }

  return { ok: true, order: newOrder };
}
