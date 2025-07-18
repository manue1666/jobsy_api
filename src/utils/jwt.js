import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config()

export const generateToken = (user_id) => {
    try {
        return jwt.sign({user_id}, process.env.JWT_SECRET,{
            expiresIn: "2h"
        })        
    } catch (error) {
        console.log("error al generar token", error)
    }
}

export const verifyToken = (token) =>{
    return jwt.verify(token, process.env.JWT_SECRET)
}