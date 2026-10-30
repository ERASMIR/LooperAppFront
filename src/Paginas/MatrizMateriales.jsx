import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Dialogo from "../Componentes/Dialogo.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_MATERIALES } from "../config/api";
import { llamarApi as llamarApiBase } from "../config/apiCliente.js";
import CargaMasivaMatriz from "../Componentes/CargaMasivaMatriz.jsx";
import { EncabezadoAjustable, ModalColumnas } from "../Componentes/columnasTabla.jsx";
import { useVistaTabla } from "../Componentes/useVistaTabla.js";
import Paginacion from "../Componentes/Paginacion.jsx";
import { paginar } from "../Componentes/paginar.js";
import { Indicador, Indicadores } from "../Componentes/Indicador.jsx";
import {
  Plus, X, Trash2, Search, Paperclip, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Pencil, Loader2, Columns3,
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────
const TIPOS_ADJUNTO = [
  { value: "ficha_tecnica", label: "Ficha técnica" },
  { value: "informe_segregacion", label: "Informe de segregación" },
];
const EXTENSIONES_ADJUNTO = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls";
const TAMANO_MAX_MB = 10;
const MAX_NOMBRE_CAMPO = 100;
const MAX_VALOR_CAMPO = 1000;

// Comparación de nombres sin distinguir mayúsculas ni tildes (igual que la collation de la BD).
const mismoNombre = (a, b) => a.trim().localeCompare(b.trim(), "es", { sensitivity: "base" }) === 0;

const filaVacia = () => ({ componenteId: "", categoria: "", material: "", caracteristicaId: "", cantidad: "", pesoKg: "", campos: {} });
// Sub Categoría del material (informativa, no se usa en el cálculo): { categoria: { material: subcategoria } }.
// Viene en el catálogo GRANSIC (hoy solo ReSimple, desde su plantilla oficial).
const subcategoriasDe = (gransic) => gransic.subcategorias || null;

// Última actualización de un producto: fecha de su versión vigente, usuario y origen (formulario o carga masiva).
const ORIGENES = { manual: "formulario", carga_masiva: "carga masiva" };
const formatoFecha = (f) => (f
  ? new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—");

// Nivel de un campo adicional: "producto" (un valor por producto) o "componente" (un valor por fila de la composición).
const esDeComponente = (c) => c.nivel === "componente";
const unidadVacia = () => ({ unidadVentaId: "", filas: [filaVacia()] });
const productoVacio = () => ({
  sku: "", descripcion: "",
  categoria: "", peligrosidad: "", unidades: [unidadVacia()], adjunto: null, camposAdicionales: {},
});

// Producto del listado → estado del formulario (edición).
const desdeProducto = (p) => ({
  id: p.id,
  version: p.version,
  actualizadoFecha: p.actualizadoFecha,
  sku: p.sku,
  descripcion: p.descripcion,
  categoria: p.categoria || "",
  peligrosidad: p.peligrosidad || "",
  unidades: p.unidades.map((u) => ({
    unidadVentaId: u.unidadVentaId,
    filas: u.filas.map((f) => ({
      componenteId: f.componenteId, categoria: f.categoria || "", material: f.material,
      caracteristicaId: f.caracteristicaId || "", cantidad: String(f.cantidad), pesoKg: String(f.pesoKg),
      campos: Object.fromEntries((f.camposAdicionales || []).map((c) => [c.campoId, c.valor])),
    })),
  })),
  adjunto: p.adjunto ? { nombre: p.adjunto.nombre, tipo: p.adjunto.tipo, urlWeb: p.adjunto.urlWeb, existente: true } : null,
  camposAdicionales: Object.fromEntries((p.camposAdicionales || []).map((c) => [c.campoId, c.valor])),
});

// Estado del formulario → body de POST/PUT /api/productos.
const aPayload = (producto, empresaId, tienePeligrosidad) => ({
  empresaId,
  sku: producto.sku.trim(),
  descripcion: producto.descripcion.trim(),
  categoria: tienePeligrosidad ? producto.categoria : null,
  peligrosidad: tienePeligrosidad ? producto.peligrosidad : null,
  unidades: producto.unidades.map((u) => ({
    unidadVentaId: u.unidadVentaId,
    filas: u.filas.map((f) => ({
      componenteId: f.componenteId, cantidad: Number(f.cantidad), pesoKg: Number(f.pesoKg),
      categoria: tienePeligrosidad ? null : f.categoria, material: f.material, caracteristicaId: f.caracteristicaId || null,
      camposAdicionales: Object.entries(f.campos || {}).map(([campoId, valor]) => ({ campoId, valor: valor.trim() })).filter((c) => c.valor),
    })),
  })),
  // Solo se envían los campos adicionales con contenido.
  camposAdicionales: Object.entries(producto.camposAdicionales || {})
    .map(([campoId, valor]) => ({ campoId, valor: valor.trim() }))
    .filter((c) => c.valor),
});

// Peso por unidad de venta (kg) = cantidad × peso (kg); TON = peso por unidad de venta / 1000
const pesoFila = (f) => (Number(f.cantidad) || 0) * (Number(f.pesoKg) || 0);
const tonFila = (f) => pesoFila(f) / 1000;
const pesoUnidad = (u) => u.filas.reduce((acc, f) => acc + pesoFila(f), 0);
const tonUnidad = (u) => pesoUnidad(u) / 1000;
const formatoKg = (n) => n.toLocaleString("es-CL", { maximumFractionDigits: 4 });
const formatoTon = (n) => n.toLocaleString("es-CL", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const etiquetaTipo = (tipo) => TIPOS_ADJUNTO.find((t) => t.value === tipo)?.label || tipo;

const inputCls = "w-full campo";
const labelCls = "block font-semibold text-sm mb-1";

// ── API looper-materiales (cliente común en config/apiCliente.js) ─────────────
const llamarApi = (token, ruta, opciones) => llamarApiBase(token, API_MATERIALES, ruta, opciones);

const aBase64 = (archivo) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1]);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });

// ── Piezas comunes ────────────────────────────────────────────────────────────
// Desplegable con botón "+" para crear un valor nuevo (solo admin/dev). opciones: [{ value, label }].
const SelectConMas = ({ id, value, onChange, opciones, placeholder, onMas, puedeCrear, disabled, tituloMas }) => (
  <div className="flex gap-1.5">
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls}>
      <option value="">{placeholder}</option>
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {puedeCrear && (
      <button
        type="button"
        onClick={onMas}
        disabled={disabled}
        title={tituloMas}
        className="flex-shrink-0 w-9 rounded-lg bg-primary-dark text-white flex items-center justify-center hover:bg-primary-darker disabled:bg-gray-300"
      >
        <Plus className="w-4 h-4" />
      </button>
    )}
  </div>
);

const Modal = ({ titulo, onCerrar, children }) => (
  <Dialogo onCerrar={onCerrar} className="max-w-md p-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-bold text-neutral-800">{titulo}</h2>
      <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
    </div>
    {children}
  </Dialogo>
);

// Modal genérico para crear un elemento de catálogo. onGuardar es async y puede lanzar el error del back.
const ModalNuevo = ({ titulo, campos, onGuardar, onCerrar, existentes }) => {
  const [valores, setValores] = useState(Object.fromEntries(campos.map((c) => [c.key, ""])));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const nombre = (valores.nombre || "").trim();
    if (!nombre) return setError("El nombre es obligatorio.");
    if (existentes.some((e) => mismoNombre(e, nombre))) return setError("Ya existe un elemento con ese nombre.");
    const falta = campos.find((c) => c.requerido && !valores[c.key]);
    if (falta) return setError(`Indica: ${falta.label.toLowerCase()}.`);
    setGuardando(true);
    try {
      await onGuardar({ ...valores, nombre });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-3">
        {campos.map((c) => (
          <div key={c.key}>
            <label htmlFor={`nuevo-${c.key}`} className={labelCls}>{c.label}</label>
            {c.opciones ? (
              <select id={`nuevo-${c.key}`} value={valores[c.key]} onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })} className={inputCls}>
                <option value="">Seleccionar</option>
                {c.opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={c.type || "text"}
                maxLength={c.maxLength}
                min={c.type === "number" ? 0 : undefined}
                step="any"
                value={valores[c.key]}
                onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
                className={inputCls}
                autoFocus={c.key === "nombre"}
              />
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="btn-principal">
          {guardando ? "Guardando…" : "Agregar"}
        </button>
      </div>
    </Modal>
  );
};

// Confirmación de acciones delicadas (eliminar, cambiar SKU). onConfirmar puede ser async.
const ModalConfirmar = ({ titulo, children, textoConfirmar, peligro, onConfirmar, onCerrar }) => {
  const [error, setError] = useState("");
  const [enCurso, setEnCurso] = useState(false);

  const confirmar = async () => {
    setEnCurso(true);
    try {
      await onConfirmar();
    } catch (err) {
      setError(err.message);
      setEnCurso(false);
    }
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="flex gap-3 text-sm text-neutral-700">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${peligro ? "text-red-600" : "text-yellow-600"}`} />
        <div className="space-y-2">{children}</div>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cancelar</button>
        <button
          onClick={confirmar}
          disabled={enCurso}
          className={`text-white px-5 py-2 rounded-lg disabled:bg-gray-400 ${peligro ? "bg-red-600 hover:bg-red-700" : "bg-primary-dark hover:bg-primary-darker"}`}
        >
          {enCurso ? "Procesando…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
};

// Lista de campos adicionales de la empresa: renombrar y eliminar (soft delete; los valores se conservan).
// onRenombrar(id, nombre) y onEliminar(id) son async y pueden lanzar el error del back.
const ModalGestionarCampos = ({ campos, onRenombrar, onEliminar, onCerrar }) => {
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState("");
  const [enCurso, setEnCurso] = useState(false);

  const ejecutar = async (accion) => {
    setEnCurso(true);
    setError("");
    try {
      await accion();
      setEditandoId(null);
      setEliminandoId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnCurso(false);
    }
  };

  const guardarNombre = (campo) => {
    const nuevo = nombre.trim();
    if (!nuevo) return setError("El nombre es obligatorio.");
    if (nuevo === campo.nombre) return setEditandoId(null);
    if (campos.some((c) => c.id !== campo.id && mismoNombre(c.nombre, nuevo))) return setError("Ya existe un campo con ese nombre.");
    ejecutar(() => onRenombrar(campo.id, nuevo));
  };

  return (
    <Modal titulo="Campos adicionales" onCerrar={onCerrar}>
      <p className="text-sm text-neutral-500 mb-3">
        Los campos son de toda la empresa. Al eliminar uno se oculta en todos los productos; sus valores no se borran y
        vuelven a aparecer si creas otro campo con el mismo nombre.
      </p>
      {campos.length === 0 && <p className="text-sm text-neutral-600">La empresa no tiene campos adicionales.</p>}
      <ul className="divide-y max-h-80 overflow-y-auto">
        {[...campos].sort((a, b) => esDeComponente(a) - esDeComponente(b)).map((c, i, lista) => (
          <li key={c.id} className="py-2">
            {(i === 0 || esDeComponente(c) !== esDeComponente(lista[i - 1])) && (
              <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">{esDeComponente(c) ? "Del componente" : "Del producto"}</p>
            )}
            {editandoId === c.id ? (
              <div className="flex gap-1.5">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardarNombre(c)}
                  maxLength={MAX_NOMBRE_CAMPO}
                  autoFocus
                  className={inputCls}
                />
                <button onClick={() => guardarNombre(c)} disabled={enCurso} className="btn-principal">
                  Guardar
                </button>
                <button onClick={() => { setEditandoId(null); setError(""); }} title="Cancelar" className="p-1.5 rounded-full hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : eliminandoId === c.id ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">¿Eliminar <b>{c.nombre}</b>?</span>
                <button onClick={() => setEliminandoId(null)} className="px-3 py-1 rounded-lg border border-primary text-primary-dark hover:bg-green-50">Cancelar</button>
                <button onClick={() => ejecutar(() => onEliminar(c.id))} disabled={enCurso} className="btn-peligro btn-chico">
                  Eliminar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">{c.nombre}</span>
                <button
                  title="Renombrar"
                  onClick={() => { setEditandoId(c.id); setNombre(c.nombre); setEliminandoId(null); setError(""); }}
                  className="p-1.5 rounded-full hover:bg-green-50 text-primary-dark"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  title="Eliminar"
                  onClick={() => { setEliminandoId(c.id); setEditandoId(null); setError(""); }}
                  className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cerrar</button>
      </div>
    </Modal>
  );
};

// ── Pestaña: listado de productos ─────────────────────────────────────────────
const ANCHO_DETALLE = 40;
const PRODUCTOS_POR_PAGINA = 50;
const ANCHO_ACCIONES = 96;

const ListadoProductos = ({
  productos, tienePeligrosidad, subcategorias, puedeEditar, onEditar, onEliminar, campos, camposComponente, claveVista,
}) => {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState(null);
  const [editandoColumnas, setEditandoColumnas] = useState(false);

  // ancho: por defecto (px). render(p): contenido de la celda.
  const columnas = [
    // VI-05: el SKU no se corta en dos líneas (si no cabe, "…" y el SKU completo al pasar el mouse).
    { id: "sku", label: "SKU", fija: true, ancho: 200, render: (p) => (
      <span className="flex items-baseline gap-1.5 min-w-0 font-medium" title={p.sku}>
        <span className="truncate">{p.sku}</span>
        {p.version > 1 && <span className="flex-shrink-0 text-xs text-neutral-500" title="Versión de la matriz">v{p.version}</span>}
      </span>
    ) },
    { id: "descripcion", label: "Descripción", fija: true, ancho: 240, render: (p) => p.descripcion },
    ...(tienePeligrosidad ? [
      { id: "categoria", label: "Categoría", ancho: 140, render: (p) => <span className="capitalize">{p.categoria}</span> },
      { id: "peligrosidad", label: "Peligrosidad", ancho: 130, render: (p) => <span className="capitalize">{p.peligrosidad}</span> },
    ] : []),
    { id: "unidades", label: "Unidades de venta · TON por unidad", fija: true, ancho: 250, render: (p) => (
      <div className="flex flex-wrap gap-1.5">
        {p.unidades.map((u) => (
          <span key={u.unidadVentaId} className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs">
            {u.unidad} · {formatoTon(tonUnidad(u))}
          </span>
        ))}
      </div>
    ) },
    // Fecha de la versión vigente: cada cambio crea una versión (formulario o carga masiva).
    // VI-05: fecha en una línea y "usuario · origen" en otra, recortada si no cabe (antes ocupaba hasta 3 líneas).
    { id: "actualizado", label: "Última actualización", ancho: 210, render: (p) => (
      <span className="block min-w-0 leading-5" title={`Versión ${p.version} · ${p.actualizadoPor || "—"} · ${ORIGENES[p.origen] || p.origen}`}>
        <span className="block whitespace-nowrap text-neutral-800">{formatoFecha(p.actualizadoFecha)}</span>
        <span className="block truncate text-xs text-neutral-500">{p.actualizadoPor || "—"} · {ORIGENES[p.origen] || p.origen}</span>
      </span>
    ) },
    { id: "adjunto", label: "Adjunto", ancho: 180, render: (p) => (p.adjunto ? (
      <a
        href={p.adjunto.urlWeb}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1 text-primary-dark hover:underline min-w-0"
        title={etiquetaTipo(p.adjunto.tipo)}
      >
        <Paperclip className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{p.adjunto.nombre}</span>
      </a>
    ) : "—") },
    ...campos.map((c) => ({
      id: `campo:${c.id}`, label: c.nombre, campo: true, ancho: 160, render: (p) => {
        const valor = p.camposAdicionales?.find((v) => v.campoId === c.id)?.valor;
        return valor ? <span className="block truncate" title={valor}>{valor}</span> : "—";
      },
    })),
  ];

  const vistaTabla = useVistaTabla(claveVista, columnas);
  const { visibles, anchoDe } = vistaTabla;
  const anchoTabla = ANCHO_DETALLE + visibles.reduce((acc, c) => acc + anchoDe(c), 0) + (puedeEditar ? ANCHO_ACCIONES : 0);
  const totalColumnas = visibles.length + 1 + (puedeEditar ? 1 : 0);

  const filtrados = productos.filter((p) =>
    `${p.sku} ${p.descripcion}`.toLowerCase().includes(busqueda.trim().toLowerCase())
  );
  // Paginado (UX-09): con cientos de productos se dibujaban miles de elementos de una vez.
  const vista = paginar(filtrados, pagina, PRODUCTOS_POR_PAGINA);
  const cambiarPagina = (n) => { setPagina(n); setAbierto(null); };

  // Resumen de la matriz (mismo estándar que Ventas y Reporte: Componentes/Indicador.jsx), sobre toda la matriz.
  const ultima = productos.reduce((max, p) => (p.actualizadoFecha > (max || "") ? p.actualizadoFecha : max), null);

  return (
    <div>
      <Indicadores className="mb-5">
        <Indicador etiqueta="Productos" valor={productos.length} />
        <Indicador etiqueta="Unidades de venta por producto (total)" valor={productos.reduce((n, p) => n + p.unidades.length, 0)} />
        <Indicador etiqueta="Con respaldo adjunto" valor={productos.filter((p) => p.adjunto).length} />
        <Indicador etiqueta="Última actualización" valor={ultima ? formatoFecha(ultima) : "—"} />
      </Indicadores>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            aria-label="Buscar por SKU o descripción"
            placeholder="Buscar por SKU o descripción"
            className="w-full campo pl-9"
          />
        </div>
        <button
          onClick={() => setEditandoColumnas(true)}
          className="btn-secundario"
        >
          <Columns3 className="w-4 h-4" /> Columnas
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="text-sm table-fixed" style={{ width: anchoTabla, minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: ANCHO_DETALLE }} />
            {visibles.map((c) => <col key={c.id} style={{ width: anchoDe(c) }} />)}
            {puedeEditar && <col style={{ width: ANCHO_ACCIONES }} />}
          </colgroup>
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3"></th>
              {visibles.map((c) => <EncabezadoAjustable key={c.id} columna={c} vistaTabla={vistaTabla} />)}
              {puedeEditar && <th className="p-3"></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={totalColumnas} className="p-6 text-center text-neutral-500">No hay productos registrados.</td></tr>
            )}
            {vista.filas.map((p) => (
              <React.Fragment key={p.id}>
                <tr className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
                  {/* UX-04: botón real para abrir el detalle con teclado; la fila sigue respondiendo al clic */}
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAbierto(abierto === p.id ? null : p.id); }}
                      aria-expanded={abierto === p.id}
                      aria-label={`${abierto === p.id ? "Ocultar" : "Ver"} la composición de ${p.sku}`}
                      className="p-1 rounded-md text-neutral-600 hover:bg-gray-100"
                    >
                      {abierto === p.id ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </td>
                  {visibles.map((c) => <td key={c.id} className="p-3 break-words overflow-hidden">{c.render(p)}</td>)}
                  {puedeEditar && (
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          title="Editar producto"
                          onClick={(e) => { e.stopPropagation(); onEditar(p); }}
                          className="p-1.5 rounded-full hover:bg-green-50 text-primary-dark"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          title="Eliminar producto"
                          onClick={(e) => { e.stopPropagation(); onEliminar(p); }}
                          className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
                {abierto === p.id && (
                  <tr className="bg-gray-50">
                    <td></td>
                    <td colSpan={totalColumnas - 1} className="p-3">
                      {p.unidades.map((u) => (
                        <div key={u.unidadVentaId} className="mb-3 last:mb-0">
                          <p className="font-semibold text-xs text-neutral-600 mb-1">Unidad de venta: {u.unidad} · {formatoKg(pesoUnidad(u))} kg</p>
                          <table className="w-full text-xs bg-white rounded-lg overflow-hidden">
                            <thead className="bg-gray-100 text-left">
                              <tr>
                                <th className="p-2">Componente</th>
                                <th className="p-2 text-right">Cantidad</th>
                                <th className="p-2 text-right">Peso (kg)</th>
                                <th className="p-2 text-right">Peso por unidad de venta (kg)</th>
                                <th className="p-2 text-right">TON</th>
                                {!tienePeligrosidad && <th className="p-2">Categoría</th>}
                                <th className="p-2">Material</th>
                                {subcategorias && <th className="p-2">Sub categoría</th>}
                                <th className="p-2">Característica</th>
                                {camposComponente.map((c) => <th key={c.id} className="p-2">{c.nombre}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {u.filas.map((f) => (
                                <tr key={f.id} className="border-t">
                                  <td className="p-2">{f.componente}</td>
                                  <td className="p-2 text-right">{f.cantidad}</td>
                                  <td className="p-2 text-right">{f.pesoKg}</td>
                                  <td className="p-2 text-right">{formatoKg(pesoFila(f))}</td>
                                  <td className="p-2 text-right">{formatoTon(tonFila(f))}</td>
                                  {!tienePeligrosidad && <td className="p-2 capitalize">{f.categoria}</td>}
                                  <td className="p-2">{f.material}</td>
                                  {subcategorias && <td className="p-2">{subcategorias[tienePeligrosidad ? p.categoria : f.categoria]?.[f.material] || "—"}</td>}
                                  <td className="p-2">{f.caracteristica}</td>
                                  {camposComponente.map((c) => (
                                    <td key={c.id} className="p-2">{f.camposAdicionales?.find((v) => v.campoId === c.id)?.valor || "—"}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                      {p.camposAdicionales?.length > 0 && (
                        <div className="mt-3">
                          <p className="font-semibold text-xs text-neutral-600 mb-1">Información adicional</p>
                          <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1 bg-white rounded-lg p-2 text-xs">
                            {p.camposAdicionales.map((c) => (
                              <div key={c.campoId} className="min-w-0">
                                <dt className="text-neutral-500">{c.nombre}</dt>
                                <dd className="break-words">{c.valor}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Paginacion
        total={filtrados.length}
        pagina={vista.pagina}
        paginas={vista.paginas}
        porPagina={PRODUCTOS_POR_PAGINA}
        onCambiar={cambiarPagina}
        nombre="productos"
        nombreUno="producto"
      />

      {editandoColumnas && (
        <ModalColumnas
          columnas={columnas}
          vistaTabla={vistaTabla}
          tituloDatos="Datos del producto"
          onCerrar={() => setEditandoColumnas(false)}
        />
      )}
    </div>
  );
};

// ── Pestaña: crear o editar producto ──────────────────────────────────────────
// inicial: producto en edición (desdeProducto) o null para uno nuevo.
const CrearProducto = ({
  gransic, puedeEditar, catalogos, abrirModal, onGestionarCampos, productosExistentes, onGuardar, inicial, onCancelarEdicion,
  claveCargaMasiva, onCargaMasiva,
}) => {
  const editando = !!inicial;
  // VI-01: la pestaña "Nuevo producto" abre el formulario listo para escribir (antes había que pulsar un segundo botón).
  const activo = editando || puedeEditar;
  const [producto, setProducto] = useState(inicial || productoVacio());
  const [errores, setErrores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [skuDesbloqueado, setSkuDesbloqueado] = useState(false);
  const [confirmarSku, setConfirmarSku] = useState(false);

  const tienePeligrosidad = gransic.tiene_peligrosidad;
  const categorias = Object.keys(gransic.categorias);
  const bloqueado = !activo || guardando;

  const opcionesUnidad = catalogos.unidades.map((u) => ({ value: u.id, label: u.nombre }));
  const opcionesComponente = catalogos.componentes.map((c) => ({ value: c.id, label: c.nombre }));
  const opcionesCaracteristica = catalogos.caracteristicas.map((c) => ({ value: c.id, label: c.nombre }));
  const subcategorias = subcategoriasDe(gransic);
  const camposProducto = catalogos.campos.filter((c) => !esDeComponente(c));
  const camposComponente = catalogos.campos.filter(esDeComponente);

  const set = (campo, valor) => setProducto((p) => ({ ...p, [campo]: valor }));
  const setCampoFila = (iu, ifila, campoId, valor) =>
    setProducto((p) => ({
      ...p,
      unidades: p.unidades.map((u, i) => i !== iu ? u : {
        ...u,
        filas: u.filas.map((f, j) => (j !== ifila ? f : { ...f, campos: { ...f.campos, [campoId]: valor } })),
      }),
    }));
  const setCampoAdicional = (campoId, valor) =>
    setProducto((p) => ({ ...p, camposAdicionales: { ...p.camposAdicionales, [campoId]: valor } }));
  const setFila = (iu, ifila, campo, valor, compNuevo) =>
    setProducto((p) => ({
      ...p,
      unidades: p.unidades.map((u, i) => i !== iu ? u : {
        ...u,
        filas: u.filas.map((f, j) => {
          if (j !== ifila) return f;
          const nueva = { ...f, [campo]: valor };
          // Al elegir un componente del catálogo se proponen su característica y peso.
          if (campo === "componenteId") {
            const comp = compNuevo || catalogos.componentes.find((c) => c.id === valor);
            if (comp) Object.assign(nueva, { caracteristicaId: comp.caracteristicaId || "", pesoKg: comp.pesoKg ?? "" });
          }
          // Si cambia la categoría de la fila (PROREP), el material deja de ser válido.
          if (campo === "categoria") nueva.material = "";
          return nueva;
        }),
      }),
    }));

  // Materiales disponibles: ReSimple según la categoría del producto; PROREP según la categoría de la fila.
  const materialesDe = (categoria) => gransic.categorias[categoria] || [];

  const setUnidad = (iu, valor) =>
    setProducto((p) => ({ ...p, unidades: p.unidades.map((u, i) => i !== iu ? u : { ...u, unidadVentaId: valor }) }));

  const cambiarCategoriaProducto = (valor) =>
    setProducto((p) => ({
      ...p,
      categoria: valor,
      unidades: p.unidades.map((u) => ({ ...u, filas: u.filas.map((f) => ({ ...f, material: "" })) })),
    }));

  const elegirAdjunto = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (archivo.size > TAMANO_MAX_MB * 1024 * 1024) {
      setErrores([`El adjunto supera ${TAMANO_MAX_MB} MB.`]);
      return;
    }
    set("adjunto", { nombre: archivo.name, tipo: producto.adjunto?.tipo || "", archivo });
  };

  const validar = () => {
    const e = [];
    const sku = producto.sku.trim();
    if (!sku) e.push("El SKU es obligatorio.");
    else if (productosExistentes.some((p) => p.id !== producto.id && p.sku.toLowerCase() === sku.toLowerCase())) e.push(`Ya existe un producto con SKU ${sku}.`);
    if (!producto.descripcion.trim()) e.push("La descripción es obligatoria.");
    if (tienePeligrosidad && !producto.categoria) e.push("Selecciona la categoría del producto.");
    if (tienePeligrosidad && !producto.peligrosidad) e.push("Selecciona la peligrosidad.");
    producto.unidades.forEach((u, iu) => {
      const nombre = catalogos.unidades.find((x) => x.id === u.unidadVentaId)?.nombre || `Unidad ${iu + 1}`;
      if (!u.unidadVentaId) e.push(`Selecciona la unidad de venta ${iu + 1}.`);
      if (u.filas.length === 0) e.push(`La unidad "${nombre}" no tiene componentes.`);
      u.filas.forEach((f, i) => {
        const faltan = [];
        if (!f.componenteId) faltan.push("componente");
        if (!tienePeligrosidad && !f.categoria) faltan.push("categoría");
        if (!f.material) faltan.push("material");
        if (tienePeligrosidad && !f.caracteristicaId) faltan.push("característica");
        if (!(Number(f.cantidad) > 0)) faltan.push("cantidad");
        if (!(Number(f.pesoKg) > 0)) faltan.push("peso");
        if (faltan.length) e.push(`${nombre}, fila ${i + 1}: falta ${faltan.join(", ")}.`);
      });
    });
    if (producto.adjunto && !producto.adjunto.tipo) e.push("Indica el tipo del adjunto.");
    return e;
  };

  const reiniciar = () => {
    setProducto(productoVacio());
    setErrores([]);
  };

  const cancelar = () => (editando ? onCancelarEdicion() : reiniciar());

  const guardar = async () => {
    const e = validar();
    setErrores(e);
    if (e.length) return;
    setGuardando(true);
    try {
      await onGuardar(producto);
      if (!editando) reiniciar();
    } catch (err) {
      setErrores([err.message, ...(err.errores || [])]);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {editando ? (
          <p className="text-sm text-neutral-700">
            Editando <b>{inicial.sku}</b> (versión {inicial.version}, actualizada el {formatoFecha(inicial.actualizadoFecha)}).
            {" "}Si cambias algún dato, al guardar se crea la versión {inicial.version + 1} y la actual queda en el historial.
          </p>
        ) : puedeEditar && (
          <p className="text-sm text-neutral-600">Completa los datos del producto o cárgalos desde un archivo con Carga masiva.</p>
        )}
        {!puedeEditar && <span className="text-sm text-neutral-500">Tu perfil solo permite consultar la matriz.</span>}
        {!editando && (
          <CargaMasivaMatriz
            gransic={gransic}
            catalogos={catalogos}
            productos={productosExistentes}
            puedeEditar={puedeEditar}
            claveConfig={claveCargaMasiva}
            onGuardar={onCargaMasiva}
          />
        )}
      </div>

      <fieldset disabled={bloqueado} className={`min-w-0 space-y-6 ${!activo ? "opacity-60" : ""}`}>
        {/* Datos generales */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-neutral-800 mb-4">Datos del producto</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="producto-sku" className={labelCls}>SKU</label>
              <div className="flex gap-1.5">
                <input
                  id="producto-sku"
                  value={producto.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  disabled={bloqueado || (editando && !skuDesbloqueado)}
                  className={inputCls}
                />
                {editando && !skuDesbloqueado && (
                  <button
                    type="button"
                    onClick={() => setConfirmarSku(true)}
                    title="Cambiar el SKU"
                    className="flex-shrink-0 px-3 rounded-lg border border-primary text-primary-dark text-xs hover:bg-green-50"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="producto-descripcion" className={labelCls}>Descripción</label>
              <input id="producto-descripcion" value={producto.descripcion} onChange={(e) => set("descripcion", e.target.value)} className={inputCls} />
            </div>
            {tienePeligrosidad && (
              <>
                <div>
                  <label htmlFor="producto-categoria" className={labelCls}>Categoría</label>
                  <select id="producto-categoria" value={producto.categoria} onChange={(e) => cambiarCategoriaProducto(e.target.value)} className={`${inputCls} capitalize`}>
                    <option value="">Seleccionar</option>
                    {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="producto-peligrosidad" className={labelCls}>Peligrosidad</label>
                  <select id="producto-peligrosidad" value={producto.peligrosidad} onChange={(e) => set("peligrosidad", e.target.value)} className={inputCls}>
                    <option value="">Seleccionar</option>
                    <option value="peligroso">Peligroso</option>
                    <option value="no peligroso">No peligroso</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Unidades de venta y composición */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-neutral-800 mb-1">Unidades de venta y composición</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Para cada unidad en que se vende el producto, registra los componentes de su envase o embalaje.
            El peso por unidad de venta y las toneladas se calculan solos.
          </p>

          {producto.unidades.map((u, iu) => (
            <div key={iu} className="border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex flex-wrap justify-between items-end gap-4 mb-3">
                <div className="w-full max-w-xs">
                  <label htmlFor={`producto-unidad-${iu}`} className={labelCls}>Unidad de venta</label>
                  <SelectConMas
                    id={`producto-unidad-${iu}`}
                    value={u.unidadVentaId}
                    onChange={(v) => setUnidad(iu, v)}
                    opciones={opcionesUnidad.filter((o) => o.value === u.unidadVentaId || !producto.unidades.some((y) => y.unidadVentaId === o.value))}
                    placeholder="Seleccionar unidad"
                    puedeCrear={puedeEditar}
                    disabled={bloqueado}
                    tituloMas="Nueva unidad de venta"
                    onMas={() => abrirModal("unidad", (id) => setUnidad(iu, id))}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-neutral-600">
                    Peso por unidad de venta: <b>{formatoKg(pesoUnidad(u))} kg</b> · <b>{formatoTon(tonUnidad(u))} TON</b>
                  </span>
                  {producto.unidades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set("unidades", producto.unidades.filter((_, i) => i !== iu))}
                      title="Quitar unidad de venta"
                      className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600 align-bottom">
                    <tr>
                      <th className="p-1.5 min-w-[10rem]">Componente</th>
                      <th className="p-1.5 min-w-[5.5rem]">Cantidad</th>
                      <th className="p-1.5 min-w-[6.5rem]">Peso (kg)</th>
                      <th className="p-1.5 min-w-[7.5rem] text-right">Peso por unidad de venta (kg)</th>
                      <th className="p-1.5 min-w-[6.5rem] text-right">TON</th>
                      {!tienePeligrosidad && <th className="p-1.5 min-w-[9rem]">Categoría</th>}
                      <th className="p-1.5 min-w-[14rem]">Material</th>
                      {subcategorias && <th className="p-1.5 min-w-[8rem]" title="Se deduce del material (informativa)">Sub categoría</th>}
                      <th className="p-1.5 min-w-[11rem]">Característica</th>
                      {camposComponente.map((c) => <th key={c.id} className="p-1.5 min-w-[9rem]">{c.nombre}</th>)}
                      <th className="p-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.filas.map((f, ifila) => {
                      const categoriaMaterial = tienePeligrosidad ? producto.categoria : f.categoria;
                      return (
                        <tr key={ifila} className="align-top">
                          <td className="p-1.5">
                            <SelectConMas
                              value={f.componenteId}
                              onChange={(v) => setFila(iu, ifila, "componenteId", v)}
                              opciones={opcionesComponente}
                              placeholder="Seleccionar"
                              puedeCrear={puedeEditar}
                              disabled={bloqueado}
                              tituloMas="Nuevo componente"
                              onMas={() => abrirModal("componente", (id, comp) => setFila(iu, ifila, "componenteId", id, comp))}
                            />
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" step="any" value={f.cantidad} onChange={(e) => setFila(iu, ifila, "cantidad", e.target.value)} className={inputCls} />
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" step="any" value={f.pesoKg} onChange={(e) => setFila(iu, ifila, "pesoKg", e.target.value)} className={inputCls} />
                          </td>
                          <td className="p-1.5 text-right pt-3.5 tabular-nums">{formatoKg(pesoFila(f))}</td>
                          <td className="p-1.5 text-right pt-3.5 tabular-nums">{formatoTon(tonFila(f))}</td>
                          {!tienePeligrosidad && (
                            <td className="p-1.5">
                              <select value={f.categoria} onChange={(e) => setFila(iu, ifila, "categoria", e.target.value)} className={`${inputCls} capitalize`}>
                                <option value="">Seleccionar</option>
                                {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                          )}
                          <td className="p-1.5">
                            <select
                              value={f.material}
                              onChange={(e) => setFila(iu, ifila, "material", e.target.value)}
                              disabled={bloqueado || !categoriaMaterial}
                              className={inputCls}
                              title={!categoriaMaterial ? "Primero selecciona la categoría" : f.material}
                            >
                              <option value="">{categoriaMaterial ? "Seleccionar" : "Elige la categoría"}</option>
                              {materialesDe(categoriaMaterial).map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          {subcategorias && (
                            <td className="p-1.5 pt-3.5 text-neutral-600">{subcategorias[categoriaMaterial]?.[f.material] || "—"}</td>
                          )}
                          <td className="p-1.5">
                            {/* Lista cerrada (igual que en la carga masiva): no se crean características nuevas. */}
                            <select
                              value={f.caracteristicaId}
                              onChange={(e) => setFila(iu, ifila, "caracteristicaId", e.target.value)}
                              disabled={bloqueado}
                              className={inputCls}
                            >
                              <option value="">Seleccionar</option>
                              {opcionesCaracteristica.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          {camposComponente.map((c) => (
                            <td key={c.id} className="p-1.5">
                              <input
                                value={f.campos?.[c.id] || ""}
                                onChange={(e) => setCampoFila(iu, ifila, c.id, e.target.value)}
                                maxLength={MAX_VALOR_CAMPO}
                                className={inputCls}
                              />
                            </td>
                          ))}
                          <td className="p-1.5">
                            <button
                              type="button"
                              title="Quitar componente"
                              onClick={() => setProducto((p) => ({
                                ...p,
                                unidades: p.unidades.map((x, i) => i !== iu ? x : { ...x, filas: x.filas.filter((_, j) => j !== ifila) }),
                              }))}
                              className="p-1.5 mt-1 rounded-full hover:bg-red-50 text-red-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => set("unidades", producto.unidades.map((x, i) => i !== iu ? x : { ...x, filas: [...x.filas, filaVacia()] }))}
                className="mt-2 text-sm text-primary-dark flex items-center gap-1 hover:text-green-800"
              >
                <Plus className="w-4 h-4" /> Agregar componente
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => set("unidades", [...producto.unidades, unidadVacia()])}
            className="btn-secundario"
          >
            <Plus className="w-4 h-4" /> Agregar otra unidad de venta
          </button>
        </section>

        {/* Campos adicionales de la empresa (texto, opcionales) */}
        <section className="bg-white rounded-2xl shadow p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-neutral-800 mb-1">Información adicional</h2>
              <p className="text-sm text-neutral-500">
                Campos propios de tu empresa para complementar la información. Todos son opcionales. Los campos del
                componente se completan en la tabla de composición.
              </p>
            </div>
            {puedeEditar && (
              <div className="flex gap-2">
                {catalogos.campos.length > 0 && (
                  <button
                    type="button"
                    onClick={onGestionarCampos}
                    className="btn-secundario"
                  >
                    Gestionar campos
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => abrirModal("campo", (id, campo) => !esDeComponente(campo) && setCampoAdicional(id, campo.valor))}
                  className="btn-secundario"
                >
                  <Plus className="w-4 h-4" /> Nuevo campo
                </button>
              </div>
            )}
          </div>
          {camposProducto.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin campos adicionales del producto.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {camposProducto.map((c) => (
                <div key={c.id}>
                  <label htmlFor={`producto-campo-${c.id}`} className={labelCls}>{c.nombre}</label>
                  <input
                    id={`producto-campo-${c.id}`}
                    value={producto.camposAdicionales[c.id] || ""}
                    onChange={(e) => setCampoAdicional(c.id, e.target.value)}
                    maxLength={MAX_VALOR_CAMPO}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Adjunto */}
        <section className="bg-white rounded-2xl shadow p-6">
          <h2 className="font-bold text-neutral-800 mb-1">Respaldo</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Adjunta un archivo de respaldo: ficha técnica del producto o informe de segregación de materiales y pesos.
            Un archivo por producto (PDF, imagen o Excel, máx. {TAMANO_MAX_MB} MB).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="producto-adjunto-tipo" className={labelCls}>Tipo de respaldo</label>
              <select
                id="producto-adjunto-tipo"
                value={producto.adjunto?.tipo || ""}
                onChange={(e) => producto.adjunto && set("adjunto", { ...producto.adjunto, tipo: e.target.value })}
                disabled={bloqueado || !producto.adjunto || producto.adjunto.existente}
                className={inputCls}
              >
                <option value="">Seleccionar</option>
                {TIPOS_ADJUNTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              {producto.adjunto ? (
                <div className="flex items-center gap-2 bg-gray-100 p-2.5 rounded-lg text-sm">
                  <Paperclip className="w-4 h-4 text-neutral-500" />
                  {producto.adjunto.urlWeb ? (
                    <a href={producto.adjunto.urlWeb} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary-dark hover:underline">{producto.adjunto.nombre}</a>
                  ) : (
                    <span className="flex-1 truncate">{producto.adjunto.nombre}</span>
                  )}
                  <button type="button" onClick={() => set("adjunto", null)} title="Quitar adjunto" className="p-1 rounded-full hover:bg-red-50 text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <input type="file" accept={EXTENSIONES_ADJUNTO} onChange={elegirAdjunto} className="w-full text-sm p-2 bg-gray-100 rounded-lg" />
              )}
            </div>
          </div>
        </section>

        {errores.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <p className="font-semibold flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4" /> Revisa estos datos:</p>
            <ul className="list-disc ml-6">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={cancelar} className="btn-secundario">Cancelar</button>
          <button type="button" onClick={guardar} className="btn-principal">
            {guardando ? "Guardando…" : editando ? "Guardar nueva versión" : "Guardar producto"}
          </button>
        </div>
      </fieldset>

      {confirmarSku && (
        <ModalConfirmar
          titulo="Cambiar el SKU"
          textoConfirmar="Sí, cambiar el SKU"
          onCerrar={() => setConfirmarSku(false)}
          onConfirmar={() => { setSkuDesbloqueado(true); setConfirmarSku(false); }}
        >
          <p>Las ventas se cruzan con la matriz <b>por SKU</b>.</p>
          <p>
            Desde que guardes la nueva versión, las ventas informadas con el SKU <b>{inicial.sku}</b> dejarán de
            asociarse a este producto. Cámbialo solo si el código del producto cambió en tus registros de venta.
          </p>
        </ModalConfirmar>
      )}
    </div>
  );
};

// ── Página ────────────────────────────────────────────────────────────────────
const MatrizMateriales = () => {
  const { user, token } = useContext(AuthContext);
  const puedeEditar = user?.perfil === "admin" || user?.perfil === "dev";
  const empresaId = user?.empresaId;

  const [gransic, setGransic] = useState(null);
  const [catalogos, setCatalogos] = useState({ unidades: [], caracteristicas: [], componentes: [], campos: [] });
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [pestana, setPestana] = useState("listado");
  const [edicion, setEdicion] = useState(null); // producto en edición (formato del formulario)
  const [aEliminar, setAEliminar] = useState(null);
  const [modal, setModal] = useState(null); // { tipo, alCrear }
  const [gestionarCampos, setGestionarCampos] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "alerta", texto }

  const api = useCallback((ruta, opciones) => llamarApi(token, ruta, opciones), [token]);
  const cargarProductos = useCallback(async () => {
    const lista = await api(`productos?empresaId=${empresaId}`);
    setProductos(lista);
    return lista;
  }, [api, empresaId]);

  const aplicarCatalogos = (cat) => {
    setGransic(cat.gransic);
    setCatalogos({ unidades: cat.unidades, caracteristicas: cat.caracteristicas, componentes: cat.componentes, campos: cat.camposAdicionales });
  };

  useEffect(() => {
    if (!token || !empresaId) return;
    let vigente = true;
    setCargando(true);
    setErrorCarga("");
    Promise.all([api(`catalogosMatriz?empresaId=${empresaId}`), api(`productos?empresaId=${empresaId}`)])
      .then(([cat, prods]) => {
        if (!vigente) return;
        aplicarCatalogos(cat);
        setProductos(prods);
      })
      .catch((err) => vigente && setErrorCarga(err.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [api, empresaId, token]);

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto });
    if (tipo === "ok") setTimeout(() => setAviso(null), 5000);
  };

  const configModal = useMemo(() => ({
    unidad: {
      titulo: "Nueva unidad de venta",
      campos: [
        { key: "nombre", label: "Nombre (ej.: tineta, saco, pallet)" },
        {
          key: "aGranel",
          label: "¿Se vende a granel?",
          requerido: true,
          opciones: [
            { value: "no", label: "No: se vende en unidades enteras (caja, tambor…)" },
            { value: "si", label: "Sí: la cantidad vendida admite decimales (tonelada, litro…)" },
          ],
        },
      ],
      existentes: catalogos.unidades.map((u) => u.nombre),
    },
    componente: {
      titulo: "Nuevo componente",
      campos: [
        { key: "nombre", label: "Nombre (ej.: tambor, tapa, etiqueta)" },
        { key: "caracteristicaId", label: "Característica habitual", opciones: catalogos.caracteristicas.map((c) => ({ value: c.id, label: c.nombre })) },
        { key: "pesoKg", label: "Peso unitario habitual (kg)", type: "number" },
      ],
      existentes: catalogos.componentes.map((c) => c.nombre),
    },
    campo: {
      titulo: "Nuevo campo adicional",
      campos: [
        { key: "nombre", label: "Nombre del campo (ej.: proveedor, color, espesor)", maxLength: MAX_NOMBRE_CAMPO },
        {
          key: "nivel",
          label: "Se completa por",
          requerido: true,
          opciones: [
            { value: "producto", label: "Producto (un valor por producto)" },
            { value: "componente", label: "Componente (un valor por cada componente de la composición)" },
          ],
        },
      ],
      existentes: catalogos.campos.map((c) => c.nombre),
    },
  }), [catalogos]);

  const guardarModal = async (valores) => {
    const { tipo, alCrear } = modal;
    if (tipo === "campo") {
      // Si existía eliminado con ese nombre, el back lo reactiva (con sus valores): se recargan los productos.
      // Los campos se muestran en orden de creación (un campo reactivado vuelve a su lugar).
      const creado = await api("camposAdicionales", { metodo: "POST", body: { empresaId, nombre: valores.nombre, nivel: valores.nivel } });
      setCatalogos((c) => ({ ...c, campos: [...c.campos, creado].sort((a, b) => a.orden - b.orden) }));
      setModal(null);
      if (creado.reactivado) {
        const lista = await cargarProductos();
        mostrarAviso("ok", `Se reactivó el campo "${creado.nombre}" con los valores que tenía.`);
        // Si se está editando un producto, su valor recuperado pasa al formulario (si no, al guardar se perdería).
        const valor = lista.find((p) => p.id === edicion?.id)?.camposAdicionales.find((c) => c.campoId === creado.id)?.valor;
        if (valor && !esDeComponente(creado)) alCrear?.(creado.id, { ...creado, valor });
      }
      return;
    }
    const [ruta, clave] = {
      unidad: ["unidadesVenta", "unidades"],
      componente: ["componentes", "componentes"],
    }[tipo];
    const body = { empresaId, nombre: valores.nombre };
    // A granel: en el Registro de Ventas la cantidad vendida en esta unidad admite decimales.
    if (tipo === "unidad") body.aGranel = valores.aGranel === "si";
    if (tipo === "componente") {
      Object.assign(body, { caracteristicaId: valores.caracteristicaId || null, pesoKg: valores.pesoKg === "" ? null : Number(valores.pesoKg) });
    }
    const creado = await api(ruta, { metodo: "POST", body });
    setCatalogos((c) => ({ ...c, [clave]: [...c[clave], creado].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) }));
    setModal(null);
    // El catálogo se actualiza antes de seleccionar el valor nuevo en el campo que abrió el modal.
    setTimeout(() => alCrear?.(creado.id, creado), 0);
  };

  // Crea (POST) o versiona (PUT) el producto y, si hay un archivo nuevo, sube el respaldo.
  const guardarProducto = async (form) => {
    const body = aPayload(form, empresaId, gransic.tiene_peligrosidad);
    // Solo campos activos; los valores de campos eliminados los conserva el back al versionar.
    body.camposAdicionales = body.camposAdicionales.filter((v) => catalogos.campos.some((c) => c.id === v.campoId));
    const editando = !!form.id;
    const guardado = await api("productos", {
      metodo: editando ? "PUT" : "POST",
      body: editando ? { ...body, id: form.id, quitarAdjunto: !form.adjunto } : body,
    });

    let errorAdjunto = "";
    if (form.adjunto?.archivo) {
      try {
        await api("productos/adjunto", {
          metodo: "POST",
          body: { productoId: guardado.id, tipo: form.adjunto.tipo, nombreArchivo: form.adjunto.nombre, base64: await aBase64(form.adjunto.archivo) },
        });
      } catch (err) {
        errorAdjunto = err.message;
      }
    }

    await cargarProductos();
    setEdicion(null);
    setPestana("listado");
    const accion = guardado.sinCambios
      ? "sin cambios en los datos: no se creó una versión nueva"
      : editando ? `actualizado (versión ${guardado.version})` : "agregado a la matriz";
    if (errorAdjunto) mostrarAviso("alerta", `Producto ${guardado.sku} ${accion}, pero no se pudo subir el respaldo: ${errorAdjunto}`);
    else mostrarAviso("ok", `Producto ${guardado.sku} ${accion}.`);
  };

  // Carga masiva: un solo envío; el back la guarda en una transacción (todo o nada) y registra la carga.
  // Después se recargan catálogos (pudo crear unidades, componentes y campos) y productos.
  const guardarCargaMasiva = async ({ archivo, filas, conError, nuevosValores, productos: lote }) => {
    const r = await api("productos/cargaMasiva", {
      metodo: "POST",
      body: { empresaId, archivo, filas, conError, nuevosValores, productos: lote },
    });
    const [cat] = await Promise.all([api(`catalogosMatriz?empresaId=${empresaId}`), cargarProductos()]);
    aplicarCatalogos(cat);
    setPestana("listado");
    const partes = [`${r.nuevos} producto${r.nuevos === 1 ? "" : "s"} nuevo${r.nuevos === 1 ? "" : "s"}`, `${r.modificados} actualizado${r.modificados === 1 ? "" : "s"}`];
    if (r.sinCambios) partes.push(`${r.sinCambios} sin cambios`);
    mostrarAviso("ok", `Carga masiva "${archivo}" guardada: ${partes.join(", ")}.`);
  };

  const eliminarProducto = async () => {
    await api(`productos?id=${aEliminar.id}`, { metodo: "DELETE" });
    const { sku } = aEliminar;
    setAEliminar(null);
    await cargarProductos();
    mostrarAviso("ok", `Producto ${sku} eliminado de la matriz.`);
  };

  // Renombrar o eliminar cambia lo que muestra el listado: se recargan los productos.
  const renombrarCampoAdicional = async (id, nombre) => {
    const actualizado = await api("camposAdicionales", { metodo: "PUT", body: { id, nombre } });
    setCatalogos((c) => ({ ...c, campos: c.campos.map((x) => (x.id === id ? actualizado : x)) }));
    await cargarProductos();
  };

  const eliminarCampoAdicional = async (id) => {
    await api(`camposAdicionales?id=${id}`, { metodo: "DELETE" });
    setCatalogos((c) => ({ ...c, campos: c.campos.filter((x) => x.id !== id) }));
    await cargarProductos();
  };

  const editar = (p) => {
    setEdicion(desdeProducto(p));
    setPestana("crear");
  };

  const cancelarEdicion = () => {
    setEdicion(null);
    setPestana("listado");
  };

  let contenido;
  if (!empresaId) {
    contenido = <p className="text-neutral-600">Selecciona una empresa para ver su matriz de materiales.</p>;
  } else if (cargando) {
    contenido = <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando matriz…</p>;
  } else if (errorCarga) {
    contenido = <p className="text-red-600">No se pudo cargar la matriz: {errorCarga}</p>;
  } else if (!gransic) {
    contenido = (
      <p className="text-neutral-600">
        La empresa no tiene un sistema de gestión (GRANSIC) con catálogo de materiales. Asígnalo en la ficha de la empresa para usar la matriz.
      </p>
    );
  } else {
    contenido = (
      <>
        <div className="flex flex-wrap items-end gap-2 mb-6 border-b border-neutral-200">
          {[["listado", "Listado de productos"], ["crear", edicion ? "Editar producto" : "Nuevo producto"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              aria-current={pestana === id ? "page" : undefined}
              className={`pestana ${pestana === id ? "pestana-activa" : ""}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto pb-2 text-sm text-neutral-500">Sistema de gestión: <b>{gransic.nombre}</b></span>
        </div>

        {aviso && (
          <div className={`mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${aviso.tipo === "ok" ? "text-green-800 bg-green-50 border-green-200" : "text-yellow-800 bg-yellow-50 border-yellow-200"}`}>
            {aviso.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="flex-1">{aviso.texto}</span>
            <button onClick={() => setAviso(null)} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
          </div>
        )}

        {pestana === "listado" ? (
          <ListadoProductos
            key={`${user?.id}.${empresaId}`}
            claveVista={`looper.matriz.columnas.${user?.id}.${empresaId}`}
            campos={catalogos.campos.filter((c) => !esDeComponente(c))}
            camposComponente={catalogos.campos.filter(esDeComponente)}
            productos={productos}
            tienePeligrosidad={gransic.tiene_peligrosidad}
            subcategorias={subcategoriasDe(gransic)}
            puedeEditar={puedeEditar}
            onEditar={editar}
            onEliminar={setAEliminar}
          />
        ) : (
          <CrearProducto
            key={edicion?.id || "nuevo"}
            gransic={gransic}
            puedeEditar={puedeEditar}
            catalogos={catalogos}
            abrirModal={(tipo, alCrear) => setModal({ tipo, alCrear })}
            onGestionarCampos={() => setGestionarCampos(true)}
            productosExistentes={productos}
            onGuardar={guardarProducto}
            inicial={edicion}
            onCancelarEdicion={cancelarEdicion}
            claveCargaMasiva={`looper.matriz.cargaMasiva.${user?.id}.${empresaId}`}
            onCargaMasiva={guardarCargaMasiva}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-10 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Matriz de Materiales</h1>
        <p className="text-neutral-600">Gestiona la composición de materiales de tus productos.</p>
      </header>

      {contenido}

      {modal && (
        <ModalNuevo
          {...configModal[modal.tipo]}
          onGuardar={guardarModal}
          onCerrar={() => setModal(null)}
        />
      )}

      {gestionarCampos && (
        <ModalGestionarCampos
          campos={catalogos.campos}
          onRenombrar={renombrarCampoAdicional}
          onEliminar={eliminarCampoAdicional}
          onCerrar={() => setGestionarCampos(false)}
        />
      )}

      {aEliminar && (
        <ModalConfirmar
          titulo="Eliminar producto"
          textoConfirmar="Eliminar"
          peligro
          onCerrar={() => setAEliminar(null)}
          onConfirmar={eliminarProducto}
        >
          <p>¿Eliminar el producto <b>{aEliminar.sku}</b> — {aEliminar.descripcion} de la matriz?</p>
          <p>Dejará de usarse en los cálculos. Sus versiones anteriores se conservan en el historial.</p>
        </ModalConfirmar>
      )}
    </div>
  );
};

export default MatrizMateriales;
