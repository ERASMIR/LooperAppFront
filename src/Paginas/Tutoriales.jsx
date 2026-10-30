import React from 'react';
import EncabezadoPagina from '../Componentes/EncabezadoPagina';

const Tutoriales = () => (
  <div className="flex flex-col items-center p-4">
    <EncabezadoPagina
      titulo="Tutoriales"
      descripcion="Acá encontrarás los tutoriales para que puedas sacarle el mejor provecho a Looper."
      className="w-full max-w-3xl"
    />

    {/* 🔹 Video 1 */}
    <div className="w-full max-w-3xl mb-10">
      <h2 className="text-xl font-semibold text-neutral-800 mb-4 text-center">
        Elaboración de la matriz de materiales
      </h2>
      <div className="aspect-w-16 aspect-h-9">
        <iframe
          className="w-full h-96 rounded-xl shadow-sm"
          src="https://drive.google.com/file/d/1y_asyzChEuQJIz1mxKqOi4UiiPk945EZ/preview"
          //src="https://www.youtube.com/embed/Z5SXMAjP2Nw"
          title="Elaboración de la matriz de materiales"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>

    {/* 🔹 Video 2 */}
    <div className="w-full max-w-3xl mb-10">
      <h2 className="text-xl font-semibold text-neutral-800 mb-4 text-center">
        Elaboración del registro de ventas
      </h2>
      <div className="aspect-w-16 aspect-h-9">
        <iframe
          className="w-full h-96 rounded-xl shadow-sm"
          src="https://drive.google.com/file/d/1Lx2lExg2QuO0Rz9cRKczwzs0hc8PrIA4/preview"
          //src="https://www.youtube.com/embed/S7VjwjCtu4A"
          title="Elaboración del registro de ventas"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  </div>
);

export default Tutoriales;
