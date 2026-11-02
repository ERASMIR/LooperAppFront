import React, { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Ventana } from "./cargaMasivaComun.jsx";
import { inputCls } from "./cargaMasivaLectura.js";
import { normalizar } from "./cargaMasivaRevision.js";
import {
  FOLIOS, PEDIDO, MAX_PEDIDO, nombrePeriodo, llave, normalizarRut, revisarVentaManual, documentosEnOtrosPeriodos, textoDudosa,
} from "./ventasRevision.js";

// Ingreso manual y edición de una venta del periodo seleccionado (T9.8). Mismas reglas que la carga masiva.
// Plan: specs/002-registro-ventas/ingreso-manual.md

const MAX_NOMBRE_CAMPO = 100;
const MAX_VALOR_CAMPO = 1000;
const dosDigitos = (n) => String(n).padStart(2, "0");

// Valores iniciales: los de la venta en edición o un formulario vacío.
const valoresIniciales = (venta) => {
  if (!venta) {
    return { fecha: "", hora: "", sku: "", unidad: "", cantidad: "", razonSocial: "", rut: "", folioFactura: "", folioGuia: "", folioBoleta: "", pedido: "" };
  }
  const [dia, hora] = venta.fecha.split(" ");
  return {
    fecha: dia,
    hora: hora === "00:00" ? "" : hora,
    sku: venta.sku,
    unidad: venta.unidad,
    cantidad: String(venta.cantidad).replace(".", ","),
    razonSocial: venta.razonSocial,
    rut: venta.rut,
    ...Object.fromEntries([...FOLIOS, PEDIDO].map((d) => [d.key, venta[d.key] ?? ""])),
  };
};

// La etiqueta se une al primer input/select/textarea de children (htmlFor + id generado) y el error queda asociado al
// campo (aria-describedby), para que el clic en la etiqueta enfoque el campo y los lectores de pantalla lo nombren.
const Campo = ({ label, obligatorio, error, children, className = "" }) => {
  const id = useId();
  let unido = false;
  const hijos = React.Children.map(children, (h) => {
    if (unido || !React.isValidElement(h) || !["input", "select", "textarea"].includes(h.type)) return h;
    unido = true;
    return React.cloneElement(h, {
      id: h.props.id || id,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
    });
  });
  return (
    <div className={className}>
      <label htmlFor={unido ? id : undefined} className="block text-sm font-semibold text-neutral-700 mb-1">
        {label}{obligatorio && <span className="text-red-600"> *</span>}
      </label>
      {hijos}
      {error && <p id={`${id}-error`} className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

// venta: la que se edita (null para una nueva). buscarClientes(q): async → [{ rut, razonSocial }] para sugerir la razón
// social. revisarDocumentos([venta]): async → documentos ya registrados en otros periodos (aviso de registro dudoso).
// onGuardar({ venta, camposAdicionales, camposNuevos }): async, puede lanzar el error del back.
const FormularioVenta = ({
  periodo, venta, productos, unidades, campos, existentes, buscarClientes, revisarDocumentos, onGuardar, onCerrar,
}) => {
  const [valores, setValores] = useState(() => valoresIniciales(venta));
  const [clientes, setClientes] = useState([]);
  const [otrosPeriodos, setOtrosPeriodos] = useState([]);
  const [valoresCampo, setValoresCampo] = useState(() =>
    Object.fromEntries((venta?.camposAdicionales || []).map((c) => [c.campoId, c.valor])));
  const [nuevos, setNuevos] = useState([]); // campos adicionales nuevos: [{ nombre, valor }]
  const [intento, setIntento] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const cambiar = (clave, valor) => setValores((v) => ({ ...v, [clave]: valor }));
  const producto = productos.find((p) => llave(p.sku) === llave(valores.sku));

  // Al elegir el SKU, si tiene una sola unidad de venta se propone esa.
  const cambiarSku = (sku) => {
    const p = productos.find((x) => llave(x.sku) === llave(sku));
    setValores((v) => ({
      ...v,
      sku,
      unidad: p && !p.unidades.some((u) => llave(u.unidad) === llave(v.unidad)) ? (p.unidades.length === 1 ? p.unidades[0].unidad : "") : v.unidad,
    }));
  };

  // Al escribir un RUT, se buscan los clientes ya usados por la empresa (lista de sugerencias) y, si el RUT coincide con
  // uno, se propone su razón social (solo si aún no se escribió una).
  useEffect(() => {
    const q = valores.rut.trim();
    if (q.length < 3) return undefined;
    let vigente = true;
    const espera = setTimeout(() => {
      buscarClientes(q)
        .then((lista) => {
          if (!vigente) return;
          setClientes(lista);
          const conocido = lista.find((c) => c.rut === normalizarRut(q));
          if (conocido) setValores((v) => (v.razonSocial.trim() ? v : { ...v, razonSocial: conocido.razonSocial }));
        })
        .catch(() => {}); // la sugerencia es opcional: si falla, se escribe a mano
    }, 300);
    return () => { vigente = false; clearTimeout(espera); };
  }, [valores.rut, buscarClientes]);

  // Documentos escritos que ya están registrados en otros periodos (aviso de registro dudoso; no bloquea).
  const documentos = useMemo(
    () => Object.fromEntries([...FOLIOS, PEDIDO].map((d) => [d.key, String(valores[d.key]).trim() || null])),
    [valores],
  );
  const firmaDocumentos = JSON.stringify(documentos);
  useEffect(() => {
    let vigente = true;
    const espera = setTimeout(() => {
      revisarDocumentos([JSON.parse(firmaDocumentos)])
        .then((lista) => vigente && setOtrosPeriodos(lista))
        .catch(() => vigente && setOtrosPeriodos([]));
    }, 400);
    return () => { vigente = false; clearTimeout(espera); };
  }, [firmaDocumentos, revisarDocumentos]);

  const revision = useMemo(
    () => revisarVentaManual({ valores, periodo, productos, unidades, existentes, idEditando: venta?.id }),
    [valores, periodo, productos, unidades, existentes, venta],
  );
  const errorNuevo = (n) => {
    const nombre = n.nombre.trim();
    if (!nombre) return "Escribe el nombre del campo.";
    if (nombre.length > MAX_NOMBRE_CAMPO) return `El nombre supera ${MAX_NOMBRE_CAMPO} caracteres.`;
    if (campos.some((c) => normalizar(c.nombre) === normalizar(nombre))) return "Ya existe un campo con ese nombre.";
    if (nuevos.filter((x) => normalizar(x.nombre) === normalizar(nombre)).length > 1) return "Nombre repetido.";
    return "";
  };
  const erroresCampos = [...Object.values(valoresCampo), ...nuevos.map((n) => n.valor)].some((v) => v.length > MAX_VALOR_CAMPO);
  const errores = intento ? revision.errores : {};
  const dudosa = documentosEnOtrosPeriodos(documentos, otrosPeriodos);

  const ultimoDia = new Date(periodo.anio, periodo.mes, 0).getDate();
  const minFecha = `${periodo.anio}-${dosDigitos(periodo.mes)}-01`;
  const maxFecha = `${periodo.anio}-${dosDigitos(periodo.mes)}-${ultimoDia}`;

  const guardar = async () => {
    setIntento(true);
    if (!revision.venta || nuevos.some(errorNuevo) || erroresCampos) return;
    setGuardando(true);
    setErrorGuardar("");
    try {
      await onGuardar({
        venta: revision.venta,
        camposAdicionales: [
          ...campos.filter((c) => valoresCampo[c.id]?.trim()).map((c) => ({ campoId: c.id, nombre: c.nombre, valor: valoresCampo[c.id].trim() })),
          ...nuevos.filter((n) => n.valor.trim()).map((n) => ({ campoId: null, nombre: n.nombre.trim(), valor: n.valor.trim() })),
        ],
        camposNuevos: nuevos.map((n) => n.nombre.trim()),
      });
    } catch (err) {
      setErrorGuardar([err.message, ...(err.errores || [])].join(" · "));
      setGuardando(false);
    }
  };

  const borde = (clave) => (errores[clave] ? "ring-1 ring-red-300" : "");

  return (
    <Ventana
      titulo={`${venta ? "Editar venta" : "Nueva venta"} · ${nombrePeriodo(periodo)}`}
      onCerrar={onCerrar}
      pie={(
        <>
          {errorGuardar && <p role="alert" className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
          {intento && Object.keys(revision.errores).length > 0 && (
            <p className="mr-auto text-sm text-red-600">{revision.errores.general || "Revisa los datos marcados."}</p>
          )}
          <button onClick={onCerrar} className="btn-secundario">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="btn-principal"
          >
            {guardando ? "Guardando…" : venta ? "Guardar cambios" : "Agregar venta"}
          </button>
        </>
      )}
    >
      <div className="pb-4 space-y-5">
        {errores.general && (
          <p className="flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {errores.general}
          </p>
        )}

        <section>
          <h3 className="font-semibold text-neutral-800 mb-2">Producto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <Campo label="Fecha de transacción" obligatorio error={errores.fecha}>
              <input type="date" min={minFecha} max={maxFecha} value={valores.fecha} onChange={(e) => cambiar("fecha", e.target.value)} className={`${inputCls} w-full ${borde("fecha")}`} />
            </Campo>
            <Campo label="Hora (opcional)">
              <input type="time" value={valores.hora} onChange={(e) => cambiar("hora", e.target.value)} className={`${inputCls} w-full`} />
            </Campo>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Campo label="SKU" obligatorio error={errores.sku}>
              <input
                list="formulario-venta-skus"
                spellCheck={false}
                autoComplete="off"
                value={valores.sku}
                onChange={(e) => cambiarSku(e.target.value)}
                placeholder="Busca por SKU o descripción"
                className={`${inputCls} w-full ${borde("sku")}`}
              />
              <datalist id="formulario-venta-skus">
                {productos.map((p) => <option key={p.sku} value={p.sku}>{p.descripcion}</option>)}
              </datalist>
              {producto && <p className="text-xs text-neutral-500 mt-1">{producto.descripcion}</p>}
            </Campo>
            <Campo label="Unidad de venta" obligatorio error={errores.unidad}>
              <select value={valores.unidad} onChange={(e) => cambiar("unidad", e.target.value)} disabled={!producto} className={`${inputCls} w-full ${borde("unidad")}`}>
                <option value="">{producto ? "Seleccionar" : "Primero elige el SKU"}</option>
                {producto?.unidades.map((u) => <option key={u.unidad} value={u.unidad}>{u.unidad}</option>)}
              </select>
            </Campo>
            <Campo label="Cantidad" obligatorio error={errores.cantidad}>
              <input inputMode="decimal" value={valores.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} className={`${inputCls} w-full ${borde("cantidad")}`} />
            </Campo>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-neutral-800 mb-2">Cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-3">
            <Campo label="RUT" obligatorio error={errores.rut}>
              <input list="formulario-venta-ruts" spellCheck={false} autoComplete="off" value={valores.rut} onChange={(e) => cambiar("rut", e.target.value)} placeholder="76.123.456-0" className={`${inputCls} w-full ${borde("rut")}`} />
              <datalist id="formulario-venta-ruts">
                {clientes.map((c) => <option key={c.rut} value={c.rut}>{c.razonSocial}</option>)}
              </datalist>
            </Campo>
            <Campo label="Razón social" obligatorio error={errores.razonSocial}>
              <input value={valores.razonSocial} onChange={(e) => cambiar("razonSocial", e.target.value)} className={`${inputCls} w-full ${borde("razonSocial")}`} />
            </Campo>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-neutral-800">Documentos</h3>
          <p className="text-xs text-neutral-500 mb-2">Indica al menos el N° de factura, de guía de despacho o de boleta.</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {FOLIOS.map((d) => (
              <Campo key={d.key} label={d.label}>
                <input inputMode="numeric" spellCheck={false} autoComplete="off" value={valores[d.key]} onChange={(e) => cambiar(d.key, e.target.value)} className={`${inputCls} w-full ${borde("documentos")}`} />
              </Campo>
            ))}
            <Campo label={PEDIDO.label}>
              <input maxLength={MAX_PEDIDO} spellCheck={false} autoComplete="off" value={valores.pedido} onChange={(e) => cambiar("pedido", e.target.value)} className={`${inputCls} w-full`} />
            </Campo>
          </div>
          {errores.documentos && <p className="text-xs text-red-600 mt-1">{errores.documentos}</p>}
          {dudosa.length > 0 && (
            <p className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Registro dudoso: {textoDudosa(dudosa)}. Revisa que no sea la misma venta. Puedes guardarla igual.
            </p>
          )}
        </section>

        <section>
          <h3 className="font-semibold text-neutral-800">Información adicional</h3>
          <p className="text-xs text-neutral-500 mb-2">Campos propios de tu empresa. Son opcionales.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {campos.map((c) => (
              <Campo key={c.id} label={c.nombre}>
                <input
                  maxLength={MAX_VALOR_CAMPO}
                  value={valoresCampo[c.id] || ""}
                  onChange={(e) => setValoresCampo((v) => ({ ...v, [c.id]: e.target.value }))}
                  className={`${inputCls} w-full`}
                />
              </Campo>
            ))}
          </div>
          {nuevos.map((n, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 mt-3 items-start">
              <Campo label="Nombre del campo nuevo" error={intento ? errorNuevo(n) : ""}>
                <input
                  value={n.nombre}
                  onChange={(e) => setNuevos((l) => l.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))}
                  className={`${inputCls} w-full`}
                />
              </Campo>
              <Campo label="Valor">
                <input
                  maxLength={MAX_VALOR_CAMPO}
                  value={n.valor}
                  onChange={(e) => setNuevos((l) => l.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                  className={`${inputCls} w-full`}
                />
              </Campo>
              <button
                title="Quitar campo nuevo"
                onClick={() => setNuevos((l) => l.filter((_, j) => j !== i))}
                className="sm:mt-7 p-2 rounded-full hover:bg-red-50 text-red-600 justify-self-start"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => setNuevos((l) => [...l, { nombre: "", valor: "" }])} className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800 mt-3">
            <Plus className="w-4 h-4" /> Crear campo adicional
          </button>
        </section>
      </div>
    </Ventana>
  );
};

export default FormularioVenta;
