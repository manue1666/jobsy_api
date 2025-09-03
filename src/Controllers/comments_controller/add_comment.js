import { CommentModel } from "../../Models/Comment_Model.js";
import { ServiceModel } from "../../Models/Service_Model.js";
import { authenticateToken } from "../../utils/authMiddleware.js";

export const addComment = [authenticateToken, async (req, res) => {
    try {
        const { id: service_id } = req.params;
        const user_id = req.user.user_id;
        const { comment } = req.body;

        // verificar si el servicio existe
        const serviceExists = await ServiceModel.findById(service_id);
        if (!serviceExists) {
            return res.status(404).json({
                error: "Servicio no encontrado"
            });
        }

        // crear el nuevo comentario
        const newComment = await CommentModel.create({
            user_id,
            service_id,
            comment
        });

        res.status(201).json({
            msg: "Comentario agregado exitosamente",
            comment: newComment.toObject()
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
