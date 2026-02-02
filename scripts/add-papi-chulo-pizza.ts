import { db } from "../server/db";
import * as schema from "@shared/schema";

async function addPapiChuloPizza() {
  console.log("Adding Papi Chulo Potato pizza...");

  // Check if pizza already exists
  const existingPizzas = await db
    .select()
    .from(schema.pizzas)
    .where(schema.pizzas.name.eq("Papi Chulo Potato"));

  if (existingPizzas.length > 0) {
    console.log("✅ Papi Chulo Potato pizza already exists in database");
    process.exit(0);
  }

  // Add the new pizza
  const newPizza = {
    name: "Papi Chulo Potato",
    description: "Thin potato slices brushed with taco chili oil, roasted corn, red onions, sliced cherry tomatoes, mozzarella, cotija. Finished with fresh cilantro, spicy papi chulo sauce and tangy sour cream drizzle.",
    tags: ["fusion", "spicy", "veg"],
    imageUrl: "/attached_assets/generated_images/papi_chulo_potato_pizza_with_corn_and_cotija.png",
    active: true,
    soldOut: false,
    price: "24.00",
  };

  await db.insert(schema.pizzas).values(newPizza);
  console.log("✅ Papi Chulo Potato pizza added successfully!");
  process.exit(0);
}

addPapiChuloPizza().catch((error) => {
  console.error("Error adding pizza:", error);
  process.exit(1);
});




