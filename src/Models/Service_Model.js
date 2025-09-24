import { model, Schema } from "mongoose";
import { CATEGORIES } from "../utils/constants.js";

const ServiceSchema = new Schema(
  {
    //relacion con el usuario
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    //nombre del servicio
    service_name: {
      type: String,
      required: true,
    },
    //categoria del servicio
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
    description: {
      type: String,
      required: true,
    },
    //contactos para el servicio
    phone: {
      type: String,
      required: true,
      unique: false,
    },
    email: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: false,
      default: "sin direccion",
    },
    service_location: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function (v) {
            return (
              v.length === 2 &&
              typeof v[0] === "number" &&
              typeof v[1] === "number"
            );
          },
          message: (props) =>
            `${props.value} no es un conjunto de coordenadas válido [longitud, latitud]`,
        },
        required: false,
      },
    },
    //url de fotos
    photos: {
      type: [String],
      default: [],
    },
    tipo: {
      type: [String],
      enum: ["domicilio", "comercio"],
      default: [],
    },
    isPromoted: {
      type: Boolean,
      default: false,
    },
    promotedUntil: {
      type: Date,
      default: null,
    },
    promotionPlan: {
      type: String,
      enum: ["24h", "72h", "1week"],
      default: null,
    },
    favoritesCount: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
    // para campos virtuales
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// calcula dinámicamente si está promocionado
ServiceSchema.virtual("isCurrentlyPromoted").get(function () {
  return (
    this.isPromoted && this.promotedUntil && new Date() < this.promotedUntil
  );
});

// actualiza isPromoted automáticamente antes de guardar
ServiceSchema.pre("save", function (next) {
  if (this.isModified("promotedUntil") || this.isModified("isPromoted")) {
    if (this.promotedUntil && new Date() > this.promotedUntil) {
      this.isPromoted = false;
      this.promotionPlan = null;
      this.promotedUntil = null;
    }
  }
  next();
});


//  para limpieza periódica
ServiceSchema.statics.cleanExpiredPromotions = async function () {
  const result = await this.updateMany(
    {
      isPromoted: true,
      promotedUntil: { $lt: new Date() },
    },
    {
      $set: {
        isPromoted: false,
        promotionPlan: null,
        promotedUntil: null,
      },
    }
  );
  return result;
};

// para verificar estado de promoción
ServiceSchema.methods.checkPromotionStatus = function () {
  if (this.promotedUntil && new Date() > this.promotedUntil) {
    this.isPromoted = false;
    this.promotionPlan = null;
    this.promotedUntil = null;
    return false;
  }
  return this.isPromoted;
};

ServiceSchema.index({ user_id: 1 }); // para busquedas mas rapidas
ServiceSchema.index({ service_location: "2dsphere" }); // para geolocalizacion

//para búsquedas de servicios promocionados activos
ServiceSchema.index({
  isPromoted: 1,
  promotedUntil: 1,
});

export const ServiceModel = model("services", ServiceSchema);
