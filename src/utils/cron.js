import cron from "node-cron";
import stripePackage from "stripe";
import { ServiceModel } from "../Models/Service_Model.js";
import { UserModel } from "../Models/User_Model.js";

// 🗑️ Job de Limpieza de Promociones Expiradas
const promotionCleanupJob = async () => {
  try {
    console.log("🔄 Limpiando promociones expiradas...");
    const result = await ServiceModel.cleanExpiredPromotions();
    if (result.modifiedCount > 0) {
      console.log(`✅ ${result.modifiedCount} promociones expiradas limpiadas`);
    }
  } catch (error) {
    console.error("❌ Error limpiando promociones:", error);
  }
};

// 🗑️ Job de Limpieza de Premium Expirado
const premiumCleanupJob = async () => {
  try {
    console.log("🔄 Limpiando usuarios premium expirados...");
    const result = await UserModel.cleanExpiredPremium();
    if (result.modifiedCount > 0) {
      console.log(
        `✅ ${result.modifiedCount} usuarios premium expirados limpiados`
      );
    }
  } catch (error) {
    console.error("❌ Error limpiando premium:", error);
  }
};

// 🚀 Función para Iniciar Todos los Cron Jobs
export const startAllCronJobs = () => {
  // Job de limpieza de promociones cada hora
  cron.schedule("0 * * * *", promotionCleanupJob);
  console.log("✅ Cron job de limpieza de promociones iniciado (cada hora)");

  // Job de limpieza de premium cada hora
  cron.schedule("0 * * * *", premiumCleanupJob);
  console.log("✅ Cron job de limpieza de premium iniciado (cada hora)");

  // ⭐ Ejecutar inmediatamente al iniciar
  setTimeout(() => {
    promotionCleanupJob();
    premiumCleanupJob();
  }, 60000); // Ejecutar después de 60 segundos

  console.log("✅ Todos los cron jobs iniciados correctamente");
};
