// Matriz de Materiales: pestaña del listado de productos (separado de Paginas/MatrizMateriales.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import { EncabezadoAjustable, ModalColumnas } from "../columnasTabla.jsx";
import { useVistaTabla } from "../useVistaTabla.js";
import Paginacion from "../Paginacion.jsx";
import { paginar } from "../paginar.js";
import { Indicador, Indicadores } from "../Indicador.jsx";
import { ORIGENES, formatoFecha, pesoFila, tonFila, pesoUnidad, tonUnidad, formatoKg, formatoTon, formatoNumero, etiquetaTipo } from "./utilidades.js";
import { Trash2, Search, Paperclip, ChevronDown, ChevronRight, Pencil, Columns3 } from "lucide-react";

// ── Pestaña: listado de productos ─────────────────────────────────────────────
export const ANCHO_DETALLE = 40;
export const PRODUCTOS_POR_PAGINA = 50;
export const ANCHO_ACCIONES = 96;

export const ListadoProductos = ({
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
            type="search"
            spellCheck={false}
            autoComplete="off"
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

      <div className="tarjeta overflow-x-auto">
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
                                  <td className="p-2 text-right">{formatoNumero(f.cantidad)}</td>
                                  <td className="p-2 text-right">{formatoNumero(f.pesoKg)}</td>
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
