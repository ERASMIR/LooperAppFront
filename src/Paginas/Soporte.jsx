import React, { useState, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { API_USUARIOS } from '../config/api';

import EncabezadoPagina from "../Componentes/EncabezadoPagina";
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
        
        `${API_USUARIOS}/crearTicketSoporte`,
        
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
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo="Centro de Soporte"
        descripcion="¿Tienes algún problema? Crea un ticket y te ayudaremos lo antes posible."
      />

      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto tarjeta p-8"
      >
        <div className="mb-6">
          <label htmlFor="asunto" className="block text-sm font-semibold text-neutral-800 mb-1">
            Asunto
          </label>
          <input
            type="text"
            id="asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="w-full campo mt-1"
            placeholder="Ej: Problema al generar reporte"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="descripcion" className="block text-sm font-semibold text-neutral-800 mb-1">
            Descripción del Problema
          </label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows="8"
            className="w-full campo mt-1"
            placeholder="Describe detalladamente el inconveniente..."
            required
          />
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-medium text-neutral-800 mb-4">Archivos Adjuntos</h3>

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
                  className="flex justify-between items-center bg-neutral-50 p-3 rounded-lg"
                >
                  <span className="text-neutral-700">{file.name}</span>
                  <span className="text-sm text-neutral-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-neutral-500 py-4">No hay archivos adjuntos.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdjuntarClick}
            className="mt-4 text-primary-dark hover:underline"
          >
            + Añadir adjunto
          </button>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="btn-principal w-full"
        >
          {enviando ? 'Enviando…' : 'Enviar ticket'}
        </button>
      </form>
    </div>
  );
};

export default Soporte;
