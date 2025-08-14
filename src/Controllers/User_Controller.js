import { FavServiceModel } from "../Models/FavService_Model.js";
import { ServiceModel } from "../Models/Service_Model.js";
import { UserModel } from "../Models/User_Model.js"
import { authenticateToken } from "../utils/authMiddleware.js";
import { generateToken } from "../utils/jwt.js";
import bcrypt from "bcrypt"
import multer from 'multer';
import { deleteImage, uploadImage } from "../utils/imageService.js";


const upload = multer({ dest: 'tmp/uploads/' });


export const getAllUsers = async (_req, res) => {
    try {
        const users = await UserModel.find({}, { password: 0 });
        if (users.length == 0) {
            return res.status(404).json({
                "error": "no hay usuarios para mostrar"
            })
        }
        res.status(200).json(users)
    } catch (error) {
        res.status(500).json({ error: "error al obtener usuarios" })
    }
};

export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body
        if (!name || !email || !password) {
            return res.status(400).json({
                "error": "datos incompletos"
            })
        }
        //buscar si ya existe el usuario
        const userExist = await UserModel.findOne({ email })
        if (userExist) {
            return res.status(409).json({
                "msg": "el usuario ya esta registrado"
            })
        }
        const user = await UserModel.create({ name, email, password })

        //convertir la respuesta a objeto
        const userObj = user.toObject()


        res.status(201).json({
            user: userObj
        })

    } catch (error) {
        console.log(error)
        res.status(500).json({ "error": "error al crear usuario" })

    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            res.status(400).json({
                "error": "datos incompletos"
            })
        }

        const user = await UserModel.findOne({ email }).select("+password")


        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ "error": "credenciales invalidas" })
        }

        const token = generateToken(user._id)
        const userObj = user.toObject()

        res.status(200).json({ token, user: userObj })

    } catch (error) {
        res.status(500).json({ "error": "no se logro iniciar sesion" })
    }
}


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


export const deleteUser = [authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.user_id; //obtener user_id del token

        //verificar que el usuario exista y sea el mismo que hace la petición
        const user = await UserModel.findOneAndDelete({ _id: id, _id: user_id });

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado o no tienes permisos"
            });
        }

        //convertir a objeto y eliminar la contraseña de la respuesta
        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            msg: "Usuario eliminado con éxito",
            deletedUser: userObj
        });

    } catch (error) {
        console.log(error);

        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de usuario inválido" });
        }

        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];

export const getCurrentUserProfile = [authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;

        //obtener información del usuario
        const user = await UserModel.findById(user_id)
            .select('-password -__v')
            .lean();

        if (!user) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        // obtener estadísticas (opcional)
        const serviceCount = await ServiceModel.countDocuments({ user_id });
        const favoriteCount = await FavServiceModel.countDocuments({ user_id });

        res.status(200).json({
            user,
            stats: {
                services: serviceCount,
                favorites: favoriteCount
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Error al obtener perfil"
        });
    }
}];

