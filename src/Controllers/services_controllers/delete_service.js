
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";



export const deleteService = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;

      // Verificar que el servicio exista y pertenezca al usuario
      const service = await ServiceModel.findOneAndDelete({ _id: id, user_id });

      if (!service) {
        return res.status(404).json({
          error: "Servicio no encontrado o no tienes permisos",
        });
      }

      res.status(200).json({
        msg: "Servicio eliminado con éxito",
        deletedService: service.toObject(),
      });
    } catch (error) {
      console.log(error);

      if (error.name === "CastError") {
        return res.status(400).json({ error: "ID de servicio inválido" });
      }

      res.status(500).json({
        error: "algo salió mal en el servidor",
      });
    }
  },
];