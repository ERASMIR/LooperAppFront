import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Dialogo from "../Componentes/Dialogo.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_MATERIALES, API_VENTAS } from "../config/api";
import { llamarApi } from "../config/apiCliente.js";
import { Indicador, Indicadores } from "../Componentes/Indicador.jsx";
import CargaMasivaVentas from "../Componentes/CargaMasivaVentas.jsx";
import { EncabezadoAjustable, ModalColumnas } from "../Componentes/columnasTabla.jsx";
import { useVistaTabla } from "../Componentes/useVistaTabla.js";
import FormularioVenta from "../Componentes/FormularioVenta.jsx";
import {
  MESES, nombrePeriodo, fechaChilena, llave, FOLIOS, PEDIDO, DOCUMENTOS, textoDocumentos, documentosEnOtrosPeriodos, textoDudosa,
} from "../Componentes/ventasRevision.js";
import {
  Search, CheckCircle2, AlertTriangle, X, Loader2, ChevronDown, ChevronRight, History, Columns3, Plus, Pencil, Trash2, Lock,
} from "lucide-react";

// Registro de Ventas: ventas por periodo (mes y año), cruzadas con la Matriz de Materiales por SKU + unidad de venta.
// La Matriz viene de looper-materiales y las ventas de looper-ventas.
// Planes: specs/002-registro-ventas/plan-trabajo.md, documento-tributario.md (T9.7) e ingreso-manual.md (T9.8).

const LINEAS_POR_PAGINA = 50;
const MODOS = { combinar: "Combinar", reemplazar: "Reemplazar todo el periodo" };
const ANCHO_ACCIONES = 80;

const inputCls = "campo";
const formatoCantidad = (n) => n.toLocaleString("es-CL", { maximumFractionDigits: 6 });
const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Periodo por defecto: el mes anterior (las ventas se cargan una vez cerrado el mes).
const periodoAnterior = () => {
  const hoy = new Date();
  return hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
};

// llamarApi: cliente común (config/apiCliente.js).

const RegistroVentas = () => {
  const { user, token } = useContext(AuthContext);
  // Admin y dev cargan, editan y eliminan todo; el REP carga y solo edita/elimina lo suyo (ingreso-manual.md).
  const puedeTodo = user?.perfil === "admin" || user?.perfil === "dev";
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
  const [editandoColumnas, setEditandoColumnas] = useState(false);
  const [formulario, setFormulario] = useState(null); // null | { venta: null (nueva) | venta en edición }
  const [eliminando, setEliminando] = useState(null); // venta a eliminar (confirmación)
  const [errorEliminar, setErrorEliminar] = useState("");

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

  // vigente(): false si el usuario ya cambió de periodo; así una respuesta tardía no pisa la del periodo elegido.
  const cargarPeriodo = useCallback(async (vigente = () => true) => {
    const d = await llamarApi(token, API_VENTAS, `ventas?empresaId=${empresaId}&anio=${periodo.anio}&mes=${periodo.mes}`);
    if (vigente()) setDatos(d);
    return d;
  }, [token, empresaId, periodo]);

  useEffect(() => {
    if (!matriz) return;
    let vigente = true;
    setCargando(true);
    setMostradas(LINEAS_POR_PAGINA);
    cargarPeriodo(() => vigente)
      .catch((err) => vigente && setErrorCarga(err.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [matriz, cargarPeriodo]);

  const mostrarAviso = (tipo, texto) => {
    setAviso({ tipo, texto });
    if (tipo === "ok") setTimeout(() => setAviso(null), 6000);
  };

  // Documentos de las líneas que ya están en otros periodos (registros dudosos), antes de guardar.
  const revisarDocumentos = useCallback(async (lineas) => {
    const documentos = Object.fromEntries(DOCUMENTOS.map((d) => [d.key, [...new Set(lineas.map((l) => l[d.key]).filter((n) => n != null && n !== ""))]]));
    if (!Object.values(documentos).some((l) => l.length)) return [];
    const r = await llamarApi(token, API_VENTAS, "ventas/revisarDocumentos", {
      metodo: "POST", body: { empresaId, anio: periodo.anio, mes: periodo.mes, documentos },
    });
    return r.otrosPeriodos;
  }, [token, empresaId, periodo]);

  // Clientes ya usados por la empresa que coinciden con lo escrito (sugerencia de razón social en el formulario).
  const buscarClientes = useCallback(
    (q) => llamarApi(token, API_VENTAS, `clientes?empresaId=${empresaId}&q=${encodeURIComponent(q)}`),
    [token, empresaId],
  );

  // Crear (POST) o editar (PUT) desde el formulario; el back vuelve a validar todo.
  const guardarVenta = async ({ venta, camposAdicionales }) => {
    const editando = formulario?.venta;
    const body = { empresaId, venta: { ...venta, camposAdicionales } };
    const r = editando
      ? await llamarApi(token, API_VENTAS, "ventas", { metodo: "PUT", body: { ...body, id: editando.id } })
      : await llamarApi(token, API_VENTAS, "ventas", { metodo: "POST", body: { ...body, anio: periodo.anio, mes: periodo.mes } });
    setFormulario(null);
    await cargarPeriodo();
    const dudosa = r.advertencias?.otrosPeriodos?.length ? ` Registro dudoso: ${textoDudosa(r.advertencias.otrosPeriodos)}.` : "";
    mostrarAviso(dudosa ? "aviso" : "ok", `${editando ? "Venta actualizada" : "Venta agregada"}: ${r.venta.sku} · ${textoDocumentos(r.venta)}.${dudosa}`);
  };

  const eliminarVenta = async () => {
    const v = eliminando;
    setErrorEliminar("");
    try {
      await llamarApi(token, API_VENTAS, `ventas?empresaId=${empresaId}&id=${v.id}`, { metodo: "DELETE" });
    } catch (err) {
      setErrorEliminar(err.message);
      return;
    }
    setEliminando(null);
    await cargarPeriodo();
    mostrarAviso("ok", `Venta eliminada: ${v.sku} · ${textoDocumentos(v)}.`);
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
    return ventas.filter((v) => [v.sku, v.descripcion, v.razonSocial, v.rut, ...DOCUMENTOS.map((d) => v[d.key])].some((x) => llave(x).includes(q)));
  }, [ventas, busqueda]);

  // Documentos de las ventas del periodo que también están en otros periodos: la fila se marca como dudosa.
  const otrosPeriodos = useMemo(() => datos?.otrosPeriodos || [], [datos]);

  // Periodo bloqueado: ya se creó el reporte con estas ventas. Para cambiarlas, primero hay que inhabilitar el reporte.
  const bloqueo = datos?.bloqueado || null;
  const puedeModificar = (v) => !bloqueo && (puedeTodo || v.creadoPorId === user?.id);
  const resumen = useMemo(() => ({
    lineas: ventas.length,
    skus: new Set(ventas.map((v) => llave(v.sku))).size,
    clientes: new Set(ventas.map((v) => v.rut)).size,
    ultima: datos?.cargas[0],
  }), [ventas, datos]);
  const campos = datos?.campos || [];

  // Columnas del listado (como en la Matriz): fijas Fecha, SKU, Cantidad y Unidad; campos adicionales ocultos por defecto.
  const columnas = [
    { id: "fecha", label: "Fecha", fija: true, ancho: 140, render: (v) => <span className="tabular-nums">{fechaChilena(v.fecha)}</span> },
    { id: "sku", label: "SKU", fija: true, ancho: 170, render: (v) => <span className="font-semibold">{v.sku}</span> },
    { id: "descripcion", label: "Descripción", ancho: 220, render: (v) => v.descripcion },
    { id: "razonSocial", label: "Razón social", ancho: 200, render: (v) => v.razonSocial },
    { id: "rut", label: "RUT", ancho: 120, render: (v) => v.rut },
    { id: "cantidad", label: "Cantidad", fija: true, derecha: true, ancho: 100, render: (v) => <span className="tabular-nums">{formatoCantidad(v.cantidad)}</span> },
    { id: "unidad", label: "Unidad de venta", fija: true, ancho: 140, render: (v) => v.unidad },
    { id: "documentos", label: "Documentos", ancho: 190, render: (v) => textoDocumentos(v) },
    ...[...FOLIOS, PEDIDO].map((d) => ({ id: d.key, label: d.label, oculta: true, ancho: 130, render: (v) => v[d.key] ?? "—" })),
    { id: "modificado", label: "Última modificación", ancho: 210, render: (v) => (
      <span className="block text-xs leading-5">
        <span className="text-sm text-neutral-800">{v.modificadoFecha ? formatoFechaHora(v.modificadoFecha) : "—"}</span><br />
        {v.modificadoPor || "—"}
      </span>
    ) },
    ...campos.map((c) => ({
      id: `campo:${c.id}`, label: c.nombre, campo: true, ancho: 160, render: (v) => {
        const valor = v.camposAdicionales.find((x) => x.campoId === c.id)?.valor;
        return valor ? <span className="block truncate" title={valor}>{valor}</span> : "—";
      },
    })),
  ];
  const vistaTabla = useVistaTabla(`looper.ventas.columnas.${user?.id}.${empresaId}`, columnas);
  const { visibles } = vistaTabla;
  const anchoTabla = visibles.reduce((acc, c) => acc + vistaTabla.anchoDe(c), 0) + ANCHO_ACCIONES;

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
          <div className="ml-auto flex flex-wrap gap-3">
            <button
              onClick={() => setFormulario({ venta: null })}
              disabled={!!bloqueo}
              title={bloqueo ? "El periodo está bloqueado" : `Ingresar a mano una venta de ${nombrePeriodo(periodo)}`}
              className="btn-principal"
            >
              <Plus className="w-4 h-4" /> Nueva venta
            </button>
            <CargaMasivaVentas
              key={`${periodo.anio}-${periodo.mes}`}
              periodo={periodo}
              productos={matriz.productos}
              unidades={matriz.unidades}
              campos={campos}
              existentes={ventas}
              puedeCargar={!bloqueo}
              motivoNoCargar="El periodo está bloqueado"
              puedeTodo={puedeTodo}
              usuarioId={user?.id}
              revisarDocumentos={revisarDocumentos}
              claveConfig={`looper.ventas.cargaMasiva.${user?.id}.${empresaId}`}
              onGuardar={guardarCarga}
            />
          </div>
        </div>

        {bloqueo && (
          <div className="mb-4 flex gap-2 text-sm rounded-xl px-4 py-3 border text-neutral-700 bg-gray-50 border-gray-300">
            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <b>Periodo bloqueado.</b> Las ventas de {nombrePeriodo(periodo)} ya se usaron en un reporte
              ({[formatoFechaHora(bloqueo.fecha), bloqueo.por].filter(Boolean).join(", ")}). Para cargar, editar o eliminar
              ventas, primero hay que inhabilitar ese reporte.
            </span>
          </div>
        )}

        {aviso && (
          <div className={`mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${aviso.tipo === "ok" ? "text-green-800 bg-green-50 border-green-200" : "text-yellow-800 bg-yellow-50 border-yellow-200"}`}>
            {aviso.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="flex-1">{aviso.texto}</span>
            <button onClick={() => setAviso(null)} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
          </div>
        )}

        <Indicadores className="mb-5">
          <Indicador etiqueta="Líneas de venta" valor={resumen.lineas} />
          <Indicador etiqueta="SKU distintos" valor={resumen.skus} />
          <Indicador etiqueta="Clientes" valor={resumen.clientes} />
          <Indicador etiqueta="Última carga" valor={resumen.ultima ? formatoFechaHora(resumen.ultima.creadoFecha) : "—"} />
        </Indicadores>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-semibold text-neutral-800">Ventas de {nombrePeriodo(periodo)}</h2>
          <button
            onClick={() => setEditandoColumnas(true)}
            className="btn-secundario ml-auto"
          >
            <Columns3 className="w-4 h-4" /> Columnas
          </button>
          <div className="relative w-full sm:w-80">
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
            No hay ventas cargadas para {nombrePeriodo(periodo)}.{!bloqueo && " Usa \"Nueva venta\" o \"Carga masiva\" para agregarlas."}
          </p>
        ) : (
          <>
            <div className="overflow-auto max-h-[60dvh] border rounded-xl">
              <table className="text-sm table-fixed" style={{ width: anchoTabla, minWidth: "100%" }}>
                <colgroup>
                  {visibles.map((c) => <col key={c.id} style={{ width: vistaTabla.anchoDe(c) }} />)}
                  <col style={{ width: ANCHO_ACCIONES }} />
                </colgroup>
                <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0 z-10">
                  <tr>
                    {visibles.map((c) => <EncabezadoAjustable key={c.id} columna={c} vistaTabla={vistaTabla} className={`p-2 ${c.derecha ? "text-right" : ""}`} />)}
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.slice(0, mostradas).map((v) => {
                    const dudosa = documentosEnOtrosPeriodos(v, otrosPeriodos);
                    const editable = puedeModificar(v);
                    const motivo = bloqueo ? "El periodo está bloqueado" : "Solo puedes modificar las ventas que cargaste tú";
                    return (
                      <tr
                        key={v.id}
                        className={`border-t align-top ${dudosa.length ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"}`}
                        title={dudosa.length ? `Registro dudoso: ${textoDudosa(dudosa)}` : undefined}
                      >
                        {visibles.map((c, i) => (
                          <td key={c.id} className={`p-2 break-words ${c.derecha ? "text-right" : ""}`}>
                            {i === 0 && dudosa.length > 0 && <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-amber-600" aria-label="Registro dudoso" />}
                            {c.render(v)}
                          </td>
                        ))}
                        <td className="p-1">
                          <div className="flex justify-end">
                            <button
                              title={editable ? "Editar venta" : motivo}
                              disabled={!editable}
                              onClick={() => setFormulario({ venta: v })}
                              className="p-1.5 rounded-full hover:bg-green-50 text-primary-dark disabled:text-gray-300 disabled:hover:bg-transparent"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              title={editable ? "Eliminar venta" : motivo}
                              disabled={!editable}
                              onClick={() => setEliminando(v)}
                              className="p-1.5 rounded-full hover:bg-red-50 text-red-600 disabled:text-gray-300 disabled:hover:bg-transparent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 text-sm text-neutral-500">
              <span>
                Mostrando {Math.min(mostradas, filtradas.length).toLocaleString("es-CL")} de {filtradas.length.toLocaleString("es-CL")} líneas
                {busqueda && ` (filtradas de ${ventas.length.toLocaleString("es-CL")})`}
              </span>
              {mostradas < filtradas.length && (
                <button onClick={() => setMostradas((m) => m + LINEAS_POR_PAGINA)} className="btn-secundario btn-chico">
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

        {formulario && (
          <FormularioVenta
            periodo={periodo}
            venta={formulario.venta}
            productos={matriz.productos}
            unidades={matriz.unidades}
            campos={campos}
            existentes={ventas}
            buscarClientes={buscarClientes}
            revisarDocumentos={revisarDocumentos}
            onGuardar={guardarVenta}
            onCerrar={() => setFormulario(null)}
          />
        )}

        {eliminando && (
          <Dialogo onCerrar={() => { setEliminando(null); setErrorEliminar(""); }} className="max-w-md p-6">
              <h2 className="text-lg font-bold text-neutral-800 mb-3">Eliminar venta</h2>
              <p className="text-sm text-neutral-700">
                ¿Eliminar la venta <b>{eliminando.sku}</b> · {formatoCantidad(eliminando.cantidad)} {eliminando.unidad} ·{" "}
                {textoDocumentos(eliminando)} a <b>{eliminando.razonSocial}</b> ({fechaChilena(eliminando.fecha)})?
              </p>
              <p className="text-xs text-neutral-500 mt-2">Deja de contar en {nombrePeriodo(periodo)}; queda registrada en la auditoría.</p>
              {errorEliminar && <p className="text-sm text-red-600 mt-3">No se pudo eliminar: {errorEliminar}</p>}
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setEliminando(null); setErrorEliminar(""); }} className="btn-secundario">Cancelar</button>
                <button onClick={eliminarVenta} className="btn-peligro">Eliminar</button>
              </div>
          </Dialogo>
        )}

        {editandoColumnas && (
          <ModalColumnas
            columnas={columnas}
            vistaTabla={vistaTabla}
            tituloDatos="Datos de la venta"
            onCerrar={() => setEditandoColumnas(false)}
          />
        )}
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
