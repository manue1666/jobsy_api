import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";

// Puedes definir los planes premium aquí o importarlos de un archivo de constantes
const PREMIUM_PLANS = {
  "monthly": {
    amount: 9900, // $99.00 MXN (en centavos)
    interval: "month",
    description: "Membresía premium mensual"
  }
};

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil'
});

export const premiumUser = [
  authenticateToken,
  async (req, res) => {
    try {
      // Solo se requiere el planId para el monto, pero no se usará en metadata
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "Plan ID es requerido" });
      }

      const selectedPlan = PREMIUM_PLANS[planId];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Plan no válido" });
      }

      // Crear PaymentIntent para la membresía premium
      const paymentIntent = await stripe.paymentIntents.create({
        amount: selectedPlan.amount,
        currency: "mxn",
        payment_method_types: ['card'],
        metadata: {
          userId: req.user.user_id,
          type: "premium"
        },
        capture_method: 'automatic',
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: selectedPlan.amount,
        paymentIntentId: paymentIntent.id,
        status: 'requires_payment_method'
      });

    } catch (error) {
      console.error('❌ Error en premiumUser:', error);
      res.status(500).json({
        error: "Error al procesar el pago de membresía premium",
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  }
];
