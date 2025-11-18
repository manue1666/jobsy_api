import cron from "node-cron";
import stripePackage from "stripe";
import { ServiceModel } from "../Models/Service_Model.js";
import { UserModel } from "../Models/User_Model.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

// Job de Limpieza de Promociones Expiradas
const promotionCleanupJob = async () => {
  try {
    console.log("Limpiando promociones expiradas...");
    const result = await ServiceModel.cleanExpiredPromotions();
    if (result.modifiedCount > 0) {
      console.log(
        `${result.modifiedCount} promociones expiradas limpiadas`
      );
    }
  } catch (error) {
    console.error("Error limpiando promociones:", error);
  }
};

// Job de Limpieza de Premium Expirado
const premiumCleanupJob = async () => {
  try {
    console.log("Limpiando usuarios premium expirados...");
    const result = await UserModel.cleanExpiredPremium();
    if (result.modifiedCount > 0) {
      console.log(
        `${result.modifiedCount} usuarios premium expirados limpiados`
      );
    }
  } catch (error) {
    console.error("Error limpiando premium:", error);
  }
};

// Job de Sincronizacion Stripe - BD (cada 6 horas) - MAS ROBUSTO
const stripeSync = async () => {
  try {
    console.log("Sincronizando suscripciones con Stripe...");
    const users = await UserModel.find({}).lean(); // Todos, no solo isPremium: true

    let activeInStripeCount = 0;
    let fixedCount = 0;
    let deactivatedCount = 0;

    for (const user of users) {
      if (!user.stripeCustomerId) continue;

      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 1,
      });

      const subscription = subs.data[0];
      const isActiveInStripe = subscription && ["active", "trialing"].includes(subscription.status);
      const isPremiumInBD = Boolean(user.isPremium);

      // Caso 1: Active en Stripe pero no en BD -> ARREGLAR
      if (isActiveInStripe && !isPremiumInBD) {
        let premiumUntil = null;
        if (subscription.current_period_end) {
          premiumUntil = new Date(subscription.current_period_end * 1000);
        }

        await UserModel.updateOne(
          { _id: user._id },
          { isPremium: true, premiumUntil }
        );
        console.log("CORREGIDO: Premium activado para usuario", user._id);
        fixedCount++;
      }
      // Caso 2: Active en Stripe y en BD -> OK
      else if (isActiveInStripe && isPremiumInBD) {
        activeInStripeCount++;
      }
      // Caso 3: Inactivo en Stripe pero activo en BD -> DESACTIVAR
      else if (!isActiveInStripe && isPremiumInBD) {
        await UserModel.updateOne(
          { _id: user._id },
          { isPremium: false, premiumUntil: null }
        );
        console.log("Desactivado premium para usuario", user._id);
        deactivatedCount++;
      }
    }

    console.log("Sincronizacion completada:", {
      activeInStripe: activeInStripeCount,
      fixed: fixedCount,
      deactivated: deactivatedCount,
    });
  } catch (error) {
    console.error("Error en sincronizacion Stripe:", error);
  }
};

// Funcion para Iniciar Todos los Cron Jobs
export const startAllCronJobs = () => {
  // Job de limpieza de promociones cada hora
  cron.schedule("0 * * * *", promotionCleanupJob);
  console.log(
    "Cron job de limpieza de promociones iniciado (cada hora)"
  );

  // Job de limpieza de premium cada hora
  cron.schedule("0 * * * *", premiumCleanupJob);
  console.log("Cron job de limpieza de premium iniciado (cada hora)");

  // Job de sincronizacion Stripe cada 6 horas
  cron.schedule("0 */6 * * *", stripeSync);
  console.log("Cron job de sincronizacion Stripe iniciado (cada 6 horas)");

  // Ejecutar inmediatamente al iniciar (despues de 60 segundos)
  setTimeout(() => {
    promotionCleanupJob();
    premiumCleanupJob();
    stripeSync();
  }, 60000);

  console.log("Todos los cron jobs iniciados correctamente");
};
