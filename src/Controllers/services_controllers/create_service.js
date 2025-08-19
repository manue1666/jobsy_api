
import { authenticateToken } from "../../utils/authMiddleware.js";
import multer from "multer";
import { uploadMultipleImages } from "../../utils/imageService.js";
import { geocodeAddress } from "../../utils/geocoder.js";
import { ServiceModel } from "../../Models/Service_Model.js";


export const uploadServiceImages = multer({
  dest: "tmp/uploads/services",
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB c/u, máximo 5 imágenes
}).array("serviceImages", 5); // 'serviceImages' debe coincidir con el FormData

export const createService = [
  authenticateToken,
  uploadServiceImages,
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