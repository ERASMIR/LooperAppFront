import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Soporte = () => {
  const { user } = useContext(AuthContext);
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [adjuntos, setAdjuntos] = useState([]); // Placeholder for attachments

  const handleAdjuntar = () => {
    // This is a placeholder for the file attachment logic.
    // In a real scenario, this would open a file dialog.
    const now = new Date();
    const nuevoAdjunto = {
      nombre: `documento_adjunto_${adjuntos.length + 1}.pdf`,
      fecha: now.toLocaleDateString(),
      hora: now.toLocaleTimeString(),
      usuario: user.name,
    };
    setAdjuntos([...adjuntos, nuevoAdjunto]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Backend logic to send the ticket will be added later
    alert('Ticket enviado (simulación). A continuación integraremos el backend.');
    console.log({ asunto, descripcion, adjuntos });
  };

  return (
    <div className="p-10 w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-800">Centro de Soporte</h1>
        <p className="text-neutral-600 mt-2">¿Tienes algún problema? Crea un ticket y te ayudaremos lo antes posible.</p>
      </header>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
        <div className="mb-6">
          <label htmlFor="asunto" className="block text-lg font-medium text-gray-800 mb-2">Asunto</label>
          <input
            type="text"
            id="asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
            placeholder="Ej: Problema al generar reporte"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="descripcion" className="block text-lg font-medium text-gray-800 mb-2">Descripción del Problema</label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="8"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
            placeholder="Describe detalladamente el inconveniente que estás experimentando..."
            required
          />
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Archivos Adjuntos</h3>
          <div className="space-y-3">
            {adjuntos.map((adjunto, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-gray-700">{adjunto.nombre}</span>
                <span className="text-sm text-gray-500">{`${adjunto.fecha} ${adjunto.hora} - ${adjunto.usuario}`}</span>
              </div>
            ))}
             {adjuntos.length === 0 && <p className='text-center text-gray-500 py-4'>No hay archivos adjuntos.</p>}
          </div>
          <button type="button" onClick={handleAdjuntar} className="mt-4 text-blue-600 hover:text-blue-800 transition-colors">
            + Añadir adjunto (simulación)
          </button>
        </div>

        <button type="submit" className="w-full text-xl bg-blue-500 text-white py-4 rounded-xl hover:bg-blue-600 transition-colors">
          Enviar Ticket
        </button>
      </form>
    </div>
  );
};

export default Soporte;
