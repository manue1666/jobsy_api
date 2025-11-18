import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { PaymentLogModel } from "../../Models/PaymentLog_Model.js";
import { BOOST_PLANS } from "../../utils/constants.js";
import { Types } from "mongoose";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

export const boostService = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id: serviceId } = req.params;
      const { planId } = req.body;
      const userId = req.user?.user_id;

      // ===== VALIDACIONES INICIALES =====
      if (!userId) {
        console.error("[Boost] Usuario no autenticado");
        return res.status(401).json({
          error: "No autenticado",
          message: "Debes iniciar sesión para promocionar servicios",
        });
      }

      if (!serviceId) {
        console.error("[Boost] ServiceId no proporcionado");
        return res.status(400).json({
          error: "service_id_required",
          message: "ID del servicio es requerido",
        });
      }

      if (!planId) {
        console.error("[Boost] PlanId no proporcionado");
        return res.status(400).json({
          error: "plan_id_required",
          message: "Plan ID es requerido",
        });
      }

      // Validar ObjectId válido
      if (!Types.ObjectId.isValid(serviceId)) {
        console.error("[Boost] ServiceId inválido:", serviceId);
        return res.status(400).json({
          error: "invalid_service_id",
          message: "ID del servicio no es válido",
        });
      }

      console.log(
        "[Boost] Procesando request - User:",
        userId,
        "Service:",
        serviceId,
        "Plan:",
        planId
      );

      // ===== VALIDAR PLAN =====
      const selectedPlan = BOOST_PLANS[planId];
      if (!selectedPlan) {
        console.error("[Boost] Plan no válido:", planId);
        return res.status(400).json({
          error: "invalid_plan",
          message: "Plan no válido. Planes disponibles: 24h, 72h, 7d",
          availablePlans: Object.keys(BOOST_PLANS),
        });
      }

      // ===== VALIDAR SERVICIO =====
      const service = await ServiceModel.findById(serviceId);
      if (!service) {
        console.error("[Boost] Servicio no encontrado:", serviceId);
        return res.status(404).json({
          error: "service_not_found",
          message: "Servicio no encontrado",
        });
      }

      // Validar que el servicio pertenezca al usuario
      if (service.user_id.toString() !== userId) {
        console.error(
          "[Boost] Usuario no autorizado - Service owner:",
          service.user_id,
          "Requesting user:",
          userId
        );
        return res.status(403).json({
          error: "unauthorized",
          message: "No tienes permiso para promocionar este servicio",
        });
      }

/*       // Validar que el servicio esté activo
      if (!service.isActive) {
        console.error("[Boost] Servicio inactivo:", serviceId);
        return res.status(400).json({
          error: "service_inactive",
          message:
            "No puedes promocionar un servicio inactivo. Actívalo primero.",
        });
      } */

      // ===== VALIDAR PROMOCIÓN ACTIVA =====
      if (
        service.isPromoted &&
        service.promotedUntil &&
        new Date(service.promotedUntil) > new Date()
      ) {
        const remainingTime = new Date(service.promotedUntil) - new Date();
        const remainingHours = Math.ceil(remainingTime / (1000 * 60 * 60));
        const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));

        console.log(
          "[Boost] Servicio ya promocionado hasta:",
          service.promotedUntil,
          "Remaining hours:",
          remainingHours
        );

        return res.status(409).json({
          error: "already_promoted",
          message: "Este servicio ya está en promoción",
          promotedUntil: service.promotedUntil,
          currentPlan: service.promotionPlan || "unknown",
          remainingHours: remainingHours,
          remainingMinutes: remainingMinutes,
        });
      }

      // ===== VERIFICAR PAGOS PENDIENTES =====
      const pendingPayment = await PaymentLogModel.findOne({
        service_id: serviceId,
        status: "pending",
        type: "service_boost",
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // Últimos 15 minutos
      });

      if (pendingPayment) {
        console.log(
          "[Boost] Pago pendiente encontrado:",
          pendingPayment.stripe_payment_intent_id
        );

        // Verificar estado del PaymentIntent en Stripe
        try {
          const existingPI = await stripe.paymentIntents.retrieve(
            pendingPayment.stripe_payment_intent_id
          );

          if (
            existingPI.status === "requires_payment_method" ||
            existingPI.status === "requires_confirmation"
          ) {
            console.log(
              "[Boost] Retornando PaymentIntent existente:",
              existingPI.id
            );
            return res.status(200).json({
              clientSecret: existingPI.client_secret,
              amount: existingPI.amount,
              paymentIntentId: existingPI.id,
              status: existingPI.status,
              message:
                "Tienes un pago pendiente. Complétalo para activar la promoción.",
            });
          }
        } catch (piError) {
          console.error(
            "[Boost] Error verificando PaymentIntent existente:",
            piError.message
          );
        }
      }

      // ===== CREAR PAYMENT INTENT =====
      console.log(
        "[Boost] Creando nuevo PaymentIntent - Amount:",
        selectedPlan.amount,
        "Plan:",
        planId
      );

      // Usar idempotency key para prevenir duplicados
      const idempotencyKey = `boost-${serviceId}-${planId}-${Date.now()}`;

      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: selectedPlan.amount,
          currency: "mxn",
          payment_method_types: ["card"],
          metadata: {
            serviceId: serviceId.toString(),
            planId: planId,
            userId: userId.toString(),
            type: "service_boost",
            planName: selectedPlan.label || planId,
          },
          capture_method: "automatic",
          description: `Boost ${selectedPlan.label} para servicio ${
            service.name || serviceId
          }`,
        },
        { idempotencyKey }
      );

      console.log(
        "[Boost] ✅ PaymentIntent creado:",
        paymentIntent.id,
        "Status:",
        paymentIntent.status
      );

      // ===== REGISTRAR EN PAYMENT LOG =====
      await PaymentLogModel.create({
        user_id: service.user_id,
        service_id: serviceId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: selectedPlan.amount,
        currency: "mxn",
        status: "pending",
        type: "service_boost",
        metadata: {
          serviceId: serviceId.toString(),
          planId: planId,
          planName: selectedPlan.label || planId,
          duration: selectedPlan.duration,
        },
      });

      console.log("[Boost] PaymentLog creado para PI:", paymentIntent.id);

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        amount: selectedPlan.amount,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        plan: {
          id: planId,
          label: selectedPlan.label,
          duration: selectedPlan.duration,
          amount: selectedPlan.amount,
        },
        service: {
          id: service._id,
          name: service.name,
        },
      });
    } catch (error) {
      console.error("❌ Error en boostService:", error);

      // Manejo específico de errores de Stripe
      if (error.type === "StripeCardError") {
        return res.status(402).json({
          error: "card_error",
          message: error.message,
        });
      }

      if (error.type === "StripeInvalidRequestError") {
        return res.status(400).json({
          error: "invalid_request",
          message: error.message,
        });
      }

      return res.status(500).json({
        error: "internal_error",
        message: "Error al procesar el pago",
        details:
          process.env.NODE_ENV === "development" ? error.message : null,
      });
    }
  },
];