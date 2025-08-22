import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { BOOST_PLANS } from "../../utils/constants.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil'
});


export const boostService = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id: serviceId } = req.params;
      const { planId } = req.body;

      console.log('📦 Recibiendo boost request - ServiceId:', serviceId, 'PlanId:', planId);

      if (!planId) {
        return res.status(400).json({ error: "Plan ID es requerido" });
      }

      const service = await ServiceModel.findById(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      if (service.user_id.toString() !== req.user.user_id) {
        return res.status(403).json({ error: "Acceso no autorizado" });
      }

      const selectedPlan = BOOST_PLANS[planId];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Plan no válido" });
      }

      // ✅ CREAR PAYMENT INTENT (sin capturar inmediatamente)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: selectedPlan.amount,
        currency: "mxn",
        payment_method_types: ['card'],
        metadata: { 
          serviceId: serviceId.toString(),
          planId: planId 
        },
        // ⭐ IMPORTANTE: Dejar capture_method en 'automatic' (default)
        // para que Stripe capture automáticamente cuando el pago sea exitoso
        capture_method: 'automatic',
      });

      console.log(`✅ PaymentIntent creado - Service: ${serviceId}, Plan: ${planId}`);
      console.log(`💰 Amount: ${selectedPlan.amount}, Metadata:`, { serviceId, planId });

      // ⭐ NO ACTUALIZAR BD AQUÍ - Esperar al webhook
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        amount: selectedPlan.amount,
        paymentIntentId: paymentIntent.id,
        status: 'requires_payment_method'
      });

    } catch (error) {
      console.error('❌ Error en boostService:', error);
      res.status(500).json({ 
        error: "Error al procesar el pago",
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  },
];