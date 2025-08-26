import { FavServiceModel } from "../../Models/FavService_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";



export const removeFavoriteService = [authenticateToken, async (req, res) => {
    try {
        const { id: service_id } = req.params;
        const user_id = req.user.user_id;

        // buscar y eliminar el favorito
        const deletedFavorite = await FavServiceModel.findOneAndDelete({
            user_id,
            service_id
        });

        if (!deletedFavorite) {
            return res.status(404).json({
                error: "Servicio favorito no encontrado o no tienes permisos"
            });
        }

        res.status(200).json({
            msg: "Servicio eliminado de favoritos",
            deletedFavorite: deletedFavorite.toObject()
        });

    } catch (error) {
        console.log(error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de servicio inválido" });
        }
        
        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];