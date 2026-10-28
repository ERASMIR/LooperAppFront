import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_MATERIALES, API_VENTAS } from "../config/api";
import CargaMasivaVentas from "../Componentes/CargaMasivaVentas.jsx";
import { MESES, nombrePeriodo, fechaChilena, llave } from "../Componentes/ventasRevision.js";
import { Search, CheckCircle2, AlertTriangle, X, Loader2, ChevronDown, ChevronRight, History } from "lucide-react";

// Registro de Ventas: ventas por periodo (mes y año), cruzadas con la Matriz de Materiales por SKU + unidad de venta.
// La Matriz viene de looper-materiales y las ventas de looper-ventas.
// Plan: specs/002-registro-ventas/plan-trabajo.md

const LINEAS_POR_PAGINA = 50;
const MODOS = { combinar: "Combinar", reemplazar: "Reemplazar todo el periodo" };

const inputCls = "bg-gray-100 p-2.5 text-sm rounded-lg";
const formatoCantidad = (n) => n.toLocaleString("es-CL", { maximumFractionDigits: 6 });
const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Periodo por defecto: el mes anterior (las ventas se cargan una vez cerrado el mes).
const periodoAnterior = () => {
  const hoy = new Date();
  return hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
};

// Envía el JWT de la sesión. Si falla, lanza un Error con el mensaje del back y su lista de errores.
const llamarApi = async (token, base, ruta, { metodo = "GET", body } = {}) => {
  const res = await fetch(`${base}/${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status} al comunicarse con el servidor`);
    err.errores = data?.errores || [];
    throw err;
  }
  return data;
};

const RegistroVentas = () => {
  const { user, token } = useContext(AuthContext);
  const puedeEditar = user?.perfil === "admin" || user?.perfil === "dev";
  const empresaId = user?.empresaId;

  const [periodo, setPeriodo] = useState(periodoAnterior);
  const [matriz, setMatriz] = useState(null); // { productos, unidades }
  const [datos, setDatos] = useState(null); // { ventas, cargas, campos } del periodo
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostradas, setMostradas] = useState(LINEAS_POR_PAGINA);
  const [verHistorial, setVerHistorial] = useState(false);

  // Matriz vigente (productos y unidades de venta) para cruzar las ventas.
  useEffect(() => {
    if (!token || !empresaId) return;
    let vigente = true;
    Promise.all([
      llamarApi(token, API_MATERIALES, `catalogosMatriz?empresaId=${empresaId}`),
      llamarApi(token, API_MATERIALES, `productos?empresaId=${empresaId}`),
    ])
      .then(([cat, productos]) => vigente && setMatriz({ productos, unidades: cat.unidades }))
      .catch((err) => vigente && (setErrorCarga(err.message), setCargando(false)));
    return () => { vigente = false; };
  }, [empresaId, token]);

  const cargarPeriodo = useCallback(async () => {
    const d = await llamarApi(token, API_VENTAS, `ventas?empresaId=${empresaId}&anio=${periodo.anio}&mes=${periodo.mes}`);
    setDatos(d);
    return d;
  }, [token, empresaId, periodo]);

  useEffect(() => {
    if (!matriz) return;
    let vigente = true;
    setCargando(true);
    setMostradas(LINEAS_POR_PAGINA);
    cargarPeriodo()
      .catch((err) => vigente && setErrorCarga(err.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [matriz, cargarPeriodo]);

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto });
    if (tipo === "ok") setTimeout(() => setAviso(null), 6000);
  };

  const guardarCarga = async (payload) => {
    // Un solo envío; el back vuelve a validar todo y guarda en una transacción (todo o nada).
    const r = await llamarApi(token, API_VENTAS, "ventas/cargaMasiva", { metodo: "POST", body: { ...payload, empresaId } });
    await cargarPeriodo();
    const partes = [`${r.guardadas.toLocaleString("es-CL")} línea${r.guardadas === 1 ? "" : "s"} guardada${r.guardadas === 1 ? "" : "s"}`];
    if (r.reemplazadas) partes.push(`${r.reemplazadas.toLocaleString("es-CL")} reemplazada${r.reemplazadas === 1 ? "" : "s"}`);
    if (payload.excluidos.length) partes.push(`${payload.excluidos.reduce((n, e) => n + e.filas, 0)} fuera de la Matriz (no guardadas)`);
    mostrarAviso("ok", `Ventas de ${nombrePeriodo(payload)} cargadas desde "${payload.archivo}": ${partes.join(", ")}.`);
  };

  const ventas = useMemo(() => datos?.ventas || [], [datos]);
  const filtradas = useMemo(() => {
    const q = llave(busqueda);
    if (!q) return ventas;
    return ventas.filter((v) => [v.sku, v.descripcion, v.razonSocial, v.rut].some((x) => llave(x).includes(q)));
  }, [ventas, busqueda]);
  const resumen = useMemo(() => ({
    lineas: ventas.length,
    skus: new Set(ventas.map((v) => llave(v.sku))).size,
    clientes: new Set(ventas.map((v) => v.rut)).size,
    ultima: datos?.cargas[0],
  }), [ventas, datos]);
  const campos = datos?.campos || [];

  const anios = [];
  for (let a = new Date().getFullYear(); a >= 2023; a--) anios.push(a);

  let contenido;
  if (!empresaId) {
    contenido = <p className="text-neutral-600">Selecciona una empresa para ver su registro de ventas.</p>;
  } else if (errorCarga) {
    contenido = <p className="text-red-600">No se pudo cargar el registro de ventas: {errorCarga}</p>;
  } else if (!matriz || !datos) {
    contenido = <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando ventas…</p>;
  } else {
    contenido = (
      <>
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <div>
            <label className="block font-semibold text-sm mb-1" htmlFor="periodo-mes">Periodo</label>
            <div className="flex gap-2">
              <select id="periodo-mes" value={periodo.mes} onChange={(e) => setPeriodo((p) => ({ ...p, mes: Number(e.target.value) }))} className={inputCls}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select aria-label="Año" value={periodo.anio} onChange={(e) => setPeriodo((p) => ({ ...p, anio: Number(e.target.value) }))} className={inputCls}>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          {cargando && <Loader2 className="w-5 h-5 mb-2.5 animate-spin text-neutral-400" />}
          <div className="ml-auto">
            <CargaMasivaVentas
              key={`${periodo.anio}-${periodo.mes}`}
              periodo={periodo}
              productos={matriz.productos}
              unidades={matriz.unidades}
              campos={campos}
              existentes={ventas}
              puedeEditar={puedeEditar}
              claveConfig={`looper.ventas.cargaMasiva.${user?.id}.${empresaId}`}
              onGuardar={guardarCarga}
            />
          </div>
        </div>

        {aviso && (
          <div className={`mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${aviso.tipo === "ok" ? "text-green-800 bg-green-50 border-green-200" : "text-yellow-800 bg-yellow-50 border-yellow-200"}`}>
            {aviso.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="flex-1">{aviso.texto}</span>
            <button onClick={() => setAviso(null)} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ["Líneas de venta", resumen.lineas.toLocaleString("es-CL")],
            ["SKU distintos", resumen.skus.toLocaleString("es-CL")],
            ["Clientes", resumen.clientes.toLocaleString("es-CL")],
            ["Última carga", resumen.ultima ? formatoFechaHora(resumen.ultima.creadoFecha) : "—"],
          ].map(([texto, valor]) => (
            <div key={texto} className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-neutral-500">{texto}</p>
              <p className="text-xl font-bold text-neutral-800 tabular-nums">{valor}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-semibold text-neutral-800">Ventas de {nombrePeriodo(periodo)}</h2>
          <div className="relative ml-auto w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setMostradas(LINEAS_POR_PAGINA); }}
              placeholder="Buscar por SKU, descripción, cliente o RUT"
              className={`${inputCls} w-full pl-9`}
            />
          </div>
        </div>

        {ventas.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center border rounded-xl">
            No hay ventas cargadas para {nombrePeriodo(periodo)}.{puedeEditar && " Usa \"Carga masiva\" para subir el archivo del mes."}
          </p>
        ) : (
          <>
            <div className="overflow-auto max-h-[60dvh] border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0">
                  <tr>
                    <th className="p-2 whitespace-nowrap">Fecha</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2">Razón social</th>
                    <th className="p-2 whitespace-nowrap">RUT</th>
                    <th className="p-2 text-right">Cantidad</th>
                    <th className="p-2 whitespace-nowrap">Unidad de venta</th>
                    {campos.map((c) => <th key={c.id} className="p-2 whitespace-nowrap">{c.nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.slice(0, mostradas).map((v) => (
                    <tr key={v.id} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap tabular-nums">{fechaChilena(v.fecha)}</td>
                      <td className="p-2 whitespace-nowrap font-semibold">{v.sku}</td>
                      <td className="p-2">{v.descripcion}</td>
                      <td className="p-2">{v.razonSocial}</td>
                      <td className="p-2 whitespace-nowrap">{v.rut}</td>
                      <td className="p-2 text-right tabular-nums">{formatoCantidad(v.cantidad)}</td>
                      <td className="p-2 whitespace-nowrap">{v.unidad}</td>
                      {campos.map((c) => <td key={c.id} className="p-2">{v.camposAdicionales.find((x) => x.campoId === c.id)?.valor || ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 text-sm text-neutral-500">
              <span>
                Mostrando {Math.min(mostradas, filtradas.length).toLocaleString("es-CL")} de {filtradas.length.toLocaleString("es-CL")} líneas
                {busqueda && ` (filtradas de ${ventas.length.toLocaleString("es-CL")})`}
              </span>
              {mostradas < filtradas.length && (
                <button onClick={() => setMostradas((m) => m + LINEAS_POR_PAGINA)} className="bg-white text-primary border border-primary px-4 py-1.5 rounded-lg hover:bg-green-50">
                  Traer {LINEAS_POR_PAGINA} más
                </button>
              )}
            </div>
          </>
        )}

        <section className="mt-6">
          <button onClick={() => setVerHistorial((v) => !v)} className="flex items-center gap-2 font-semibold text-neutral-800">
            {verHistorial ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <History className="w-4 h-4" /> Historial de cargas del periodo ({datos.cargas.length})
          </button>
          {verHistorial && (datos.cargas.length === 0 ? (
            <p className="text-sm text-neutral-500 mt-2">Aún no hay cargas en este periodo.</p>
          ) : (
            <div className="overflow-auto border rounded-xl mt-2">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-neutral-600">
                  <tr>
                    <th className="p-2">Fecha</th><th className="p-2">Usuario</th><th className="p-2">Archivo</th><th className="p-2">Modo</th>
                    <th className="p-2 text-right">Guardadas</th><th className="p-2 text-right">Reemplazadas</th><th className="p-2 text-right">Fuera de la Matriz</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.cargas.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{formatoFechaHora(c.creadoFecha)}</td>
                      <td className="p-2">{c.creadoPor}</td>
                      <td className="p-2">{c.archivo}</td>
                      <td className="p-2">{MODOS[c.modo]}</td>
                      <td className="p-2 text-right tabular-nums">{c.lineasGuardadas}</td>
                      <td className="p-2 text-right tabular-nums">{c.lineasReemplazadas}</td>
                      <td className="p-2 text-right tabular-nums" title={c.excluidos.map((e) => `${e.sku} (${e.unidad})`).join(", ")}>
                        {c.excluidos.reduce((n, e) => n + e.filas, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      </>
    );
  }

  return (
    <div className="p-10 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Registro de Ventas</h1>
        <p className="text-neutral-600">Gestiona las ventas mensuales de tus productos.</p>
      </header>

      <div className="bg-white p-6 rounded-lg shadow-sm min-h-[calc(100vh-14rem)]">{contenido}</div>
    </div>
  );
};

export default RegistroVentas;
