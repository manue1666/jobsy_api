import { model, Schema } from "mongoose";
import bcrypt from "bcrypt"


const UserSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    //url de imagen
    profilePhoto:{
        type:String
    },
    isVerified:{
        type:Boolean,
        default:false
    },
},{timestamps:true});

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