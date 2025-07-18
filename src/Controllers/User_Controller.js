import {UserModel} from "../Models/User_Model.js"
import { generateToken } from "../utils/jwt.js";


export const getAllUsers = async (_req,res) => {
    try {
        const users = await UserModel.find({},{password:0});
        if(users.length == 0){
            return res.status(400).json({
                "error":"no hay usuarios para mostrar"
            })
        }
        res.status(200).json(users)
    } catch (error) {
        res.status(500).json({error: "error al obtener usuarios"})
    }
};

export const register = async (req, res) => {
    try {
        const {name,email,password} = req.body
        if(!name || !email || !password){
            return res.status(400).json({
                "error":"datos incompletos"
            })
        }
        //buscar si ya existe el usuario
        const userExist = await UserModel.findOne({email})
        if(userExist){
            res.status(400).json({
                "msg":"el usuario ya esta registrado"
            })
        }
        const user = await UserModel.create({name,email,password})

        //convertir la respuesta a objeto
        const userObj = user.toObject()
        

        res.status(200).json({
            user:userObj
        })

    } catch (error) {
        res.status(500).json({"error":"error al crear usuario"})
    }
};


export const login = async (req, res) => {
    try {
        const {email,password} = req.body

        if(!email || !password){
            res.status(400).json({
                "error":"datos incompletos"
            })
        }

        const user = await UserModel.findOne({email}).select("+password")

        
        if(!user || !(await user.comparePassword(password))){
            return res.status(400).json({"error":"credenciales invalidas"})
        }

        const token = generateToken(user._id)
        const userObj = user.toObject()

        res.status(200).json({token, user:userObj})

    } catch (error) {
        res.status(500).json({"error":"no se logro iniciar sesion"})
    }
}