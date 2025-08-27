import { authenticateToken } from "../../utils/authMiddleware.js";
import multer from "multer";
import { uploadMultipleImages } from "../../utils/imageService.js";
import { geocodeAddress } from "../../utils/geocoder.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { UserModel } from "../../Models/User_Model.js"; // Importar UserModel


export const createService = [
  authenticateToken,
  async (req, res, next) => {
    try {
      // Obtener usuario
      const user = await UserModel.findById(req.user.user_id).lean();
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Contar servicios existentes del usuario
      const userServicesCount = await ServiceModel.countDocuments({ user_id: req.user.user_id });

      // Validaciones según premium
      if (!user.isPremium) {
        if (userServicesCount >= 1) {
          return res.status(403).json({ error: "Los usuarios no premium solo pueden publicar 1 servicio." });
        }
        // Limitar multer a 1 imagen
        const upload = multer({
          dest: "tmp/uploads/services",
          limits: { fileSize: 10 * 1024 * 1024, files: 1 },
        }).array("serviceImages", 1);
        upload(req, res, function (err) {
          if (err) {
            return res.status(400).json({ error: "Error al subir imagen: " + err.message });
          }
          if (req.files && req.files.length > 1) {
            return res.status(400).json({ error: "Solo puedes subir 1 imagen por servicio." });
          }
          next();
        });
      } else {
        if (userServicesCount >= 5) {
          return res.status(403).json({ error: "Los usuarios premium solo pueden publicar hasta 5 servicios." });
        }
        // Limitar multer a 9 imágenes
        const upload = multer({
          dest: "tmp/uploads/services",
          limits: { fileSize: 10 * 1024 * 1024, files: 9 },
        }).array("serviceImages", 9);
        upload(req, res, function (err) {
          if (err) {
            return res.status(400).json({ error: "Error al subir imágenes: " + err.message });
          }
          if (req.files && req.files.length > 9) {
            return res.status(400).json({ error: "Solo puedes subir hasta 9 imágenes por servicio." });
          }
          next();
        });
      }
    } catch (error) {
      return res.status(500).json({ error: "Error al validar usuario/servicios", details: error.message });
    }
  },
  async (req, res) => {
    try {
      const {
        service_name,
        category,
        description,
        phone,
        email,
        address,
        tipo,
      } = req.body;

      // 1. Procesamiento universal del campo 'tipo'
      let tipoArray = [];
      try {
        if (typeof tipo === "string") {
          // Caso 1: String JSON (desde frontend) -> "[\"domicilio\",\"comercio\"]"
          if (tipo.startsWith("[")) {
            tipoArray = JSON.parse(tipo);
          }
          // Caso 2: String plano (desde Postman/form-data) -> "domicilio,comercio"
          else {
            tipoArray = tipo
              .split(",")
              .map((item) => item.trim().replace(/["']/g, ""));
          }
        }
        // Caso 3: Array directo (desde Postman/raw JSON)
        else if (Array.isArray(tipo)) {
          tipoArray = tipo;
        }
      } catch (e) {
        console.warn("Error al procesar campo 'tipo':", e.message);
      }

      // 2. Validación de tipos
      const validTypes = ["domicilio", "comercio"];
      tipoArray = tipoArray.filter((t) => validTypes.includes(t));
      if (tipoArray.length === 0) {
        tipoArray = []; // Valor por defecto si no hay tipos válidos
      }

      // 3. Geocodificación
      if (!address) {
        return res.status(400).json({ error: "La dirección es requerida" });
      }

      const coordinates = await geocodeAddress(address);
      if (!coordinates) {
        return res.status(400).json({
          error: "No se pudo determinar la ubicación. Verifica la dirección.",
        });
      }

      // 4. Procesamiento de imágenes
      let photos = [];
      if (req.files?.length > 0) {
        photos = await uploadMultipleImages(
          req.files.map((file) => file.path),
          "marketplace/services"
        );
      }

      // 5. Creación del servicio
      const service = new ServiceModel({
        user_id: req.user.user_id,
        service_name,
        category,
        description,
        phone,
        email,
        address,
        service_location: {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude],
        },
        photos,
        tipo: tipoArray,
      });

      await service.save();

      res.status(201).json({
        service: service.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error en createService:", error);
      res.status(500).json({
        error: "Error interno al crear el servicio",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
];