import React, { useCallback, useContext, useEffect, useState } from "react";
import { Loader2, Save, Download, Trash2, X, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { AuthContext } from "../context/AuthContext.jsx";
import EncabezadoPagina from "../Componentes/EncabezadoPagina";
import Dialogo from "../Componentes/Dialogo.jsx";
import ResultadoProyeccion from "../Componentes/proyeccion/ResultadoProyeccion.jsx";
import { formatoTon, mesCorto, sumarMeses, totalSerie } from "../Componentes/proyeccion/proyeccionComun.js";
import { nombrePeriodo } from "../Componentes/ventasRevision.js";
import { API_REPORTES } from "../config/api";
import { llamarApi, textoError } from "../config/apiCliente.js";

// Proyección de materiales (T12): proyecta las toneladas de cada material y clasificación para 1–12 meses con los
// reportes validados de la empresa (requisito: los últimos 6 meses con reporte). Plan: specs/005-proyeccion/plan-trabajo.md
// Calcula y guarda looper-reportes (GET /api/proyeccion, GET/POST/DELETE /api/proyecciones); el Excel se arma aquí.
const HORIZONTES = Array.from({ length: 12 }, (_, i) => i + 1);

const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
// Excel con la tabla de la proyección.
const descargarExcel = async (r) => {
  const XLSX = await import("xlsx");
  const meses = r.series[0].proyeccion;
  const filas = r.series.map((s) => {
    const t = totalSerie(s);
    return {
      Material: s.material, Clasificación: s.categoria, Peligrosidad: s.peligrosidad || "",
      ...Object.fromEntries(s.proyeccion.map((p) => [mesCorto(p), Number(p.valor.toFixed(6))])),
      Total: Number(t.valor.toFixed(6)), "Rango bajo": Number(t.bajo.toFixed(6)), "Rango alto": Number(t.alto.toFixed(6)),
      "Sensibilidad (%)": Number(t.pct.toFixed(1)), Método: s.metodo,
      Coherencia: s.coherencia.estado === "ajustado" ? `Ajustado con ${s.coherencia.con} (r = ${s.coherencia.r.toFixed(2)})` : "Coherente",
    };
  });
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), "Proyección");
  const p0 = meses[0];
  XLSX.writeFile(libro, `Proyeccion_${r.empresa.replace(/\W+/g, "_")}_${p0.anio}-${String(p0.mes).padStart(2, "0")}_${r.horizonte}m.xlsx`);
};

const Proyeccion = () => {
  const { user, token } = useContext(AuthContext);
  const empresaId = user?.empresaId;
  const puedeEliminar = ["admin", "dev"].includes(user?.perfil);
  const [pestana, setPestana] = useState("nueva");
  const [horizonte, setHorizonte] = useState(6);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [abierta, setAbierta] = useState(null); // fila del historial con su resultado
  const [eliminando, setEliminando] = useState(null);
  const [errorEliminar, setErrorEliminar] = useState("");

  const api = useCallback((ruta, opciones) => llamarApi(token, API_REPORTES, ruta, opciones), [token]);
  const cargarHistorial = useCallback(async () => {
    try {
      setHistorial(await api(`proyecciones?empresaId=${empresaId}`));
    } catch (err) {
      setError(textoError(err));
    }
  }, [api, empresaId]);

  // Al entrar o cambiar de empresa: su historial y sin la proyección de la empresa anterior.
  useEffect(() => {
    if (!token || !empresaId) return;
    setResultado(null);
    setAviso("");
    setError("");
    cargarHistorial();
  }, [token, empresaId, cargarHistorial]);

  const proyectar = async () => {
    setCalculando(true);
    setAviso("");
    setError("");
    try {
      setResultado(await api(`proyeccion?empresaId=${empresaId}&horizonte=${horizonte}`));
    } catch (err) {
      setResultado(null);
      setError(textoError(err));
    } finally {
      setCalculando(false);
    }
  };

  // El back vuelve a calcular con el mismo horizonte y la guarda (no se confía en lo que manda el front).
  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const guardada = await api("proyecciones", { metodo: "POST", body: { empresaId, horizonte: resultado.horizonte } });
      await cargarHistorial();
      setAviso(`Proyección guardada en el historial (${guardada.horizonte} meses desde ${nombrePeriodo({ anio: guardada.desdeAnio, mes: guardada.desdeMes })}).`);
    } catch (err) {
      setError(textoError(err));
    } finally {
      setGuardando(false);
    }
  };

  const abrir = async (fila) => {
    setError("");
    try {
      setAbierta(await api(`proyecciones?empresaId=${empresaId}&id=${fila.id}`));
    } catch (err) {
      setError(textoError(err));
    }
  };

  const eliminar = async () => {
    setErrorEliminar("");
    try {
      await api(`proyecciones?empresaId=${empresaId}&id=${eliminando.id}`, { metodo: "DELETE" });
      setHistorial((h) => h.filter((x) => x.id !== eliminando.id));
      setEliminando(null);
    } catch (err) {
      setErrorEliminar(textoError(err));
    }
  };

  return (
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo="Proyección de materiales"
        descripcion="Estima las toneladas de los próximos meses por material, con los reportes validados de la empresa."
      />

      <div className="tarjeta p-6 min-h-[calc(100vh-14rem)]">
        <div className="flex gap-1 border-b border-neutral-200 mb-6" role="tablist">
          {[["nueva", "Nueva proyección"], ["historial", `Historial de proyecciones${historial.length ? ` (${historial.length})` : ""}`]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)} className={`pestana ${pestana === id ? "pestana-activa" : ""}`}>{label}</button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm rounded-xl px-4 py-3 border bg-red-50 border-red-200 text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        {pestana === "nueva" && (
          <>
            <div className="flex flex-wrap items-end gap-3 mb-2">
              <label className="text-sm font-semibold text-neutral-800">
                Meses a proyectar
                <select value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))} className="campo block mt-1 py-1.5">
                  {HORIZONTES.map((h) => <option key={h} value={h}>{h} {h === 1 ? "mes" : "meses"}{h === 6 ? " (lo que piden los sistemas de gestión)" : ""}</option>)}
                </select>
              </label>
              <button onClick={proyectar} disabled={calculando} className="btn-principal">
                {calculando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <TrendingUp className="w-4 h-4" aria-hidden="true" />}
                {calculando ? "Proyectando…" : "Proyectar"}
              </button>
              {resultado && !calculando && (
                <>
                  <button onClick={guardar} disabled={guardando} className="btn-secundario">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    {guardando ? "Guardando…" : "Guardar proyección"}
                  </button>
                  <button onClick={() => descargarExcel(resultado)} className="btn-secundario"><Download className="w-4 h-4" aria-hidden="true" /> Descargar Excel</button>
                </>
              )}
            </div>
            <p className="mb-6 text-sm text-neutral-600">
              Requisito: reportes validados en los últimos 6 meses. Se usa toda la historia disponible; con 12 meses o más se considera la estacionalidad.
            </p>

            {aviso && <p role="status" className="mb-4 text-sm rounded-xl px-4 py-3 border bg-green-50 border-green-200 text-green-800">{aviso}</p>}
            {resultado?.avisos?.map((a) => (
              <p key={a} className="mb-4 text-sm rounded-xl px-4 py-3 border bg-yellow-50 border-yellow-200 text-yellow-900 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" /> {a}
              </p>
            ))}
            {resultado
              ? <ResultadoProyeccion key={`${resultado.horizonte}-${resultado.historia.hasta.anio}-${resultado.historia.hasta.mes}`} resultado={resultado} />
              : !error && <p className="text-neutral-600">Elige cuántos meses proyectar y presiona <b>Proyectar</b>.</p>}
          </>
        )}

        {pestana === "historial" && (
          historial.length === 0 ? (
            <p className="text-neutral-600">Aún no hay proyecciones guardadas. Calcula una en "Nueva proyección" y guárdala.</p>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <table className="text-sm min-w-full">
                <thead className="bg-neutral-50 text-neutral-600 text-left">
                  <tr>
                    <th className="p-2 font-semibold">Fecha</th>
                    <th className="p-2 font-semibold">Usuario</th>
                    <th className="p-2 font-semibold">Proyecta</th>
                    <th className="p-2 font-semibold text-right">Meses de historia</th>
                    <th className="p-2 font-semibold text-right">Total proyectado (t)</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => {
                    const desde = { anio: h.desdeAnio, mes: h.desdeMes };
                    const hasta = sumarMeses(desde, h.horizonte - 1);
                    return (
                      <tr key={h.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{formatoFechaHora(h.fecha)}</td>
                        <td className="p-2">{h.por || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{mesCorto(desde)} – {mesCorto(hasta)} ({h.horizonte} {h.horizonte === 1 ? "mes" : "meses"})</td>
                        <td className="p-2 text-right tabular-nums">{h.mesesHistoria}</td>
                        <td className="p-2 text-right tabular-nums">{formatoTon(Number(h.totalProyectado))}</td>
                        <td className="p-2 whitespace-nowrap text-right">
                          <button onClick={() => abrir(h)} className="btn-secundario btn-chico">Ver</button>
                          {puedeEliminar && (
                            <button onClick={() => setEliminando(h)} aria-label="Eliminar proyección" title="Eliminar proyección" className="ml-1 p-1.5 rounded-full text-red-600 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {abierta && (
        <Dialogo onCerrar={() => setAbierta(null)} className="w-full max-w-6xl max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b">
            <div>
              <h2 className="text-lg font-bold text-neutral-800">Proyección guardada · {formatoFechaHora(abierta.fecha)}</h2>
              <p className="text-sm text-neutral-600">Por {abierta.por} · solo lectura</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => descargarExcel(abierta.resultado)} className="btn-secundario btn-chico"><Download className="w-4 h-4" aria-hidden="true" /> Excel</button>
              <button onClick={() => setAbierta(null)} aria-label="Cerrar" className="p-1 rounded-full hover:bg-neutral-100"><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
          </div>
          <div className="px-6 py-5 overflow-y-auto"><ResultadoProyeccion resultado={abierta.resultado} /></div>
        </Dialogo>
      )}

      {eliminando && (
        <Dialogo onCerrar={() => setEliminando(null)} className="w-full max-w-md p-6">
          <h2 className="text-lg font-bold text-neutral-800 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" aria-hidden="true" /> Eliminar proyección</h2>
          <p className="mt-2 text-neutral-700">Se quitará del historial la proyección del {formatoFechaHora(eliminando.fecha)}.</p>
          {errorEliminar && <p role="alert" className="mt-3 text-sm text-red-600">No se pudo eliminar: {errorEliminar}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => { setEliminando(null); setErrorEliminar(""); }} className="btn-secundario">Cancelar</button>
            <button onClick={eliminar} className="btn-peligro">Eliminar</button>
          </div>
        </Dialogo>
      )}
    </div>
  );
};

export default Proyeccion;
