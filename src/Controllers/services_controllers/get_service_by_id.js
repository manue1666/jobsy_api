import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";



export const getServiceById = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const service = await ServiceModel.findById(id).lean();

      if (!service) {
        return res.status(404).json({
          error: "Servicio no encontrado",
        });
      }

      res.status(200).json({
        service,
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