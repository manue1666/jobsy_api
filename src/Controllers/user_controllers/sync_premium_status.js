import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { UserModel } from "../../Models/User_Model.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export const syncPremiumStatus = [
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: "Usuario sin customer de Stripe" });
      }

      console.log("Sincronizando premium para usuario:", userId);

      // Obtener suscripción de Stripe
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        limit: 1,
      });

      const subscription = subs.data[0];

      if (!subscription) {
        return res.status(400).json({ 
          error: "Sin suscripcion activa",
          message: "No se encontro suscripcion en Stripe"
        });
      }

      console.log("Suscripcion encontrada:", subscription.id, "Status:", subscription.status);

      // Determinar si debe estar activo
      const isActive = ["active", "trialing"].includes(subscription.status);

      if (!isActive) {
        console.log("Suscripcion no activa, desactivando premium");
        await UserModel.findByIdAndUpdate(userId, {
          isPremium: false,
          premiumUntil: null,
        });
        
        return res.status(200).json({
          success: true,
          message: "Premium desactivado (suscripcion no activa)",
          isPremium: false,
          subscriptionStatus: subscription.status,
        });
      }

      // Obtener fecha de fin del periodo actual
      let premiumUntil = null;
      
      if (subscription.current_period_end) {
        premiumUntil = new Date(subscription.current_period_end * 1000);
        console.log("Premium Until (from subscription):", premiumUntil);
      } else {
        // Si no hay current_period_end, obtener de la factura
        const invoices = await stripe.invoices.list({
          subscription: subscription.id,
          limit: 1,
        });

        if (invoices.data.length > 0) {
          const invoice = invoices.data[0];
          const line = invoice.lines?.data?.[0];
          if (line?.period?.end) {
            premiumUntil = new Date(line.period.end * 1000);
            console.log("Premium Until (from invoice):", premiumUntil);
          }
        }
      }

      // Actualizar usuario en BD
      const updateData = { isPremium: true };
      if (premiumUntil) {
        updateData.premiumUntil = premiumUntil;
      }

      const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
        new: true,
      });

      console.log("Usuario sincronizado:", {
        userId,
        isPremium: updatedUser.isPremium,
        premiumUntil: updatedUser.premiumUntil,
      });

      return res.status(200).json({
        success: true,
        message: "Premium sincronizado correctamente",
        isPremium: updatedUser.isPremium,
        premiumUntil: updatedUser.premiumUntil,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000)
          : null,
      });
    } catch (error) {
      console.error("Error en syncPremiumStatus:", error);
      return res.status(500).json({
        error: "Error sincronizando premium",
        details: error.message,
      });
    }
  },
];