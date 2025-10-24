import { UserModel } from "../../Models/User_Model.js";


export const register = async (req, res) => {
    try {

        if (Array.isArray(req.body)) {
            for (const userarray of req.body) {
                const { name, email, password } = userarray
                if (!name || !email || !password) {
                    return res.status(400).json({
                        "error": "datos incompletos"
                    })
                }
                //buscar si ya existe el usuario
                const userExist = await UserModel.findOne({ email })
                if (userExist) {
                    return res.status(409).json({
                        "msg": "el usuario ya esta registrado."
                    })
                }

                //Creación de usuario -> Espera de una promesa
                await UserModel.create({ name, email, password })

                //Mandar respuesta de exito:
                console.log("Usuario correctamente registrado: \n name:" + name + "\n email: " + email + "\n password: " + password);
            }
            return res.status(201).json({ users: req.body });
        } else {

            const { name, email, password } = req.body
            if (!name || !email || !password) {
                return res.status(400).json({
                    "error": "datos incompletos"
                })
            }
            //buscar si ya existe el usuario
            const userExist = await UserModel.findOne({ email })
            if (userExist) {
                return res.status(409).json({
                    "msg": "el usuario ya esta registrado"
                })
            }
            const user = await UserModel.create({ name, email, password })

            //convertir la respuesta a objeto
            const userObj = user.toObject()


            res.status(201).json({
                user: userObj
            })

        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ "error": "error al crear usuario" })

    }
};