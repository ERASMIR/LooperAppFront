// Carga masiva de la Matriz: pantalla de revisión (separado de Componentes/CargaMasivaMatriz.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import { AlertTriangle, Download, ChevronDown, ChevronRight } from "lucide-react";
import { resumir } from "./cargaMasivaRevision.js";
import { FILAS_POR_PAGINA, descargarErrores } from "./cargaMasivaLectura.js";
import { Paginado } from "./cargaMasivaComun.jsx";
import { Indicador, Indicadores } from "./Indicador.jsx";

// ── Revisión: resumen, errores y cambios ─────────────────────────────────────
const ESTADOS = {
  nuevo: { label: "Nuevos", cls: "bg-green-50 text-green-800", tono: "correcto" },
  modificado: { label: "Modificados", cls: "bg-blue-50 text-blue-800", tono: "cambio" },
  sinCambios: { label: "Sin cambios", cls: "bg-gray-100 text-neutral-600", tono: "neutro" },
  error: { label: "Con errores (no se cargan)", cls: "bg-red-50 text-red-700", tono: "error" },
};
const ETIQUETA_ESTADO = { nuevo: "Nuevo", modificado: "Modificado" };


// productos: revisados con las decisiones aplicadas. conQuitados: los que tienen componentes que no vienen en el archivo.
export const Revision = ({ archivo, revision, productos, conQuitados, decisionDe, onDecidir, onDecidirTodos }) => {
  const [verErrores, setVerErrores] = useState(FILAS_POR_PAGINA);
  const [verCambios, setVerCambios] = useState(FILAS_POR_PAGINA);
  const [abierto, setAbierto] = useState(null);
  const { errores, nuevosValores } = revision;
  const resumen = resumir(productos);
  const cambios = productos.filter((r) => r.estado === "nuevo" || r.estado === "modificado");
  const totalNuevosValores = Object.values(nuevosValores).reduce((n, l) => n + l.length, 0);

  return (
    <div className="pb-4 space-y-5">
      <div>
        <p className="text-sm text-neutral-700 mb-2"><b>{archivo}</b> · {productos.length} SKU revisados</p>
        <Indicadores>
          {[["nuevo", resumen.nuevos], ["modificado", resumen.modificados], ["sinCambios", resumen.sinCambios], ["error", resumen.conError]].map(([estado, n]) => (
            <Indicador key={estado} etiqueta={ESTADOS[estado].label} valor={n} tono={ESTADOS[estado].tono} />
          ))}
        </Indicadores>
        <p className="text-xs text-neutral-500 mt-2">
          Se guardan los nuevos y los modificados. Los sin cambios no se tocan, y los productos de la matriz que no vienen en
          el archivo quedan como están.
        </p>
      </div>

      {errores.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Errores: {errores.length} fila{errores.length === 1 ? "" : "s"}
            </h3>
            <button onClick={() => descargarErrores(archivo, errores, [["Fila", "fila", 6], ["SKU", "sku", 20], ["Error", "mensaje", 90]])} className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800">
              <Download className="w-4 h-4" /> Descargar errores (Excel)
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-2">
            Los SKU con algún error <b>no se cargan</b> (ninguna de sus filas). Corrígelos en el archivo y vuelve a subirlo.
          </p>
          <div className="overflow-auto max-h-[35dvh] border border-red-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-left text-red-800 sticky top-0">
                <tr><th className="p-2 text-right">Fila</th><th className="p-2">SKU</th><th className="p-2">Error</th></tr>
              </thead>
              <tbody>
                {errores.slice(0, verErrores).map((e, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 text-right tabular-nums text-neutral-500">{e.fila}</td>
                    <td className="p-2 whitespace-nowrap">{e.sku || <span className="italic text-neutral-500">sin SKU</span>}</td>
                    <td className="p-2">{e.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginado total={errores.length} mostradas={verErrores} onMas={() => setVerErrores((n) => n + FILAS_POR_PAGINA)} texto="errores" />
        </section>
      )}

      {conQuitados.length > 0 && (
        <ComponentesQuitados conQuitados={conQuitados} decisionDe={decisionDe} onDecidir={onDecidir} onDecidirTodos={onDecidirTodos} />
      )}

      {totalNuevosValores > 0 && (
        <section className="flex gap-3 text-sm rounded-xl px-4 py-3 border text-yellow-800 bg-yellow-50 border-yellow-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            El archivo trae <b>{totalNuevosValores} valor{totalNuevosValores === 1 ? "" : "es"} nuevo{totalNuevosValores === 1 ? "" : "s"}</b> que
            no existen en tus catálogos. Antes de guardar te pediremos autorizar que se agreguen.
          </p>
        </section>
      )}

      <section>
        <h3 className="font-semibold text-neutral-800 mb-1">Productos a guardar: {cambios.length}</h3>
        {cambios.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay productos nuevos ni modificados para guardar.</p>
        ) : (
          <>
            <ul className="border rounded-xl divide-y">
              {cambios.slice(0, verCambios).map((r) => (
                <li key={r.sku} className="text-sm">
                  <button
                    onClick={() => setAbierto(abierto === r.sku ? null : r.sku)}
                    className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50"
                  >
                    {abierto === r.sku ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADOS[r.estado].cls}`}>{ETIQUETA_ESTADO[r.estado]}</span>
                    <span className="font-semibold whitespace-nowrap">{r.sku}</span>
                    <span className="text-neutral-600 truncate">{r.descripcion}</span>
                    {r.estado === "modificado" && (
                      <span className="ml-auto text-xs text-neutral-500 whitespace-nowrap">{r.cambios.length} cambio{r.cambios.length === 1 ? "" : "s"}</span>
                    )}
                  </button>
                  {abierto === r.sku && (
                    <div className="px-9 pb-3 text-neutral-700">
                      {r.estado === "modificado" ? (
                        <ul className="list-disc ml-4 space-y-0.5">{r.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.producto.unidades.map((u) => (
                            <li key={u.unidad}>
                              <b>{u.unidad}:</b>{" "}
                              {u.filas.map((f) => `${f.componente} (${f.cantidad.toLocaleString("es-CL")} × ${f.pesoKg.toLocaleString("es-CL", { maximumFractionDigits: 6 })} kg)`).join(", ")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Paginado total={cambios.length} mostradas={verCambios} onMas={() => setVerCambios((n) => n + FILAS_POR_PAGINA)} texto="productos" />
          </>
        )}
      </section>
    </div>
  );
};

// ── Componentes de la matriz que no vienen en el archivo ─────────────────────
export const BotonDecision = ({ activo, onClick, children, peligro }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-lg text-xs border ${activo
      ? (peligro ? "bg-red-600 border-red-600 text-white" : "bg-primary-dark border-primary text-white")
      : "bg-white border-gray-300 text-neutral-700 hover:bg-gray-50"}`}
  >
    {children}
  </button>
);

export const ComponentesQuitados = ({ conQuitados, decisionDe, onDecidir, onDecidirTodos }) => {
  const total = conQuitados.reduce((n, r) => n + r.quitados.length, 0);
  return (
    <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Componentes que no vienen en el archivo: {total} en {conQuitados.length} producto{conQuitados.length === 1 ? "" : "s"}
        </h3>
        <div className="flex gap-2">
          <BotonDecision onClick={() => onDecidirTodos("conservar")}>Conservar todos</BotonDecision>
          <BotonDecision onClick={() => onDecidirTodos("eliminar")}>Eliminar todos</BotonDecision>
        </div>
      </div>
      <p className="text-xs text-yellow-800 mb-3">
        Estos componentes están hoy en la matriz, pero el archivo trae el producto sin ellos. Indica para cada uno si se
        <b> conserva</b> (sigue en el producto) o se <b>elimina</b> de la matriz.
      </p>
      <div className="space-y-3 max-h-[35dvh] overflow-y-auto">
        {conQuitados.map((r) => (
          <div key={r.sku} className="bg-white rounded-lg border border-yellow-100 p-2">
            <p className="text-sm mb-1"><b>{r.sku}</b> <span className="text-neutral-600">{r.descripcion}</span></p>
            <ul className="divide-y">
              {r.quitados.map((q) => {
                const d = decisionDe(r, q);
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="flex-1 min-w-[12rem]">
                      {q.unidad} · <b>{q.componente}</b>
                      <span className="text-neutral-500"> ({q.fila.cantidad.toLocaleString("es-CL")} × {q.fila.pesoKg.toLocaleString("es-CL", { maximumFractionDigits: 6 })} kg, {q.fila.material})</span>
                      {q.unidadCompleta && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs">falta toda la unidad</span>}
                    </span>
                    <BotonDecision activo={d === "conservar"} onClick={() => onDecidir(r, q, "conservar")}>Conservar</BotonDecision>
                    <BotonDecision activo={d === "eliminar"} peligro onClick={() => onDecidir(r, q, "eliminar")}>Eliminar</BotonDecision>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Autorización de valores nuevos, agrupados por campo ─────────────────────
export const ValoresNuevos = ({ nuevosValores }) => {
  const grupos = [
    ["Unidad de venta", nuevosValores.unidades],
    ["Componente", nuevosValores.componentes],
  ].filter(([, lista]) => lista.length);
  return (
    <div className="pb-4 space-y-4">
      <p className="text-sm text-neutral-700">
        Estos valores no existen en los catálogos de tu empresa. Si confirmas, se agregan y quedan disponibles también en el
        formulario. Revisa que no sean errores de escritura de un valor existente (por ejemplo, "Tambr" en vez de "Tambor").
      </p>
      {grupos.map(([campo, lista]) => (
        <section key={campo}>
          <h3 className="font-semibold text-neutral-800 mb-1">{campo} <span className="font-normal text-neutral-500">({lista.length})</span></h3>
          <div className="overflow-auto max-h-[30dvh] border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">Valor nuevo</th><th className="p-2 text-right">Filas</th><th className="p-2">SKU (ejemplos)</th></tr>
              </thead>
              <tbody>
                {lista.map((n) => (
                  <tr key={n.nombre} className="border-t">
                    <td className="p-2 font-semibold">{n.nombre}</td>
                    <td className="p-2 text-right tabular-nums">{n.filas}</td>
                    <td className="p-2 text-neutral-600">{n.skus.slice(0, 3).join(", ")}{n.skus.length > 3 ? ` y ${n.skus.length - 3} más` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {nuevosValores.campos.length > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 mb-1">Campos adicionales <span className="font-normal text-neutral-500">({nuevosValores.campos.length})</span></h3>
          <ul className="text-sm text-neutral-700 list-disc ml-5">
            {nuevosValores.campos.map((c) => <li key={c.nombre}>{c.nombre} <span className="text-neutral-500">({c.nivel === "componente" ? "del componente" : "del producto"})</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
};
