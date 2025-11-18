import { model, Schema } from "mongoose";

const PaymentLogSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    service_id: {
      type: Schema.Types.ObjectId,
      ref: "services",
      default: null,
    },
    stripe_payment_intent_id: {
      type: String,
      default: null,
    },
    stripe_charge_id: {
      type: String,
      default: null,
    },
    stripe_subscription_id: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "mxn",
    },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "canceled"],
      default: "pending",
    },
    type: {
      type: String,
      enum: ["premium_subscription", "service_boost", "webhook_processing"],
      required: true,
    },
    error_message: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

PaymentLogSchema.index({ user_id: 1, created_at: -1 });
PaymentLogSchema.index({ stripe_payment_intent_id: 1 });
PaymentLogSchema.index({ status: 1, type: 1 });

export const PaymentLogModel = model("payment_logs", PaymentLogSchema);