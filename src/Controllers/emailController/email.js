import nodemailer from "nodemailer";
import { UserModel } from "../../Models/User_Model.js"; // Importar UserModel
import { authenticateToken } from "../../utils/authMiddleware.js";

export const sendEmail = [
  authenticateToken,
  async (req, res, next) => {
    //Obtener usuario
    const user = await UserModel.findById(req.user.user_id).lean();
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    let email = user.email;

    // Obtener la fecha actual
    const date = new Date();

    // Convertir a formato ISO (YYYY-MM-DD)
    const localDate = date.toISOString().split("T")[0];

    const mensaje = `
  <div style="font-family: Arial, sans-serif; background: #f4f8fb; padding: 32px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(26,35,126,0.08); overflow: hidden;">
      <div style="background: #1a237e; color: #fff; padding: 24px 0; text-align: center;">
        <h2 style="margin: 0; font-size: 2em; letter-spacing: 1px;">¡Gracias por unirte a Premium, ${user.name}!</h2>
      </div>
      <div style="padding: 24px; color: #333;">
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Nos complace darte la bienvenida a la experiencia Premium en <span style="color: #00bfae; font-weight: bold;">Jobsy</span>.</p>
        <div style="background: #e0f7fa; border-left: 6px solid #00bfae; padding: 16px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 1.1em; color: #1a237e;">📌 Detalles de tu suscripción:</p>
          <p style="margin: 0; font-size: 1.4em; color: #00bfae; font-weight: bold; letter-spacing: 2px;">- Nombre: ${user.name}</p>
          <p style="margin: 0; font-size: 1.4em; color: #00bfae; font-weight: bold; letter-spacing: 2px;">- Correo: ${email}</p>
          <p style="margin: 0; font-size: 1.4em; color: #00bfae; font-weight: bold; letter-spacing: 2px;">- Fecha de contratación: ${localDate}</p>
          <p style="margin: 0; font-size: 1.4em; color: #00bfae; font-weight: bold; letter-spacing: 2px;">- Precio: 99.00 MXN</p>

          </div>
        <p>⭐ Plan mensual Premium  💰$<span style="color: #1a237e; font-weight: bold;">99.00 MXN / mes  </p>
        <p style="color: #1a237e;">⭐Beneficios: publica hasta 5 servicios, sube hasta 9 imágenes por servicio y edita tus servicios publicados.</p>
      </div>
      <div style="background: #00bfae; color: #fff; text-align: center; padding: 16px 0; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
        <strong>TEAM JOBSY | TETEOCAN</strong>
      </div>
    </div>
  </div>
`;
    try {
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.correo_electronico, //Correo electronico de la empresa -> Jobsy
          pass: process.env.contrasenia_aplicacion_google, //Contraseña de aplicación de la empresa -> Jobsy
        },
      });

      await transporter.sendMail({
        from: process.env.correo_electronico,
        to: email,
        subject: "TE UNISTE A PREMIUM!!",
        text: mensaje,
      });

      res.json({ ok: true, msg: "Correo enviado correctamente" });
    } catch (err) {
      res.status(500).json({ ok: false, msg: err.message });
    }
  },
];
