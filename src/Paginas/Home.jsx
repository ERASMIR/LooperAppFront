import React from "react";

export default function Home() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Título principal */}
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        Bienvenido a LooperApp
      </h1>
      <p className="text-gray-600 mb-10 max-w-3xl">
        Desde este panel podrás acceder a todas las herramientas para gestionar
        tus reportes, documentos y declaraciones REP. En el menú lateral
        izquierdo encontrarás opciones para:
        <span className="block mt-2">
          - Crear reportes<br />
          - Consultar documentos y declaraciones<br />
          - Visualizar datos históricos<br />
          - Solicitar soporte técnico<br />
          - Consultar tutoriales y guías rápidas
        </span>
      </p>

      {/* Distribución principal */}
      <div className="grid grid-cols-3 gap-8">
        {/* Columna izquierda (2/3) */}
        <div className="col-span-2 bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Descarga de plantillas
          </h2>
          <p className="text-gray-600 mb-6">
            Aquí puedes descargar las plantillas necesarias para cargar tus
            datos: la <strong>Matriz de composición de materiales</strong> y los{" "}
            <strong>Registros de ventas</strong>. Deberás completarlas y
            adjuntarlas para generar tus reportes.
          </p>

          <div className="flex gap-4">
            <a
              href="https://docs.google.com/spreadsheets/d/1Yz2mbAgHE-_G2PAFWNlpru5vZmpR5gBi/edit?usp=sharing&ouid=117342122865482341602&rtpof=true&sd=true"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-center"
            >
              Descargar plantilla de materiales
            </a>

            <a
              href="https://docs.google.com/spreadsheets/d/1bLtyvtX9Sp-lhlpLP9K6ZJy8XZ0PyIFS/edit?usp=sharing&ouid=117342122865482341602&rtpof=true&sd=true"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-center"
            >
              Descargar plantilla de ventas
            </a>
          </div>
        </div>

        {/* Columna derecha (1/3) */}
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Sitios oficiales sobre la Ley REP
          </h2>
          <p className="text-gray-600 mb-4">
            Accede a fuentes oficiales y documentos normativos sobre la Ley de
            Responsabilidad Extendida del Productor (Ley N° 20.920):
          </p>
          <ul className="space-y-3">
            <li>
              <a
                href="https://economiacircular.mma.gob.cl/ley-rep/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-medium hover:underline"
              >
                Ministerio del Medio Ambiente (MMA)
              </a>
              <p className="text-gray-600 text-sm">
                Información oficial de Economía Circular, Decretos de Metas
                (Envases y Embalajes, Neumáticos, etc.) y Repositorio REP.
              </p>
            </li>

            <li>
              <a
                href="https://portal.sma.gob.cl/index.php/ley-rep/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-medium hover:underline"
              >
                Superintendencia del Medio Ambiente (SMA)
              </a>
              <p className="text-gray-600 text-sm">
                Requerimientos de fiscalización, instructivos (como la Res. 2084)
                y el Sistema de Reporte de la REP (SISREP).
              </p>
            </li>

            <li>
              <a
                href="https://portalvu.mma.gob.cl/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-medium hover:underline"
              >
                Ventanilla Única (RETC)
              </a>
              <p className="text-gray-600 text-sm">
                Portal para las declaraciones obligatorias de comercialización y
                gestión de productos prioritarios (Res. 4771).
              </p>
            </li>

            <li>
              <a
                href="https://www.bcn.cl/leychile/navegar?idNorma=1090894"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-medium hover:underline"
              >
                Biblioteca del Congreso Nacional (BCN)
              </a>
              <p className="text-gray-600 text-sm">
                Texto completo y oficial de la Ley N° 20.920 (Ley REP).
              </p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
