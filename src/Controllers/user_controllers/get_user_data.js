import { UserModel } from "../../Models/User_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

export const getUserData = [
  authenticateToken,
  async (req, res) => {
    try {
      const user_id = req.params.id;
      // Excluir campos sensibles y no requeridos
      const user = await UserModel.findById(user_id)
        .select("-user_location -isVerified -premiumUntil -updatedAt -favoritesCount -password")
        .lean();
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      // Obtener servicios creados por el usuario
      const services = await ServiceModel.find({ user_id })
        .select("_id service_name category description phone email address photos tipo isPromoted promotedUntil promotionPlan favoritesCount createdAt")
        .lean();
      res.status(200).json({
        user,
        services,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error en el servidor" });
    }
  },
];