import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. GESTION DU CORS (ESSENTIEL)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. VÉRIFICATION DU CORPS DE LA REQUÊTE
    const body = await req.text()
    if (!body) {
      throw new Error("Le corps de la requête est vide. Vérifiez l'appel depuis le client.")
    }

    const { plan, user_id, email } = JSON.parse(body) as { plan: 'GOLD' | 'DIAMANT', user_id: string, email: string }
    console.log(`[Checkout] Requête reçue pour le plan: ${plan}, User: ${user_id}`)

    // Mapping des plans vers tes Price IDs Stripe (Paiement Unique / A vie)
    const prices: Record<string, string> = {
      'GOLD': 'price_1TKNnF1E637e5G6go8w6V027', 
      'DIAMANT': 'price_1TKNnr1E637e5G6gebY9NBEZ', 
    }

    if (!prices[plan]) {
      throw new Error(`Plan inconnu: ${plan}`)
    }

    // 3. VÉRIFICATION DE LA CLÉ STRIPE
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error("La clé STRIPE_SECRET_KEY est manquante dans les secrets Supabase.")
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [
        { price: prices[plan], quantity: 1 },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/success.html?plan=${plan}`,
      cancel_url: `${req.headers.get('origin')}/subscriptions.html`,
      metadata: {
        user_id: user_id,
        plan: plan
      }
    })

    console.log(`[Checkout] Session créée avec succès: ${session.id}`)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(`[Checkout Error] ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
