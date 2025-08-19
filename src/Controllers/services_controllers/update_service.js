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

      // Verificar que el servicio exista y pertenezca al usuario
      const service = await ServiceModel.findOne({ _id: id, user_id });

      if (!service) {
        return res.status(404).json({
          error: "Servicio no encontrado o no tienes permisos",
        });
      }

      // Campos permitidos para actualización (incluyendo 'tipo')
      const allowedUpdates = [
        "service_name",
        "category",
        "description",
        "phone",
        "email",
        "address",
        "photos",
        "tipo"
      ];
      
      const updates = Object.keys(req.body);
      const isValidOperation = updates.every(update => allowedUpdates.includes(update));

      if (!isValidOperation) {
        return res.status(400).json({ error: "Actualizaciones no válidas" });
      }

      // Procesamiento del campo 'tipo' (igual que en createService)
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
        delete updateData.tipo; // Eliminamos para no sobrescribir en el forEach
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

      // Procesamiento de imágenes (igual que en createService)
      if (req.files?.length > 0) {
        const newPhotos = await uploadMultipleImages(
          req.files.map(file => file.path),
          "marketplace/services"
        );
        
        // Combinamos las fotos existentes con las nuevas (o reemplazamos según tu lógica)
        service.photos = [...(service.photos || []), ...newPhotos];
      }

      // Actualizar los demás campos
      updates.forEach(update => {
        if (update !== 'tipo' && update !== 'address') {
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