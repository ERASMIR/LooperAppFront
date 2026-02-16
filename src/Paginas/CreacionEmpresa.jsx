import React, { useState, useEffect } from 'react';
import { API_USUARIOS } from '../config/api';

const CreacionEmpresa = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    responsable: '',
    correo_responsable: '',
    gransic_id: '',
  });

  const [message, setMessage] = useState('');
  const [gransicList, setGransicList] = useState([]);

  useEffect(() => {
    fetch(`${API_USUARIOS}/getGransic`)
      .then((res) => res.json())
      .then((data) => setGransicList(data))
      .catch((err) => console.error('Error al cargar GRANSIC:', err));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await fetch(`${API_USUARIOS}/createempresa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setMessage('Empresa creada con éxito!');
        setFormData({
          nombre: '',
          direccion: '',
          telefono: '',
          responsable: '',
          correo_responsable: '',
          gransic_id: '',
        });
      } else {
        const errorData = await res.json();
        setMessage(`Error al crear la empresa: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error('❌ Error al crear empresa:', err);
      setMessage('Error de red al intentar crear la empresa.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-900">Crear Nueva Empresa</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre de la empresa"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none placeholder-gray-400"
            onChange={handleChange}
            value={formData.nombre}
            required
          />
          <input
            type="text"
            name="direccion"
            placeholder="Dirección"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none placeholder-gray-400"
            onChange={handleChange}
            value={formData.direccion}
          />
          <input
            type="text"
            name="telefono"
            placeholder="Teléfono"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none placeholder-gray-400"
            onChange={handleChange}
            value={formData.telefono}
          />
          <input
            type="text"
            name="responsable"
            placeholder="Nombre del responsable"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none placeholder-gray-400"
            onChange={handleChange}
            value={formData.responsable}
          />
          <input
            type="email"
            name="correo_responsable"
            placeholder="Correo del responsable"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none placeholder-gray-400"
            onChange={handleChange}
            value={formData.correo_responsable}
          />
          <select
            name="gransic_id"
            className="w-full bg-gray-100 text-xl p-4 rounded-xl focus:outline-none text-gray-700"
            onChange={handleChange}
            value={formData.gransic_id}
          >
            <option value="">Seleccionar GRANSIC</option>
            {gransicList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full p-4 text-xl font-bold text-white bg-blue-500 rounded-xl hover:bg-blue-600 focus:outline-none"
          >
            Crear Empresa
          </button>
        </form>
        {message && <p className="text-center text-red-500">{message}</p>}
      </div>
    </div>
  );
};

export default CreacionEmpresa;
