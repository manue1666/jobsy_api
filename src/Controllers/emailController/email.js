import nodemailer from 'nodemailer';
import { UserModel } from "../../Models/User_Model.js"; // Importar UserModel
import { authenticateToken } from "../../utils/authMiddleware.js";

export const sendEmail = [
    authenticateToken, async (req, res, next)=>{
        //Obtener usuario
        const user = await UserModel.findById(req.user.user_id).lean();
        if(!user){return res.status(404).json({error : "Usuario no encontrado"})};

        let email = user.email;

// Obtener la fecha actual
const date = new Date();

// Convertir a formato ISO (YYYY-MM-DD)
const localDate = date.toISOString().split("T")[0];

        const mensaje = `
¡Gracias por unirte a Premium, ${user.name}!

Nos complace darte la bienvenida a la experiencia Premium.

📌 Detalles de tu suscripción:
- Nombre: ${user.name}
- Correo: ${email}
- Fecha de contratación: ${localDate}
- Precio: ${process.env.price_premium} ${process.env.type_currency}

⭐ Plan mensual Premium  
💰 Precio: ${process.env.price_premium} ${process.env.type_currency} / mes  
Beneficios: publica hasta ${process.env.count_services} servicios, sube hasta ${process.env.count_imgs} imágenes por servicio y edita tus servicios publicados.


ATT: TEAM JOBSY | TETEOCAN
`;
        try{
            let transporter = nodemailer.createTransport({
                service : "gmail",
                auth : {
                    user : process.env.correo_electronico, //Correo electronico de la empresa -> Jobsy
                    pass : process.env.contrasenia_aplicacion_google //Contraseña de aplicación de la empresa -> Jobsy
                }
            });

            await transporter.sendMail({
                from : process.env.correo_electronico,
                to: email,
                subject : "TE UNISTE A PREMIUM!!",
                text : mensaje
            });

            res.json({ok:true, msg: "Correo enviado correctamente"});
        }catch(err){
            res.status(500).json({ok:false, msg:err.message});
        }

    }
]