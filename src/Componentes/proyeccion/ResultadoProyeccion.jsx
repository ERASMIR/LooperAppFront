import React, { useMemo, useState } from "react";
import { CheckCircle2, Link2, Info } from "lucide-react";
import { Indicador, Indicadores } from "../Indicador.jsx";
import { nombrePeriodo } from "../ventasRevision.js";
import GraficoProyeccion from "./GraficoProyeccion.jsx";
import MatrizCorrelacion from "./MatrizCorrelacion.jsx";
import { capitalizar, formatoPct, formatoTon, mesCorto, totalSerie } from "./proyeccionComun.js";

// Resultado de una proyección (la recién calculada o una guardada en el historial): resumen, tabla por material y mes
// con la sensibilidad, gráfico real vs. proyectado y cuadro de correlación entre materiales.
const TOTAL = "__total__";

const Coherencia = ({ c }) => (c.estado === "ajustado" ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-xs text-yellow-900"
    title={`Proyección individual fuera de la relación histórica con ${c.con} (r = ${c.r.toFixed(2)}): se ajustó hacia esa relación.`}>
    <Link2 className="w-3.5 h-3.5" aria-hidden="true" /> Ajustado
  </span>
) : (
  <span className="inline-flex items-center gap-1 text-xs text-neutral-600"
    title={c.con ? `Dentro de la relación histórica con ${c.con} (r = ${c.r.toFixed(2)}).` : "Sin un material con relación fuerte."}>
    <CheckCircle2 className="w-3.5 h-3.5 text-primary-dark" aria-hidden="true" /> Coherente
  </span>
));

const ResultadoProyeccion = ({ resultado }) => {
  const [clasificacion, setClasificacion] = useState("");
  const [grafico, setGrafico] = useState(TOTAL);
  // Clasificaciones (domiciliario / no domiciliario…) según lo declarado.
  const clasificaciones = useMemo(() => [["", "Todas"], ...[...new Set(resultado.series.map((s) => s.categoria))].map((c) => [c, capitalizar(c)])], [resultado]);
  const series = useMemo(() => resultado.series.filter((s) => !clasificacion || s.categoria === clasificacion), [resultado, clasificacion]);
  const meses = useMemo(() => resultado.series[0]?.proyeccion || [], [resultado]);

  // Total de los materiales visibles (según la clasificación elegida), mes a mes.
  const total = useMemo(() => {
    const sumaProy = (i, k) => series.reduce((n, s) => n + s.proyeccion[i][k], 0);
    const real = (resultado.series[0]?.real || []).map((r, i) => ({ ...r, valor: series.reduce((n, s) => n + s.real[i].valor, 0) }));
    const proyeccion = meses.map((m, i) => ({ ...m, valor: sumaProy(i, "valor"), bajo: sumaProy(i, "bajo"), alto: sumaProy(i, "alto") }));
    return { real, proyeccion };
  }, [resultado, series, meses]);
  const totalHorizonte = totalSerie({ proyeccion: total.proyeccion });
  const ajustados = series.filter((s) => s.coherencia.estado === "ajustado").length;
  const elegida = grafico === TOTAL ? { ...total, etiqueta: "Total de los materiales" } : resultado.series.find((s) => s.id === grafico);

  return (
    <div className="space-y-6">
      <Indicadores>
        <Indicador etiqueta="Meses de historia" valor={resultado.historia.meses} ayuda={`${nombrePeriodo(resultado.historia.desde)} a ${nombrePeriodo(resultado.historia.hasta)}`} />
        <Indicador etiqueta="Materiales proyectados" valor={series.length} />
        <Indicador etiqueta={`Total proyectado (${resultado.horizonte} ${resultado.horizonte === 1 ? "mes" : "meses"}, t)`} valor={`${formatoTon(totalHorizonte.valor)} ± ${formatoPct(totalHorizonte.pct)}`} tono="correcto" />
        <Indicador etiqueta="Ajustados por coherencia" valor={ajustados} tono="atencion" ayuda="Materiales cuya proyección se corrigió para respetar su relación con otro material" />
      </Indicadores>

      <div className="flex flex-wrap items-center gap-2">
        {clasificaciones.map(([v, l]) => (
          <button key={v || "todas"} onClick={() => setClasificacion(v)} aria-pressed={clasificacion === v} className={`chip ${clasificacion === v ? "chip-activo" : ""}`}>{l}</button>
        ))}
      </div>

      <section>
        <h2 className="font-semibold text-neutral-800 mb-2">Toneladas proyectadas por material</h2>
        <div className="overflow-x-auto border rounded-xl">
          <table className="text-sm min-w-full">
            <thead className="bg-neutral-50 text-neutral-600 text-left">
              <tr>
                <th className="p-2 font-semibold min-w-[16rem]">Material</th>
                <th className="p-2 font-semibold">Clasificación</th>
                {meses.map((m) => <th key={`${m.anio}-${m.mes}`} className="p-2 font-semibold text-right whitespace-nowrap">{mesCorto(m)}</th>)}
                <th className="p-2 font-semibold text-right">Total</th>
                <th className="p-2 font-semibold text-right whitespace-nowrap" title="Banda del 80 %: rango bajo – alto del total del horizonte">Sensibilidad</th>
                <th className="p-2 font-semibold">Coherencia</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const t = totalSerie(s);
                return (
                  <tr key={s.id} className="border-t align-top hover:bg-neutral-50">
                    <td className="p-2">
                      <button onClick={() => setGrafico(s.id)} className="text-left font-medium text-neutral-800 hover:text-primary-dark hover:underline">{s.material}</button>
                      <div className="text-xs text-neutral-500">{s.metodo}</div>
                    </td>
                    <td className="p-2 text-neutral-700 whitespace-nowrap">{capitalizar(s.categoria)}{s.peligrosidad ? <div className="text-xs text-neutral-500">{s.peligrosidad}</div> : null}</td>
                    {s.proyeccion.map((p) => (
                      <td key={`${p.anio}-${p.mes}`} className="p-2 text-right tabular-nums whitespace-nowrap" title={`Rango: ${formatoTon(p.bajo)} – ${formatoTon(p.alto)} t${p.original != null ? ` · sin ajuste: ${formatoTon(p.original)} t` : ""}`}>
                        {formatoTon(p.valor)}
                      </td>
                    ))}
                    <td className="p-2 text-right tabular-nums font-semibold whitespace-nowrap">{formatoTon(t.valor)}</td>
                    <td className="p-2 text-right tabular-nums whitespace-nowrap">
                      ± {formatoPct(t.pct)}
                      <div className="text-xs text-neutral-500">{formatoTon(t.bajo)} – {formatoTon(t.alto)}</div>
                    </td>
                    <td className="p-2"><Coherencia c={s.coherencia} /></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 bg-neutral-50 font-semibold">
              <tr>
                <td className="p-2" colSpan={2}>Total</td>
                {total.proyeccion.map((p) => <td key={`${p.anio}-${p.mes}`} className="p-2 text-right tabular-nums whitespace-nowrap">{formatoTon(p.valor)}</td>)}
                <td className="p-2 text-right tabular-nums whitespace-nowrap">{formatoTon(totalHorizonte.valor)}</td>
                <td className="p-2 text-right tabular-nums whitespace-nowrap">± {formatoPct(totalHorizonte.pct)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-600 flex items-start gap-1">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
          Toneladas. Sensibilidad: rango probable (80 %) del total del horizonte, según el error del modelo al proyectar los últimos meses ya
          conocidos; pasa el mouse por un mes para ver su rango.{resultado.historia.meses < 12 ? " Con menos de 12 meses de historia la proyección no considera estacionalidad." : ""}
        </p>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold text-neutral-800">Tendencia: real y proyectado</h2>
          <label className="text-sm text-neutral-700 flex items-center gap-2">
            Ver
            <select value={grafico} onChange={(e) => setGrafico(e.target.value)} className="campo py-1.5 max-w-xs">
              <option value={TOTAL}>Total de los materiales</option>
              {resultado.series.map((s) => <option key={s.id} value={s.id}>{s.etiqueta}</option>)}
            </select>
          </label>
        </div>
        <div className="border rounded-xl p-4">
          <GraficoProyeccion real={elegida.real} proyeccion={elegida.proyeccion} titulo={elegida.etiqueta} />
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-neutral-800 mb-1">Correlación entre materiales</h2>
        <p className="text-sm text-neutral-600 mb-2">
          Cuánto se mueven juntos los materiales mes a mes (1 = siempre juntos). Si un material tiene una relación fuerte con otro, su proyección
          no puede alejarse de la proporción histórica entre ambos.
        </p>
        <MatrizCorrelacion correlacion={resultado.correlacion} />
      </section>
    </div>
  );
};

export default ResultadoProyeccion;
