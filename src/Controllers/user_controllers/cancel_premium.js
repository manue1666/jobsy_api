import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { UserModel } from "../../Models/User_Model.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2025-07-30.basil",
});

// Cancelar suscripción premium (inmediato o al final del periodo)
export const cancelPremium = [
	authenticateToken,
	async (req, res) => {
		try {
			const userId = req.user?.user_id;
			const cancelAtPeriodEnd = Boolean(req.body?.cancelAtPeriodEnd);
			if (!userId) return res.status(401).json({ error: "No autenticado" });

			const user = await UserModel.findById(userId);
			if (!user || !user.stripeCustomerId) {
				return res.status(404).json({ error: "Usuario no encontrado" });
			}

			// Buscar suscripción activa o trialing del cliente
			const subs = await stripe.subscriptions.list({
				customer: user.stripeCustomerId,
				status: "all",
				limit: 10,
			});
			const activeSub = subs.data.find((s) =>
				["active", "trialing", "past_due", "unpaid"].includes(s.status)
			);
			if (!activeSub) {
				return res.status(400).json({ error: "No tienes una suscripción activa" });
			}

			let updated;
			if (cancelAtPeriodEnd) {
				updated = await stripe.subscriptions.update(activeSub.id, {
					cancel_at_period_end: true,
				});
			} else {
				updated = await stripe.subscriptions.cancel(activeSub.id);
			}

			return res.status(200).json({
				success: true,
				subscriptionId: updated.id,
				status: updated.status,
				cancelAtPeriodEnd: updated.cancel_at_period_end || false,
			});
		} catch (error) {
			console.error("❌ Error cancelando suscripción premium:", error);
			return res.status(500).json({ error: "Error cancelando suscripción" });
		}
	},
];

