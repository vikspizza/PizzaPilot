/**
 * Script to generate pizza images using OpenAI's DALL-E API
 * 
 * Usage:
 * 1. Set OPENAI_API_KEY environment variable
 * 2. Run: npx tsx scripts/generate-pizza-image.ts
 * 
 * Or use a free alternative like:
 * - Puter.js (free, unlimited)
 * - Microsoft Copilot (free DALL-E 3)
 * - Pollo AI (free DALL-E)
 */

import { writeFile } from "fs/promises";
import { join } from "path";

const PIZZA_PROMPT = `A beautiful, appetizing pizza with thin potato slices brushed with taco chili oil, roasted corn kernels, red onion slices, sliced cherry tomatoes, melted mozzarella cheese, crumbled cotija cheese, fresh cilantro leaves, spicy papi chulo sauce drizzled on top, and tangy sour cream drizzle. Professional food photography, overhead view, rustic wooden background, vibrant colors, high quality, detailed`;

const IMAGE_FILENAME = "papi_chulo_potato_pizza_with_corn_and_cotija.png";
const OUTPUT_PATH = join(process.cwd(), "attached_assets", "generated_images", IMAGE_FILENAME);

async function generateImageWithOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY environment variable not set");
    console.log("\nTo generate the image:");
    console.log("1. Get an API key from https://platform.openai.com/api-keys");
    console.log("2. Run: OPENAI_API_KEY=your_key npx tsx scripts/generate-pizza-image.ts");
    console.log("\nOr use a free alternative:");
    console.log("- Microsoft Copilot: https://copilot.microsoft.com (free DALL-E 3)");
    console.log("- Pollo AI: https://pollo.ai/im/dall-e (free DALL-E)");
    console.log("- Puter.js: https://developer.puter.com (free, unlimited)");
    process.exit(1);
  }

  try {
    console.log("🎨 Generating pizza image with DALL-E...");
    console.log(`Prompt: ${PIZZA_PROMPT}\n`);

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: PIZZA_PROMPT,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0].url;

    console.log("✅ Image generated! Downloading...");

    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    await writeFile(OUTPUT_PATH, Buffer.from(imageBuffer));

    console.log(`✅ Image saved to: ${OUTPUT_PATH}`);
    console.log("\nThe pizza image has been generated and saved!");
    console.log("You can now run 'npm run seed' to add the pizza to the database.");
  } catch (error) {
    console.error("❌ Error generating image:", error);
    console.log("\nAlternative: You can manually generate the image using:");
    console.log(`Prompt: ${PIZZA_PROMPT}`);
    console.log(`Save as: ${IMAGE_FILENAME}`);
    console.log(`Location: attached_assets/generated_images/`);
    process.exit(1);
  }
}

// Check if OpenAI is available, otherwise provide instructions
if (process.env.OPENAI_API_KEY) {
  generateImageWithOpenAI();
} else {
  console.log("📝 Pizza Image Generation Instructions");
  console.log("=====================================\n");
  console.log(`Image Name: ${IMAGE_FILENAME}`);
  console.log(`Save Location: attached_assets/generated_images/\n`);
  console.log("Prompt for image generation:");
  console.log(`"${PIZZA_PROMPT}"\n`);
  console.log("Free options to generate the image:");
  console.log("1. Microsoft Copilot (free DALL-E 3):");
  console.log("   https://copilot.microsoft.com");
  console.log("   - Open Copilot");
  console.log("   - Use the prompt above");
  console.log("   - Download and save to the location above\n");
  console.log("2. Pollo AI (free DALL-E):");
  console.log("   https://pollo.ai/im/dall-e");
  console.log("   - Use the prompt above\n");
  console.log("3. Puter.js (free, unlimited):");
  console.log("   https://developer.puter.com/tutorials/free-unlimited-image-generation-api\n");
  console.log("4. With OpenAI API key:");
  console.log("   OPENAI_API_KEY=your_key npx tsx scripts/generate-pizza-image.ts\n");
}




