import nodemailer from "nodemailer";
import { UserModel } from "../../Models/User_Model.js";

export const recoverPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ error: "Debes ingresar un correo electrónico" });
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  // Generar nueva contraseña aleatoria
  const newPassword =
    Math.random().toString(36).slice(-10) +
    Math.random().toString(36).slice(-2);

  // Asignar la nueva contraseña en texto plano
  user.password = newPassword;
  await user.save();

  // Mensaje de aviso y precauciones (HTML profesional)
  const mensaje = `
  <div style="font-family: Arial, sans-serif; background: #f4f8fb; padding: 32px;">
    <div style="max-width: 500px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(26,35,126,0.08); overflow: hidden;">
      <div style="background: #1a237e; color: #fff; padding: 24px 0; text-align: center;">
        <h2 style="margin: 0; font-size: 2em; letter-spacing: 1px;">Recuperación de Contraseña</h2>
      </div>
      <div style="padding: 24px; color: #333;">
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Has solicitado recuperar tu contraseña en <span style="color: #00bfae; font-weight: bold;">Jobsy</span>.</p>
        <div style="background: #e0f7fa; border-left: 6px solid #00bfae; padding: 16px; margin: 24px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 1.1em; color: #1a237e;">Tu nueva contraseña temporal es:</p>
          <p style="margin: 0; font-size: 1.4em; color: #00bfae; font-weight: bold; letter-spacing: 2px;">${newPassword}</p>
        </div>
        <p>Por seguridad, inicia sesión con esta contraseña y <span style="color: #1a237e; font-weight: bold;">cámbiala lo antes posible</span> desde tu perfil para mantener tu cuenta segura.</p>
        <p style="color: #1a237e;">Si no solicitaste este cambio, contacta con nuestro equipo de soporte inmediatamente.</p>
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
        user: process.env.correo_electronico,
        pass: process.env.contrasenia_aplicacion_google,
      },
    });

    await transporter.sendMail({
      from: process.env.correo_electronico,
      to: email,
      subject: "Recuperación de contraseña Jobsy",
      html: mensaje,
    });

    res.json({
      ok: true,
      msg: "Correo de recuperación enviado. Revisa tu bandeja de entrada y sigue las instrucciones.",
    });
  } catch (err) {
    res.status(500).json({ ok: false, msg: err.message });
  }
};