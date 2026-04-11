export async function POST() {
  return Response.json(
    { error: "Checkout temporairement désactivé en production." },
    { status: 503 }
  );
}