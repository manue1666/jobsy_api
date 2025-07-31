import { FavServiceModel } from "../Models/FavService_Model.js";
import { ServiceModel } from "../Models/Service_Model.js";
import { authenticateToken } from "../utils/authMiddleware.js";
import { CATEGORIES } from "../utils/constants.js";


export const createService = [authenticateToken, async (req, res) => {
    try {
        
        const { service_name, category, description, phone, email, address, photos, tipo } = req.body;
        const user_id = req.user.user_id; // el id se obtiene del token

        if(!service_name || !category || !description || !phone || !email){
            return res.status(400).json({
                "error":"datos minimos incompletos"
            });
        }

        const service = await ServiceModel.create({
            user_id,
            service_name,
            category,
            description,
            phone,
            email,
            photos,
            address,
            tipo
        });

        res.status(200).json({
            "msg":"servicio creado con exito",
            service: service.toObject()
        });

    } catch (error) {
        console.log(error);
        
        // Manejar errores específicos de MongoDB
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({
            "error":"algo salio mal en el servidor"
        });
    }
}];

export const getServiceById = [authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const service = await ServiceModel.findById(id).lean();
        
        if (!service) {
            return res.status(404).json({
                error: "Servicio no encontrado"
            });
        }

        res.status(200).json({
            service
        });

    } catch (error) {
        console.log(error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de servicio inválido" });
        }
        
        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];

export const getUserServices = [authenticateToken, async (req, res) => {
    try {
        const user_id = req.user.user_id;
        
        const services = await ServiceModel.find({ user_id }).lean();
        
        res.status(200).json({
            count: services.length,
            services
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];

export const updateService = [authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.user_id;
        const updateData = req.body;

        // Verificar que el servicio exista y pertenezca al usuario
        const service = await ServiceModel.findOne({ _id: id, user_id });
        
        if (!service) {
            return res.status(404).json({
                error: "Servicio no encontrado o no tienes permisos"
            });
        }

        // Actualizar solo los campos permitidos
        const allowedUpdates = ['service_name', 'category', 'description', 'phone', 'email', 'address', 'photos'];
        const updates = Object.keys(req.body);
        
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));
        
        if (!isValidOperation) {
            return res.status(400).json({ error: "Actualizaciones no válidas" });
        }

        updates.forEach(update => service[update] = updateData[update]);
        await service.save();

        res.status(200).json({
            msg: "Servicio actualizado con éxito",
            service: service.toObject()
        });

    } catch (error) {
        console.log(error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de servicio inválido" });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        
        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];

export const deleteService = [authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.user_id;

        // Verificar que el servicio exista y pertenezca al usuario
        const service = await ServiceModel.findOneAndDelete({ _id: id, user_id });
        
        if (!service) {
            return res.status(404).json({
                error: "Servicio no encontrado o no tienes permisos"
            });
        }

        res.status(200).json({
            msg: "Servicio eliminado con éxito",
            deletedService: service.toObject()
        });

    } catch (error) {
        console.log(error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de servicio inválido" });
        }
        
        res.status(500).json({
            error: "algo salió mal en el servidor"
        });
    }
}];

export const searchServices = [authenticateToken, async (req, res) => {
    try {
        const { query, category } = req.query;
        const user_id = req.user.user_id;
        
        // validar categoría si viene en los parámetros
        if (category && !CATEGORIES.includes(category)) {
            return res.status(400).json({
                error: "Categoría no válida",
                validCategories: CATEGORIES
            });
        }
        
        // construir objeto de filtro
        const filter = {};
        
        // filtro por texto (nombre o descripción)
        if (query) {
            filter.$or = [
                { service_name: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ];
        }
        
        // filtro por categoría
        if (category) {
            filter.category = category;
        }
        
        // paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // consulta a la base de datos
        const services = await ServiceModel.find(filter)
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'user_id',
                select: 'name profilePhoto'
            })
            .lean();
        
        // contar total para paginación
        const total = await ServiceModel.countDocuments(filter);
        
        // verificar favoritos si el usuario está autenticado
        const favoriteServices = await FavServiceModel.find({ user_id });
        const favoriteIds = favoriteServices.map(fav => fav.service_id.toString());
        
        const servicesWithFavorites = services.map(service => ({
            ...service,
            isFavorite: favoriteIds.includes(service._id.toString()),
            user: service.user_id // Mover la info de usuario a un campo 'user'
        }));
        
        // eliminar el campo user_id ya que se movio a 'user'
        const finalServices = servicesWithFavorites.map(({ user_id, ...rest }) => rest);
        
        res.status(200).json({
            total,
            page,
            pages: Math.ceil(total / limit),
            services: finalServices,
            ...(category ? { currentCategory: category } : {}),
            ...(query ? { currentQuery: query } : {})
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            error: "Error al buscar servicios",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}];