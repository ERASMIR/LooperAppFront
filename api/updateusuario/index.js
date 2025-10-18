const bcrypt = require('bcryptjs');
const sql = require('mssql');

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

module.exports = async function (context, req) {
    const { id, nombre, apellidos, url_avatar, password } = req.body;

    if (!id) {
        context.res = {
            status: 400,
            body: { message: "Por favor, proporciona un ID de usuario." }
        };
        return;
    }

    try {
        await sql.connect(dbConfig);

        const updateFields = [];
        const request = new sql.Request();
        request.input('id', sql.Int, id);

        if (nombre !== undefined) {
            updateFields.push('nombre = @nombre');
            request.input('nombre', sql.NVarChar, nombre);
        }
        if (apellidos !== undefined) {
            updateFields.push('apellidos = @apellidos');
            request.input('apellidos', sql.NVarChar, apellidos);
        }
        if (url_avatar !== undefined) {
            updateFields.push('url_avatar = @url_avatar');
            request.input('url_avatar', sql.NVarChar, url_avatar);
        }
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            updateFields.push('password_hash = @password_hash'); 
            request.input('password_hash', sql.NVarChar, hashedPassword);
        }
        
        if (updateFields.length === 0) {
             context.res = {
                status: 400,
                body: { message: "No hay campos para actualizar." }
            };
            return;
        }

        const query = `UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = @id`;

        await request.query(query);

        context.res = {
            status: 200,
            body: { message: "Usuario actualizado correctamente." }
        };

    } catch (err) {
        context.log.error("Error al actualizar usuario:", err);
        context.res = {
            status: 500,
            body: { message: "Error interno del servidor al actualizar el usuario." }
        };
    }
};
