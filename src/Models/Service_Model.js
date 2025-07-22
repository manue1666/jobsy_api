import { model, Schema } from "mongoose";
import { CATEGORIES } from "../utils/constants";


const ServiceSchema = new Schema({
    //relacion con el usuario
    user_id:{
        type:Schema.Types.ObjectId,
        ref:"users",
        required:true
    },
    //nombre del servicio
    service_name:{
        type:String,
        required:true
    },
    //categoria del servicio
    category:{
        type:String,
        required:true,
        enum:CATEGORIES
    },
    description:{
        type:String,
        required:true
    },
    //contactos para el servicio
    phone:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    service_location:{
        type:{
            type:String,
            default:"Point"
        },
        coordinates:[Number]
    },
    //url de fotos
    photos:[
        {type:String}
    ],
    
    //imprime fecha de creacion y actualizacion
},{timestamps:true});


ServiceSchema.index({ user_id: 1 }); // para busquedas mas rapidas
ServiceSchema.index({ service_location: '2dsphere' }); // para geolocalizacion

export const ServiceModel = model("services",ServiceSchema)