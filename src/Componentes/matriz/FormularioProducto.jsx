// Matriz de Materiales: pestaña para crear o editar un producto (separado de Paginas/MatrizMateriales.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import CargaMasivaMatriz from "../CargaMasivaMatriz.jsx";
import { TIPOS_ADJUNTO, EXTENSIONES_ADJUNTO, TAMANO_MAX_MB, MAX_VALOR_CAMPO, filaVacia, subcategoriasDe, formatoFecha, esDeComponente, unidadVacia, productoVacio, pesoFila, tonFila, pesoUnidad, tonUnidad, formatoKg, formatoTon, inputCls, labelCls } from "./utilidades.js";
import { SelectConMas, ModalConfirmar } from "./modales.jsx";
import { Plus, X, Trash2, Paperclip, AlertTriangle } from "lucide-react";

// ── Pestaña: crear o editar producto ──────────────────────────────────────────
// inicial: producto en edición (desdeProducto) o null para uno nuevo.
export const CrearProducto = ({
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
        <section className="tarjeta p-6">
          <h2 className="font-bold text-neutral-800 mb-4">Datos del producto</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="producto-sku" className={labelCls}>SKU</label>
              <div className="flex gap-1.5">
                <input
                  id="producto-sku"
                  spellCheck={false}
                  autoComplete="off"
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
        <section className="tarjeta p-6">
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
        <section className="tarjeta p-6">
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
        <section className="tarjeta p-6">
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
