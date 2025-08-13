import axios from "axios";

const GEO_API = process.env.GEOCODING_API;

export const geocodeAddress = async (address) => {
  // Validación básica de entrada
  if (!address || typeof address !== "string") {
    console.error("Error: La dirección debe ser un texto válido");
    return null;
  }

  try {
    const response = await axios.get(
      `https://geocode.maps.co/search?q=${encodeURIComponent(address)}&api_key=${GEO_API}`,
      {
        timeout: 5000, // Timeout de 5 segundos
        headers: {
          "User-Agent": "TuAppServicios/1.0 (contacto@tudominio.com)", // Identificador
        },
      }
    );

    // Verificar respuesta y estructura de datos
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      console.error("Error: No se encontraron resultados para la dirección");
      return null;
    }

    // Extraer primera coincidencia (la más relevante)
    const { lon, lat } = response.data[0];
    if (!lon || !lat) {
      console.error("Error: Datos de coordenadas incompletos en la respuesta");
      return null;
    }

    return {
      longitude: parseFloat(lon),
      latitude: parseFloat(lat),
      rawAddress: response.data[0].display_name, // Opcional: dirección completa normalizada
    };
  } catch (error) {
    console.error("Error en geocodeAddress:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return null;
  }
};