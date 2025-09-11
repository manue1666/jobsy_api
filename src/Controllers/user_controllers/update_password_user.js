import { UserModel } from "../../Models/User_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import bcrypt from "bcrypt";

export const updatePasswordUser = [
  authenticateToken,
  async (req, res) => {
    try {
      const user_id = req.user.user_id;
      const { currentPassword, password } = req.body;

      if (!currentPassword || !password) {
        return res.status(400).json({ error: "Debes enviar la contraseña actual y la nueva contraseña" });
      }

      const user = await UserModel.findById(user_id);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "La contraseña actual es incorrecta" });
      }

      // Asignar en texto plano y dejar que el pre('save') del modelo la hashee
      user.password = password;
      await user.save();

      const userObj = user.toObject();
      delete userObj.password;

      res.status(200).json({
        msg: "Contraseña actualizada",
        user: userObj
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error del servidor" });
    }
  }
];