# CRUSTOPS - Experimental Pizza Test Kitchen

Full-stack web application for CRUSTOPS offering free pizzas in exchange for honest reviews.

## Architecture
- **Frontend**: React + TypeScript with Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with custom "Paper & Flour" theme

## Key Features
- OTP-based phone authentication
- Service window restrictions (Thu-Sat 4PM-8PM)
- Daily pie limits (15 per day)
- Admin dashboard for pizza/order management
- User profiles with order history

## Brand Identity
- Theme: Industrial "Ops Center" aesthetic
- Tagline: "Instantiate Pizza. Satiate Hunger."
- Fonts: Space Mono (monospace) + Space Grotesk (display)
- Logo: Wordmark with gear-shaped "O" containing pizza slice

## Menu
1. **Truffle Shuffle** ($24) - Wild mushrooms, garlic confit, taleggio, white truffle oil
2. **CrustGPT** ($23) - Pesto, pecorino, tomatoes, ricotta lemon honey drizzle
3. **Señor Crustobal** ($25) - Taco chili oil, corn, chipotle lime, avocado

## TODO: SMS Integration
- Twilio integration was dismissed during setup
- Current OTP codes are logged to console for testing
- To enable real SMS: Set up Twilio integration or provide API credentials as secrets
