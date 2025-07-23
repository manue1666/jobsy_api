import { model, Schema } from "mongoose";
import bcrypt from "bcrypt"


const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePhoto: {
        type: String
    },
    user_location: {
        type: {
            type: String,
            default: "Point",
            enum: ["Point"], 
            required: false
        },
        coordinates: {
            type: [Number],
            default: [0, 0], 
            validate: {
                validator: function(v) {
                    return v.length === 2 && 
                           typeof v[0] === 'number' && 
                           typeof v[1] === 'number';
                },
                message: props => `${props.value} no es un conjunto de coordenadas válido [longitud, latitud]`
            },
            required: false
        }
    },
    isVerified: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

//cifrar la contraseña antes de guardar
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

//comparar contraseñas
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


export const UserModel = model("users", UserSchema);