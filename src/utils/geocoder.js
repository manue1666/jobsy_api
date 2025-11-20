import axios from "axios";

const GEO_API = process.env.GEOCODING_API;

export const geocodeAddress = async (address) => {
  // Validación básica de entrada
  if (!address || typeof address !== "string") {
    console.error("[Geocoder] Error: La dirección debe ser un texto válido");
    return {
      success: false,
      error: "invalid_input",
      message: "La dirección debe ser un texto válido",
    };
  }

  // Validar longitud mínima
  if (address.trim().length < 5) {
    console.error("[Geocoder] Error: Dirección demasiado corta");
    return {
      success: false,
      error: "address_too_short",
      message: "La dirección debe tener al menos 5 caracteres",
    };
  }

  try {
    console.log("[Geocoder] Geocodificando dirección:", address);

    const response = await axios.get(
      `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&api_key=${GEO_API}`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "JobsyApp/1.0 (support@jobsy.com)",
        },
      }
    );

    // Verificar respuesta y estructura de datos
    if (!response.data || !Array.isArray(response.data)) {
      console.error("[Geocoder] Error: Respuesta del API inválida");
      return {
        success: false,
        error: "invalid_response",
        message: "Error en el servicio de geocodificación",
      };
    }

    if (response.data.length === 0) {
      console.error("[Geocoder] Error: No se encontraron resultados para:", address);
      return {
        success: false,
        error: "no_results",
        message: "No se encontró la ubicación. Intenta con una dirección más específica",
        suggestions: [
          "Incluye número de calle",
          "Agrega colonia o barrio",
          "Especifica ciudad y estado",
          "Ejemplo: Calle 5 de Mayo 123, Centro, Puebla, México"
        ],
      };
    }

    // Extraer primera coincidencia (la más relevante)
    const firstResult = response.data[0];
    const { lon, lat, display_name } = firstResult;

    if (!lon || !lat) {
      console.error("[Geocoder] Error: Datos de coordenadas incompletos");
      return {
        success: false,
        error: "incomplete_coordinates",
        message: "Los datos de ubicación están incompletos",
      };
    }

    // Validar que las coordenadas sean números válidos
    const longitude = parseFloat(lon);
    const latitude = parseFloat(lat);

    if (isNaN(longitude) || isNaN(latitude)) {
      console.error("[Geocoder] Error: Coordenadas no numéricas");
      return {
        success: false,
        error: "invalid_coordinates",
        message: "Las coordenadas obtenidas no son válidas",
      };
    }

    // Validar rango de coordenadas (mundial)
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      console.error("[Geocoder] Error: Coordenadas fuera de rango");
      return {
        success: false,
        error: "coordinates_out_of_range",
        message: "Las coordenadas están fuera del rango válido",
      };
    }

    console.log("[Geocoder] ✅ Geocodificación exitosa:", {
      address,
      longitude,
      latitude,
      display_name,
    });

    return {
      success: true,
      longitude,
      latitude,
      rawAddress: display_name,
      originalInput: address,
    };

  } catch (error) {
    console.error("[Geocoder] Error en geocodeAddress:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // Manejar errores específicos
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return {
        success: false,
        error: "timeout",
        message: "Tiempo de espera agotado. Verifica tu conexión a internet",
      };
    }

    if (error.response?.status === 429) {
      return {
        success: false,
        error: "rate_limit",
        message: "Demasiadas solicitudes. Intenta de nuevo en unos momentos",
      };
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        error: "api_key_invalid",
        message: "Error de configuración del servicio de mapas",
      };
    }

    if (!navigator.onLine || error.code === "ENOTFOUND") {
      return {
        success: false,
        error: "network_error",
        message: "No hay conexión a internet. Verifica tu conexión",
      };
    }

    return {
      success: false,
      error: "unknown_error",
      message: "Error al procesar la dirección. Intenta de nuevo",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  }
};