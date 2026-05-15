import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

// Crypto provider for Deno Edge Functions
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '' 
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  console.log(`[Webhook] Requête reçue : ${req.method}`)
  const signature = req.headers.get('stripe-signature')

  try {
    const body = await req.text()
    
    // 1. Vérification de la signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SIGNING_SECRET est manquant")
    
    // Utilisation de constructEventAsync pour Deno
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature || '',
      webhookSecret,
      undefined,
      cryptoProvider
    )

    console.log(`[Webhook] Événement valide: ${event.type}`)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const userId = session.metadata?.user_id
      const plan = session.metadata?.plan

      console.log(`[Webhook] Session complétée. Type: ${plan}, User: ${userId}`)

      if (!userId || !plan) {
         throw new Error("Metadata (user_id ou plan) manquantes dans la session Stripe.")
      }

      // 2. Mise à jour du profil dans Supabase
      console.log(`[Webhook] Tentative de mise à jour Supabase pour ${userId}...`)
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          subscription_type: plan, 
          stripe_customer_id: session.customer 
        })
        .eq('id', userId)

      if (error) {
        console.error(`[Webhook] Erreur Supabase lors de la MAJ: ${error.message}`)
        throw error
      }
      console.log(`[Webhook] Mise à jour Supabase réussie pour ${userId} !`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error(`[Webhook Error] ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})
