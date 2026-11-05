import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { MAX_NOMBRE_CAMPO, subcategoriasDe, esDeComponente, desdeProducto, aPayload, aBase64 } from "../Componentes/matriz/utilidades.js";
import { ModalNuevo, ModalConfirmar, ModalGestionarCampos } from "../Componentes/matriz/modales.jsx";
import { ListadoProductos } from "../Componentes/matriz/ListadoProductos.jsx";
import { CrearProducto } from "../Componentes/matriz/FormularioProducto.jsx";
import { X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { API_MATERIALES } from "../config/api";
import { llamarApi as llamarApiBase } from "../config/apiCliente.js";
import { invalidarCatalogos, obtenerCatalogos } from "../config/cacheCatalogos.js";
import EncabezadoPagina from "../Componentes/EncabezadoPagina";

// ── API looper-materiales (cliente común en config/apiCliente.js) ─────────────
const llamarApi = (token, ruta, opciones) => llamarApiBase(token, API_MATERIALES, ruta, opciones);

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

  // Guardar o eliminar un producto actualiza solo ese producto en el listado (RC-02); antes se recargaban los ~350.
  // Editar crea una versión nueva con otro id: se reemplaza la anterior en su lugar. El listado viene ordenado por SKU.
  const reemplazarProducto = useCallback((anteriorId, nuevo) => {
    setProductos((lista) => {
      const i = lista.findIndex((p) => p.id === anteriorId);
      const sin = lista.filter((p) => p.id !== anteriorId && p.id !== nuevo.id);
      if (i >= 0) {
        sin.splice(Math.min(i, sin.length), 0, nuevo);
        return sin;
      }
      return [...sin, nuevo].sort((a, b) => a.sku.localeCompare(b.sku));
    });
  }, []);

  const aplicarCatalogos = (cat) => {
    setGransic(cat.gransic);
    setCatalogos({ unidades: cat.unidades, caracteristicas: cat.caracteristicas, componentes: cat.componentes, campos: cat.camposAdicionales });
  };

  useEffect(() => {
    if (!token || !empresaId) return;
    let vigente = true;
    setCargando(true);
    setErrorCarga("");
    Promise.all([obtenerCatalogos(token, empresaId), api(`productos?empresaId=${empresaId}`)])
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
      invalidarCatalogos(empresaId);
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
    invalidarCatalogos(empresaId);
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
    let actualizado = guardado;
    if (form.adjunto?.archivo) {
      try {
        await api("productos/adjunto", {
          metodo: "POST",
          body: { productoId: guardado.id, tipo: form.adjunto.tipo, nombreArchivo: form.adjunto.nombre, base64: await aBase64(form.adjunto.archivo) },
        });
        actualizado = await api(`producto?id=${guardado.id}`); // con el respaldo recién subido
      } catch (err) {
        errorAdjunto = err.message;
      }
    }

    const { sinCambios: _sinCambios, ...producto } = actualizado;
    reemplazarProducto(editando ? form.id : null, producto);
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
    const [cat] = await Promise.all([obtenerCatalogos(token, empresaId, { forzar: true }), cargarProductos()]);
    aplicarCatalogos(cat);
    setPestana("listado");
    const partes = [`${r.nuevos} producto${r.nuevos === 1 ? "" : "s"} nuevo${r.nuevos === 1 ? "" : "s"}`, `${r.modificados} actualizado${r.modificados === 1 ? "" : "s"}`];
    if (r.sinCambios) partes.push(`${r.sinCambios} sin cambios`);
    mostrarAviso("ok", `Carga masiva "${archivo}" guardada: ${partes.join(", ")}.`);
  };

  const eliminarProducto = async () => {
    await api(`productos?id=${aEliminar.id}`, { metodo: "DELETE" });
    const { sku } = aEliminar;
    setProductos((lista) => lista.filter((p) => p.id !== aEliminar.id));
    setAEliminar(null);
    mostrarAviso("ok", `Producto ${sku} eliminado de la matriz.`);
  };

  // Renombrar o eliminar cambia lo que muestra el listado: se recargan los productos.
  const renombrarCampoAdicional = async (id, nombre) => {
    const actualizado = await api("camposAdicionales", { metodo: "PUT", body: { id, nombre } });
    invalidarCatalogos(empresaId);
    setCatalogos((c) => ({ ...c, campos: c.campos.map((x) => (x.id === id ? actualizado : x)) }));
    await cargarProductos();
  };

  const eliminarCampoAdicional = async (id) => {
    await api(`camposAdicionales?id=${id}`, { metodo: "DELETE" });
    invalidarCatalogos(empresaId);
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
        </div>

        {aviso && (
          <div role="status" className={`mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${aviso.tipo === "ok" ? "text-green-800 bg-green-50 border-green-200" : "text-yellow-800 bg-yellow-50 border-yellow-200"}`}>
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
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo="Matriz de Materiales"
        descripcion="Gestiona la composición de materiales de tus productos."
        extra={gransic && <span className="chip-etiqueta">Sistema de gestión: <b>{gransic.nombre}</b></span>}
      />

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
          <p>
            Dejará de aparecer en la Matriz y no se podrán cargar ventas nuevas con este SKU. Las ventas ya registradas se
            siguen calculando con su última versión en los reportes que crees. Sus versiones anteriores se conservan en el
            historial.
          </p>
        </ModalConfirmar>
      )}
    </div>
  );
};

export default MatrizMateriales;
