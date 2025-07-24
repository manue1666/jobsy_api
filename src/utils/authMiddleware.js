// authMiddleware.js
import { verifyToken } from "./jwt.js";

export const authenticateToken = (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado" });
    }

    // Verificar el token
    const decoded = verifyToken(token);
    req.user = decoded; // Almacenar la información del usuario en el request
    
    next(); // Continuar con el siguiente middleware/función
  } catch (error) {
    console.log("Error al verificar token:", error);
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
};