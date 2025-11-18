import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { PaymentLogModel } from "../../Models/PaymentLog_Model.js";
import { BOOST_PLANS } from "../../utils/constants.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export const boostService = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id: serviceId } = req.params;
      const { planId } = req.body;

      console.log(
        "Recibiendo boost request - ServiceId:",
        serviceId,
        "PlanId:",
        planId
      );

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

      // Validar que no este ya en promocion activa
      if (
        service.isPromoted &&
        service.promotedUntil &&
        new Date(service.promotedUntil) > new Date()
      ) {
        const remainingHours = Math.ceil(
          (new Date(service.promotedUntil) - new Date()) / (1000 * 60 * 60)
        );
        return res.status(400).json({
          error: "already_promoted",
          message: "Este servicio ya esta en promocion",
          promotedUntil: service.promotedUntil,
          remainingHours: remainingHours,
        });
      }

      const selectedPlan = BOOST_PLANS[planId];
      if (!selectedPlan) {
        return res.status(400).json({ error: "Plan no valido" });
      }

      // Crear Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: selectedPlan.amount,
        currency: "mxn",
        payment_method_types: ["card"],
        metadata: {
          serviceId: serviceId.toString(),
          planId: planId,
        },
        capture_method: "automatic",
      });

      console.log(
        "Payment Intent creado - Service:",
        serviceId,
        "Plan:",
        planId
      );
      console.log("Amount:", selectedPlan.amount, "Metadata:", {
        serviceId,
        planId,
      });

      // Registrar intento de pago en PaymentLog
      await PaymentLogModel.create({
        user_id: service.user_id,
        service_id: serviceId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: selectedPlan.amount,
        currency: "mxn",
        status: "pending",
        type: "service_boost",
        metadata: { serviceId, planId, planName: planId },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        amount: selectedPlan.amount,
        paymentIntentId: paymentIntent.id,
        status: "requires_payment_method",
      });
    } catch (error) {
      console.error("Error en boostService:", error);
      res.status(500).json({
        error: "Error al procesar el pago",
        details:
          process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  },
];