import { FavServiceModel } from "../../Models/FavService_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

export const getFavoriteServices = [authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        
        // paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // obtener favoritos con información completa del servicio
        const favorites = await FavServiceModel.find({ user_id })
            .populate({
                path: 'service_id',
                select: '-__v',
                populate: {
                    path: 'user_id',
                    select: 'name'
                }
            })
            .skip(skip)
            .limit(limit)
            .lean();
        
        // contar total para paginación
        const total = await FavServiceModel.countDocuments({ user_id });
        
        // formatear respuesta
        const formattedFavorites = favorites.map(fav => {
            const service = fav.service_id;
            return {
                ...service,
                favoriteId: fav._id,
                addedAt: fav.createdAt
            };
        });
        
        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit),
            favorites: formattedFavorites
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Error al obtener servicios favoritos"
        });
    }
}];