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

    // --- PREMIUM USER LOGIC (legacy, deshabilitado para suscripciones) ---
    // Las membresías premium por suscripción se manejan en los eventos
    // customer.subscription.* e invoice.payment_succeeded más abajo.
    if (metadata.type === "premium") {
      // Ignorado aquí; se maneja por eventos de suscripción/invoice
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

  // Manejar eventos de suscripción premium
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const subscription = event.data.object;
    const { userId, type } = subscription.metadata || {};
    if (type === "premium" && userId && Types.ObjectId.isValid(userId)) {
      // Solo activar premium si la suscripción está activa
      if (subscription.status === "active") {
        // Evitar escribir una fecha inválida; si falta, activamos premium y
        // delegamos premiumUntil a invoice.payment_succeeded o a cuando Stripe provea el valor.
        try {
          const update = { isPremium: true };
          if (
            typeof subscription.current_period_end === "number" &&
            !isNaN(subscription.current_period_end)
          ) {
            update.premiumUntil = new Date(
              subscription.current_period_end * 1000
            );
          } else {
            // Si no hay fecha, calcular manualmente 30 días desde ahora si el usuario no tiene premiumUntil
            const user = await UserModel.findById(userId);
            if (!user.premiumUntil) {
              update.premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              console.warn(
                "⚠️ Calculando premiumUntil manualmente:", update.premiumUntil
              );
            } else {
              console.warn(
                "⚠️ subscription.current_period_end inválido y usuario ya tiene premiumUntil:",
                subscription.current_period_end
              );
            }
          }
          await UserModel.findByIdAndUpdate(userId, update, {
            new: true,
            runValidators: true,
          });
          console.log(`✅ Usuario activado como premium:`, userId);
        } catch (dbError) {
          console.error("❌ Error actualizando usuario premium:", dbError);
        }
      } else {
        // No desactivar premium si la suscripción no está activa
        console.log(`ℹ️ Suscripción premium no activa para usuario:`, userId);
      }
    }
  }

  // Activar premium al pagarse la factura (primer cobro de la suscripción)
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    if (invoice.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const { userId, type } = sub.metadata || {};
        if (type === "premium" && userId && Types.ObjectId.isValid(userId)) {
          if (sub.status === "active") {
            // Preferir la fecha del periodo del invoice (línea 0), fallback a sub.current_period_end
            let premiumUntil = null;
            const line = invoice.lines?.data?.[0];
            const periodEndSec = line?.period?.end;
            if (typeof periodEndSec === "number" && !isNaN(periodEndSec)) {
              premiumUntil = new Date(periodEndSec * 1000);
            } else if (
              typeof sub.current_period_end === "number" &&
              !isNaN(sub.current_period_end)
            ) {
              premiumUntil = new Date(sub.current_period_end * 1000);
            } else {
              console.warn(
                "⚠️ No se pudo determinar premiumUntil (invoice/sub sin period_end)"
              );
            }
            await UserModel.findByIdAndUpdate(
              userId,
              premiumUntil
                ? { isPremium: true, premiumUntil }
                : { isPremium: true },
              { new: true, runValidators: true }
            );
            console.log(`✅ Usuario activado como premium (invoice):`, userId);
          } else {
            console.log(
              `ℹ️ invoice.payment_succeeded pero sub no activa:`,
              sub.id
            );
          }
        }
      } catch (e) {
        console.error("❌ Error manejando invoice.payment_succeeded:", e);
      }
    }
  }

  // Desactivar premium cuando la suscripción se elimina/cancela
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const { userId, type } = subscription.metadata || {};
    if (type === "premium" && userId && Types.ObjectId.isValid(userId)) {
      try {
        await UserModel.findByIdAndUpdate(
          userId,
          { isPremium: false, premiumUntil: null },
          { new: true, runValidators: true }
        );
        console.log(
          `⚠️ Suscripción cancelada. Usuario desactivado como premium:`,
          userId
        );
      } catch (e) {
        console.error("❌ Error al desactivar premium por cancelación:", e);
      }
    }
  }

  // Asignar automáticamente el método de pago como default al completar SetupIntent
  if (event.type === "setup_intent.succeeded") {
    const setupIntent = event.data.object;
    const customerId = setupIntent.customer;
    const paymentMethodId = setupIntent.payment_method;
    if (customerId && paymentMethodId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId }
        });
        console.log(`✅ Método de pago ${paymentMethodId} asignado como default para ${customerId}`);
      } catch (err) {
        console.error("❌ Error asignando método de pago default:", err);
      }
    }
  }

  res.json({ received: true });
};
