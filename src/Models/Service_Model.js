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

    //imprime fecha de creacion y actualizacion
  },
  { timestamps: true }
);

ServiceSchema.index({ user_id: 1 }); // para busquedas mas rapidas
ServiceSchema.index({ service_location: "2dsphere" }); // para geolocalizacion

export const ServiceModel = model("services", ServiceSchema);
