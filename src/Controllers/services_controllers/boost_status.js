import { authenticateToken } from "../../utils/authMiddleware.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { PaymentLogModel } from "../../Models/PaymentLog_Model.js";
import { Types } from "mongoose";

export const getBoostStatus = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id: serviceId } = req.params;
      const userId = req.user?.user_id;

      if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      if (!Types.ObjectId.isValid(serviceId)) {
        return res.status(400).json({ error: "ID de servicio inválido" });
      }

      const service = await ServiceModel.findById(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Servicio no encontrado" });
      }

      if (service.user_id.toString() !== userId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const now = new Date();
      const isCurrentlyPromoted = 
        service.isPromoted && 
        service.promotedUntil && 
        new Date(service.promotedUntil) > now;

      let remainingTime = null;
      if (isCurrentlyPromoted) {
        const timeLeft = new Date(service.promotedUntil) - now;
        remainingTime = {
          hours: Math.floor(timeLeft / (1000 * 60 * 60)),
          minutes: Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)),
          total_milliseconds: timeLeft,
        };
      }

      // Obtener historial de pagos
      const paymentHistory = await PaymentLogModel.find({
        service_id: serviceId,
        type: "service_boost",
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("amount status createdAt completed_at metadata");

      return res.status(200).json({
        serviceId: service._id,
        serviceName: service.name,
        isPromoted: isCurrentlyPromoted,
        promotedUntil: service.promotedUntil,
        promotionPlan: service.promotionPlan,
        lastPromotedAt: service.lastPromotedAt,
        remainingTime,
        paymentHistory: paymentHistory.map(p => ({
          amount: p.amount,
          status: p.status,
          plan: p.metadata?.planId || p.metadata?.planName,
          createdAt: p.createdAt,
          completedAt: p.completed_at,
        })),
      });

    } catch (error) {
      console.error("Error en getBoostStatus:", error);
      return res.status(500).json({
        error: "Error al obtener estado de promoción",
        details: process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  },
];