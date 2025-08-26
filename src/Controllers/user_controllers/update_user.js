import multer from "multer";
import { UserModel } from "../../Models/User_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { deleteImage, uploadImage } from "../../utils/imageService.js";

const upload = multer({ dest: 'tmp/uploads/' });

export const updateUser = [
  authenticateToken,
  upload.single('profileImage'), // Middleware para procesar la imagen
  async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;
      const updateData = req.body;

      const user = await UserModel.findOne({ _id: id, _id: user_id });
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      // 1. Manejo de imagen
      if (req.file) {
        if (user.profilePhoto) await deleteImage(user.profilePhoto);
        updateData.profilePhoto = await uploadImage(req.file.path, 'profiles');
      }

      // 2. Validar campos permitidos
      const allowedUpdates = ['name', 'email', 'profilePhoto', 'user_location', 'password'];
      const updates = Object.keys(updateData);
      const isValidOperation = updates.every(update => allowedUpdates.includes(update));

      if (!isValidOperation) {
        return res.status(400).json({ error: "Actualizaciones no válidas" });
      }

      // 3. Actualizar campos
      updates.forEach(update => {
        user[update] = updateData[update];
      });

      await user.save();

      // 4. Eliminar contraseña de la respuesta
      const userObj = user.toObject();
      delete userObj.password;

      res.status(200).json({
        msg: "Usuario actualizado",
        user: userObj
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error del servidor" });
    }
  }
];