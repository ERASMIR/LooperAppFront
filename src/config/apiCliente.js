// Cliente común de las APIs (auditoría UI, RC-04): antes había una copia de esto en cada página.
// Las URLs base siguen en api.js.

/**
 * Llama a una API con el JWT de la sesión. Devuelve el JSON de la respuesta.
 * Si falla, lanza un Error con el mensaje del back (`error`), su lista de errores (`err.errores`) y el código HTTP
 * (`err.status`).
 */
export const llamarApi = async (token, base, ruta, { metodo = "GET", body } = {}) => {
  const res = await fetch(`${base}/${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status} al comunicarse con el servidor`);
    err.errores = data?.errores || [];
    err.status = res.status;
    throw err;
  }
  return data;
};

// Mensaje del error con su lista de errores del back: "Revisa los datos: RUT obligatorio. Correo inválido."
export const textoError = (err, separador = " ") =>
  (err.errores?.length ? `${err.message}: ${err.errores.join(separador)}` : err.message);

/**
 * Descarga un archivo de la API (con la sesión) y lo guarda con el nombre que indica el back (Content-Disposition).
 * Devuelve el nombre del archivo. Si falla, lanza un Error con el mensaje del back y sus errores.
 */
export const descargarArchivo = async (token, url, nombrePorDefecto) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error(data?.error || `Error ${res.status} al generar el archivo`);
    err.errores = data?.errores || [];
    err.status = res.status;
    throw err;
  }
  const nombre = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || nombrePorDefecto;
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(await res.blob());
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000); // liberar después de que el navegador tome la descarga
  return nombre;
};
