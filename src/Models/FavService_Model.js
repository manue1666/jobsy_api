import { model, Schema } from "mongoose";

//schema para servicios guardados como favoritos
const FavServiceSchema = new Schema({
    //id del usuario
    user_id:{
        type:Schema.Types.ObjectId,
        ref:"users",
        required:true
    },
    //id del servicio favorito
    service_id:{
        type:Schema.Types.ObjectId,
        ref:"services",
        required:true
    },
},{timestamps:true});

FavServiceSchema.index(
  { user_id: 1, service_id: 1 },
  { unique: true }
);

export const FavServiceModel = model("fav_service", FavServiceSchema)
