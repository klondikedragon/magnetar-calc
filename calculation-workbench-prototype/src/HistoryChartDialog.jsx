import { useEffect, useMemo, useRef, useState } from "react";
import { ChartNoAxesCombined, Info, Layers3, X } from "lucide-react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { formatAutomatically } from "./engine.js";
import { prepareHistoryChart } from "./historyChart.js";

echarts.use([CanvasRenderer, DataZoomComponent, GridComponent, LineChart, TooltipComponent]);

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function compactAxisNumber(value) {
  if (Math.abs(value) >= 1e6 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) return Number(value).toExponential(2).replace("e+", "e");
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default function HistoryChartDialog({ history, base, precision, notation, groupDigits, onClose, onInspect }) {
  const chartElementRef = useRef(null);
  const chartRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [scale, setScale] = useState("auto");
  const chart = useMemo(() => prepareHistoryChart(history, scale), [history, scale]);
  const renderValue = (item) => formatAutomatically(item.value, { base, precision, notation, groupDigits }).text;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    };
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const element = chartElementRef.current;
    if (!element) return undefined;
    const instance = echarts.init(element, undefined, { renderer: "canvas" });
    chartRef.current = instance;
    const seriesData = chart.points.map((point) => [point.position, point.y]);
    instance.setOption({
      animationDuration: 180,
      grid: { top: 24, right: 25, bottom: 44, left: 66, containLabel: true },
      tooltip: {
        trigger: "axis",
        confine: true,
        formatter: (params) => {
          const point = chart.points[params[0]?.dataIndex];
          if (!point || point.y === null) return "";
          return `<b>History #${point.item.id}</b><br/>${escapeHtml(point.item.expression)}<br/><span>${escapeHtml(renderValue(point.item))}</span>`;
        },
      },
      dataZoom: history.length > 16 ? [{ type: "inside", xAxisIndex: 0 }, { type: "slider", xAxisIndex: 0, height: 16, bottom: 2, borderColor: "#d9ddd3", fillerColor: "rgba(183,216,82,.18)", handleSize: 0, moveHandleSize: 0 }] : [],
      xAxis: {
        type: "value", min: 1, max: Math.max(1, history.length), interval: 1, name: "chronological History position", nameLocation: "middle", nameGap: 25,
        axisLabel: { formatter: (position) => Number.isInteger(position) ? String(position) : "", color: "#718083", fontSize: 10 },
        axisLine: { lineStyle: { color: "#cfd6c9" } }, splitLine: { show: false },
      },
      yAxis: {
        type: "value", name: chart.selectedScale === "log" ? "log₁₀(value)" : "value", nameLocation: "middle", nameGap: 47,
        axisLabel: { color: "#718083", fontSize: 10, formatter: chart.selectedScale === "log" ? (value) => `10^${compactAxisNumber(value)}` : compactAxisNumber },
        axisLine: { lineStyle: { color: "#cfd6c9" } }, splitLine: { lineStyle: { color: "#edf0e9" } },
      },
      series: [{ type: "line", data: seriesData, connectNulls: false, showSymbol: true, symbolSize: 7, lineStyle: { color: "#91aa3d", width: 2 }, itemStyle: { color: "#5e7620", borderColor: "#fffefa", borderWidth: 1 }, emphasis: { focus: "series" } }],
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(element);
    const handleClick = (params) => {
      const point = chart.points[params.dataIndex];
      if (point?.y !== null) onInspect(point.item);
    };
    instance.on("click", handleClick);
    return () => { resize.disconnect(); instance.dispose(); chartRef.current = null; };
  }, [chart, history.length, onInspect, renderValue]);

  return <div className="history-chart-overlay" role="dialog" aria-modal="true" aria-labelledby="history-chart-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="history-chart-card">
      <header className="history-chart-header">
        <div><p className="eyebrow">HISTORY CHART</p><h2 id="history-chart-title">Calculated values over time</h2></div>
        <button className="quiet chart-close" ref={closeButtonRef} onClick={onClose} aria-label="Close History chart" title="Close"><X size={17} /></button>
      </header>
      <div className="history-chart-controls">
        <div className="chart-scale-switch" aria-label="Vertical scale">
          <button className={scale === "auto" ? "selected" : ""} onClick={() => setScale("auto")}>Auto</button>
          <button className={scale === "linear" ? "selected" : ""} disabled={!chart.supportsLinear} onClick={() => setScale("linear")}>Linear</button>
          <button className={scale === "log" ? "selected" : ""} disabled={!chart.supportsLog} onClick={() => setScale("log")}>Log</button>
        </div>
        <p>{scale === "auto" ? `Auto selected ${chart.automaticScale}.` : `${chart.selectedScale === "log" ? "Logarithmic" : "Linear"} scale.`} Click a plotted point for its full information.</p>
      </div>
      {history.length ? <><div className="history-chart-plot" ref={chartElementRef} />
        {chart.markers.length > 0 && <section className="history-chart-markers" aria-label="Unplotted History values"><p><Layers3 size={14} /> {chart.markers.length} unplotted value{chart.markers.length === 1 ? "" : "s"}</p><div>{chart.markers.map((point) => <button key={point.item.id} onClick={() => onInspect(point.item)} title={`History #${point.item.id}: ${point.reason}. Open full information.`}><Info size={13} /><span>#{point.item.id}</span></button>)}</div><small>Structural or otherwise non-plottable values are marked here rather than assigned an invented coordinate.</small></section>
        }</> : <div className="history-chart-empty"><ChartNoAxesCombined size={24} /><p>Save calculations to History before charting them.</p></div>}
    </section>
  </div>;
}
