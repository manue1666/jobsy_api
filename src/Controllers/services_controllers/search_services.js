import { FavServiceModel } from "../../Models/FavService_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { CATEGORIES } from "../../utils/constants.js";

export const searchServices = [
  authenticateToken,
  async (req, res) => {
    try {
      const { query, category, ownerId } = req.query;
      const user_id = req.user.user_id;

      // validar categoría si viene en los parámetros
      if (category && !CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: "Categoría no válida",
          validCategories: CATEGORIES,
        });
      }

      // construir objeto de filtro
      const filter = {};

      // filtro por texto (nombre o descripción)
      if (query) {
        filter.$or = [
          { service_name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ];
      }

      // filtro por categoría
      if (category) {
        filter.category = category;
      }

      //Filtro por autor
      if (ownerId) {
        filter.user_id = ownerId;
      }

      // paginación
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // consulta a la base de datos
      const services = await ServiceModel.find(filter)
        .skip(skip)
        .limit(limit)
        .populate({
          path: "user_id",
          select: "name profilePhoto",
        })
        .lean();

      // contar total para paginación
      const total = await ServiceModel.countDocuments(filter);

      // verificar favoritos si el usuario está autenticado
      const favoriteServices = await FavServiceModel.find({ user_id });
      const favoriteIds = favoriteServices.map((fav) =>
        fav.service_id.toString()
      );

      const servicesWithFavorites = services.map((service) => ({
        ...service,
        isFavorite: favoriteIds.includes(service._id.toString()),
        user: service.user_id, // Mover la info de usuario a un campo 'user'
      }));

      // eliminar el campo user_id ya que se movio a 'user'
      const finalServices = servicesWithFavorites.map(
        ({ user_id, ...rest }) => rest
      );

      res.status(200).json({
        total,
        page,
        pages: Math.ceil(total / limit),
        services: finalServices,
        ...(category ? { currentCategory: category } : {}),
        ...(ownerId ? { currentOwnerId: ownerId } : {}),
        ...(query ? { currentQuery: query } : {}),
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        error: "Error al buscar servicios",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
];