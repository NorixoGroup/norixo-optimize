import { stripe } from "@/stripe/server"

export async function POST() {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: "Concierge Plan" },
          unit_amount: 3900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:3000/dashboard",
    cancel_url: "http://localhost:3000/dashboard",
  })

  return Response.json({ url: session.url })
}