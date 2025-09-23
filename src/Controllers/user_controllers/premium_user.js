import stripePackage from "stripe";
import { authenticateToken } from "../../utils/authMiddleware.js";



const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-07-30.basil",
});

// Endpoint principal para suscripción premium
export const premiumUser = [
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
      if (!priceId) {
        return res.status(500).json({ error: "Falta STRIPE_PREMIUM_PRICE_ID" });
      }

      const { UserModel } = await import("../../Models/User_Model.js");
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Crear Stripe Customer si no existe y guardarlo
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || user.username || undefined,
          metadata: { userId: user._id.toString() },
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Verificar/default payment method
      let customer = await stripe.customers.retrieve(customerId);
      let defaultPmId =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;
      console.log("[Stripe] Customer loaded:", customerId, "Default PM:", defaultPmId);

      if (!defaultPmId) {
        const pms = await stripe.paymentMethods.list({
          customer: customerId,
          type: "card",
        });
        console.log("[Stripe] PaymentMethods found:", pms.data.map(pm => pm.id));

        if (!pms.data.length) {
          console.log("[Stripe] No payment methods found for customer.");
          return res.status(200).json({
            requiresPaymentMethod: true,
            message:
              "No hay método de pago. Ejecuta el SetupIntent y vuelve a intentar.",
          });
        }

        // Configurar el primero como default para facturación
        defaultPmId = pms.data[0].id;
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: defaultPmId },
        });
        console.log("[Stripe] Default payment method set:", defaultPmId);
        // Esperar y recuperar el customer actualizado
        await new Promise((resolve) => setTimeout(resolve, 1000));
        customer = await stripe.customers.retrieve(customerId);
        console.log("[Stripe] Customer reloaded after update:", customerId, "Default PM:", customer.invoice_settings?.default_payment_method);
      }

      // Confirmar que el método de pago default está presente
      defaultPmId =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;
      console.log("[Stripe] Final default payment method:", defaultPmId);

      if (!defaultPmId) {
        console.log("[Stripe] Failed to set default payment method.");
        return res.status(400).json({
          error: "No se pudo configurar el método de pago como default.",
        });
      }

      console.log("[Stripe] Creating subscription for customer:", customerId);
      // Crear suscripción mensual (con idempotencia y guardado de PM)
      const idempotencyKey = `sub-premium-${user._id}-${Date.now()}`;
      const subscription = await stripe.subscriptions.create(
        {
          customer: customerId,
          items: [{ price: priceId }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
          metadata: {
            userId: user._id.toString(),
            type: "premium",
          },
        },
        { idempotencyKey }
      );
      console.log("[Stripe] Subscription created:", subscription.id, "Status:", subscription.status);

      // Extraer client_secret del PaymentIntent del invoice inicial
      let clientSecret = null;
      const latestInvoice = subscription.latest_invoice;
      if (latestInvoice?.payment_intent) {
        console.log("[Stripe] latest_invoice.payment_intent:", latestInvoice.payment_intent);
        if (typeof latestInvoice.payment_intent === "string") {
          const pi = await stripe.paymentIntents.retrieve(
            latestInvoice.payment_intent
          );
          clientSecret = pi?.client_secret || null;
          console.log("[Stripe] PaymentIntent loaded by ID:", pi?.id, "ClientSecret:", clientSecret);
        } else {
          clientSecret = latestInvoice.payment_intent?.client_secret || null;
          console.log("[Stripe] PaymentIntent object found. ClientSecret:", clientSecret);
        }
      } else {
  console.log("[Stripe] No payment_intent in latest_invoice. Forcing invoice payment...");
        try {
          await stripe.invoices.pay(latestInvoice.id);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const updatedInvoice = await stripe.invoices.retrieve(latestInvoice.id, {
            expand: ["payment_intent"],
          });
          if (updatedInvoice.payment_intent) {
            if (typeof updatedInvoice.payment_intent === "string") {
              const pi = await stripe.paymentIntents.retrieve(updatedInvoice.payment_intent);
              clientSecret = pi?.client_secret || null;
              console.log("[Stripe] PaymentIntent loaded by ID (forced):", pi?.id, "ClientSecret:", clientSecret);
            } else {
              clientSecret = updatedInvoice.payment_intent?.client_secret || null;
              console.log("[Stripe] PaymentIntent object found (forced). ClientSecret:", clientSecret);
            }
          } else {
            console.log("[Stripe] Still no payment_intent after forcing invoice payment.");
          }
        } catch (forceError) {
          console.error("[Stripe] Error forcing invoice payment:", forceError);
        }
      }

      return res.status(200).json({
        clientSecret,
        subscriptionId: subscription.id,
        status: subscription.status,
      });
    } catch (error) {
      console.error("❌ Error en premiumUser:", error);
      return res.status(500).json({
        error: "Error al procesar la suscripción premium",
        details: error?.message || null,
      });
    }
  },
];

// Endpoint para crear SetupIntent (asociar tarjeta)
export const createPremiumSetupIntent = [
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: "No autenticado" });
      }

      const { UserModel } = await import("../../Models/User_Model.js");
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Crear/asegurar customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.name || user.username || undefined,
          metadata: { userId: user._id.toString() },
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      // Crear SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: user._id.toString(),
          type: "premium_setup",
        },
      });

      return res.status(200).json({
        setupIntentClientSecret: setupIntent.client_secret,
      });
    } catch (error) {
      console.error("❌ Error en createPremiumSetupIntent:", error);
      return res.status(500).json({
        error: "Error al crear SetupIntent",
        details: error?.message || null,
      });
    }
  },
];
