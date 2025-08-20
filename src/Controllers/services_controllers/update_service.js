import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import multer from "multer";
import { uploadMultipleImages } from "../../utils/imageService.js";
import { geocodeAddress } from "../../utils/geocoder.js";

// Reutilizamos el mismo middleware de multer para consistencia
export const uploadServiceImages = multer({
  dest: "tmp/uploads/services",
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
}).array("serviceImages", 5);

export const updateService = [
  authenticateToken,
  uploadServiceImages,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user.user_id;
      const updateData = req.body;

      // Verificar servicio y permisos
      const service = await ServiceModel.findOne({ _id: id, user_id });
      if (!service)
        return res.status(404).json({
          error: "Servicio no encontrado o no tienes permisos",
        });

      // Campos permitidos
      const allowedUpdates = [
        "service_name",
        "category",
        "description",
        "phone",
        "email",
        "address",
        "tipo",
      ];
      const updates = Object.keys(updateData).filter(u => allowedUpdates.includes(u));

      // Procesar campo 'tipo'
      if (updateData.tipo) {
        let tipoArray = [];
        try {
          if (typeof updateData.tipo === "string") {
            if (updateData.tipo.startsWith("[")) {
              tipoArray = JSON.parse(updateData.tipo);
            } else {
              tipoArray = updateData.tipo
                .split(",")
                .map(item => item.trim().replace(/["']/g, ""));
            }
          } else if (Array.isArray(updateData.tipo)) {
            tipoArray = updateData.tipo;
          }
          // Validación de tipos
          const validTypes = ["domicilio", "comercio"];
          tipoArray = tipoArray.filter(t => validTypes.includes(t));
          service.tipo = tipoArray.length > 0 ? tipoArray : [];
        } catch (e) {
          console.warn("Error al procesar campo 'tipo':", e.message);
        }
        delete updateData.tipo;
      }

      // Geocodificación si se actualiza la dirección
      if (updateData.address) {
        const coordinates = await geocodeAddress(updateData.address);
        if (!coordinates) {
          return res.status(400).json({
            error: "No se pudo determinar la nueva ubicación. Verifica la dirección.",
          });
        }
        service.service_location = {
          type: "Point",
          coordinates: [coordinates.longitude, coordinates.latitude],
        };
      }

      // Procesar imágenes
      let existingPhotos = [];
      if (updateData.existingPhotos) {
        try {
          existingPhotos = JSON.parse(updateData.existingPhotos);
          if (!Array.isArray(existingPhotos)) existingPhotos = [];
        } catch (e) {
          console.warn("Error al parsear existingPhotos:", e.message);
          existingPhotos = [];
        }
      }

      let newPhotos = [];
      if (req.files?.length > 0) {
        newPhotos = await uploadMultipleImages(
          req.files.map(file => file.path),
          "marketplace/services"
        );
      }

      service.photos = [...existingPhotos, ...newPhotos];

      // Actualizar los demás campos
      updates.forEach(update => {
        if (update !== "address" && update !== "tipo") {
          service[update] = updateData[update];
        }
      });

      await service.save();

      res.status(200).json({
        msg: "Servicio actualizado con éxito",
        service: service.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error("Error en updateService:", error);

      if (error.name === "CastError") {
        return res.status(400).json({ error: "ID de servicio inválido" });
      }
      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: "Error interno al actualizar el servicio",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
];