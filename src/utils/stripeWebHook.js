import stripePackage from 'stripe';
import { Types } from 'mongoose';
import { ServiceModel } from '../Models/Service_Model.js';
import { BOOST_PLANS } from './constants.js';

const stripe = stripePackage(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-07-30.basil'
});

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(401).json({ error: 'Firma no proporcionada' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('🔔 Evento recibido:', event.type);

  // Permitir múltiples eventos
  if (event.type !== 'payment_intent.succeeded' && event.type !== 'charge.succeeded') {
    console.log('Evento no manejado, respondiendo 200');
    return res.json({ received: true });
  }

  // Extraer metadata según el tipo de evento
  let serviceId, planId;
  if (event.type === 'payment_intent.succeeded') {
    console.log('Procesando payment_intent.succeeded');
    ({ serviceId, planId } = event.data.object.metadata || {});
  } else if (event.type === 'charge.succeeded') {
    console.log('Procesando charge.succeeded');
    ({ serviceId, planId } = event.data.object.metadata || {});
  }

  console.log('Metadata extraída - ServiceId:', serviceId, 'PlanId:', planId);

  // Validar metadata
  if (!serviceId || !planId) {
    console.error('❌ Metadata faltante');
    return res.status(400).json({ error: 'Metadata inválida' });
  }

  if (!Types.ObjectId.isValid(serviceId)) {
    console.error('❌ ObjectId inválido:', serviceId);
    return res.status(400).json({ error: 'ServiceId inválido' });
  }

  // Resto del código igual...

  if (!BOOST_PLANS[planId]) {
    console.error('❌ Plan no válido:', planId);
    return res.status(400).json({ error: 'Plan no válido' });
  }

  try {
    console.log('Actualizando servicio en BD...');
    const updatedService = await ServiceModel.findByIdAndUpdate(
      serviceId,
      {
        isPromoted: true,
        promotedUntil: new Date(Date.now() + BOOST_PLANS[planId]),
        promotionPlan: planId
      },
      { new: true }
    );
    
    if (!updatedService) {
      console.error('❌ Servicio no encontrado:', serviceId);
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    
    console.log('✅ Servicio actualizado:', updatedService);
    res.json({ received: true });
  } catch (dbError) {
    console.error('❌ Error de base de datos:', dbError);
    res.status(500).json({ 
      error: 'Error en la base de datos',
      details: process.env.NODE_ENV === 'development' ? dbError.message : null
    });
  }
};