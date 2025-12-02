import { ServiceModel } from "../../Models/Service_Model.js";
import { FavServiceModel } from "../../Models/FavService_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";
import { CATEGORIES } from "../../utils/constants.js";
import mongoose from "mongoose";
import { UserModel } from "../../Models/User_Model.js";

export const searchServices = [
  authenticateToken,
  async (req, res) => {
    try {
      const {
        query,
        category,
        categories,
        ownerId,
        name,
        tipo,
        tipos,
        address,
        phone,
        email,
        isPromoted,
        promotionPlan,
        createdFrom,
        createdTo,
        minFavorites,
        maxFavorites,
        sortBy,             // createdAt|favorites|distance (removido 'promoted')
        sortOrder,          // asc|desc
        latitude,
        longitude,
        maxDistance,
        page: pageParam,
        limit: limitParam,
      } = req.query;
      const authUserId = req.user.user_id;

      if (category && !CATEGORIES.includes(category)) {
        return res.status(400).json({ error: "Categoría no válida", validCategories: CATEGORIES });
      }

      const page = Math.max(parseInt(pageParam) || 1, 1);
      const limit = Math.min(Math.max(parseInt(limitParam) || 10, 1), 100);
      const skip = (page - 1) * limit;

      // Actualizar ubicación del usuario
      if (latitude && longitude) {
        const coords = [
          parseFloat(longitude.toString()),
          parseFloat(latitude.toString()),
        ];
        
        await UserModel.findByIdAndUpdate(
          req.user._id,
          {
            user_location: {
              type: "Point",
              coordinates: coords,
            },
          },
          { new: true }
        );
      }

      // Construir match inicial
      const initialMatch = {};

      if (category) initialMatch.category = category;

      if (categories) {
        const arr = (Array.isArray(categories) ? categories : categories.split(",")).map(c => c.trim()).filter(Boolean);
        if (arr.length) initialMatch.category = { $in: arr.filter(c => CATEGORIES.includes(c)) };
      }

      if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
        initialMatch.user_id = new mongoose.Types.ObjectId(ownerId);
      }

      const tiposFuente = tipo || tipos;
      if (tiposFuente) {
        const tiposArray = (Array.isArray(tiposFuente) ? tiposFuente : tiposFuente.split(","))
          .map(t => t.trim()).filter(Boolean);
        if (tiposArray.length) initialMatch.tipo = { $in: tiposArray };
      }

      if (name) initialMatch.service_name = { $regex: name, $options: "i" };
      if (address) initialMatch.address = { $regex: address, $options: "i" };
      if (phone) initialMatch.phone = { $regex: phone, $options: "i" };
      if (email) initialMatch.email = { $regex: email, $options: "i" };

      if (typeof isPromoted !== 'undefined') {
        if (isPromoted === 'true') initialMatch.isPromoted = true; 
        else if (isPromoted === 'false') initialMatch.isPromoted = false;
      }
      if (promotionPlan) initialMatch.promotionPlan = promotionPlan;

      if (createdFrom || createdTo) {
        initialMatch.createdAt = {};
        if (createdFrom) initialMatch.createdAt.$gte = new Date(createdFrom);
        if (createdTo) initialMatch.createdAt.$lte = new Date(createdTo);
        if (Object.keys(initialMatch.createdAt).length === 0) delete initialMatch.createdAt;
      }

      // Pipeline
      const pipeline = [];

      // $geoNear o $match inicial
      if (latitude && longitude) {
        const coords = [
          parseFloat(longitude.toString()),
          parseFloat(latitude.toString()),
        ];
        const distanceLimit = maxDistance ? parseInt(maxDistance) : 10000;

        pipeline.push({
          $geoNear: {
            near: {
              type: "Point",
              coordinates: coords
            },
            distanceField: "distance",
            maxDistance: distanceLimit,
            spherical: true,
            ...(Object.keys(initialMatch).length > 0 && { query: initialMatch })
          }
        });
      } else {
        if (Object.keys(initialMatch).length) {
          pipeline.push({ $match: initialMatch });
        }
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

      // Búsqueda amplia
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
              { tipo: regex },
              { 'user.name': regex },
            ]
          }
        });
      }

      // Lookup favoritos
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

      // Filtro por rango de favoritos
      const favRange = [];
      if (minFavorites) favRange.push({ favoritesCount: { $gte: parseInt(minFavorites) } });
      if (maxFavorites) favRange.push({ favoritesCount: { $lte: parseInt(maxFavorites) } });
      if (favRange.length) {
        pipeline.push({ $match: Object.assign({}, ...favRange) });
      }

      // Proyección
      pipeline.push({
        $project: {
          favMeta: 0,
          __v: 0,
          'user.password': 0,
          'user.emailVerified': 0,
        }
      });

      // *** ORDENAMIENTO MEJORADO ***
      // SIEMPRE ordenar promocionados primero, luego por criterio seleccionado
      const sortStage = { $sort: {} };
      
      // 1. SIEMPRE promocionados primero
      sortStage.$sort.isPromoted = -1;

      // 2. Luego por criterio seleccionado
      if (sortBy === 'distance' && latitude && longitude) {
        sortStage.$sort.distance = (sortOrder === 'asc') ? 1 : -1;
      } else if (sortBy === 'favorites') {
        sortStage.$sort.favoritesCount = (sortOrder === 'asc') ? 1 : -1;
      } else if (sortBy === 'createdAt') {
        sortStage.$sort.createdAt = (sortOrder === 'asc') ? 1 : -1;
      } else {
        // Por defecto: más recientes
        sortStage.$sort.createdAt = -1;
      }

      pipeline.push(sortStage);

      // Facet para total + paginación
      pipeline.push({
        $facet: {
          metadata: [ { $count: 'total' } ],
          data: [ { $skip: skip }, { $limit: limit } ]
        }
      });

      // Ejecutar
      const aggResult = await ServiceModel.aggregate(pipeline);
      const metadata = aggResult[0]?.metadata?.[0] || { total: 0 };
      const data = aggResult[0]?.data || [];

      const total = metadata.total;
      const pages = total === 0 ? 0 : Math.ceil(total / limit);

      // Calcular favoritos (redundante pero asegura consistencia)
      const serviceIds = data.map(doc => doc._id);
      const favCounts = await FavServiceModel.aggregate([
        { $match: { service_id: { $in: serviceIds } } },
        { $group: { _id: "$service_id", count: { $sum: 1 } } }
      ]);
      const favCountMap = {};
      favCounts.forEach(fc => {
        favCountMap[fc._id.toString()] = fc.count;
      });
      
      const favoriteServices = await FavServiceModel.find({ user_id: authUserId });
      const favoriteIds = favoriteServices.map(fav => fav.service_id.toString());

      // Formatear
      const services = data.map(doc => ({
        ...doc,
        favoritesCount: favCountMap[doc._id.toString()] || doc.favoritesCount || 0,
        isFavorite: favoriteIds.includes(doc._id.toString()),
        user: {
          _id: doc.user._id,
          name: doc.user.name,
          profilePhoto: doc.user.profilePhoto
        },
        ...(doc.distance !== undefined && { distance: Math.round(doc.distance) })
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
        ...(latitude ? { currentLatitude: parseFloat(latitude) } : {}),
        ...(longitude ? { currentLongitude: parseFloat(longitude) } : {}),
        ...(maxDistance ? { currentMaxDistance: parseInt(maxDistance) } : {}),
      });
    } catch (error) {
      res.status(500).json({
        error: "Error al buscar servicios",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
];