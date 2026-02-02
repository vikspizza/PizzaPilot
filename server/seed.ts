import { db } from "./db";
import * as schema from "@shared/schema";

const PIZZA_IMAGES: Record<string, string> = {
  "truffle": "/attached_assets/generated_images/white_pizza_with_truffle_and_mushrooms.png",
  "crustgpt": "/attached_assets/generated_images/pesto_pizza_with_ricotta_and_arugula.png",
  "senor": "/attached_assets/generated_images/taco_style_pizza_with_corn_and_avocado.png",
  "papichulo": "/attached_assets/generated_images/papi_chulo_potato_pizza_with_corn_and_cotija.png",
  "george": "/attached_assets/generated_images/george_crustanza_pizza_placeholder.png",
};

async function seed() {
  console.log("Seeding database...");

  // Check if pizzas already exist
  const existingPizzas = await db.select().from(schema.pizzas);
  if (existingPizzas.length > 0) {
    console.log("Pizzas already seeded, skipping...");
    return;
  }

  // Seed pizzas
  const pizzasData = [
    {
      name: "Truffle Shuffle",
      description: "Wild mushrooms, garlic confit, taleggio, mozzarella, white truffle oil, fresh rosemary.",
      tags: ["veg", "white pie", "rich"],
      imageUrl: PIZZA_IMAGES["truffle"],
      active: true,
      soldOut: false,
      price: "24.00",
    },
    {
      name: "CrustGPT",
      description: "Green tangy Pesto, Pecorino Romano, Tomatoes. Finished with Ricotta Lemon Honey drizzle and arugula greens.",
      tags: ["veg", "pesto", "fresh"],
      imageUrl: PIZZA_IMAGES["crustgpt"],
      active: true,
      soldOut: false,
      price: "23.00",
    },
    {
      name: "Señor Crustobal",
      description: "Taco chili oil, mozzerella, corn, yellow onions. Finished with cilantro, tangy sour cream, chipotle and lime drizzle, pico de gallo and avocado slices.",
      tags: ["fusion", "spicy", "loaded"],
      imageUrl: PIZZA_IMAGES["senor"],
      active: true,
      soldOut: false,
      price: "25.00",
    },
    {
      name: "Papa Crusto",
      description: "Thin potato slices brushed with taco chili oil, roasted corn, red onions, sliced cherry tomatoes, mozzarella, cotija. Finished with fresh cilantro, spicy papi chulo sauce and tangy sour cream drizzle.",
      tags: ["fusion", "spicy", "veg"],
      imageUrl: PIZZA_IMAGES["papichulo"],
      active: true,
      soldOut: false,
      price: "24.00",
    },
    {
      name: "George Crustanza",
      description: "Tomato sauce, mozzerella, pecorino romano, sliced cherry tomatoes. Finished with zesty basil and arugula sauce and ricotta drizzle.",
      tags: ["veg", "classic", "fresh"],
      imageUrl: PIZZA_IMAGES["george"],
      active: true,
      soldOut: false,
      price: "23.00",
    },
  ];

  await db.insert(schema.pizzas).values(pizzasData);
  console.log("✅ Pizzas seeded successfully");

  // Seed default settings
  const existingSettings = await db.select().from(schema.settings);
  if (existingSettings.length === 0) {
    await db.insert(schema.settings).values({
      maxPiesPerDay: 15,
      serviceDays: [4, 5, 6], // Thu, Fri, Sat
      serviceStartHour: 16,
      serviceEndHour: 20,
    });
    console.log("✅ Settings seeded successfully");
  }

  console.log("Database seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Error seeding database:", error);
  process.exit(1);
});
