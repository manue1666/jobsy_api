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

      const service = await ServiceModel.findById(serviceId);
      if (!service || service.user_id.toString() !== req.user.user_id) {
        return res.status(403).json({ error: "Acceso no autorizado" });
      }

      const selectedPlan = BOOST_PLANS[planId];
      if (!selectedPlan) return res.status(400).json({ error: "Plan no válido" });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: selectedPlan.amount,
        currency: "usd",
        metadata: { serviceId, planId },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
      console.log(`PaymentIntent creado para servicio ${serviceId}. ClientSecret: ${paymentIntent.client_secret}`);
    } catch (error) {
      res.status(500).json({ 
        error: "Error al procesar el pago",
        details: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  },
];