import { model, Schema } from "mongoose";
import bcrypt from "bcrypt";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePhoto: {
      type: String,
    },
    user_location: {
      type: {
        type: String,
        default: "Point",
        enum: ["Point"],
        required: false,
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
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
    servicesCount: {
      type: Number,
      default: 0,
    },
    favoritesCount: {
      type: Number,
      default: 0,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    premiumUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

//cifrar la contraseña antes de guardar
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.statics.cleanExpiredPremium = async function () {
  // Solo limpia si premiumUntil expiró hace más de 1 día
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await this.updateMany(
    {
      isPremium: true,
      premiumUntil: { $lt: oneDayAgo },
    },
    {
      $set: {
        isPremium: false,
        premiumUntil: null,
      },
    }
  );
  return result;
};

//comparar contraseñas
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const UserModel = model("users", UserSchema);
