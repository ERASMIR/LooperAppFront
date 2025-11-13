import React from 'react';

const Tutoriales = () => (
  <div className="flex flex-col items-center px-6 py-10 bg-gray-50 min-h-screen">
    {/* 🔹 Título principal */}
    <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">
      Tutoriales
    </h1>
    <p className="text-lg text-gray-600 mb-10 text-center max-w-2xl">
      Acá encontrarás los tutoriales para que puedas sacarle el mejor provecho a Looper.
    </p>

    {/* 🔹 Video 1 */}
    <div className="w-full max-w-3xl mb-10">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        Elaboración de la matriz de materiales
      </h2>
      <div className="aspect-w-16 aspect-h-9">
        <iframe
          className="w-full h-96 rounded-xl shadow-lg"
          src="https://www.youtube-nocookie.com/embed/Z5SXMAjP2Nw"
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
      <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
        Elaboración del registro de ventas
      </h2>
      <div className="aspect-w-16 aspect-h-9">
        <iframe
          className="w-full h-96 rounded-xl shadow-lg"
          src="https://www.youtube-nocookie.com/embed/S7VjwjCtu4A"
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
