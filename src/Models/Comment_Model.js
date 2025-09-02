import { model, Schema } from "mongoose";

const CommentSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  service_id: {
    type: Schema.Types.ObjectId,
    ref: "services",
    required: true
  },
  comment:{
    type:String,
    required: true
  }
},{timestamps:true});

export const CommentModel = model("comments", CommentSchema)
