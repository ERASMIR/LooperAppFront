import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';

const Soporte = () => {
  const { user } = useContext(AuthContext);
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [adjuntos, setAdjuntos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE_MB = 5;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // ✅ Convierte un archivo a base64 (promesa)
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // quitamos el encabezado "data:application/pdf;base64,"
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`El archivo "${file.name}" excede el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`);
      } else {
        validFiles.push(file);
      }
    }
    setAdjuntos((prev) => [...prev, ...validFiles]);
  };

  const handleAdjuntarClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!asunto || !descripcion) {
      alert('Por favor completa todos los campos obligatorios.');
      return;
    }

    setEnviando(true);

    try {
      // ✅ Convertimos todos los adjuntos a base64
      const adjuntosProcesados = await Promise.all(
        adjuntos.map(async (file) => ({
          originalname: file.name,
          mimetype: file.type,
          base64: await fileToBase64(file)
        }))
      );

      // ✅ Construimos el JSON completo
      const payload = {
        asunto,
        descripcion,
        email: user?.email,
        userId: user?.id,
        empresaId: user?.empresaId,
        adjuntos: adjuntosProcesados
      };

      const response = await fetch(
        
        'https://looper-usuarios.azurewebsites.net/api/crearticketsoporte',
        //'http://localhost:7071/api/crearTicketSoporte',
        
        {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al crear el ticket: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Ticket creado:', data);

      if (data.success) {
        alert(`✅ Ticket creado correctamente.\nTu número de seguimiento es: ${data.numeroTicket}`);
      } else {
        alert('❌ Ocurrió un error al crear el ticket.');
      }

      // Reiniciamos el formulario
      setAsunto('');
      setDescripcion('');
      setAdjuntos([]);
    } catch (error) {
      console.error('❌ Error al enviar el ticket:', error);
      alert('Ocurrió un error al enviar el ticket. Intenta nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p-10 w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-800">Centro de Soporte</h1>
        <p className="text-neutral-600 mt-2">
          ¿Tienes algún problema? Crea un ticket y te ayudaremos lo antes posible.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg"
      >
        <div className="mb-6">
          <label htmlFor="asunto" className="block text-lg font-medium text-gray-800 mb-2">
            Asunto
          </label>
          <input
            type="text"
            id="asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="w-full bg-gray-100 text-xl p-4 rounded-2xl mt-1"
            placeholder="Ej: Problema al generar reporte"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="descripcion" className="block text-lg font-medium text-gray-800 mb-2">
            Descripción del Problema
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="8"
            className="w-full bg-gray-100 text-xl p-4 rounded-2xl mt-1"
            placeholder="Describe detalladamente el inconveniente..."
            required
          />
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Archivos Adjuntos</h3>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div className="space-y-3">
            {adjuntos.length > 0 ? (
              adjuntos.map((file, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                >
                  <span className="text-gray-700">{file.name}</span>
                  <span className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">No hay archivos adjuntos.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdjuntarClick}
            className="mt-4 text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Añadir adjunto
          </button>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className={`w-full text-xl py-4 rounded-xl transition-colors ${
            enviando
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {enviando ? 'Enviando...' : 'Enviar Ticket'}
        </button>
      </form>
    </div>
  );
};

export default Soporte;
