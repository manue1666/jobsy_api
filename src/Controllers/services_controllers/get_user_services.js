import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";



export const getUserServices = [
  authenticateToken,
  async (req, res) => {
    try {
      const user_id = req.user.user_id;

      const services = await ServiceModel.find({ user_id })
        .populate("user_id", "name profilePhoto")
        .lean();

      res.status(200).json({
        count: services.length,
        services,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        error: "algo salió mal en el servidor",
      });
    }
  },
];