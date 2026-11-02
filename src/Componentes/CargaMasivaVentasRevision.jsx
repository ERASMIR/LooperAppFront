// Carga masiva de ventas: pantalla de revisión (separado de Componentes/CargaMasivaVentas.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import { AlertTriangle, Download, Info } from "lucide-react";
import { FILAS_POR_PAGINA, descargarErrores } from "./cargaMasivaLectura.js";
import { Paginado } from "./cargaMasivaComun.jsx";
import { Indicador, Indicadores } from "./Indicador.jsx";
import { nombrePeriodo, fechaChilena, CAMPOS_COMPARADOS, textoDocumentos, textoDudosa } from "./ventasRevision.js";
import { plural } from "./cargaMasivaVentasComun.js";

// ── Revisión: resumen, errores, excluidos, advertencias y modo de carga ──────

export const Revision = ({
  archivo, periodo, revision, camposNuevos, existentes, modo, onModo, coincidencias, dudosas, puedeTodo, autorizado, onAutorizar,
}) => {
  const [verErrores, setVerErrores] = useState(FILAS_POR_PAGINA);
  const { errores, excluidos, advertencias, resumen } = revision;
  const hayErrores = errores.length > 0;

  return (
    <div className="pb-4 space-y-5">
      <div>
        <p className="text-sm text-neutral-700 mb-2"><b>{archivo}</b> · {plural(resumen.filas, "fila revisada", "filas revisadas")}</p>
        <Indicadores>
          <Indicador etiqueta="Líneas válidas" valor={resumen.validas} tono="correcto" />
          <Indicador etiqueta="Filas con error (bloquean)" valor={resumen.conError} tono="error" />
          <Indicador etiqueta="No están en la Matriz (no se guardan)" valor={resumen.excluidas} tono="atencion" />
          <Indicador etiqueta="Descripciones distintas (aviso)" valor={advertencias.length} tono="atencion" />
        </Indicadores>
      </div>

      {hayErrores && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Errores: {plural(errores.length, "error", "errores")} en {plural(resumen.conError, "fila", "filas")}
            </h3>
            <button
              onClick={() => descargarErrores(archivo, errores, [["Fila", "fila", 6], ["SKU", "sku", 24], ["Error", "mensaje", 100]])}
              className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800"
            >
              <Download className="w-4 h-4" /> Descargar errores (Excel)
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-2">
            <b>No se guarda nada</b> mientras el archivo tenga errores: una venta mal cargada cambia lo que se declara.
            Corrígelos en el archivo y vuelve a subirlo.
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

      {excluidos.length > 0 && (
        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" /> No están en la Matriz de Materiales: {plural(excluidos.length, "producto", "productos")} ({plural(resumen.excluidas, "fila", "filas")})
          </h3>
          <p className="text-xs text-yellow-800 mb-3">
            Estas ventas <b>no se guardarán</b>. Puede ser correcto (por ejemplo, envases reciclados o reventas declaradas por
            otra empresa); si deben contabilizarse, créalos primero en la Matriz de Materiales y vuelve a cargar el archivo.
          </p>
          <div className="overflow-auto max-h-[30dvh] border border-yellow-100 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">SKU</th><th className="p-2">Unidad de venta</th><th className="p-2 text-right">Filas</th><th className="p-2">Motivo</th></tr>
              </thead>
              <tbody>
                {excluidos.map((e) => (
                  <tr key={`${e.sku}::${e.unidad}`} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap font-semibold">{e.sku}<span className="block text-xs font-normal text-neutral-500">{e.descripcion}</span></td>
                    <td className="p-2 whitespace-nowrap">{e.unidad}</td>
                    <td className="p-2 text-right tabular-nums">{e.filas}</td>
                    <td className="p-2 text-neutral-700">
                      {e.motivo === "sku"
                        ? "El SKU no existe en la Matriz."
                        : `El SKU existe, pero no con esta unidad (en la Matriz: ${e.unidadesMatriz.join(", ")}).`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {advertencias.length > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-1">
            <Info className="w-4 h-4" /> Descripción distinta a la de la Matriz: {plural(advertencias.length, "SKU", "SKU")}
          </h3>
          <p className="text-xs text-neutral-500 mb-2">Solo es un aviso: las ventas se guardan igual (el cruce se hace por SKU y unidad de venta).</p>
          <div className="overflow-auto max-h-[25dvh] border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">SKU</th><th className="p-2">En el archivo</th><th className="p-2">En la Matriz</th><th className="p-2 text-right">Filas</th></tr>
              </thead>
              <tbody>
                {advertencias.map((a) => (
                  <tr key={a.sku} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap font-semibold">{a.sku}</td>
                    <td className="p-2">{a.archivo}</td>
                    <td className="p-2">{a.matriz}</td>
                    <td className="p-2 text-right tabular-nums">{a.filas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dudosas.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" /> Registros dudosos: {plural(dudosas.length, "línea trae", "líneas traen")} documentos ya registrados en otro periodo
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            Solo es un aviso: se guardan igual y quedan resaltadas en el listado. Revisa que no sea la misma venta registrada
            dos veces (por ejemplo, la guía en un mes y la factura en el siguiente).
          </p>
          <div className="overflow-auto max-h-[25dvh] border border-amber-100 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2 text-right">Fila</th><th className="p-2">SKU</th><th className="p-2">Documentos</th><th className="p-2">Ya registrado en</th></tr>
              </thead>
              <tbody>
                {dudosas.map(({ linea, otros }) => (
                  <tr key={linea.fila} className="border-t align-top bg-amber-50/50">
                    <td className="p-2 text-right tabular-nums text-neutral-500">{linea.fila}</td>
                    <td className="p-2 whitespace-nowrap font-semibold">{linea.sku}</td>
                    <td className="p-2 whitespace-nowrap">{textoDocumentos(linea)}</td>
                    <td className="p-2">{textoDudosa(otros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {camposNuevos.length > 0 && (
        <p className="text-sm text-neutral-700">
          Se crearán los campos adicionales: {camposNuevos.map((c) => <b key={c} className="mr-1">"{c}"</b>)}
        </p>
      )}

      {!hayErrores && resumen.validas > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 mb-1">¿Cómo se guarda?</h3>
          <p className="text-xs text-neutral-500 mb-2">
            {nombrePeriodo(periodo)} tiene hoy {plural(existentes, "línea de venta", "líneas de venta")}.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {[
              ["combinar", "Combinar con lo existente", "Reemplaza las ventas del periodo que comparten un documento (factura, guía, boleta o pedido) con el archivo. Las demás se conservan."],
              ...(puedeTodo ? [["reemplazar", "Reemplazar todo el periodo", "Elimina todas las ventas del periodo y deja solo las del archivo. Útil si el archivo viene completo desde tu ERP."]] : []),
            ].map(([valor, titulo, texto]) => (
              <label
                key={valor}
                className={`flex gap-2 rounded-xl border p-3 cursor-pointer ${modo === valor ? (valor === "reemplazar" ? "border-red-400 bg-red-50" : "border-primary bg-green-50") : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input type="radio" name="modo" checked={modo === valor} onChange={() => onModo(valor)} className="mt-1 accent-primary-dark" />
                <span>
                  <span className="block text-sm font-semibold text-neutral-800">{titulo}</span>
                  <span className="block text-xs text-neutral-600">{texto}</span>
                </span>
              </label>
            ))}
          </div>

          {modo === "combinar" && <Coincidencias coincidencias={coincidencias} periodo={periodo} autorizado={autorizado} onAutorizar={onAutorizar} />}
          {modo === "reemplazar" && (existentes > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 mb-2">
                Se eliminarán <b>todas</b> las ventas de {nombrePeriodo(periodo)} ({plural(existentes, "línea", "líneas")}) y quedarán
                solo las {plural(resumen.validas, "línea", "líneas")} del archivo. Las eliminadas quedan en el historial.
              </p>
              <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
                Autorizo eliminar las {plural(existentes, "línea", "líneas")} de {nombrePeriodo(periodo)} y reemplazarlas por las del archivo.
              </Autorizar>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">El periodo no tiene ventas: solo se agregan líneas.</p>
          ))}
        </section>
      )}
    </div>
  );
};

// Valor de un dato de la venta para mostrar en la comparación antes / después.
const mostrarDato = (v, key) => {
  if (key === "fecha") return fechaChilena(v.fecha);
  if (key === "cantidad") return Number(v.cantidad).toLocaleString("es-CL", { maximumFractionDigits: 6 });
  return v[key] ?? "—";
};

// Una venta en una celda: los datos comparados, con los que cambian resaltados.
export const DatosVenta = ({ venta, cambios = [], resaltar }) => (
  <span className="block text-xs leading-5">
    {CAMPOS_COMPARADOS.filter((c) => venta[c.key] != null && venta[c.key] !== "").map((c) => (
      <span key={c.key} className={`mr-2 ${cambios.includes(c.key) ? resaltar : ""}`}>
        <span className="text-neutral-500">{c.label}:</span> {mostrarDato(venta, c.key)}
      </span>
    ))}
  </span>
);

// Modo "combinar" por documento: qué pasa con las ventas guardadas que comparten un documento con el archivo.
export const Coincidencias = ({ coincidencias, periodo, autorizado, onAutorizar }) => {
  const { completa, sinCambios, modifica, elimina, ajenas } = coincidencias;
  if (![completa, sinCambios, modifica, elimina, ajenas].some((l) => l.length)) {
    return <p className="text-sm text-neutral-600">Ningún documento del archivo está registrado en {nombrePeriodo(periodo)}: solo se agregan líneas.</p>;
  }
  const confirmar = modifica.length + elimina.length;
  return (
    <div className="space-y-3">
      {ajenas.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 mb-2">
            {plural(ajenas.length, "venta guardada comparte", "ventas guardadas comparten")} documento con el archivo, pero las cargó
            otro usuario: tu perfil no permite reemplazarlas. Quita esos documentos del archivo o pide a un administrador que lo cargue.
          </p>
          <ul className="text-xs text-red-800 space-y-1">
            {ajenas.map(({ existente: e }) => (
              <li key={e.id}><b>{e.sku}</b> · {textoDocumentos(e)} · cargada por {e.creadoPor || "otro usuario"}</li>
            ))}
          </ul>
        </div>
      )}
      {(completa.length > 0 || sinCambios.length > 0) && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          {completa.length > 0 && <>Se completarán {plural(completa.length, "venta ya registrada", "ventas ya registradas")} con los documentos que agrega el archivo. </>}
          {sinCambios.length > 0 && <>{plural(sinCambios.length, "venta del archivo ya está registrada", "ventas del archivo ya están registradas")} igual: se mantienen.</>}
        </p>
      )}
      {confirmar > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          {modifica.length > 0 && (
            <>
              <p className="text-sm text-yellow-800 mb-2">
                Se <b>modificarán</b> {plural(modifica.length, "venta", "ventas")}: mismo documento y producto, pero cambian otros datos (resaltados).
              </p>
              <div className="overflow-auto max-h-[30dvh] border border-yellow-100 rounded-lg bg-white mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-white text-left text-neutral-600 sticky top-0">
                    <tr><th className="p-2">SKU · unidad</th><th className="p-2">Antes</th><th className="p-2">Después (archivo, fila)</th></tr>
                  </thead>
                  <tbody>
                    {modifica.map(({ existente: e, nueva: n, cambios }) => (
                      <tr key={e.id} className="border-t align-top">
                        <td className="p-2 whitespace-nowrap font-semibold">{e.sku}<span className="block text-xs font-normal text-neutral-500">{e.unidad}</span></td>
                        <td className="p-2"><DatosVenta venta={e} cambios={cambios} resaltar="bg-red-100 rounded px-1" /></td>
                        <td className="p-2">
                          <span className="text-xs text-neutral-500">Fila {n.fila}</span>
                          <DatosVenta venta={n} cambios={cambios} resaltar="bg-green-100 rounded px-1" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {elimina.length > 0 && (
            <>
              <p className="text-sm text-yellow-800 mb-2">
                Se <b>eliminarán</b> {plural(elimina.length, "venta", "ventas")}: son de documentos que vienen en el archivo, pero el archivo ya no las trae.
              </p>
              <ul className="text-xs text-yellow-900 bg-white border border-yellow-100 rounded-lg p-2 mb-3 space-y-1 max-h-[20dvh] overflow-auto">
                {elimina.map(({ existente: e }) => (
                  <li key={e.id}><b>{e.sku}</b> · {e.unidad} · {mostrarDato(e, "cantidad")} · {textoDocumentos(e)} · {e.razonSocial}</li>
                ))}
              </ul>
            </>
          )}
          <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
            Autorizo {[
              modifica.length ? `modificar ${plural(modifica.length, "venta", "ventas")}` : "",
              elimina.length ? `eliminar ${plural(elimina.length, "venta", "ventas")}` : "",
            ].filter(Boolean).join(" y ")} de {nombrePeriodo(periodo)}.
          </Autorizar>
        </div>
      )}
    </div>
  );
};

export const Autorizar = ({ autorizado, onAutorizar, children }) => (
  <label className="flex items-start gap-2 text-sm font-semibold text-neutral-800 cursor-pointer">
    <input type="checkbox" checked={autorizado} onChange={(e) => onAutorizar(e.target.checked)} className="w-4 h-4 mt-0.5 accent-primary-dark" />
    {children}
  </label>
);
