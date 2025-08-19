import { FavServiceModel } from "../../Models/FavService_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { UserModel } from "../../Models/User_Model.js";

export const searchServicesNearby = [
  authenticateToken,
  async (req, res) => {
    try {
      const { longitude, latitude } = req.query;

      // 1. Validar coordenadas
      if (!longitude || !latitude) {
        return res.status(400).json({ error: "Se requieren coordenadas" });
      }

      const coords = [
        parseFloat(longitude.toString()),
        parseFloat(latitude.toString()),
      ];

      // 2. Actualizar ubicación del usuario
      await UserModel.findByIdAndUpdate(
        req.user._id,
        {
          user_location: {
            type: "Point",
            coordinates: coords,
          },
        },
        { new: true }
      );

      // 3. Buscar servicios cercanos
      const maxDistance = req.query.maxDistance || 10000; // 10km por defecto

      const services = await ServiceModel.find({
        service_location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: coords,
            },
            $maxDistance: maxDistance,
          },
        },
      })
        .populate("user_id", "name profilePhoto")
        .lean();

      // Verificar favoritos
      const favoriteServices = await FavServiceModel.find({
        user_id: req.user._id,
      });
      const favoriteIds = favoriteServices.map((fav) =>
        fav.service_id.toString()
      );

      const formattedServices = services.map((service) => ({
        ...service,
        isFavorite: favoriteIds.includes(service._id.toString()),
        user: service.user_id, // Mover user_id a user
        // Eliminar user_id para mantener consistencia
        user_id: undefined,
      }));

      res.json(formattedServices);
    } catch (error) {
      console.error("Error en searchServicesNearby:", error);
      res.status(500).json({ error: "Error al buscar servicios cercanos" });
    }
  },
];