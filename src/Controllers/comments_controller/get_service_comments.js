import { CommentModel } from "../../Models/Comment_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

export const getCommentsByService = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id: service_id } = req.params;

      // Verificar si el servicio existe
      const serviceExists = await ServiceModel.findById(service_id);
      if (!serviceExists) {
        return res.status(404).json({
          error: "Servicio no encontrado",
        });
      }

      // Buscar todos los comentarios del servicio y popular la info del usuario
      const comments = await CommentModel.find({ service_id }) // Filtra por el ID del servicio
        .populate({
          path: "user_id", // Campo a popular
          select: "name profilePhoto", // Selecciona solo estos campos del usuario
        })
        .sort({ createdAt: -1 }); // Ordena por fecha de creación DESCENDENTE (más nuevos primero)

      res.status(200).json({
        success: true,
        comments: comments,
      });
    } catch (error) {
      console.log("Error en getCommentsByService:", error);

      if (error.name === "CastError") {
        return res.status(400).json({ error: "ID de servicio inválido" });
      }

      res.status(500).json({
        error: "Error interno del servidor al obtener los comentarios",
      });
    }
  },
];
