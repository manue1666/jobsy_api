import { CommentModel } from "../../Models/Comment_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

export const deleteComment = [authenticateToken, async (req, res) => {
    try {
        const { id: comment_id } = req.params;
        const user_id = req.user.user_id;

        // Buscar el comentario
        const comment = await CommentModel.findById(comment_id);

        // Verificar si el comentario existe
        if (!comment) {
            return res.status(404).json({
                error: "Comentario no encontrado"
            });
        }

        // Verificar que el usuario sea el propietario del comentario
        if (comment.user_id.toString() !== user_id) {
            return res.status(403).json({
                error: "No autorizado: solo el propietario puede eliminar este comentario"
            });
        }

        // Eliminar el comentario
        await CommentModel.findByIdAndDelete(comment_id);

        res.status(200).json({
            success: true,
            msg: "Comentario eliminado exitosamente"
        });

    } catch (error) {
        console.log("Error en deleteComment:", error);

        if (error.name === 'CastError') {
            return res.status(400).json({ error: "ID de comentario inválido" });
        }

        res.status(500).json({
            error: "Error interno del servidor al eliminar el comentario"
        });
    }
}];