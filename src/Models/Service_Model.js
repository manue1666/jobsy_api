import { model, Schema } from "mongoose";


const ServiceSchema = new Schema({
    //relacion con el usuario
    user_id:{
        type:Schema.Types.ObjectId,
        ref:"users",
        required:true
    },
    category:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    //url de fotos
    photos:[
        {type:String}
    ],
    
    //imprime fecha de creacion y actualizacion
},{timestamps:true});

export const ServiceModel = model("services",ServiceSchema)