import truffleImage from "@assets/generated_images/white_pizza_with_truffle_and_mushrooms.png";
import crustGptImage from "@assets/generated_images/pesto_pizza_with_ricotta_and_arugula.png";
import senorCrustobalImage from "@assets/generated_images/taco_style_pizza_with_corn_and_avocado.png";

export const PIZZA_IMAGES: Record<string, string> = {
  "3": truffleImage,
  "4": crustGptImage,
  "5": senorCrustobalImage,
};

export const DEFAULT_PIZZA_IMAGE = truffleImage;
