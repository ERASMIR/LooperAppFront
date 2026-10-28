// Carga masiva de la Matriz de Materiales — parte B: revisión del contenido del archivo contra los catálogos y la
// matriz actual. Funciones puras (sin React). Plan: specs/001-matriz-materiales/carga-masiva.md

// Minúsculas, sin tildes ni signos: "Descripción del producto" → "descripcion del producto".
export const normalizar = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const PELIGROSIDADES = ["peligroso", "no peligroso"];

// Número del archivo: acepta punto o coma decimal ("0,5", "0.5") y números de Excel ("1e-7"). null si no es número.
export const leerNumero = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return null;
  if (t.includes(",")) return /^-?\d+,\d+$/.test(t) ? Number(t.replace(",", ".")) : null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const formatoNum = (n) => n.toLocaleString("es-CL", { maximumFractionDigits: 6 });
// Valor del archivo para los mensajes: decimales de Excel con coma y hasta 6 decimales; textos largos recortados.
const citar = (v) => {
  const t = String(v ?? "").trim();
  const n = /^-?\d+\.\d+$/.test(t) ? formatoNum(Number(t)) : t;
  return `"${n.length > 60 ? `${n.slice(0, 57)}…` : n}"`;
};

// Busca un nombre en una lista sin distinguir mayúsculas ni tildes; devuelve el elemento o undefined.
const buscar = (lista, nombre, campo = "nombre") => lista.find((x) => normalizar(x[campo] ?? x) === normalizar(nombre));

// Firma de una fila de composición para comparar (orden de las filas no importa).
const firmaFila = (f) => [f.componente, formatoNum(f.cantidad), formatoNum(f.pesoKg), f.categoria || "", f.material, f.caracteristica || ""]
  .map(normalizar).join("|");

/**
 * Revisa las filas leídas del archivo.
 * @param filas      [{ fila, valores: { encabezado: texto } }]
 * @param asignacion { claveCampo: encabezado }  (claves base y "campo:<id>")
 * @param crear      encabezados que se crearán como campo adicional
 * @param niveles    { encabezado: "producto" | "componente" } de las columnas a crear
 * @param base       campos base (camposBase) con su `opcional`
 * @param gransic    { tiene_peligrosidad, categorias: { categoria: [materiales] } }
 * @param catalogos  { unidades, componentes, caracteristicas, campos }
 * @param productos  matriz actual (GET /api/productos)
 * @returns { errores, nuevosValores, productos, resumen }
 */
export const revisarCarga = ({ filas, asignacion, crear, niveles = {}, base, gransic, catalogos, productos }) => {
  const tienePeligrosidad = gransic.tiene_peligrosidad;
  const categorias = Object.keys(gransic.categorias);
  const obligatorios = base.filter((b) => !b.opcional).map((b) => b.key);
  const etiqueta = Object.fromEntries(base.map((b) => [b.key, b.label.replace(/ \(.*\)$/, "")]));
  // Campos adicionales: los de producto tienen un valor por SKU; los de componente, uno por fila de la composición.
  const asignados = catalogos.campos.filter((c) => asignacion[`campo:${c.id}`]);
  const deComponente = (nivel) => nivel === "componente";
  const columnasCampo = (componente) => [
    ...asignados.filter((c) => deComponente(c.nivel) === componente).map((c) => [c.nombre, asignacion[`campo:${c.id}`]]),
    ...crear.filter((col) => deComponente(niveles[col]) === componente).map((col) => [col, col]),
  ];
  const columnasProducto = columnasCampo(false);
  const columnasComponente = columnasCampo(true);

  const errores = []; // { fila, sku, mensaje }
  const skusConError = new Set();
  const nuevos = { unidades: new Map(), componentes: new Map() };
  const grupos = new Map(); // sku normalizado → { sku, filas: [] }

  const anotarNuevo = (tipo, nombre, sku) => {
    const clave = normalizar(nombre);
    const n = nuevos[tipo].get(clave) || { nombre, filasPorSku: new Map() };
    n.filasPorSku.set(sku, (n.filasPorSku.get(sku) || 0) + 1);
    nuevos[tipo].set(clave, n);
  };

  // 1. Validación fila por fila
  for (const f of filas) {
    const v = (clave) => (asignacion[clave] ? f.valores[asignacion[clave]] : "") || "";
    const sku = v("sku").trim();
    const error = (mensaje) => {
      errores.push({ fila: f.fila, sku, mensaje });
      if (sku) skusConError.add(normalizar(sku));
    };
    if (!sku) {
      error("La fila no tiene SKU, así que no se puede saber a qué producto pertenece.");
      continue;
    }

    const faltan = obligatorios.filter((k) => !v(k).trim()).map((k) => etiqueta[k]);
    if (faltan.length) error(faltan.length === 1 ? `Falta el dato obligatorio "${faltan[0]}".` : `Faltan los datos obligatorios: ${faltan.join(", ")}.`);

    const cantidad = leerNumero(v("cantidad"));
    const pesoKg = leerNumero(v("pesoKg"));
    const numero = (dato, valor, n) => {
      if (n === null) error(`${dato} ${citar(valor)} no es un número. Escríbelo solo con dígitos y coma o punto decimal (ej.: 0,25).`);
      else if (!(n > 0)) error(`${dato} ${citar(valor)} debe ser mayor que 0.`);
    };
    if (v("cantidad")) numero("La cantidad", v("cantidad"), cantidad);
    if (v("pesoKg")) numero("El peso (kg)", v("pesoKg"), pesoKg);

    const categoria = categorias.find((c) => normalizar(c) === normalizar(v("categoria")));
    if (v("categoria") && !categoria) {
      error(`La categoría ${citar(v("categoria"))} no es válida en ${gransic.nombre || "tu sistema de gestión"}. Valores permitidos: ${categorias.join(", ")}.`);
    }

    let material;
    if (v("material") && categoria) {
      material = gransic.categorias[categoria].find((m) => normalizar(m) === normalizar(v("material")));
      if (!material) {
        const otra = categorias.find((c) => gransic.categorias[c].some((m) => normalizar(m) === normalizar(v("material"))));
        error(otra
          ? `El material ${citar(v("material"))} no está permitido en la categoría "${categoria}" (sí en "${otra}"). Revisa la categoría o el material.`
          : `El material ${citar(v("material"))} no está en la lista de materiales de ${gransic.nombre || "tu sistema de gestión"}. Usa el nombre exacto de la lista (como aparece en el formulario).`);
      }
    }

    let peligrosidad = null;
    if (tienePeligrosidad && v("peligrosidad")) {
      peligrosidad = PELIGROSIDADES.find((p) => normalizar(p) === normalizar(v("peligrosidad")));
      if (!peligrosidad) error(`La peligrosidad ${citar(v("peligrosidad"))} no es válida. Valores permitidos: Peligroso, No peligroso.`);
    }

    // Unidad, componente y característica: si no existen, son valores nuevos (se crean con autorización).
    const unidad = buscar(catalogos.unidades, v("unidad"))?.nombre || v("unidad").trim();
    const componente = buscar(catalogos.componentes, v("componente"))?.nombre || v("componente").trim();
    const caracteristica = buscar(catalogos.caracteristicas, v("caracteristica"))?.nombre || v("caracteristica").trim();
    if (unidad && !buscar(catalogos.unidades, unidad)) anotarNuevo("unidades", unidad, sku);
    if (componente && !buscar(catalogos.componentes, componente)) anotarNuevo("componentes", componente, sku);
    // La característica es una lista cerrada (como categoría, material y peligrosidad): no se crean valores nuevos.
    if (caracteristica && !buscar(catalogos.caracteristicas, caracteristica)) {
      error(`La característica ${citar(caracteristica)} no es válida. Valores permitidos: ${catalogos.caracteristicas.map((c) => c.nombre).join(", ")}.`);
    }

    const clave = normalizar(sku);
    if (!grupos.has(clave)) grupos.set(clave, { sku, filas: [] });
    grupos.get(clave).filas.push({
      fila: f.fila,
      descripcion: v("descripcion").trim(),
      categoria: categoria || "",
      peligrosidad,
      unidad,
      componente,
      cantidad,
      pesoKg,
      material: material || "",
      caracteristica,
      campos: Object.fromEntries(columnasProducto.map(([nombre, col]) => [nombre, (f.valores[col] || "").trim()])),
      // Vacío = conserva el valor actual: solo se envían los que traen dato.
      camposFila: Object.fromEntries(columnasComponente.map(([nombre, col]) => [nombre, (f.valores[col] || "").trim()]).filter(([, x]) => x)),
    });
  }

  // 2. Coherencia dentro de cada SKU: datos del producto iguales en todas sus filas.
  const coherentes = [["descripcion", "descripción"], ...(tienePeligrosidad ? [["categoria", "categoría"], ["peligrosidad", "peligrosidad"]] : [])];
  for (const g of grupos.values()) {
    for (const [campo, nombre] of coherentes) {
      const primero = g.filas[0][campo];
      for (const f of g.filas.slice(1)) {
        if (normalizar(f[campo]) !== normalizar(primero)) {
          errores.push({
            fila: f.fila,
            sku: g.sku,
            mensaje: `La ${nombre} ${citar(f[campo])} es distinta a la de la fila ${g.filas[0].fila} (${citar(primero)}). Un mismo SKU debe tener la misma ${nombre} en todas sus filas.`,
          });
          skusConError.add(normalizar(g.sku));
        }
      }
    }
    const nombresCampos = Object.keys(g.filas[0].campos);
    for (const nombre of nombresCampos) {
      const valores = [...new Set(g.filas.map((f) => f.campos[nombre]).filter(Boolean))];
      if (valores.length > 1) {
        errores.push({
          fila: g.filas[0].fila,
          sku: g.sku,
          mensaje: `El campo adicional "${nombre}" es del producto (un solo valor por SKU), pero este SKU trae ${valores.length} valores distintos `
            + `(${valores.slice(0, 3).map(citar).join(", ")}${valores.length > 3 ? ", …" : ""}). Deja un solo valor, no cargues esa columna o `
            + `usa un campo del componente.`,
        });
        skusConError.add(normalizar(g.sku));
      }
    }
  }

  // 3. Producto armado y comparación con la matriz actual
  const existentes = new Map(productos.map((p) => [normalizar(p.sku), p]));
  const resultado = [];
  for (const [clave, g] of grupos) {
    const existente = existentes.get(clave);
    if (skusConError.has(clave)) {
      resultado.push({ sku: g.sku, estado: "error", descripcion: g.filas[0].descripcion, existente: !!existente });
      continue;
    }
    const unidades = [];
    for (const f of g.filas) {
      let u = unidades.find((x) => normalizar(x.unidad) === normalizar(f.unidad));
      if (!u) unidades.push((u = { unidad: f.unidad, filas: [] }));
      u.filas.push({
        componente: f.componente, cantidad: f.cantidad, pesoKg: f.pesoKg,
        categoria: tienePeligrosidad ? null : f.categoria, material: f.material, caracteristica: f.caracteristica || null,
        camposAdicionales: f.camposFila,
      });
    }
    // Campos adicionales: un valor vacío en el archivo conserva el actual (no se envía).
    const camposProducto = {};
    for (const nombre of Object.keys(g.filas[0].campos)) {
      const valor = g.filas.map((f) => f.campos[nombre]).find(Boolean);
      if (valor) camposProducto[nombre] = valor;
    }
    const producto = {
      sku: existente?.sku || g.sku,
      descripcion: g.filas[0].descripcion,
      categoria: tienePeligrosidad ? g.filas[0].categoria : null,
      peligrosidad: tienePeligrosidad ? g.filas[0].peligrosidad : null,
      unidades,
      camposAdicionales: camposProducto,
    };
    if (!existente) {
      resultado.push({ sku: producto.sku, estado: "nuevo", descripcion: producto.descripcion, producto, cambios: [] });
      continue;
    }
    // Componentes de la matriz que no vienen en el archivo: la persona decide si se conservan o se eliminan.
    const quitados = componentesQuitados(existente, producto, tienePeligrosidad);
    const item = { sku: producto.sku, descripcion: producto.descripcion, producto, actual: existente, quitados, tienePeligrosidad };
    const cambios = compararProducto(existente, producto, tienePeligrosidad);
    resultado.push({ ...item, estado: cambios.length ? "modificado" : "sinCambios", cambios });
  }

  const contar = (estado) => resultado.filter((r) => r.estado === estado).length;
  // Solo cuentan los SKU que se guardarán: un valor que aparece únicamente en SKU con error no se crea.
  const utiles = (m) => [...m.values()]
    .map((n) => {
      const skus = [...n.filasPorSku.keys()].filter((s) => !skusConError.has(normalizar(s)));
      return { nombre: n.nombre, skus, filas: skus.reduce((t, s) => t + n.filasPorSku.get(s), 0) };
    })
    .filter((n) => n.skus.length);
  return {
    errores: errores.sort((a, b) => a.fila - b.fila),
    nuevosValores: {
      unidades: utiles(nuevos.unidades),
      componentes: utiles(nuevos.componentes),
      campos: crear.map((nombre) => ({ nombre, nivel: niveles[nombre] || "producto" })),
    },
    productos: resultado,
    resumen: { nuevos: contar("nuevo"), modificados: contar("modificado"), sinCambios: contar("sinCambios"), conError: contar("error") },
  };
};

// Resumen por estado de una lista de productos revisados.
export const resumir = (productos) => {
  const contar = (estado) => productos.filter((r) => r.estado === estado).length;
  return { nuevos: contar("nuevo"), modificados: contar("modificado"), sinCambios: contar("sinCambios"), conError: contar("error") };
};

// Fila de la matriz actual en el formato del archivo (para conservarla en la versión nueva).
const filaDelActual = (f, tienePeligrosidad) => ({
  componente: f.componente,
  cantidad: Number(f.cantidad),
  pesoKg: Number(f.pesoKg),
  categoria: tienePeligrosidad ? null : f.categoria,
  material: f.material,
  caracteristica: f.caracteristica || null,
  camposAdicionales: Object.fromEntries((f.camposAdicionales || []).map((c) => [c.nombre, c.valor])),
});

// Filas de la matriz actual que no vienen en el archivo (por unidad; los componentes se emparejan por nombre y en orden).
// Devuelve [{ id, unidad, componente, unidadCompleta, fila }].
const componentesQuitados = (actual, nuevo, tienePeligrosidad) => {
  const quitados = [];
  for (const ua of actual.unidades) {
    const u = nuevo.unidades.find((x) => normalizar(x.unidad) === normalizar(ua.unidad));
    const pendientes = [...ua.filas];
    for (const f of u?.filas || []) {
      const i = pendientes.findIndex((a) => normalizar(a.componente) === normalizar(f.componente));
      if (i >= 0) pendientes.splice(i, 1);
    }
    pendientes.forEach((a, i) => quitados.push({
      id: `${normalizar(ua.unidad)}|${normalizar(a.componente)}|${i}`,
      unidad: ua.unidad,
      componente: a.componente,
      unidadCompleta: !u,
      fila: filaDelActual(a, tienePeligrosidad),
    }));
  }
  return quitados;
};

/**
 * Aplica las decisiones sobre los componentes que no vienen en el archivo: los "conservar" se agregan de nuevo a la
 * versión que se guardará. decisiones: { idQuitado: "conservar" | "eliminar" }. Devuelve el item con producto, cambios y
 * estado recalculados (si se conserva todo y no hay otros cambios, queda "sinCambios").
 */
export const aplicarDecisiones = (item, decisiones) => {
  const conservar = item.quitados.filter((q) => decisiones[q.id] === "conservar");
  if (!conservar.length) return item;
  const unidades = item.producto.unidades.map((u) => ({ ...u, filas: [...u.filas] }));
  for (const q of conservar) {
    let u = unidades.find((x) => normalizar(x.unidad) === normalizar(q.unidad));
    if (!u) unidades.push((u = { unidad: q.unidad, filas: [] }));
    u.filas.push(q.fila);
  }
  const producto = { ...item.producto, unidades };
  const cambios = compararProducto(item.actual, producto, item.tienePeligrosidad);
  return { ...item, producto, cambios, estado: cambios.length ? "modificado" : "sinCambios" };
};

// Diferencias entre la versión vigente y la del archivo, en frases cortas para la persona.
const compararProducto = (actual, nuevo, tienePeligrosidad) => {
  const cambios = [];
  const distinto = (a, b) => normalizar(a) !== normalizar(b);
  if (actual.descripcion.trim() !== nuevo.descripcion) cambios.push(`Descripción: "${actual.descripcion}" → "${nuevo.descripcion}"`);
  if (tienePeligrosidad && distinto(actual.categoria, nuevo.categoria)) cambios.push(`Categoría: ${actual.categoria || "—"} → ${nuevo.categoria}`);
  if (tienePeligrosidad && distinto(actual.peligrosidad, nuevo.peligrosidad)) cambios.push(`Peligrosidad: ${actual.peligrosidad || "—"} → ${nuevo.peligrosidad}`);

  for (const u of nuevo.unidades) {
    const ua = actual.unidades.find((x) => normalizar(x.unidad) === normalizar(u.unidad));
    if (!ua) {
      cambios.push(`Unidad ${u.unidad} agregada (${u.filas.length} componente${u.filas.length > 1 ? "s" : ""})`);
      continue;
    }
    const filasActuales = ua.filas.map((f) => ({ ...f, componente: f.componente, cantidad: Number(f.cantidad), pesoKg: Number(f.pesoKg) }));
    const firmasA = filasActuales.map(firmaFila).sort().join("¦");
    const firmasN = u.filas.map(firmaFila).sort().join("¦");
    const traeCampos = u.filas.some((f) => Object.keys(f.camposAdicionales || {}).length);
    if (firmasA === firmasN && !traeCampos) continue;
    // Detalle por componente (se emparejan por nombre; los repetidos, en orden).
    const pendientes = [...filasActuales];
    for (const f of u.filas) {
      const i = pendientes.findIndex((a) => normalizar(a.componente) === normalizar(f.componente));
      if (i < 0) {
        cambios.push(`${u.unidad}: componente ${f.componente} agregado`);
        continue;
      }
      const a = pendientes.splice(i, 1)[0];
      const det = [];
      if (formatoNum(a.cantidad) !== formatoNum(f.cantidad)) det.push(`cantidad ${formatoNum(a.cantidad)} → ${formatoNum(f.cantidad)}`);
      if (formatoNum(a.pesoKg) !== formatoNum(f.pesoKg)) det.push(`peso ${formatoNum(a.pesoKg)} → ${formatoNum(f.pesoKg)} kg`);
      if (!tienePeligrosidad && distinto(a.categoria, f.categoria)) det.push(`categoría ${a.categoria || "—"} → ${f.categoria}`);
      if (distinto(a.material, f.material)) det.push(`material ${a.material} → ${f.material}`);
      if (distinto(a.caracteristica, f.caracteristica)) det.push(`característica ${a.caracteristica || "—"} → ${f.caracteristica || "—"}`);
      for (const [nombre, valor] of Object.entries(f.camposAdicionales || {})) {
        const anterior = (a.camposAdicionales || []).find((c) => normalizar(c.nombre) === normalizar(nombre))?.valor || "";
        if (anterior !== valor) det.push(`${nombre} ${anterior ? `"${anterior}"` : "—"} → "${valor}"`);
      }
      if (det.length) cambios.push(`${u.unidad} · ${f.componente}: ${det.join(", ")}`);
    }
    for (const a of pendientes) cambios.push(`${u.unidad}: componente ${a.componente} quitado`);
  }
  for (const ua of actual.unidades) {
    if (!nuevo.unidades.some((u) => normalizar(u.unidad) === normalizar(ua.unidad))) cambios.push(`Unidad ${ua.unidad} quitada`);
  }

  for (const [nombre, valor] of Object.entries(nuevo.camposAdicionales)) {
    const anterior = (actual.camposAdicionales || []).find((c) => normalizar(c.nombre) === normalizar(nombre))?.valor || "";
    if (anterior !== valor) cambios.push(`${nombre}: ${anterior ? `"${anterior}"` : "—"} → "${valor}"`);
  }
  return cambios;
};
