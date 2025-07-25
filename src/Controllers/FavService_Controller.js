import { FavServiceModel } from "../Models/FavService_Model.js";
import { ServiceModel } from "../Models/Service_Model.js";
import { authenticateToken } from "../utils/authMiddleware.js";

export const addFavoriteService = [authenticateToken, async (req, res) => {
    try {
        const { id: service_id } = req.params;
        const user_id = req.user.user_id;

        // verificar si el servicio existe
        const serviceExists = await ServiceModel.findById(service_id);
        if (!serviceExists) {
            return res.status(404).json({
                error: "Servicio no encontrado"
            });
        }

        // verificar si ya está marcado como favorito
        const existingFavorite = await FavServiceModel.findOne({ 
            user_id, 
            service_id 
        });

        if (existingFavorite) {
            return res.status(400).json({
                error: "Este servicio ya está en tus favoritos"
            });
        }

        // crear el nuevo favorito
        const favorite = await FavServiceModel.create({
            user_id,
            service_id
        });

        res.status(201).json({
            msg: "Servicio agregado a favoritos",
            favorite: favorite.toObject()
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