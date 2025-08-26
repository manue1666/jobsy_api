import { FavServiceModel } from "../../Models/FavService_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

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
            return res.status(409).json({
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