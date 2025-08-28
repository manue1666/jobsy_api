import stripePackage from "stripe";
import { Types } from "mongoose";
import { ServiceModel } from "../Models/Service_Model.js";
import { UserModel } from "../Models/User_Model.js";
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

    // --- PREMIUM USER LOGIC ---
    if (metadata.type === "premium") {
      const { userId } = metadata;
      if (!userId || !Types.ObjectId.isValid(userId)) {
        console.error("❌ userId inválido o faltante:", userId);
        return res.status(400).json({ error: "userId inválido" });
      }
      // Solo mensual por ahora, 30 días
      const premiumDays = 30;
      const premiumUntil = new Date(
        Date.now() + premiumDays * 24 * 60 * 60 * 1000
      );

      try {
        const updatedUser = await UserModel.findByIdAndUpdate(
          userId,
          {
            isPremium: true,
            premiumUntil: premiumUntil,
          },
          { new: true, runValidators: true }
        );
        if (!updatedUser) {
          console.error("❌ Usuario no encontrado:", userId);
          return res.status(404).json({ error: "Usuario no encontrado" });
        }
        console.log("✅ Usuario actualizado a premium:", {
          userId: updatedUser._id,
          premiumUntil: updatedUser.premiumUntil,
        });
      } catch (dbError) {
        console.error("❌ Error de base de datos (premium):", dbError);
        try {
          const paymentIntentId = event.data.object.id;
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: "failed_premium_activation",
          });
          console.log("⚠️ Pago revertido por fallo en BD (premium)");
        } catch (refundError) {
          console.error(
            "❌ Error crítico: No se pudo revertir el pago (premium):",
            refundError
          );
        }
      }
      return res.json({ received: true });
    }

    // --- BOOST SERVICE LOGIC ---
    const { serviceId, planId } = metadata;
    if (serviceId && planId) {
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
