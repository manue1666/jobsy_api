import { FavServiceModel } from "../../Models/FavService_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { UserModel } from "../../Models/User_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";


export const getCurrentUserProfile = [authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        // Contar servicios y favoritos
        const serviceCount = await ServiceModel.countDocuments({ user_id });
        const favoriteCount = await FavServiceModel.countDocuments({ user_id });

        // Actualizar los campos en el usuario
        await UserModel.findByIdAndUpdate(
            user_id,
            {
                servicesCount: serviceCount,
                favoritesCount: favoriteCount
            }
        );

        // Obtener información del usuario actualizada
        const user = await UserModel.findById(user_id)
            .select('-password -__v')
            .lean();

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        res.status(200).json({
            user
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Error al obtener perfil"
        });
    }
}];
