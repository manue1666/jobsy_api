import { UserModel } from "../../Models/User_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";




export const deleteUser = [authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.user_id; //obtener user_id del token

        //verificar que el usuario exista y sea el mismo que hace la petición
        const user = await UserModel.findOneAndDelete({ _id: id, _id: user_id });

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado o no tienes permisos"
            });
        }

        //convertir a objeto y eliminar la contraseña de la respuesta
        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            msg: "Usuario eliminado con éxito",
            deletedUser: userObj
        });

    } catch (error) {
        console.log(error);

        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de usuario inválido" });
        }

        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];