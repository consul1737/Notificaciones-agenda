require("dotenv").config();
const { google } = require("googleapis");
const qrcode = require("qrcode");
const { Client } = require("whatsapp-web.js");
const schedule = require("node-schedule");
const moment = require("moment");
const fs = require("fs"); // No es necesario instalar, es parte de Node.js

// Cargar variables de entorno
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH;
const SHEET_ID = process.env.SHEET_ID;
const RANGE = process.env.RANGE || "A:F";
const COUNTRY_CODE = process.env.COUNTRY_CODE || "54";

const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const client = new Client();

client.on("qr", (qr) => {
    // Generar el QR y guardarlo como archivo PNG
    qrcode.toFile("qrcode.png", qr, (err) => {
        if (err) {
            console.error("Error generando archivo QR:", err.message);
        } else {
            console.log("El código QR se ha guardado como 'qrcode.png'.");
        }
    });
});

client.on("ready", () => {
    console.log("Cliente de WhatsApp listo.");

    // Programar tarea diaria a las 8:00 AM
    schedule.scheduleJob("0 8 * * *", () => {
        console.log("Ejecutando tarea programada: Enviar notificaciones.");
        enviarNotificaciones();
    });
});

// Inicializar el cliente de WhatsApp
client.initialize();

// Leer datos de Google Sheets
async function leerDatosDeSheets() {
    try {
        const sheets = google.sheets({ version: "v4", auth });
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: RANGE,
        });
        return res.data.values || [];
    } catch (error) {
        console.error("Error leyendo la hoja:", error.message);
        return [];
    }
}

// Enviar notificaciones a clientes
async function enviarNotificaciones() {
    try {
        const datos = await leerDatosDeSheets();

        if (!datos || datos.length === 0) {
            console.log("No hay datos en la hoja.");
            return;
        }

        datos.slice(1).forEach((fila) => {
            const [nombre, fecha, horaInicio, horaFin, estado, telefono] = fila;

            if (!nombre || !fecha || !horaInicio || !telefono) {
                console.log("Fila incompleta, omitiendo:", fila);
                return;
            }

            const hoy = moment().startOf("day");
            const fechaTurno = moment(fecha, "YYYY-MM-DD");

            if (fechaTurno.diff(hoy, "days") >= 1 && estado.toLowerCase() === "notificado") {
                const mensaje = `
Hola ${nombre}, este es un recordatorio de su turno:
📅 Fecha: ${fecha}
⏰ Hora: ${horaInicio} - ${horaFin}

Para confirmar su asistencia, le solicitamos una seña de $10.000. Puede realizar el depósito a través de Mercado Pago utilizando el alias lumina.kinesiologia. La cuenta está a nombre de Virginia Bergami.

Quedamos atentos a su confirmación respondiendo a este mensaje.
¡Muchas gracias!`;

                const numeroCompleto = `${COUNTRY_CODE}${telefono}`;
                client
                    .sendMessage(numeroCompleto + "@c.us", mensaje)
                    .then(() => {
                        console.log(`Mensaje enviado a ${nombre} (${numeroCompleto}).`);
                    })
                    .catch((error) => {
                        console.error(`Error enviando mensaje a ${numeroCompleto}:`, error.message);
                    });
            }
        });
    } catch (error) {
        console.error("Error enviando notificaciones:", error.message);
    }
}
