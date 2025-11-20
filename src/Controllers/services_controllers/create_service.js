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

      // Validaciones explícitas de campos requeridos
      if (!service_name || typeof service_name !== "string" || service_name.trim().length < 3) {
        return res.status(400).json({ error: "El nombre del servicio es requerido y debe tener al menos 3 caracteres." });
      }
      if (!category || typeof category !== "string") {
        return res.status(400).json({ error: "La categoría es requerida." });
      }
      if (!description || typeof description !== "string" || description.trim().length < 10) {
        return res.status(400).json({ error: "La descripción es requerida y debe tener al menos 10 caracteres." });
      }
      if (!phone || typeof phone !== "string" || !/^\+?\d{7,15}$/.test(phone)) {
        return res.status(400).json({ error: "El número de teléfono es requerido y debe tener entre 7 y 15 dígitos." });
      }
      if (!email || typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: "El correo electrónico es requerido y debe tener formato válido." });
      }
      if (!address || typeof address !== "string" || address.trim().length < 5) {
        return res.status(400).json({ error: "La dirección es requerida y debe tener al menos 5 caracteres." });
      }

      // Verificar duplicidad de teléfono
      const phoneExists = await ServiceModel.findOne({ phone });
      if (phoneExists) {
        return res.status(409).json({ error: "El número de teléfono ya está registrado en otro servicio." });
      }

      // 1. Procesamiento universal del campo 'tipo'
      let tipoArray = [];
      try {
        if (typeof tipo === "string") {
          if (tipo.startsWith("[")) {
            tipoArray = JSON.parse(tipo);
          } else {
            tipoArray = tipo
              .split(",")
              .map((item) => item.trim().replace(/["']/g, ""));
          }
        } else if (Array.isArray(tipo)) {
          tipoArray = tipo;
        }
      } catch (e) {
        return res.status(400).json({ error: "El campo 'tipo' tiene un formato inválido." });
      }

      // 2. Validación de tipos
      const validTypes = ["domicilio", "comercio"];
      tipoArray = tipoArray.filter((t) => validTypes.includes(t));
      if (tipoArray.length === 0) {
        tipoArray = [];
      }

      // 3. Geocodificación
      console.log("[CreateService] Iniciando geocodificación para:", address);
      const geocodeResult = await geocodeAddress(address);
      
      if (!geocodeResult.success) {
        console.error("[CreateService] Error en geocodificación:", geocodeResult.error);
        
        // Retornar error específico con sugerencias
        return res.status(400).json({
          error: geocodeResult.error,
          message: geocodeResult.message,
          suggestions: geocodeResult.suggestions,
          field: "address",
        });
      }

      console.log("[CreateService] ✅ Geocodificación exitosa:", {
        input: address,
        detected: geocodeResult.rawAddress,
        coordinates: [geocodeResult.longitude, geocodeResult.latitude],
      });

      // 4. Procesamiento de imágenes
      let photos = [];
      if (req.files?.length > 0) {
        try {
          photos = await uploadMultipleImages(
            req.files.map((file) => file.path),
            "marketplace/services"
          );
        } catch (imgErr) {
          return res.status(400).json({ 
            error: "image_upload_failed",
            message: "Error al procesar las imágenes: " + imgErr.message,
            field: "images",
          });
        }
      }

      // 5. Creación del servicio
      const service = new ServiceModel({
        user_id: req.user.user_id,
        service_name,
        category,
        description,
        phone,
        email,
        address: geocodeResult.rawAddress || address,
        service_location: {
          type: "Point",
          coordinates: [geocodeResult.longitude, geocodeResult.latitude],
        },
        photos,
        tipo: tipoArray,
      });

      await service.save();

      res.status(201).json({
        service: service.toObject({ virtuals: true }),
        geocodeInfo: {
          originalAddress: address,
          normalizedAddress: geocodeResult.rawAddress,
        },
      });
    } catch (error) {
      console.error("Error en createService:", error);
      res.status(500).json({
        error: "internal_error",
        message: "Error interno al crear el servicio",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
];