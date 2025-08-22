import stripePackage from "stripe";
import { Types } from "mongoose";
import { ServiceModel } from "../Models/Service_Model.js";
import { BOOST_PLANS } from "./constants.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(401).json({ error: "Firma no proporcionada" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Error verificando webhook:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log("🔔 Evento recibido:", event.type);

  // Manejar eventos de pago exitoso
  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "charge.succeeded"
  ) {
    // ✅ EXTRAER METADATOS
    let metadata = {};
    if (event.type === "payment_intent.succeeded") {
      metadata = event.data.object.metadata || {};
      console.log("💰 Procesando payment_intent.succeeded");
    } else if (event.type === "charge.succeeded") {
      metadata = event.data.object.metadata || {};
      console.log("💳 Procesando charge.succeeded");
    }

    const { serviceId, planId } = metadata;
    console.log(
      "📋 Metadata extraída - ServiceId:",
      serviceId,
      "PlanId:",
      planId
    );

    // ✅ VALIDACIÓN ROBUSTA DE METADATOS
    if (!serviceId || !planId) {
      console.error("❌ Metadata faltante o incompleta");
      return res.status(400).json({ error: "Metadata inválida" });
    }

    if (!Types.ObjectId.isValid(serviceId)) {
      console.error("❌ ObjectId inválido:", serviceId);
      return res.status(400).json({ error: "ServiceId inválido" });
    }

    if (!BOOST_PLANS[planId]) {
      console.error("❌ Plan no válido:", planId);
      return res.status(400).json({ error: "Plan no válido" });
    }

    try {
      console.log("🔄 Actualizando servicio en BD...");

      const selectedPlan = BOOST_PLANS[planId];
      const promotionDuration = selectedPlan.duration;
      const promotedUntil = new Date(Date.now() + promotionDuration);

      const updatedService = await ServiceModel.findByIdAndUpdate(
        serviceId,
        {
          isPromoted: true,
          promotedUntil: promotedUntil,
          promotionPlan: planId,
        },
        { new: true, runValidators: true }
      );

      if (!updatedService) {
        console.error("❌ Servicio no encontrado:", serviceId);
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      console.log("✅ Servicio actualizado exitosamente:", {
        serviceId: updatedService._id,
        isPromoted: updatedService.isPromoted,
        promotedUntil: updatedService.promotedUntil,
        promotionPlan: updatedService.promotionPlan,
      });
    } catch (dbError) {
      console.error("❌ Error de base de datos:", dbError);
      // ⭐ REVERTIR EL PAGO SI FALLA LA BD
      try {
        const paymentIntentId = event.data.object.id;
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: "failed_service_activation",
        });
        console.log("⚠️ Pago revertido por fallo en BD");
      } catch (refundError) {
        console.error(
          "❌ Error crítico: No se pudo revertir el pago:",
          refundError
        );
      }
    }
  }

  // Manejar cancelaciones
  if (event.type === "payment_intent.canceled") {
    const paymentIntent = event.data.object;
    const { serviceId } = paymentIntent.metadata || {};

    if (serviceId) {
      try {
        await ServiceModel.findByIdAndUpdate(serviceId, {
          isPromoted: false,
          promotedUntil: null,
          promotionPlan: null,
        });
        console.log("🔄 Boost revertido por cancelación de pago");
      } catch (error) {
        console.error("❌ Error revertiendo boost:", error);
      }
    }
  }

  res.json({ received: true });
};
