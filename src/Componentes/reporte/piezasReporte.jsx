// Crear Reporte: resultado, historial, ventana del reporte y planilla ReSimple (separado de Paginas/ReportePeriodo.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import Dialogo from "../Dialogo.jsx";
import { Indicador, Indicadores } from "../Indicador.jsx";
import { MESES, nombrePeriodo } from "../ventasRevision.js";
import { Loader2, AlertTriangle, X, Trash2, FileSpreadsheet, History } from "lucide-react";
import { esReSimple, formatoTon, formatoFechaHora, plural, toneladasTotales, clavePeriodo } from "./utilidades.js";

// ── Resultado: resumen, líneas no encontradas y toneladas por material ────────

export const Resultado = ({ calculo }) => {
  const [categoria, setCategoria] = useState("");
  const [soloConValor, setSoloConValor] = useState(true);
  const { gransic, materiales, resumen } = calculo;
  const peligrosidad = gransic.tienePeligrosidad;
  const categorias = [...new Set(materiales.map((m) => m.categoria))];
  const conValor = (m) => (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0) > 0;
  const filas = materiales.filter((m) => (!categoria || m.categoria === categoria) && (!soloConValor || conValor(m)));
  const suma = (k) => filas.reduce((n, m) => n + (m[k] || 0), 0);

  return (
    <div className="space-y-5">
      <Indicadores>
        <Indicador etiqueta="Líneas de venta del periodo" valor={resumen.lineas} />
        <Indicador etiqueta="Procesadas" valor={resumen.procesadas} tono="correcto" />
        <Indicador etiqueta="No encontradas en la Matriz (no se contabilizan)" valor={resumen.noEncontradas.length} tono="atencion" />
        <Indicador etiqueta="Toneladas totales" valor={formatoTon(materiales.reduce((n, m) => n + (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0), 0))} />
      </Indicadores>

      {resumen.noEncontradas.length > 0 && (
        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" /> Ventas no encontradas en la Matriz</h3>
          <ul className="text-sm text-yellow-900 space-y-1 max-h-48 overflow-auto">
            {resumen.noEncontradas.map((n) => <li key={n.ventaId}><b>{n.sku}</b> · {n.unidad} · {n.cantidad}</li>)}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="font-semibold text-neutral-800 mr-2">Toneladas por material · {gransic.nombre}</h3>
          {["", ...categorias].map((c) => (
            <button
              key={c || "todas"}
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`chip capitalize ${categoria === c ? "chip-activo" : ""}`}
            >
              {c || "Todas"}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={soloConValor} onChange={(e) => setSoloConValor(e.target.checked)} className="accent-primary-dark" />
            Solo materiales con toneladas
          </label>
        </div>
        <div className="overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-neutral-600">
              <tr>
                <th className="p-2">Categoría</th>
                <th className="p-2">Material</th>
                {peligrosidad ? (
                  <>
                    <th className="p-2 text-right">T. peligrosos</th>
                    <th className="p-2 text-right">T. no peligrosos</th>
                  </>
                ) : <th className="p-2 text-right">Toneladas</th>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-neutral-500">No hay materiales con toneladas en esta categoría.</td></tr>
              )}
              {filas.map((m) => (
                <tr key={`${m.categoria}::${m.material}`} className="border-t">
                  <td className="p-2 capitalize">{m.categoria}</td>
                  <td className="p-2">{m.material}</td>
                  {peligrosidad ? (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasPeligroso)}</td>
                      <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasNoPeligroso)}</td>
                    </>
                  ) : <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasTotal)}</td>}
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t">
                <tr>
                  <td className="p-2" colSpan={2}>Total{categoria ? ` ${categoria}` : ""}</td>
                  {peligrosidad ? (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasPeligroso"))}</td>
                      <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasNoPeligroso"))}</td>
                    </>
                  ) : <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasTotal"))}</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};

// ── Pestaña "Historial de reportes": una fila por periodo con su reporte vigente (o sin vigente, si se eliminó) ──
// El historial llega sin materiales: el total viene calculado por el back.

export const ListadoReportes = ({ periodos, puedeEliminar, onAbrir, onEliminar }) => (
  periodos.length === 0 ? (
    <p className="text-sm text-neutral-500 border rounded-xl p-6 text-center">Aún no hay reportes de esta empresa. Créalos en la pestaña "Crear reporte".</p>
  ) : (
    <div className="overflow-auto border rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-neutral-600">
          <tr>
            <th className="p-3">Mes</th>
            <th className="p-3">Año</th>
            <th className="p-3">Usuario</th>
            <th className="p-3">Fecha de carga</th>
            <th className="p-3 text-right">Toneladas totales</th>
            <th className="p-3">Estado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={clavePeriodo(p)} onClick={() => onAbrir(p)} className={`border-t cursor-pointer hover:bg-gray-50 ${p.vigente ? "" : "text-neutral-500"}`}>
              <td className="p-3 font-semibold">{MESES[p.mes - 1]}</td>
              <td className="p-3">{p.anio}</td>
              <td className="p-3">{p.vigente?.creadoPor || "—"}</td>
              <td className="p-3 whitespace-nowrap">{p.vigente ? formatoFechaHora(p.vigente.creadoFecha) : "—"}</td>
              <td className="p-3 text-right tabular-nums">{p.vigente ? formatoTon(toneladasTotales(p.vigente)) : "—"}</td>
              <td className="p-3">
                {p.vigente
                  ? <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs">Vigente</span>
                  : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-neutral-600 text-xs">Sin reporte vigente</span>}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                {/* UX-04: botón real para abrir con teclado; la fila sigue respondiendo al clic */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAbrir(p); }}
                  aria-label={`Ver el reporte de ${nombrePeriodo(p)}`}
                  className="px-2 py-1 rounded-md text-sm font-medium text-primary-dark hover:bg-primary-light"
                >
                  Ver
                </button>
                {puedeEliminar && p.vigente && (
                  <button
                    title="Eliminar reporte (desbloquea las ventas del periodo)"
                    onClick={(e) => { e.stopPropagation(); onEliminar(p.vigente); }}
                    className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
);

// Ventana con el reporte de un periodo: datos y resultados del vigente (el declarado) y, abajo, las versiones anteriores
// del mismo periodo (sin resultados). detalle: el vigente con sus materiales (null mientras se carga).
// Botón de la planilla oficial de ReSimple (solo para reportes vigentes de ReSimple), con su descripción arriba.
// `enVentana`: dentro de la ventana del reporte va sin la línea separadora (VI-07), que solo sirve en el aviso verde.
export const BotonPlanillaReSimple = ({ reporte, descargando, error, onDescargar, enVentana = false }) => (
  esReSimple(reporte?.gransic) && !reporte.eliminado ? (
    <div className={`basis-full flex flex-col items-start gap-1.5 ${enVentana ? "" : "border-t border-green-200 pt-3"}`}>
      <p className="text-sm text-neutral-700">Planilla oficial de ReSimple con este reporte, lista para cargarla en ReSimple y hacer la declaración.</p>
      <button
        onClick={() => onDescargar(reporte)}
        disabled={descargando}
        className="btn-principal"
      >
        {descargando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />} Reporte ReSimple .xlsx
      </button>
      {error && <p role="alert" className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}</p>}
    </div>
  ) : null
);

export const VentanaReporte = ({ grupo, detalle, puedeEliminar, onEliminar, onCerrar, descargando, errorDescarga, onDescargar }) => {
  const { vigente, versiones } = grupo;
  return (
    <Dialogo onCerrar={onCerrar} className="max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex justify-between items-start gap-3 px-6 pt-5 pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-neutral-800">Reporte de {nombrePeriodo(grupo)}</h2>
            {vigente ? (
              <p className="text-sm text-neutral-600">
                Vigente · creado el {formatoFechaHora(vigente.creadoFecha)} por {vigente.creadoPor} · {vigente.gransic.nombre} ·
                {" "}{plural(vigente.resumen.procesadas, "línea procesada", "líneas procesadas")} · {formatoTon(toneladasTotales(vigente))} t
              </p>
            ) : <p className="text-sm text-neutral-500">Sin reporte vigente: el último se eliminó y aún no se crea uno nuevo.</p>}
          </div>
          <div className="flex items-center gap-2">
            {puedeEliminar && vigente && (
              <button onClick={() => onEliminar(vigente)} className="btn-peligro-borde">
                <Trash2 className="w-4 h-4" /> Eliminar reporte
              </button>
            )}
            <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-8">
          <BotonPlanillaReSimple reporte={vigente} descargando={descargando} error={errorDescarga} onDescargar={onDescargar} enVentana />
          {vigente && (detalle
            ? <Resultado calculo={detalle} />
            : <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando resultados…</p>)}
          <section>
            <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-2">
              <History className="w-4 h-4" /> Historial del reporte de {nombrePeriodo(grupo)}: {plural(versiones.length, "vez generado", "veces generado")}
            </h3>
            <div className="overflow-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-neutral-600">
                  <tr>
                    <th className="p-2 text-right">Versión</th>
                    <th className="p-2">Creado</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Eliminado</th>
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((r, i) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-2 text-right tabular-nums">{versiones.length - i}</td>
                      <td className="p-2 text-xs leading-5">{formatoFechaHora(r.creadoFecha)}<br />{r.creadoPor}</td>
                      <td className="p-2">
                        {r.eliminado
                          ? <span className="px-2 py-0.5 rounded-full bg-gray-100 text-neutral-600 text-xs">Eliminado</span>
                          : <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs">Vigente (declarado)</span>}
                      </td>
                      <td className="p-2 text-xs leading-5">
                        {r.eliminado ? <>{formatoFechaHora(r.eliminado.fecha)} · {r.eliminado.por}<br /><span className="italic">{r.eliminado.motivo}</span></> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
    </Dialogo>
  );
};

export const Modal = ({ titulo, children, pie, onCerrar }) => (
  <Dialogo onCerrar={onCerrar} capa="z-[60]" className="max-w-lg p-6">
    <h2 className="text-lg font-bold text-neutral-800 mb-3">{titulo}</h2>
    {children}
    <div className="flex justify-end gap-3 mt-6">{pie}</div>
  </Dialogo>
);
