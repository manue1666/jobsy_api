import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { UserModel } from "../../Models/User_Model.js";

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
	apiVersion: "2025-07-30.basil",
});

// Estado e historial de la suscripción premium
export const statusPremium = [
	authenticateToken,
	async (req, res) => {
		try {
			const userId = req.user?.user_id;
			if (!userId) return res.status(401).json({ error: "No autenticado" });

			const user = await UserModel.findById(userId).lean();
			if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

			const result = {
				isPremium: Boolean(user.isPremium),
				premiumUntil: user.premiumUntil || null,
				stripeCustomerId: user.stripeCustomerId || null,
				subscription: null,
				invoices: [],
			};

			if (!user.stripeCustomerId) {
				return res.status(200).json(result);
			}

			// Obtener suscripción más reciente del cliente
			const subs = await stripe.subscriptions.list({
				customer: user.stripeCustomerId,
				status: "all",
				limit: 10,
				expand: ["data.default_payment_method"],
			});
			const latestSub = subs.data[0] || null;

			if (latestSub) {
				result.subscription = {
					id: latestSub.id,
					status: latestSub.status,
					priceId:
						latestSub.items?.data?.[0]?.price?.id || latestSub.items?.data?.[0]?.price,
					currentPeriodEnd: latestSub.current_period_end
						? new Date(latestSub.current_period_end * 1000)
						: null,
					cancelAtPeriodEnd: latestSub.cancel_at_period_end || false,
					defaultPaymentMethod: latestSub.default_payment_method || null,
				};
			}

			// Traer últimas facturas (pagadas y abiertas)
			const invoices = await stripe.invoices.list({
				customer: user.stripeCustomerId,
				limit: 10,
			});
			result.invoices = invoices.data.map((inv) => ({
				id: inv.id,
				status: inv.status,
				amountPaid: inv.amount_paid,
				amountDue: inv.amount_due,
				currency: inv.currency,
				created: inv.created ? new Date(inv.created * 1000) : null,
				hostedInvoiceUrl: inv.hosted_invoice_url,
				periodEnd:
					inv.lines?.data?.[0]?.period?.end
						? new Date(inv.lines.data[0].period.end * 1000)
						: null,
				subscription: inv.subscription || null,
			}));

			return res.status(200).json(result);
		} catch (error) {
			console.error("❌ Error consultando estado de suscripción premium:", error);
			return res.status(500).json({ error: "Error consultando estado de suscripción" });
		}
	},
];

