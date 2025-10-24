import { ServiceModel } from "../../Models/Service_Model.js";
import { CATEGORIES } from "../../utils/constants.js";

export const searchServicesWeb = async (req, res) => {
  try {
    const {
      query,
      category,
      categories,
      name,
      tipo,
      tipos,
      address,
      phone,
      email,
      sortBy,
      sortOrder,
      page: pageParam,
      limit: limitParam,
    } = req.query;

    // Validar categoría simple
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Categoría no válida", validCategories: CATEGORIES });
    }

    // Normalizar paginación
    const page = Math.max(parseInt(pageParam) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitParam) || 10, 1), 100);
    const skip = (page - 1) * limit;

    // Construir match inicial
    const initialMatch = {};

    // Categoría única
    if (category) initialMatch.category = category;

    // Múltiples categorías
    if (categories) {
      const arr = (Array.isArray(categories) ? categories : categories.split(",")).map(c => c.trim()).filter(Boolean);
      if (arr.length) initialMatch.category = { $in: arr.filter(c => CATEGORIES.includes(c)) };
    }

    // Tipos
    const tiposFuente = tipo || tipos;
    if (tiposFuente) {
      const tiposArray = (Array.isArray(tiposFuente) ? tiposFuente : tiposFuente.split(","))
        .map(t => t.trim()).filter(Boolean);
      if (tiposArray.length) initialMatch.tipo = { $in: tiposArray };
    }

    // Nombre parcial específico
    if (name) {
      initialMatch.service_name = { $regex: name, $options: "i" };
    }

    if (address) initialMatch.address = { $regex: address, $options: "i" };
    if (phone) initialMatch.phone = { $regex: phone, $options: "i" };
    if (email) initialMatch.email = { $regex: email, $options: "i" };

    // Pipeline de agregación
    const pipeline = [];

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

    // Búsqueda amplia (query)
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

    // Proyección (información básica sin datos sensibles)
    pipeline.push({
      $project: {
        _id: 1,
        service_name: 1,
        description: 1,
        category: 1,
        tipo: 1,
        address: 1,
        phone: 1,
        email: 1,
        servicePhoto: 1,
        isPromoted: 1,
        promotionPlan: 1,
        createdAt: 1,
        user: {
          _id: 1,
          name: 1,
          profilePhoto: 1
        }
      }
    });

    // Ordenamiento dinámico
    const sortMap = {
      createdAt: 'createdAt',
      promoted: 'isPromoted'
    };
    const chosenSortField = sortMap[sortBy] || 'createdAt';
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

    res.status(200).json({
      total,
      page,
      pages,
      services: data,
      ...(category ? { currentCategory: category } : {}),
      ...(categories ? { currentCategories: categories } : {}),
      ...(query ? { currentQuery: query } : {}),
      ...(name ? { currentName: name } : {}),
      ...(tipo ? { currentTipo: tipo } : {}),
      ...(tipos ? { currentTipos: tipos } : {}),
      ...(address ? { currentAddress: address } : {}),
      ...(phone ? { currentPhone: phone } : {}),
      ...(email ? { currentEmail: email } : {}),
      ...(sortBy ? { currentSortBy: sortBy } : {}),
      ...(sortOrder ? { currentSortOrder: sortOrder } : {}),
    });
  } catch (error) {
    console.error("Error en searchServicesWeb:", error);
    res.status(500).json({
      error: "Error al buscar servicios",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};