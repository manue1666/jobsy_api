import { FavServiceModel } from "../../Models/FavService_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { UserModel } from "../../Models/User_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";


export const getCurrentUserProfile = [authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        //obtener información del usuario
        const user = await UserModel.findById(user_id)
            .select('-password -__v')
            .lean();

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        // obtener estadísticas (opcional)
        const serviceCount = await ServiceModel.countDocuments({ user_id });
        const favoriteCount = await FavServiceModel.countDocuments({ user_id });

        res.status(200).json({
            user,
            stats: {
                services: serviceCount,
                favorites: favoriteCount
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Error al obtener perfil"
        });
    }
}];
