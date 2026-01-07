import { useState, useRef, useMemo } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Upload, FileSpreadsheet, Calendar, BarChart3, Download, 
  FileText, Search, Loader2, TrendingUp, Building, Truck,
  DollarSign, ClipboardList, FileDown, ChevronDown
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { apiRequest } from "@/lib/queryClient";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from "recharts";

interface GranjaViajes {
  granja: string;
  viajes: number;
  hojas: string[];
}

interface DespachoResumen {
  fecha: string;
  totalManifiestos: number;
  totalRemesas: number;
  granjas: { [key: string]: number };
  totalFlete: number;
}

interface DespachoDetalle {
  fecha: string;
  nombre: string;
  placa: string;
  cedula: string;
  conductor: string;
  granja: string;
  planta: string;
  flete: number;
  cantidadCargada: number;
  titular: string;
  tipoTitular: string;
  estado: string;
  idManifiesto: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c43', '#665191', '#a05195'];

export default function Facturacion() {
  const [activeTab, setActiveTab] = useState("excel");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Excel upload state
  const [excelData, setExcelData] = useState<GranjaViajes[]>([]);
  const [totalHojas, setTotalHojas] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Date range state
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Reports state
  const [resumenData, setResumenData] = useState<DespachoResumen[]>([]);
  const [detalleData, setDetalleData] = useState<DespachoDetalle[]>([]);
  const [granjasTotales, setGranjasTotales] = useState<{ granja: string; viajes: number; flete: number; cantidad: number }[]>([]);
  
  // Pre-factura state
  const preFacturaFileInputRef = useRef<HTMLInputElement>(null);
  const [preFacturaAllData, setPreFacturaAllData] = useState<{ sheetName: string; day: number; month: string; monthNum: number; rowCount: number }[]>([]);
  const [preFacturaItems, setPreFacturaItems] = useState<{ item: number; descripcion: string; cantidad: number }[]>([]);
  const [isLoadingPreFactura, setIsLoadingPreFactura] = useState(false);
  const [preFacturaFileName, setPreFacturaFileName] = useState("");
  const [preFacturaTotal, setPreFacturaTotal] = useState(0);
  const [preFacturaFechaInicio, setPreFacturaFechaInicio] = useState("");
  const [preFacturaFechaFin, setPreFacturaFechaFin] = useState("");
  
  // Process Excel file with multiple sheets
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setFileName(file.name);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      
      const sheetNames = workbook.SheetNames;
      setTotalHojas(sheetNames.length);
      
      // Count occurrences of each granja across all sheets
      const granjaCount: { [key: string]: { count: number; hojas: string[] } } = {};
      
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Look for granja column (usually named "GRANJA", "Granja", or similar)
        if (jsonData.length > 0) {
          const headerRow = jsonData[0] as string[];
          const granjaIndex = headerRow.findIndex(h => 
            h && typeof h === 'string' && 
            (h.toUpperCase().includes('GRANJA') || h.toUpperCase().includes('DESTINO') || h.toUpperCase().includes('FARM'))
          );
          
          if (granjaIndex >= 0) {
            for (let i = 1; i < jsonData.length; i++) {
              const granja = jsonData[i]?.[granjaIndex];
              if (granja && typeof granja === 'string' && granja.trim()) {
                const granjaName = granja.trim().toUpperCase();
                if (!granjaCount[granjaName]) {
                  granjaCount[granjaName] = { count: 0, hojas: [] };
                }
                granjaCount[granjaName].count++;
                if (!granjaCount[granjaName].hojas.includes(sheetName)) {
                  granjaCount[granjaName].hojas.push(sheetName);
                }
              }
            }
          } else {
            // If no granja column found, count the sheet name itself
            const sheetGranja = sheetName.toUpperCase();
            if (!granjaCount[sheetGranja]) {
              granjaCount[sheetGranja] = { count: 0, hojas: [] };
            }
            granjaCount[sheetGranja].count++;
            granjaCount[sheetGranja].hojas.push(sheetName);
          }
        }
      }
      
      // Convert to array and sort by count
      const result: GranjaViajes[] = Object.entries(granjaCount)
        .map(([granja, data]) => ({
          granja,
          viajes: data.count, // Count total rows/trips per granja
          hojas: data.hojas
        }))
        .sort((a, b) => b.viajes - a.viajes);
      
      setExcelData(result);
      toast({ title: "Excel procesado", description: `${sheetNames.length} hojas analizadas` });
    } catch (error) {
      toast({ title: "Error", description: "Error al procesar el archivo Excel", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Fetch despachos data for date range
  const fetchDespachosReport = async () => {
    if (!fechaInicio || !fechaFin) {
      toast({ title: "Error", description: "Seleccione rango de fechas", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await apiRequest("GET", `/api/despachos`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || "Error al cargar despachos");
      }
      
      // Filter by date range using string comparison (YYYY-MM-DD format)
      const filteredDespachos = result.despachos.filter((d: any) => {
        if (!d.fecha) return false;
        // Compare dates as strings (YYYY-MM-DD format allows string comparison)
        return d.fecha >= fechaInicio && d.fecha <= fechaFin;
      });
      
      // Generate summary by date
      const resumenByDate: { [key: string]: DespachoResumen } = {};
      const detalles: DespachoDetalle[] = [];
      const granjasTotalesMap: { [key: string]: { viajes: number; flete: number; cantidad: number } } = {};
      
      for (const despacho of filteredDespachos) {
        const fecha = despacho.fecha;
        
        if (!resumenByDate[fecha]) {
          resumenByDate[fecha] = {
            fecha,
            totalManifiestos: 0,
            totalRemesas: 0,
            granjas: {},
            totalFlete: 0
          };
        }
        
        // Process manifiestos
        if (despacho.manifiestos && Array.isArray(despacho.manifiestos)) {
          const successManifiestos = despacho.manifiestos.filter((m: any) => m.status === "success");
          resumenByDate[fecha].totalManifiestos += successManifiestos.length;
        }
        
        // Process remesas
        if (despacho.remesas && Array.isArray(despacho.remesas)) {
          const successRemesas = despacho.remesas.filter((r: any) => r.status === "success");
          resumenByDate[fecha].totalRemesas += successRemesas.length;
          
          for (const remesa of successRemesas) {
            resumenByDate[fecha].totalFlete += remesa.valorFlete || 0;
          }
        }
        
        // Process rows for details
        if (despacho.rows && Array.isArray(despacho.rows)) {
          for (const row of despacho.rows) {
            const granja = row.granja || "Sin Granja";
            
            // Add to granjas count
            if (!resumenByDate[fecha].granjas[granja]) {
              resumenByDate[fecha].granjas[granja] = 0;
            }
            resumenByDate[fecha].granjas[granja]++;
            
            // Add to totales
            if (!granjasTotalesMap[granja]) {
              granjasTotalesMap[granja] = { viajes: 0, flete: 0, cantidad: 0 };
            }
            granjasTotalesMap[granja].viajes++;
            
            // Find corresponding remesa/manifiesto for this row
            const remesa = despacho.remesas?.find((r: any) => r.placa === row.placa && r.cedula === row.cedula);
            const manifiesto = despacho.manifiestos?.find((m: any) => m.placa === row.placa && m.cedula === row.cedula);
            
            const flete = remesa?.valorFlete || 0;
            const cantidadCargada = parseFloat(remesa?.cantidadCargada || "0") || 0;
            granjasTotalesMap[granja].flete += flete;
            granjasTotalesMap[granja].cantidad += cantidadCargada;
            
            // Add detail row
            detalles.push({
              fecha,
              nombre: despacho.nombre,
              placa: row.placa,
              cedula: row.cedula,
              conductor: row.cedulaData?.nombre || row.cedula,
              granja,
              planta: row.planta || "",
              flete,
              cantidadCargada,
              titular: manifiesto?.numIdTitular || "",
              tipoTitular: manifiesto?.tipoIdTitular || "",
              estado: manifiesto?.status === "success" ? "Exitoso" : (manifiesto?.status === "error" ? "Error" : "Pendiente"),
              idManifiesto: manifiesto?.idManifiesto || manifiesto?.responseCode || ""
            });
          }
        }
      }
      
      // Convert to arrays
      setResumenData(Object.values(resumenByDate).sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setDetalleData(detalles);
      setGranjasTotales(
        Object.entries(granjasTotalesMap)
          .map(([granja, data]) => ({ granja, ...data }))
          .sort((a, b) => b.viajes - a.viajes)
      );
      
      toast({ 
        title: "Reporte generado", 
        description: `${filteredDespachos.length} despachos encontrados en el período` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Error al generar el reporte", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Export to Excel
  const exportExcelReport = () => {
    if (excelData.length === 0) {
      toast({ title: "Error", description: "No hay datos para exportar", variant: "destructive" });
      return;
    }
    
    const ws = XLSX.utils.json_to_sheet(excelData.map(g => ({
      Granja: g.granja,
      "Cantidad de Viajes": g.viajes,
      "Hojas/Días": g.hojas.join(", ")
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Viajes por Granja");
    XLSX.writeFile(wb, `Informe_Viajes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  const exportDespachosResumen = () => {
    if (granjasTotales.length === 0) {
      toast({ title: "Error", description: "No hay datos para exportar", variant: "destructive" });
      return;
    }
    
    // Sheet 1: Resumen por granja
    const wsResumen = XLSX.utils.json_to_sheet(granjasTotales.map(g => ({
      Granja: g.granja,
      "Total Viajes": g.viajes,
      "Total Flete": g.flete
    })));
    
    // Sheet 2: Detalle diario
    const wsDetalle = XLSX.utils.json_to_sheet(detalleData.map(d => ({
      Fecha: d.fecha,
      Despacho: d.nombre,
      Placa: d.placa,
      "Cédula Conductor": d.cedula,
      Conductor: d.conductor,
      Granja: d.granja,
      Planta: d.planta,
      "Valor Flete": d.flete,
      "ID Titular": d.titular,
      "Tipo Titular": d.tipoTitular,
      Estado: d.estado,
      "ID Manifiesto": d.idManifiesto
    })));
    
    // Sheet 3: Resumen por fecha
    const wsFechas = XLSX.utils.json_to_sheet(resumenData.map(r => ({
      Fecha: r.fecha,
      "Total Manifiestos": r.totalManifiestos,
      "Total Remesas": r.totalRemesas,
      "Total Flete": r.totalFlete
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Granjas");
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Diario");
    XLSX.utils.book_append_sheet(wb, wsFechas, "Resumen Fechas");
    XLSX.writeFile(wb, `Facturacion_${fechaInicio}_${fechaFin}.xlsx`);
  };
  
  const totalViajes = excelData.reduce((sum, g) => sum + g.viajes, 0);
  const totalFleteGeneral = granjasTotales.reduce((sum, g) => sum + g.flete, 0);
  const totalViajesDespachos = granjasTotales.reduce((sum, g) => sum + g.viajes, 0);
  const totalCantidadGeneral = granjasTotales.reduce((sum, g) => sum + g.cantidad, 0);
  const totalToneladas = totalCantidadGeneral / 1000;
  const totalBultos = totalCantidadGeneral / 40;
  
  const detalleDataPorFecha = useMemo(() => {
    const grouped: { [fecha: string]: DespachoDetalle[] } = {};
    for (const item of detalleData) {
      if (!grouped[item.fecha]) {
        grouped[item.fecha] = [];
      }
      grouped[item.fecha].push(item);
    }
    return Object.entries(grouped).sort((a, b) => {
      const dateA = new Date(a[0].split('/').reverse().join('-'));
      const dateB = new Date(b[0].split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
  }, [detalleData]);
  
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("INFORME DE DESPACHOS", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Período: ${fechaInicio} al ${fechaFin}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 10;
    
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - margin * 2, 20, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const summaryY = yPos + 7;
    doc.text(`Granjas: ${granjasTotales.length}`, margin + 10, summaryY);
    doc.text(`Total Viajes: ${totalViajesDespachos}`, margin + 50, summaryY);
    doc.text(`Total Manifiestos: ${resumenData.reduce((sum, r) => sum + r.totalManifiestos, 0)}`, margin + 100, summaryY);
    doc.text(`Total: ${totalToneladas.toFixed(2)} Ton (${Math.round(totalBultos)} bultos)`, margin + 160, summaryY);
    yPos += 25;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN POR GRANJA", margin, yPos);
    yPos += 6;
    
    doc.setFontSize(8);
    const colWidths = [10, 80, 30, 50];
    const headers = ["#", "Granja (Centro de Costo)", "Viajes", "Cantidad (Ton)"];
    doc.setFillColor(66, 139, 202);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos, pageWidth - margin * 2, 6, "F");
    let xPos = margin + 2;
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos + 4);
      xPos += colWidths[i];
    });
    yPos += 6;
    
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    granjasTotales.forEach((item, index) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = margin;
      }
      const bgColor = index % 2 === 0 ? 255 : 245;
      doc.setFillColor(bgColor, bgColor, bgColor);
      doc.rect(margin, yPos, pageWidth - margin * 2, 5, "F");
      xPos = margin + 2;
      doc.text(String(index + 1), xPos, yPos + 3.5);
      xPos += colWidths[0];
      doc.text(item.granja.substring(0, 40), xPos, yPos + 3.5);
      xPos += colWidths[1];
      doc.text(String(item.viajes), xPos, yPos + 3.5);
      xPos += colWidths[2];
      const itemToneladas = item.cantidad / 1000;
      doc.text(`${itemToneladas.toFixed(2)} Ton`, xPos, yPos + 3.5);
      yPos += 5;
    });
    
    doc.setFont("helvetica", "bold");
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, yPos, pageWidth - margin * 2, 6, "F");
    xPos = margin + 2;
    doc.text("", xPos, yPos + 4);
    xPos += colWidths[0];
    doc.text("TOTAL", xPos, yPos + 4);
    xPos += colWidths[1];
    doc.text(String(totalViajesDespachos), xPos, yPos + 4);
    xPos += colWidths[2];
    doc.text(`${totalToneladas.toFixed(2)} Ton`, xPos, yPos + 4);
    yPos += 12;
    
    for (const [fecha, items] of detalleDataPorFecha) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      }
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const fechaCantidad = items.reduce((sum, i) => sum + i.cantidadCargada, 0);
      const fechaToneladas = fechaCantidad / 1000;
      doc.text(`DESPACHOS DEL ${fecha} - ${items.length} viajes - ${fechaToneladas.toFixed(2)} Ton (${Math.round(fechaCantidad / 40)} bultos)`, margin, yPos);
      yPos += 6;
      
      doc.setFontSize(7);
      const detColWidths = [20, 20, 40, 30, 30, 25, 30, 18, 22];
      const detHeaders = ["Fecha", "Placa", "Conductor", "Granja", "Planta", "Cantidad", "Titular", "Estado", "Manifiesto"];
      doc.setFillColor(100, 100, 100);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, yPos, pageWidth - margin * 2, 5, "F");
      xPos = margin + 1;
      detHeaders.forEach((header, i) => {
        doc.text(header, xPos, yPos + 3.5);
        xPos += detColWidths[i];
      });
      yPos += 5;
      
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      items.forEach((item, index) => {
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = margin;
        }
        const bgColor = index % 2 === 0 ? 255 : 248;
        doc.setFillColor(bgColor, bgColor, bgColor);
        doc.rect(margin, yPos, pageWidth - margin * 2, 4.5, "F");
        xPos = margin + 1;
        doc.text(item.fecha, xPos, yPos + 3);
        xPos += detColWidths[0];
        doc.text(item.placa, xPos, yPos + 3);
        xPos += detColWidths[1];
        doc.text(item.conductor.substring(0, 22), xPos, yPos + 3);
        xPos += detColWidths[2];
        doc.text(item.granja.substring(0, 18), xPos, yPos + 3);
        xPos += detColWidths[3];
        doc.text(item.planta.substring(0, 18), xPos, yPos + 3);
        xPos += detColWidths[4];
        const itemTon = item.cantidadCargada / 1000;
        doc.text(`${itemTon.toFixed(2)} Ton`, xPos, yPos + 3);
        xPos += detColWidths[5];
        doc.text(`${item.tipoTitular === "C" ? "CC" : "NIT"}: ${item.titular.substring(0, 12)}`, xPos, yPos + 3);
        xPos += detColWidths[6];
        doc.text(item.estado.substring(0, 10), xPos, yPos + 3);
        xPos += detColWidths[7];
        doc.text(item.idManifiesto.substring(0, 12), xPos, yPos + 3);
        yPos += 4.5;
      });
      yPos += 5;
    }
    
    const fileName = `informe_despachos_${fechaInicio.replace(/-/g, "")}_${fechaFin.replace(/-/g, "")}.pdf`;
    doc.save(fileName);
    toast({ title: "PDF exportado", description: fileName });
  };
  
  // Generate pre-factura from Excel file
  const handlePreFacturaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsLoadingPreFactura(true);
    setPreFacturaFileName(file.name);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      
      const sheetNames = workbook.SheetNames;
      
      // Parse each sheet name to extract date and count rows
      const sheetData: { sheetName: string; day: number; month: string; monthNum: number; rowCount: number }[] = [];
      
      const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", 
                      "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Count data rows (excluding header)
        const rowCount = jsonData.length > 1 ? jsonData.length - 1 : 0;
        
        if (rowCount === 0) continue;
        
        // Try to extract date from sheet name (formats: "16 DICIEMBRE", "16-DIC", "2025-12-16", etc.)
        let day = 0;
        let monthName = "";
        let monthNum = 0;
        
        // Try format: "16 DICIEMBRE" or "16 DIC"
        const dateMatch = sheetName.match(/(\d{1,2})\s*[-_]?\s*([A-Za-z]+)/i);
        if (dateMatch) {
          day = parseInt(dateMatch[1], 10);
          const monthPart = dateMatch[2].toUpperCase();
          // Find matching month
          monthNum = months.findIndex(m => m.startsWith(monthPart.substring(0, 3))) + 1;
          monthName = monthNum > 0 ? months[monthNum - 1] : monthPart;
        } else {
          // Try format: "2025-12-16"
          const isoMatch = sheetName.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) {
            day = parseInt(isoMatch[3], 10);
            monthNum = parseInt(isoMatch[2], 10);
            monthName = months[monthNum - 1];
          } else {
            // Use sheet name as-is for description
            day = 0;
            monthName = sheetName.toUpperCase();
            monthNum = 0;
          }
        }
        
        sheetData.push({ sheetName, day, month: monthName, monthNum, rowCount });
      }
      
      // Sort by month then day
      sheetData.sort((a, b) => {
        if (a.monthNum !== b.monthNum) return a.monthNum - b.monthNum;
        return a.day - b.day;
      });
      
      // Store all data for filtering
      setPreFacturaAllData(sheetData);
      
      // Generate items from all data
      applyPreFacturaFilter(sheetData, "", "");
      
      toast({ 
        title: "Excel cargado", 
        description: `${sheetData.length} días encontrados. Use los filtros de fecha si desea limitar el reporte.` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Error al procesar el archivo Excel", variant: "destructive" });
    } finally {
      setIsLoadingPreFactura(false);
    }
  };
  
  // Apply date filter to pre-factura data
  const applyPreFacturaFilter = (data: typeof preFacturaAllData, startDay: string, endDay: string) => {
    let filteredData = [...data];
    
    // Parse start and end as day numbers (assumes same month for simplicity)
    const startDayNum = startDay ? parseInt(startDay, 10) : 0;
    const endDayNum = endDay ? parseInt(endDay, 10) : 31;
    
    if (startDayNum > 0 || endDayNum < 31) {
      filteredData = data.filter(sheet => {
        if (sheet.day === 0) return true; // Include sheets without parsed dates
        return sheet.day >= startDayNum && sheet.day <= endDayNum;
      });
    }
    
    // Generate items
    const items = filteredData.map((sheet, index) => ({
      item: index + 1,
      descripcion: sheet.day > 0 
        ? `LOGISTICA GUIA Y MANIFIESTO TRANSPORTE DE CARGA - ${sheet.day} ${sheet.month}`
        : `LOGISTICA GUIA Y MANIFIESTO TRANSPORTE DE CARGA - ${sheet.month}`,
      cantidad: sheet.rowCount
    }));
    
    const total = items.reduce((sum, item) => sum + item.cantidad, 0);
    
    setPreFacturaItems(items);
    setPreFacturaTotal(total);
  };
  
  // Handle filter change
  const handlePreFacturaFilterChange = (start: string, end: string) => {
    setPreFacturaFechaInicio(start);
    setPreFacturaFechaFin(end);
    if (preFacturaAllData.length > 0) {
      applyPreFacturaFilter(preFacturaAllData, start, end);
    }
  };
  
  const exportPreFactura = () => {
    if (preFacturaItems.length === 0) {
      toast({ title: "Error", description: "No hay datos para exportar", variant: "destructive" });
      return;
    }
    
    const ws = XLSX.utils.json_to_sheet(preFacturaItems.map(item => ({
      "Ítem": item.item,
      "Descripción": item.descripcion,
      "Cantidad": item.cantidad
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pre-Factura");
    XLSX.writeFile(wb, `Pre_Factura_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              Facturación
            </h1>
            <p className="text-muted-foreground mt-1">
              Reportes de viajes y manifiestos para facturación quincenal
            </p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
            <TabsTrigger value="excel" className="flex items-center gap-2" data-testid="tab-excel">
              <FileSpreadsheet className="h-4 w-4" />
              Informe Excel
            </TabsTrigger>
            <TabsTrigger value="despachos" className="flex items-center gap-2" data-testid="tab-despachos">
              <ClipboardList className="h-4 w-4" />
              Informe Despachos
            </TabsTrigger>
            <TabsTrigger value="prefactura" className="flex items-center gap-2" data-testid="tab-prefactura">
              <FileText className="h-4 w-4" />
              Pre-Factura
            </TabsTrigger>
          </TabsList>
          
          {/* TAB 1: Informe desde Excel */}
          <TabsContent value="excel" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Cargar Libro de Excel
                </CardTitle>
                <CardDescription>
                  Suba un libro de Excel con múltiples hojas de despacho diario para contar viajes por granja
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleExcelUpload}
                  accept=".xlsx,.xls"
                  className="hidden"
                  data-testid="input-excel-upload"
                />
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                    data-testid="button-upload-excel"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {isProcessing ? "Procesando..." : "Seleccionar Archivo Excel"}
                  </Button>
                  {excelData.length > 0 && (
                    <Button
                      onClick={exportExcelReport}
                      variant="outline"
                      className="flex items-center gap-2"
                      data-testid="button-export-excel"
                    >
                      <Download className="h-4 w-4" />
                      Exportar Reporte
                    </Button>
                  )}
                </div>
                
                {fileName && (
                  <p className="text-sm text-muted-foreground">
                    Archivo: <span className="font-medium">{fileName}</span> - {totalHojas} hojas procesadas
                  </p>
                )}
              </CardContent>
            </Card>
            
            {excelData.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                          <Building className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{excelData.length}</p>
                          <p className="text-sm text-muted-foreground">Granjas Diferentes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                          <Truck className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalViajes}</p>
                          <p className="text-sm text-muted-foreground">Total Viajes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                          <FileSpreadsheet className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalHojas}</p>
                          <p className="text-sm text-muted-foreground">Hojas Analizadas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Viajes por Granja
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={excelData.slice(0, 15)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="granja" type="category" width={120} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="viajes" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detalle de Viajes por Granja</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Granja</TableHead>
                            <TableHead className="text-center">Viajes</TableHead>
                            <TableHead>Días/Hojas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {excelData.map((item, index) => (
                            <TableRow key={item.granja} data-testid={`row-granja-${index}`}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="font-medium">{item.granja}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{item.viajes}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                                {item.hojas.slice(0, 5).join(", ")}
                                {item.hojas.length > 5 && ` +${item.hojas.length - 5} más`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          
          {/* TAB 2: Informe desde Despachos Guardados */}
          <TabsContent value="despachos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Seleccionar Período de Facturación
                </CardTitle>
                <CardDescription>
                  Consulte los despachos guardados para generar reportes de facturación y auditoría
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="fechaInicio">Fecha Inicio</Label>
                    <Input
                      id="fechaInicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full sm:w-[180px]"
                      data-testid="input-fecha-inicio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaFin">Fecha Fin</Label>
                    <Input
                      id="fechaFin"
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="w-full sm:w-[180px]"
                      data-testid="input-fecha-fin"
                    />
                  </div>
                  <Button
                    onClick={fetchDespachosReport}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                    data-testid="button-generate-report"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {isLoading ? "Generando..." : "Generar Reporte"}
                  </Button>
                  {granjasTotales.length > 0 && (
                    <>
                      <Button
                        onClick={exportDespachosResumen}
                        variant="outline"
                        className="flex items-center gap-2"
                        data-testid="button-export-despachos"
                      >
                        <Download className="h-4 w-4" />
                        Exportar Excel
                      </Button>
                      <Button
                        onClick={exportToPDF}
                        variant="outline"
                        className="flex items-center gap-2"
                        data-testid="button-export-pdf"
                      >
                        <FileDown className="h-4 w-4" />
                        Exportar PDF
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {granjasTotales.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                          <Building className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{granjasTotales.length}</p>
                          <p className="text-sm text-muted-foreground">Granjas</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                          <Truck className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totalViajesDespachos}</p>
                          <p className="text-sm text-muted-foreground">Viajes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                          <FileText className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {resumenData.reduce((sum, r) => sum + r.totalManifiestos, 0)}
                          </p>
                          <p className="text-sm text-muted-foreground">Manifiestos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                          <DollarSign className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {totalToneladas.toFixed(2)} Ton
                          </p>
                          <p className="text-sm text-muted-foreground">({Math.round(totalBultos)} bultos)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Charts Row */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Viajes por Granja
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={granjasTotales.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="granja" type="category" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="viajes" fill="#10b981" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Distribución de Fletes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={granjasTotales.slice(0, 8)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="flete"
                              nameKey="granja"
                              label={({ granja, percent }) => `${granja}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {granjasTotales.slice(0, 8).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Summary Table by Granja */}
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen para Facturación - Por Granja</CardTitle>
                    <CardDescription>
                      Totales de viajes y fletes por granja para el período seleccionado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Granja (Centro de Costo)</TableHead>
                            <TableHead className="text-center">Total Viajes</TableHead>
                            <TableHead className="text-right">Cantidad (Ton)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {granjasTotales.map((item, index) => (
                            <TableRow key={item.granja} data-testid={`row-resumen-${index}`}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{item.granja}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{item.viajes}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {(item.cantidad / 1000).toFixed(2)} Ton
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell></TableCell>
                            <TableCell>TOTAL</TableCell>
                            <TableCell className="text-center">{totalViajesDespachos}</TableCell>
                            <TableCell className="text-right font-mono">
                              {totalToneladas.toFixed(2)} Ton
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
                
                {/* Detailed Daily Report - Grouped by Date */}
                <Card>
                  <CardHeader>
                    <CardTitle>Reporte Diario Detallado - Para Auditoría</CardTitle>
                    <CardDescription>
                      Detalle de cada viaje agrupado por fecha, con información de fletes, titulares y centros de costo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full space-y-2">
                      {detalleDataPorFecha.map(([fecha, items]) => {
                        const fechaCantidad = items.reduce((sum, i) => sum + i.cantidadCargada, 0);
                        const fechaToneladas = fechaCantidad / 1000;
                        const fechaBultos = Math.round(fechaCantidad / 40);
                        const exitosos = items.filter(i => i.estado === "Exitoso").length;
                        return (
                          <AccordionItem key={fecha} value={fecha} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-4">
                                  <Calendar className="h-5 w-5 text-primary" />
                                  <span className="font-bold text-lg">{fecha}</span>
                                  <Badge variant="secondary" className="ml-2">
                                    {items.length} viajes
                                  </Badge>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {exitosos} exitosos
                                  </Badge>
                                </div>
                                <span className="font-mono font-bold text-primary">
                                  {fechaToneladas.toFixed(2)} Ton ({fechaBultos} bultos)
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="overflow-x-auto border rounded-md mt-2">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      <TableHead>Placa</TableHead>
                                      <TableHead>Conductor</TableHead>
                                      <TableHead>Granja</TableHead>
                                      <TableHead>Planta</TableHead>
                                      <TableHead className="text-right">Cantidad</TableHead>
                                      <TableHead>Titular</TableHead>
                                      <TableHead>Estado</TableHead>
                                      <TableHead>ID Manifiesto</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((item, index) => (
                                      <TableRow key={`${item.placa}-${index}`} data-testid={`row-detalle-${fecha}-${index}`}>
                                        <TableCell className="font-mono">{item.placa}</TableCell>
                                        <TableCell className="max-w-[150px] truncate" title={item.conductor}>
                                          {item.conductor}
                                        </TableCell>
                                        <TableCell>{item.granja}</TableCell>
                                        <TableCell className="max-w-[100px] truncate">{item.planta}</TableCell>
                                        <TableCell className="text-right font-mono">
                                          {(item.cantidadCargada / 1000).toFixed(2)} Ton
                                        </TableCell>
                                        <TableCell>
                                          {item.tipoTitular === "C" ? "CC: " : "NIT: "}
                                          {item.titular}
                                        </TableCell>
                                        <TableCell>
                                          <Badge 
                                            variant={item.estado === "Exitoso" ? "default" : 
                                                    item.estado === "Error" ? "destructive" : "secondary"}
                                            className={item.estado === "Exitoso" ? "bg-green-600" : ""}
                                          >
                                            {item.estado}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{item.idManifiesto}</TableCell>
                                      </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/30 font-medium">
                                      <TableCell colSpan={4} className="text-right">
                                        Subtotal {fecha}:
                                      </TableCell>
                                      <TableCell className="text-right font-mono font-bold">
                                        {fechaToneladas.toFixed(2)} Ton ({fechaBultos} bultos)
                                      </TableCell>
                                      <TableCell colSpan={3}></TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                    {detalleDataPorFecha.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No hay datos detallados para mostrar
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          
          {/* TAB 3: Pre-Factura */}
          <TabsContent value="prefactura" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generar Pre-Factura desde Excel
                </CardTitle>
                <CardDescription>
                  Cargue el libro de Excel con hojas por día de despacho para generar las líneas de facturación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="file"
                  ref={preFacturaFileInputRef}
                  onChange={handlePreFacturaUpload}
                  accept=".xlsx,.xls"
                  className="hidden"
                  data-testid="input-prefactura-excel"
                />
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <Button
                    onClick={() => preFacturaFileInputRef.current?.click()}
                    disabled={isLoadingPreFactura}
                    className="flex items-center gap-2"
                    data-testid="button-upload-prefactura"
                  >
                    {isLoadingPreFactura ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {isLoadingPreFactura ? "Procesando..." : "Cargar Excel de Manifiestos"}
                  </Button>
                  {preFacturaFileName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{preFacturaFileName}</span>
                    </div>
                  )}
                </div>
                
                {preFacturaAllData.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-3">Filtrar por rango de días (opcional):</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="space-y-2">
                        <Label htmlFor="preFacturaDiaInicio">Día Inicio</Label>
                        <Input
                          id="preFacturaDiaInicio"
                          type="number"
                          min="1"
                          max="31"
                          placeholder="1"
                          value={preFacturaFechaInicio}
                          onChange={(e) => handlePreFacturaFilterChange(e.target.value, preFacturaFechaFin)}
                          data-testid="input-prefactura-dia-inicio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preFacturaDiaFin">Día Fin</Label>
                        <Input
                          id="preFacturaDiaFin"
                          type="number"
                          min="1"
                          max="31"
                          placeholder="31"
                          value={preFacturaFechaFin}
                          onChange={(e) => handlePreFacturaFilterChange(preFacturaFechaInicio, e.target.value)}
                          data-testid="input-prefactura-dia-fin"
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handlePreFacturaFilterChange("1", "15")}
                        className="flex items-center gap-2"
                        data-testid="button-prefactura-quincena1"
                      >
                        <Calendar className="h-4 w-4" />
                        1ra Quincena
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handlePreFacturaFilterChange("16", "31")}
                        className="flex items-center gap-2"
                        data-testid="button-prefactura-quincena2"
                      >
                        <Calendar className="h-4 w-4" />
                        2da Quincena
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {preFacturaItems.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      Líneas de Facturación
                    </CardTitle>
                    <CardDescription>
                      {preFacturaItems.length} días - {preFacturaTotal} manifiestos totales
                    </CardDescription>
                  </div>
                  <Button
                    onClick={exportPreFactura}
                    variant="outline"
                    className="flex items-center gap-2"
                    data-testid="button-export-prefactura"
                  >
                    <Download className="h-4 w-4" />
                    Exportar Excel
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Ítem</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-[100px] text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preFacturaItems.map((item) => (
                          <TableRow key={item.item} data-testid={`row-prefactura-${item.item}`}>
                            <TableCell className="font-medium text-center">{item.item}</TableCell>
                            <TableCell>{item.descripcion}</TableCell>
                            <TableCell className="text-right font-mono">{item.cantidad.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted/50">
                          <TableCell></TableCell>
                          <TableCell className="text-right">TOTAL</TableCell>
                          <TableCell className="text-right font-mono">{preFacturaTotal.toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
