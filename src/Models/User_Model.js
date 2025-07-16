import { model, Schema } from "mongoose";
//usar bcrypt

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
    phone:{
        type:String,
        required:true
    },
    profilePhoto:{
        type:String
    },
    location:{
        type:{
            type:String,
            default:"Point"
        },
        coordinates:[Number]
    },
    isVerified:{
        type:Boolean,
        default:false
    },
},{timestamps:true});

//cifrado de contraseña antes de guardar(pendiente)

//metodo para comparar contraseñas(pendiente)


export const UserModel = model("users", UserSchema);