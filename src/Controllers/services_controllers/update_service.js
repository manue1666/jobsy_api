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

      // Validaciones explícitas de campos
      if (updateData.service_name !== undefined) {
        if (!updateData.service_name || typeof updateData.service_name !== "string" || updateData.service_name.trim().length < 3) {
          return res.status(400).json({ error: "El nombre del servicio es requerido y debe tener al menos 3 caracteres." });
        }
      }
      if (updateData.category !== undefined) {
        if (!updateData.category || typeof updateData.category !== "string") {
          return res.status(400).json({ error: "La categoría es requerida." });
        }
      }
      if (updateData.description !== undefined) {
        if (!updateData.description || typeof updateData.description !== "string" || updateData.description.trim().length < 10) {
          return res.status(400).json({ error: "La descripción es requerida y debe tener al menos 10 caracteres." });
        }
      }
      if (updateData.phone !== undefined) {
        if (!updateData.phone || typeof updateData.phone !== "string" || !/^\+?\d{7,15}$/.test(updateData.phone)) {
          return res.status(400).json({ error: "El número de teléfono es requerido y debe tener entre 7 y 15 dígitos." });
        }
        // Verificar duplicidad de teléfono
        const phoneExists = await ServiceModel.findOne({ phone: updateData.phone, _id: { $ne: id } });
        if (phoneExists) {
          return res.status(409).json({ error: "El número de teléfono ya está registrado en otro servicio." });
        }
      }
      if (updateData.email !== undefined) {
        if (!updateData.email || typeof updateData.email !== "string" || !/^\S+@\S+\.\S+$/.test(updateData.email)) {
          return res.status(400).json({ error: "El correo electrónico es requerido y debe tener formato válido." });
        }
      }
      if (updateData.address !== undefined) {
        if (!updateData.address || typeof updateData.address !== "string" || updateData.address.trim().length < 5) {
          return res.status(400).json({ error: "La dirección es requerida y debe tener al menos 5 caracteres." });
        }
      }

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
          return res.status(400).json({ error: "El campo 'tipo' tiene un formato inválido." });
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
        try {
          newPhotos = await uploadMultipleImages(
            req.files.map(file => file.path),
            "marketplace/services"
          );
        } catch (imgErr) {
          return res.status(400).json({ error: "Error al procesar las imágenes: " + imgErr.message });
        }
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