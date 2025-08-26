import { UserModel } from "../../Models/User_Model.js";

export const getAllUsers = async (_req, res) => {
    try {
        const users = await UserModel.find({}, { password: 0 });
        if (users.length == 0) {
            return res.status(404).json({
                "error": "no hay usuarios para mostrar"
            })
        }
        res.status(200).json(users)
    } catch (error) {
        res.status(500).json({ error: "error al obtener usuarios" })
    }
};