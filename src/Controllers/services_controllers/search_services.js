import { ServiceModel } from "../../Models/Service_Model.js";
import { FavServiceModel } from "../../Models/FavService_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { CATEGORIES } from "../../utils/constants.js";
import mongoose from "mongoose";

export const searchServices = [
  authenticateToken,
  async (req, res) => {
    try {
      const {
        query,              // búsqueda amplia (service + user)
        category,           // una categoría
        categories,         // múltiples categorías (coma separadas)
        ownerId,            // id de usuario dueño
        name,               // coincidencia parcial en service_name
        tipo,               // uno o varios tipos (coma separada)
        tipos,              // alias para múltiples tipos
        address,            // coincidencia parcial
        phone,              // coincidencia parcial
        email,              // coincidencia parcial
        isPromoted,         // true|false
        promotionPlan,      // 24h|72h|1week
        createdFrom,        // fecha ISO
        createdTo,          // fecha ISO
        minFavorites,       // número mínimo de favoritos
        maxFavorites,       // número máximo de favoritos
        sortBy,             // createdAt|favorites|promoted
        sortOrder,          // asc|desc
        page: pageParam,
        limit: limitParam,
      } = req.query;
      const authUserId = req.user.user_id; // string

      // Validar categoría simple
      if (category && !CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Categoría no válida", validCategories: CATEGORIES });
      }

      // Normalizar paginación
      const page = Math.max(parseInt(pageParam) || 1, 1);
      const limit = Math.min(Math.max(parseInt(limitParam) || 10, 1), 100);
      const skip = (page - 1) * limit;

      // Construir match inicial (campos directos de servicio)
      const initialMatch = {};

      // Categoría única
      if (category) initialMatch.category = category;

      // Múltiples categorías
      if (categories) {
        const arr = (Array.isArray(categories) ? categories : categories.split(",")).map(c => c.trim()).filter(Boolean);
        if (arr.length) initialMatch.category = { $in: arr.filter(c => CATEGORIES.includes(c)) };
      }

      // Dueño
      if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
        initialMatch.user_id = new mongoose.Types.ObjectId(ownerId);
      }

      // Tipos (unificado de tipo / tipos)
      const tiposFuente = tipo || tipos;
      if (tiposFuente) {
        const tiposArray = (Array.isArray(tiposFuente) ? tiposFuente : tiposFuente.split(","))
          .map(t => t.trim()).filter(Boolean);
        if (tiposArray.length) initialMatch.tipo = { $in: tiposArray };
      }

      // Nombre parcial específico (service_name)
      if (name) {
        initialMatch.service_name = { $regex: name, $options: "i" };
      }

      if (address) initialMatch.address = { $regex: address, $options: "i" };
      if (phone) initialMatch.phone = { $regex: phone, $options: "i" };
      if (email) initialMatch.email = { $regex: email, $options: "i" };

      // Promoción
      if (typeof isPromoted !== 'undefined') {
        if (isPromoted === 'true') initialMatch.isPromoted = true; else if (isPromoted === 'false') initialMatch.isPromoted = false;
      }
      if (promotionPlan) initialMatch.promotionPlan = promotionPlan;

      // Rango de fechas
      if (createdFrom || createdTo) {
        initialMatch.createdAt = {};
        if (createdFrom) initialMatch.createdAt.$gte = new Date(createdFrom);
        if (createdTo) initialMatch.createdAt.$lte = new Date(createdTo);
        if (Object.keys(initialMatch.createdAt).length === 0) delete initialMatch.createdAt;
      }

      // Pipeline de agregación
      const pipeline = [];

      // $match inicial (solo si hay algo que filtrar)
      if (Object.keys(initialMatch).length) {
        pipeline.push({ $match: initialMatch });
      }

      // Unir usuario
      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' }
      );

      // Búsqueda amplia (query) incluyendo campos del usuario
      if (query) {
        const regex = new RegExp(query, 'i');
        pipeline.push({
          $match: {
            $or: [
              { service_name: regex },
              { description: regex },
              { address: regex },
              { phone: regex },
              { email: regex },
              { category: regex },
              { tipo: regex }, // si tipo es array, regex aplica elemento a elemento
              { 'user.name': regex },
            ]
          }
        });
      }

      // Lookup para favoritos con agregación para evitar traer todos
      pipeline.push({
        $lookup: {
          from: 'favservices',
          let: { serviceId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$service_id', '$$serviceId'] } } },
            { $group: { _id: '$service_id', count: { $sum: 1 }, users: { $addToSet: '$user_id' } } }
          ],
          as: 'favMeta'
        }
      });

      // Calcular favoritesCount e isFavorite
      const authUserObjectId = mongoose.Types.ObjectId.isValid(authUserId) ? new mongoose.Types.ObjectId(authUserId) : null;
      pipeline.push({
        $addFields: {
          favoritesCount: {
            $cond: [
              { $gt: [ { $size: '$favMeta' }, 0 ] },
              { $arrayElemAt: [ '$favMeta.count', 0 ] },
              0
            ]
          },
          isFavorite: authUserObjectId ? {
            $in: [ authUserObjectId, {
              $cond: [
                { $gt: [ { $size: '$favMeta' }, 0 ] },
                { $arrayElemAt: [ '$favMeta.users', 0 ] },
                []
              ]
            } ]
          } : false
        }
      });

      // Filtro por rango de favoritos (después de calcular)
      const favRange = [];
      if (minFavorites) favRange.push({ favoritesCount: { $gte: parseInt(minFavorites) } });
      if (maxFavorites) favRange.push({ favoritesCount: { $lte: parseInt(maxFavorites) } });
      if (favRange.length) {
        pipeline.push({ $match: Object.assign({}, ...favRange) });
      }

      // Proyección parcial (dejar user como objeto anidado y ocultar favMeta)
      pipeline.push({
        $project: {
          favMeta: 0,
          __v: 0,
          'user.password': 0,
          'user.emailVerified': 0,
        }
      });

      // Ordenamiento dinámico
      const sortMap = {
        createdAt: 'createdAt',
        favorites: 'favoritesCount',
        promoted: 'isPromoted'
      };
      const chosenSortField = sortMap[sortBy] || 'isPromoted';
      const primaryDirection = (sortOrder === 'asc') ? 1 : -1;
      const sortStage = { $sort: { [chosenSortField]: primaryDirection, createdAt: -1 } };
      pipeline.push(sortStage);

      // Facet para total + paginación
      pipeline.push({
        $facet: {
          metadata: [ { $count: 'total' } ],
          data: [ { $skip: skip }, { $limit: limit } ]
        }
      });

      // Ejecutar pipeline
      const aggResult = await ServiceModel.aggregate(pipeline);
      const metadata = aggResult[0]?.metadata?.[0] || { total: 0 };
      const data = aggResult[0]?.data || [];

      const total = metadata.total;
      const pages = total === 0 ? 0 : Math.ceil(total / limit);

      // Calcular favoritos y estado favorito como en la versión inicial
      const serviceIds = data.map(doc => doc._id);
      // Obtener todos los favoritos de estos servicios
      const favCounts = await FavServiceModel.aggregate([
        { $match: { service_id: { $in: serviceIds } } },
        { $group: { _id: "$service_id", count: { $sum: 1 } } }
      ]);
      const favCountMap = {};
      favCounts.forEach(fc => {
        favCountMap[fc._id.toString()] = fc.count;
      });
      // Obtener favoritos del usuario autenticado
      const favoriteServices = await FavServiceModel.find({ user_id: authUserId });
      const favoriteIds = favoriteServices.map(fav => fav.service_id.toString());

      // Ajustar formato de salida (user ya presente). Mantener compatibilidad: mover user_id fuera (ya está en user). Añadir isFavorite y favoritesCount ya calculados.
      const services = data.map(doc => ({
        ...doc,
        favoritesCount: favCountMap[doc._id.toString()] || 0,
        isFavorite: favoriteIds.includes(doc._id.toString()),
        user: {
          _id: doc.user._id,
          name: doc.user.name,
          profilePhoto: doc.user.profilePhoto
        }
      }));

      res.status(200).json({
        total,
        page,
        pages,
        services,
        ...(category ? { currentCategory: category } : {}),
        ...(categories ? { currentCategories: categories } : {}),
        ...(ownerId ? { currentOwnerId: ownerId } : {}),
        ...(query ? { currentQuery: query } : {}),
        ...(name ? { currentName: name } : {}),
        ...(tipo ? { currentTipo: tipo } : {}),
        ...(tipos ? { currentTipos: tipos } : {}),
        ...(address ? { currentAddress: address } : {}),
        ...(phone ? { currentPhone: phone } : {}),
        ...(email ? { currentEmail: email } : {}),
        ...(isPromoted ? { currentIsPromoted: isPromoted } : {}),
        ...(promotionPlan ? { currentPromotionPlan: promotionPlan } : {}),
        ...(createdFrom ? { currentCreatedFrom: createdFrom } : {}),
        ...(createdTo ? { currentCreatedTo: createdTo } : {}),
        ...(minFavorites ? { currentMinFavorites: parseInt(minFavorites) } : {}),
        ...(maxFavorites ? { currentMaxFavorites: parseInt(maxFavorites) } : {}),
        ...(sortBy ? { currentSortBy: sortBy } : {}),
        ...(sortOrder ? { currentSortOrder: sortOrder } : {}),
      });
    } catch (error) {
      res.status(500).json({
        error: "Error al buscar servicios",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
];