import stripePackage from "stripe";
import { Types } from "mongoose";
import { ServiceModel } from "../Models/Service_Model.js";
import { UserModel } from "../Models/User_Model.js";
import { PaymentLogModel } from "../Models/PaymentLog_Model.js";
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
    console.error("Error verificando webhook:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log("Evento recibido:", event.type);

  // Manejar eventos de pago exitoso
  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "charge.succeeded"
  ) {
    let metadata = {};
    if (event.type === "payment_intent.succeeded") {
      metadata = event.data.object.metadata || {};
      console.log("Procesando payment_intent.succeeded");
    } else if (event.type === "charge.succeeded") {
      metadata = event.data.object.metadata || {};
      console.log("Procesando charge.succeeded");
    }

    if (metadata.type === "premium") {
      // Ignorado aqui; se maneja por eventos de suscripcion/invoice
    }

    // --- BOOST SERVICE LOGIC ---
    const { serviceId, planId } = metadata;
    if (serviceId && planId) {
      console.log("[Webhook] Procesando boost - Service:", serviceId, "Plan:", planId);

      // Validar ObjectId
      if (!Types.ObjectId.isValid(serviceId)) {
        console.error("[Webhook] ServiceId inválido:", serviceId);
        return res.json({ received: true });
      }

      // Validar plan
      if (!BOOST_PLANS[planId]) {
        console.error("[Webhook] Plan inválido:", planId);
        return res.json({ received: true });
      }

      try {
        const service = await ServiceModel.findById(serviceId);
        if (!service) {
          console.error("[Webhook] Servicio no encontrado:", serviceId);
          return res.json({ received: true });
        }

        const plan = BOOST_PLANS[planId];
        const promotedUntil = new Date(Date.now() + plan.duration);

        console.log("[Webhook] Actualizando servicio en BD...");
        console.log("[Webhook] Plan details:", {
          planId,
          duration: plan.duration,
          promotedUntil: promotedUntil.toISOString(),
        });

        // Actualizar servicio
        const updatedService = await ServiceModel.findByIdAndUpdate(
          serviceId,
          {
            isPromoted: true,
            promotedUntil: promotedUntil,
            promotionPlan: planId,
            lastPromotedAt: new Date(),
          },
          { new: true }
        );

        if (!updatedService) {
          console.error("[Webhook] Error al actualizar servicio:", serviceId);
          return res.json({ received: true });
        }

        console.log("[Webhook] ✅ Servicio promocionado exitosamente:", {
          serviceId: updatedService._id,
          isPromoted: updatedService.isPromoted,
          promotedUntil: updatedService.promotedUntil,
          promotionPlan: updatedService.promotionPlan,
        });

        // Actualizar PaymentLog a succeeded
        const paymentIntentId = event.data.object.id;
        await PaymentLogModel.findOneAndUpdate(
          { stripe_payment_intent_id: paymentIntentId },
          { 
            status: "succeeded",
            completed_at: new Date(),
          }
        );

        console.log("[Webhook] PaymentLog actualizado a succeeded:", paymentIntentId);

      } catch (dbError) {
        console.error("[Webhook] ❌ Error de BD al actualizar servicio:", dbError);
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

        // Registrar cancelacion
        await PaymentLogModel.create({
          service_id: serviceId,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: "canceled",
          type: "service_boost",
          metadata: paymentIntent.metadata || {},
        });

        console.log("Boost revertido por cancelacion de pago");
      } catch (error) {
        console.error("Error revertiendo boost:", error);
      }
    }
  }

  // Manejar eventos de suscripcion premium
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const subscription = event.data.object;
    const { userId, type } = subscription.metadata || {};
    if (type === "premium" && userId && Types.ObjectId.isValid(userId)) {
      if (subscription.status === "active") {
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
            const user = await UserModel.findById(userId);
            if (!user.premiumUntil) {
              update.premiumUntil = new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              );
              console.warn(
                "Calculando premiumUntil manualmente:",
                update.premiumUntil
              );
            } else {
              console.warn(
                "subscription.current_period_end invalido y usuario ya tiene premiumUntil:",
                subscription.current_period_end
              );
            }
          }
          await UserModel.findByIdAndUpdate(userId, update, {
            new: true,
            runValidators: true,
          });
          console.log("Usuario activado como premium:", userId);
        } catch (dbError) {
          console.error("Error actualizando usuario premium:", dbError);
        }
      } else {
        console.log("Suscripcion premium no activa para usuario:", userId);
      }
    }
  }

  // Activar premium al pagarse la factura
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    if (invoice.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const { userId, type } = sub.metadata || {};
        if (type === "premium" && userId && Types.ObjectId.isValid(userId)) {
          if (sub.status === "active") {
            let premiumUntil = null;
            
            // Intentar obtener de la factura primero
            const line = invoice.lines?.data?.[0];
            const periodEndSec = line?.period?.end;
            if (typeof periodEndSec === "number" && !isNaN(periodEndSec)) {
              premiumUntil = new Date(periodEndSec * 1000);
              console.log("premiumUntil obtenido de invoice.lines:", premiumUntil);
            } 
            // Si no, obtener de la suscripcion
            else if (
              typeof sub.current_period_end === "number" &&
              !isNaN(sub.current_period_end)
            ) {
              premiumUntil = new Date(sub.current_period_end * 1000);
              console.log("premiumUntil obtenido de subscription.current_period_end:", premiumUntil);
            } 
            // Si tampoco, calcular manualmente 30 dias desde ahora
            else {
              premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              console.warn("premiumUntil calculado manualmente (30 dias):", premiumUntil);
            }

            const updateData = { isPremium: true };
            if (premiumUntil) {
              updateData.premiumUntil = premiumUntil;
            }

            const updatedUser = await UserModel.findByIdAndUpdate(
              userId,
              updateData,
              { new: true, runValidators: true }
            );

            // Registrar pago exitoso de suscripcion
            await PaymentLogModel.create({
              user_id: userId,
              stripe_subscription_id: sub.id,
              stripe_charge_id: invoice.charge,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: "succeeded",
              type: "premium_subscription",
              metadata: { 
                invoiceId: invoice.id, 
                subscriptionId: sub.id,
                premiumUntil: premiumUntil 
              },
            });

            console.log("Usuario activado como premium (invoice):", {
              userId,
              isPremium: updatedUser.isPremium,
              premiumUntil: updatedUser.premiumUntil,
            });
          } else {
            console.log(
              "invoice.payment_succeeded pero sub no activa:",
              sub.id,
              "Status:",
              sub.status
            );
          }
        }
      } catch (e) {
        console.error("Error manejando invoice.payment_succeeded:", e);
      }
    }
  }

  // Manejar fallos de pago en facturas
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const customerId = invoice.customer;

    try {
      // Buscar usuario por stripe customer id
      const user = await UserModel.findOne({
        stripeCustomerId: customerId,
      });

      if (user) {
        // Registrar fallo
        await PaymentLogModel.create({
          user_id: user._id,
          stripe_subscription_id: invoice.subscription,
          amount: invoice.amount_due,
          currency: invoice.currency,
          status: "failed",
          type: "premium_subscription",
          error_message: "Pago de factura fallido",
          metadata: { invoiceId: invoice.id },
        });

        console.log("Pago fallido registrado para usuario:", user._id);
        // TODO: Enviar email notificando fallo de pago
      }
    } catch (error) {
      console.error("Error manejando invoice.payment_failed:", error);
    }
  }

  // Desactivar premium cuando la suscripcion se elimina/cancela
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

        // Registrar cancelacion
        await PaymentLogModel.create({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          amount: 0,
          currency: "mxn",
          status: "canceled",
          type: "premium_subscription",
          metadata: { reason: "subscription_deleted" },
        });

        console.log(
          "Suscripcion cancelada. Usuario desactivado como premium:",
          userId
        );
      } catch (e) {
        console.error("Error al desactivar premium por cancelacion:", e);
      }
    }
  }

  // Asignar automaticamente el metodo de pago como default al completar SetupIntent
  if (event.type === "setup_intent.succeeded") {
    const setupIntent = event.data.object;
    const customerId = setupIntent.customer;
    const paymentMethodId = setupIntent.payment_method;
    if (customerId && paymentMethodId) {
      try {
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
        console.log(
          `Metodo de pago ${paymentMethodId} asignado como default para ${customerId}`
        );
      } catch (err) {
        console.error("Error asignando metodo de pago default:", err);
      }
    }
  }

  res.json({ received: true });
};
