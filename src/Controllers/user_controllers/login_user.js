import { UserModel } from "../../Models/User_Model.js"
import { generateToken } from "../../utils/jwt.js"



export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            res.status(400).json({
                "error": "datos incompletos"
            })
        }

        const user = await UserModel.findOne({ email }).select("+password")


        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ "error": "credenciales invalidas" })
        }

        const token = generateToken(user._id)
        const userObj = user.toObject()

        res.status(200).json({ token, user: userObj })

    } catch (error) {
        res.status(500).json({ "error": "no se logro iniciar sesion" })
    }
}
