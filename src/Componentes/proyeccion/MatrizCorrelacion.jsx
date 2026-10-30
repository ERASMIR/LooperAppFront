import React from "react";
import { fuerza } from "./proyeccionComun.js";

// Cuadro de correlación entre materiales (Spearman, mes a mes): filas con el nombre completo y columnas numeradas para
// que quepa. El color indica la fuerza: fuerte (≥ 0,8), media (0,6–0,8), débil. Las relaciones fuertes son las que
// restringen la proyección (coherencia entre materiales).
const COLOR = {
  fuerte: "bg-primary-dark text-white",
  media: "bg-green-100 text-green-900",
  débil: "bg-white text-neutral-500",
};
const formato = (r) => r.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MatrizCorrelacion = ({ correlacion }) => {
  const { etiquetas, matriz } = correlacion;
  return (
    <div>
      <div className="overflow-x-auto border rounded-xl">
        <table className="text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="p-2 text-left font-semibold">Material</th>
              {etiquetas.map((e, j) => (
                <th key={j} className="p-2 w-14 text-center font-semibold" title={e} scope="col">
                  <span aria-hidden="true">{j + 1}</span>
                  <span className="sr-only">{e}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {etiquetas.map((e, i) => (
              <tr key={i} className="border-t">
                <th scope="row" className="p-2 text-left font-normal text-neutral-800 max-w-xs">
                  <span className="text-neutral-500 tabular-nums mr-1">{i + 1}.</span>{e}
                </th>
                {matriz[i].map((r, j) => (
                  <td key={j} className={`p-2 text-center tabular-nums ${i === j ? "bg-neutral-100 text-neutral-500" : COLOR[r > 0 ? fuerza(r) : "débil"]}`}
                    title={i === j ? undefined : `${etiquetas[i]} y ${etiquetas[j]}: r = ${formato(r)} (${fuerza(r)}${r < 0 ? ", inversa: cuando uno sube el otro baja" : ""})`}>
                    {i === j ? "—" : formato(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1 bg-primary-dark" />Fuerte (≥ 0,80): restringe la proyección</span>
        <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1 bg-green-100 border border-green-200" />Media (0,60–0,79)</span>
        <span><span className="inline-block w-3 h-3 rounded-sm align-middle mr-1 bg-white border border-neutral-300" />Débil (&lt; 0,60) o inversa (negativa)</span>
      </p>
    </div>
  );
};

export default MatrizCorrelacion;
