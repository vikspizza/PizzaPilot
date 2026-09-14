import { z } from "zod";
import type { OrderWithCustomer } from "@shared/schema";
import type { IStorage } from "./storage";
import { sendOrderConfirmationEmail, type OrderEmailConfig } from "./order-email";

export const createAdminOrderRequestSchema = z
  .object({
    batchId: z.string().min(1),
    pizzaId: z.string().min(1),
    slotId: z.string().uuid(),
    customerName: z.string().min(2),
    customerPhone: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{10}$/, "Phone must be 10 digits")),
    customerEmail: z.string().email().optional().or(z.literal("")),
    sendConfirmationEmail: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.sendConfirmationEmail && !value.customerEmail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required when sending a confirmation",
        path: ["customerEmail"],
      });
    }
  });

export type CreateAdminOrderRequest = z.infer<typeof createAdminOrderRequestSchema>;

export type CreateAdminOrderResult =
  | { ok: true; order: OrderWithCustomer; emailSent: boolean }
  | { ok: false; status: number; error: string };

/**
 * Kitchen-created order: skips holds, sold-out checks, slot conflicts, and signup throttle.
 * Double-booked slots are allowed.
 */
export async function createAdminOrder(
  storage: IStorage,
  request: CreateAdminOrderRequest,
  emailConfig: OrderEmailConfig,
): Promise<CreateAdminOrderResult> {
  const batch = await storage.getBatchById(request.batchId);
  if (!batch) {
    return { ok: false, status: 404, error: "Batch not found" };
  }

  const batchPizzas = await storage.getBatchPizzas(batch.id);
  const batchPizza = batchPizzas.find((entry) => entry.pizzaId === request.pizzaId);
  if (!batchPizza) {
    return { ok: false, status: 400, error: "That pizza is not on this batch." };
  }

  if (!batch.slotListId) {
    return { ok: false, status: 400, error: "This batch has no pickup slot list." };
  }

  const slots = await storage.getPickupSlots(batch.slotListId);
  const slot = slots.find((entry) => entry.slotId === request.slotId);
  if (!slot) {
    return { ok: false, status: 400, error: "Pickup slot is not on this batch's slot list." };
  }

  const email =
    request.customerEmail?.trim() ||
    `manual+${request.customerPhone}@vikspizza.local`;

  const customer = await storage.upsertCustomer({
    phone: request.customerPhone,
    name: request.customerName.trim(),
    email,
  });

  const order = await storage.createOrder({
    batchId: batch.id,
    customerId: customer.id,
    pizzaId: request.pizzaId,
    quantity: 1,
    type: "pickup",
    date: batch.serviceDate,
    slotId: request.slotId,
  });

  let emailSent = false;
  if (request.sendConfirmationEmail) {
    if (!request.customerEmail?.trim()) {
      return {
        ok: false,
        status: 400,
        error: "Email is required when sending a confirmation",
      };
    }
    try {
      await sendOrderConfirmationEmail(order, batchPizza.pizza, emailConfig);
      emailSent = true;
    } catch (error) {
      console.error("Failed to send admin order confirmation email:", error);
      return {
        ok: true,
        order,
        emailSent: false,
      };
    }
  }

  return { ok: true, order, emailSent };
}
