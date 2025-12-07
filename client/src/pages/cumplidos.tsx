import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { XmlViewer } from "@/components/xml-viewer";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, FileCode, History, Loader2, RefreshCw, Eye, Download, X, FileCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { useSettings } from "@/hooks/use-settings";

interface CumplidoExcelRow {
  INGRESOID: string;
  FECHAINGRESO: string;
  ESTADO: string;
  USUARIO: string;
  INTERACTIVO: string;
  NUMNITEMPRESATRANSPORTE: string;
  CODIGOEMPRESA: string;
  CONSECUTIVOREMESA: string;
  NUMIDGPS: string;
  NUMMANIFIESTOCARGA: string;
  INGRESOIDREMESA: string;
  INGRESOIDMANIFIESTO: string;
  CODMUNICIPIOORIGEN: string;
  ORIGEN: string;
  CODMUNICIPIODESTINO: string;
  DESTINO: string;
  NUMPLACA: string;
  FECHALLEGADACARGUE: any;
  HORALLEGADACARGUE: any;
  FECHASALIDACARGUE: any;
  HORASALIDACARGUE: any;
  FECHALLEGADADESCARGUE: any;
  HORALLEGADADESCARGUE: any;
  FECHASALIDADESCARGUE: any;
  HORASALIDADESCARGUE: any;
  LATITUDCARGUE: number;
  LONGITUDCARGUE: number;
  LATITUDDESCARGUE: number;
  LONGITUDDESCARGUE: number;
  OBSERVACIONES: string;
}

interface CumplidoRemesaSubmission {
  consecutivoRemesa: string;
  numNitEmpresa: string;
  numPlaca: string;
  origen: string;
  destino: string;
  fechaEntradaCargue: string;
  horaEntradaCargue: string;
  fechaEntradaDescargue: string;
  horaEntradaDescargue: string;
  cantidadCargada: string;
  cantidadEntregada: string;
  xmlQueryRequest: string;
  xmlCumplidoRequest: string;
  status: string;
  queryResponse?: string;
  cumplidoResponse?: string;
  responseCode?: string;
  responseMessage?: string;
}

interface CumplidoBatch {
  id: string;
  type: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  status: string;
  createdAt: string;
}

interface CumplidoManifiestoSubmission {
  numManifiestoCarga: string;
  numNitEmpresa: string;
  numPlaca: string;
  origen: string;
  destino: string;
  fechaEntregaDocumentos: string;
  xmlCumplidoRequest: string;
  status: string;
  responseCode?: string;
  responseMessage?: string;
}

export default function Cumplidos() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState("remesa");
  const [data, setData] = useState<CumplidoExcelRow[]>([]);
  const [generatedSubmissions, setGeneratedSubmissions] = useState<CumplidoRemesaSubmission[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [batches, setBatches] = useState<CumplidoBatch[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentBatchResults, setCurrentBatchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<CumplidoBatch | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manifiestoData, setManifiestoData] = useState<CumplidoExcelRow[]>([]);
  const [manifiestoSubmissions, setManifiestoSubmissions] = useState<CumplidoManifiestoSubmission[]>([]);
  const [isSendingManifiesto, setIsSendingManifiesto] = useState(false);
  const [manifiestoCurrentBatchId, setManifiestoCurrentBatchId] = useState<string | null>(null);
  const [manifestoBatchResults, setManifestoBatchResults] = useState<any[]>([]);
  const [showManifiestoResults, setShowManifiestoResults] = useState(false);
  const [isPollingManifiesto, setIsPollingManifiesto] = useState(false);
  const [manifiestoCurrentBatch, setManifiestoCurrentBatch] = useState<CumplidoBatch | null>(null);
  const manifiestoFileInputRef = useRef<HTMLInputElement>(null);

  // Pagination states
  const [remesaPage, setRemesaPage] = useState(1);
  const [manifiestoPage, setManifiestoPage] = useState(1);
  const pageSize = 20;

  const fetchBatchResults = useCallback(async (batchId: string) => {
    try {
      const [batchRes, subRes] = await Promise.all([
        fetch(`/api/rndc/batches/${batchId}`),
        fetch(`/api/rndc/cumplido-remesa/${batchId}`),
      ]);
      const batchData = await batchRes.json();
      const subData = await subRes.json();
      
      if (batchData.success) {
        setCurrentBatch(batchData.batch);
      }
      if (subData.success) {
        setCurrentBatchResults(subData.submissions);
      }
      
      return batchData.success ? batchData.batch : null;
    } catch (error) {
      console.error("Error fetching batch results:", error);
      return null;
    }
  }, []);

  const fetchManifiestoBatchResults = useCallback(async (batchId: string) => {
    try {
      const [batchRes, subRes] = await Promise.all([
        fetch(`/api/rndc/batches/${batchId}`),
        fetch(`/api/rndc/cumplido-manifiesto/${batchId}`),
      ]);
      const batchData = await batchRes.json();
      const subData = await subRes.json();
      
      if (batchData.success) {
        setManifiestoCurrentBatch(batchData.batch);
      }
      if (subData.success) {
        setManifestoBatchResults(subData.submissions);
      }
      
      return batchData.success ? batchData.batch : null;
    } catch (error) {
      console.error("Error fetching manifiesto batch results:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!currentBatchId || !isPolling) return;
    
    let isCancelled = false;
    
    const pollResults = async () => {
      const batch = await fetchBatchResults(currentBatchId);
      if (isCancelled) return;
      
      if (batch && batch.status === "completed") {
        setIsPolling(false);
        toast({
          title: "Procesamiento Completado",
          description: `${batch.successCount} exitosos, ${batch.errorCount} errores`,
          className: batch.errorCount > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200",
        });
      }
    };
    
    pollResults();
    const intervalId = setInterval(pollResults, 2000);
    
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [currentBatchId, isPolling, fetchBatchResults]);

  useEffect(() => {
    if (!manifiestoCurrentBatchId || !isPollingManifiesto) return;
    
    let isCancelled = false;
    
    const pollResults = async () => {
      const batch = await fetchManifiestoBatchResults(manifiestoCurrentBatchId);
      if (isCancelled) return;
      
      if (batch && batch.status === "completed") {
        setIsPollingManifiesto(false);
        toast({
          title: "Procesamiento Completado",
          description: `${batch.successCount} exitosos, ${batch.errorCount} errores`,
          className: batch.errorCount > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200",
        });
      }
    };
    
    pollResults();
    const intervalId = setInterval(pollResults, 2000);
    
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [manifiestoCurrentBatchId, isPollingManifiesto, fetchManifiestoBatchResults]);

  const excelDateToDate = (excelDate: number): Date => {
    const utcDays = Math.floor(excelDate) - 25569;
    const utcValue = utcDays * 86400 * 1000;
    const d = new Date(utcValue);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };

  const excelTimeToHoursMinutes = (excelTime: number): { hours: number; minutes: number } => {
    const totalMinutes = Math.round(excelTime * 24 * 60);
    return {
      hours: Math.floor(totalMinutes / 60) % 24,
      minutes: totalMinutes % 60
    };
  };

  const formatExcelDateTime = (dStr: any, tStr: any): string => {
    let dateStr = "";
    let timeStr = "";
    
    if (typeof dStr === 'number') {
      const d = excelDateToDate(dStr);
      dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } else if (typeof dStr === 'string') {
      dateStr = dStr;
    }
    
    if (typeof tStr === 'number') {
      const { hours, minutes } = excelTimeToHoursMinutes(tStr);
      timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else if (typeof tStr === 'string') {
      timeStr = tStr;
    }
    
    return `${dateStr} ${timeStr}`.trim();
  };

  const parseDateTime = (dStr: any, tStr: any, addMinutes: number = 0): { date: string; time: string } => {
    let d = new Date();
    
    console.log("[parseDateTime] Input date:", dStr, "type:", typeof dStr);
    
    if (typeof dStr === 'number') {
      d = excelDateToDate(dStr);
      console.log("[parseDateTime] Excel date converted:", d);
    } else if (typeof dStr === 'string') {
      const parts = dStr.split(/[-/]/);
      console.log("[parseDateTime] String parts:", parts);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // Format: DD/MM/YYYY
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          console.log("[parseDateTime] Parsed as DD/MM/YYYY:", d);
        } else if (parts[0].length === 4) {
          // Format: YYYY/MM/DD
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          console.log("[parseDateTime] Parsed as YYYY/MM/DD:", d);
        }
      }
    }

    if (typeof tStr === 'number') {
      const { hours, minutes } = excelTimeToHoursMinutes(tStr);
      d.setHours(hours, minutes, 0, 0);
    } else if (typeof tStr === 'string') {
      const parts = tStr.split(':');
      if (parts.length >= 2) d.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0);
    }

    d.setMinutes(d.getMinutes() + addMinutes);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      let jsonData: CumplidoExcelRow[];
      
      if (file.name.endsWith('.csv')) {
        const wb = XLSX.read(content, { type: "string", raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        jsonData = XLSX.utils.sheet_to_json(ws, { raw: true }) as CumplidoExcelRow[];
      } else {
        const wb = XLSX.read(content, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        jsonData = XLSX.utils.sheet_to_json(ws) as CumplidoExcelRow[];
      }
      
      setData(jsonData);
      setGeneratedSubmissions([]);
      setRemesaPage(1);
      toast({
        title: "Archivo Procesado",
        description: `Se han cargado ${jsonData.length} registros exitosamente.`,
      });
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const generateQueryXml = (row: CumplidoExcelRow): string => {
    return `<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>3</tipo>
<procesoid>3</procesoid>
</solicitud>
<variables>INGRESOID,FECHAING,CANTIDADCARGADA</variables>
<documento>
<NUMNITEMPRESATRANSPORTE>'${row.NUMNITEMPRESATRANSPORTE}'</NUMNITEMPRESATRANSPORTE>
<CONSECUTIVOREMESA>'${row.CONSECUTIVOREMESA}'</CONSECUTIVOREMESA>
</documento>
</root>`;
  };

  const generateCumplidoRemesaXml = (row: CumplidoExcelRow, cantidadCargada: string): string => {
    const fechaEntradaCargue = parseDateTime(row.FECHALLEGADACARGUE, row.HORALLEGADACARGUE, 0);
    const horaEntradaCargue = parseDateTime(row.FECHALLEGADACARGUE, row.HORALLEGADACARGUE, 5);
    const fechaEntradaDescargue = parseDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE, 0);

    return `<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>1</tipo>
<procesoid>5</procesoid>
</solicitud>
<variables>
<NUMNITEMPRESATRANSPORTE>${row.NUMNITEMPRESATRANSPORTE}</NUMNITEMPRESATRANSPORTE>
<CONSECUTIVOREMESA>${row.CONSECUTIVOREMESA}</CONSECUTIVOREMESA>
<TIPOCUMPLIDOREMESA>C</TIPOCUMPLIDOREMESA>
<CANTIDADCARGADA>${cantidadCargada}</CANTIDADCARGADA>
<CANTIDADENTREGADA>${cantidadCargada}</CANTIDADENTREGADA>
<UNIDADMEDIDACAPACIDAD>1</UNIDADMEDIDACAPACIDAD>
<FECHAENTRADACARGUE>${fechaEntradaCargue.date}</FECHAENTRADACARGUE>
<HORAENTRADACARGUEREMESA>${horaEntradaCargue.time}</HORAENTRADACARGUEREMESA>
<FECHAENTRADADESCARGUE>${fechaEntradaDescargue.date}</FECHAENTRADADESCARGUE>
<HORAENTRADADESCARGUECUMPLIDO>${fechaEntradaDescargue.time}</HORAENTRADADESCARGUECUMPLIDO>
</variables>
</root>`;
  };

  const handleQueryCantidades = async () => {
    if (data.length === 0) return;

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    setIsQuerying(true);
    const submissions: CumplidoRemesaSubmission[] = [];

    try {
      for (const row of data) {
        const queryXml = generateQueryXml(row);
        
        const response = await fetch("/api/rndc/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xmlRequest: queryXml, wsUrl }),
        });

        const result = await response.json();
        
        let cantidadCargada = "10000";
        if (result.success && result.data?.CANTIDADCARGADA) {
          cantidadCargada = String(result.data.CANTIDADCARGADA);
        }

        const fechaEntradaCargue = parseDateTime(row.FECHALLEGADACARGUE, row.HORALLEGADACARGUE, 0);
        const horaEntradaCargue = parseDateTime(row.FECHALLEGADACARGUE, row.HORALLEGADACARGUE, 5);
        const fechaEntradaDescargue = parseDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE, 0);

        const cumplidoXml = generateCumplidoRemesaXml(row, cantidadCargada);

        submissions.push({
          consecutivoRemesa: String(row.CONSECUTIVOREMESA),
          numNitEmpresa: String(row.NUMNITEMPRESATRANSPORTE),
          numPlaca: String(row.NUMPLACA),
          origen: String(row.ORIGEN || ''),
          destino: String(row.DESTINO || ''),
          fechaEntradaCargue: fechaEntradaCargue.date,
          horaEntradaCargue: horaEntradaCargue.time,
          fechaEntradaDescargue: fechaEntradaDescargue.date,
          horaEntradaDescargue: fechaEntradaDescargue.time,
          cantidadCargada,
          cantidadEntregada: cantidadCargada,
          xmlQueryRequest: queryXml,
          xmlCumplidoRequest: cumplidoXml,
          status: "ready",
          queryResponse: result.rawXml || "",
        });
      }

      setGeneratedSubmissions(submissions);
      toast({
        title: "Consultas Completadas",
        description: `Se consultaron ${submissions.length} remesas. XMLs listos para enviar.`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al consultar cantidades",
        variant: "destructive",
      });
    }

    setIsQuerying(false);
  };

  const handleSendCumplidos = async () => {
    if (generatedSubmissions.length === 0) return;

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    setIsSending(true);
    try {
      const response = await fetch("/api/rndc/cumplido-remesa-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: generatedSubmissions, wsUrl }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Lote Enviado",
          description: result.message,
          className: "bg-green-50 border-green-200 text-green-800",
        });
        
        setCurrentBatchId(result.batchId);
        setShowResults(true);
        setIsPolling(true);
        
        setGeneratedSubmissions([]);
        setData([]);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Error de conexión al servidor", variant: "destructive" });
    }
    setIsSending(false);
  };

  const handleCloseResults = () => {
    setShowResults(false);
    setCurrentBatchId(null);
    setCurrentBatchResults([]);
    setIsPolling(false);
  };

  const handleExportResults = () => {
    if (currentBatchResults.length === 0) return;
    
    const exportData = currentBatchResults.map(sub => ({
      "Consecutivo Remesa": sub.consecutivoRemesa,
      "NIT Empresa": sub.numNitEmpresa,
      "Placa": sub.numPlaca,
      "Origen": sub.origen,
      "Destino": sub.destino,
      "Cantidad Cargada": sub.cantidadCargada,
      "Cantidad Entregada": sub.cantidadEntregada,
      "Fecha Entrada Cargue": sub.fechaEntradaCargue,
      "Hora Entrada Cargue": sub.horaEntradaCargue,
      "Estado": sub.status === "success" ? "Exitoso" : sub.status === "error" ? "Error" : sub.status,
      "Código Respuesta": sub.responseCode || "",
      "Mensaje Respuesta": sub.responseMessage || "",
      "Fecha Procesamiento": sub.processedAt ? new Date(sub.processedAt).toLocaleString('es-CO') : "",
      "XML Enviado": sub.xmlCumplidoRequest || "",
      "XML Respuesta": sub.xmlResponse || "",
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cumplidos Remesa");
    
    const now = new Date();
    const filename = `cumplidos_remesa_${now.toISOString().split('T')[0]}_${now.getHours()}${now.getMinutes()}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    toast({
      title: "Archivo Exportado",
      description: `Se ha descargado ${filename}`,
    });
  };

  const handleManifiestoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      let jsonData: CumplidoExcelRow[];
      
      if (file.name.endsWith('.csv')) {
        const wb = XLSX.read(content, { type: "string", raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        jsonData = XLSX.utils.sheet_to_json(ws, { raw: true }) as CumplidoExcelRow[];
      } else {
        const wb = XLSX.read(content, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        jsonData = XLSX.utils.sheet_to_json(ws) as CumplidoExcelRow[];
      }
      
      setManifiestoData(jsonData);
      setManifiestoSubmissions([]);
      setManifiestoPage(1);
      toast({
        title: "Archivo Procesado",
        description: `Se han cargado ${jsonData.length} manifiestos.`,
      });
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const generateCumplidoManifiestoXml = (row: CumplidoExcelRow): string => {
    const fechaDescargue = parseDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE, 0);

    return `<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>1</tipo>
<procesoid>6</procesoid>
</solicitud>
<variables>
<NUMNITEMPRESATRANSPORTE>${row.NUMIDGPS}</NUMNITEMPRESATRANSPORTE>
<NUMMANIFIESTOCARGA>${row.CONSECUTIVOREMESA}</NUMMANIFIESTOCARGA>
<TIPOCUMPLIDOMANIFIESTO>C</TIPOCUMPLIDOMANIFIESTO>
<FECHAENTREGADOCUMENTOS>${fechaDescargue.date}</FECHAENTREGADOCUMENTOS>
</variables>
</root>`;
  };

  const handleGenerateManifiestoXmls = () => {
    if (manifiestoData.length === 0) return;

    const submissions: CumplidoManifiestoSubmission[] = manifiestoData.map(row => {
      const fechaDescargue = parseDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE, 0);
      
      return {
        numManifiestoCarga: String(row.CONSECUTIVOREMESA),
        numNitEmpresa: String(row.NUMIDGPS),
        numPlaca: String(row.NUMPLACA),
        origen: String(row.ORIGEN || ''),
        destino: String(row.DESTINO || ''),
        fechaEntregaDocumentos: fechaDescargue.date,
        xmlCumplidoRequest: generateCumplidoManifiestoXml(row),
        status: "ready",
      };
    });

    setManifiestoSubmissions(submissions);
    toast({
      title: "XMLs Generados",
      description: `Se generaron ${submissions.length} XMLs listos para enviar.`,
      className: "bg-green-50 border-green-200",
    });
  };

  const handleSendManifiestos = async () => {
    if (manifiestoSubmissions.length === 0) return;

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    setIsSendingManifiesto(true);
    try {
      const response = await fetch("/api/rndc/cumplido-manifiesto-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: manifiestoSubmissions, wsUrl }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Lote Enviado",
          description: result.message,
          className: "bg-green-50 border-green-200 text-green-800",
        });
        
        setManifiestoCurrentBatchId(result.batchId);
        setShowManifiestoResults(true);
        setIsPollingManifiesto(true);
        
        setManifiestoSubmissions([]);
        setManifiestoData([]);
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Error de conexión al servidor", variant: "destructive" });
    }
    setIsSendingManifiesto(false);
  };

  const handleCloseManifiestoResults = () => {
    setShowManifiestoResults(false);
    setManifiestoCurrentBatchId(null);
    setManifestoBatchResults([]);
    setIsPollingManifiesto(false);
  };

  const handleExportManifiestoResults = () => {
    if (manifestoBatchResults.length === 0) return;
    
    const exportData = manifestoBatchResults.map(sub => ({
      "Manifiesto": sub.numManifiestoCarga,
      "NIT Empresa": sub.numNitEmpresa,
      "Placa": sub.numPlaca,
      "Origen": sub.origen,
      "Destino": sub.destino,
      "Fecha Entrega Docs": sub.fechaEntregaDocumentos,
      "Estado": sub.status === "success" ? "Exitoso" : sub.status === "error" ? "Error" : sub.status,
      "Código Respuesta": sub.responseCode || "",
      "Mensaje Respuesta": sub.responseMessage || "",
      "Fecha Procesamiento": sub.processedAt ? new Date(sub.processedAt).toLocaleString('es-CO') : "",
      "XML Enviado": sub.xmlCumplidoRequest || "",
      "XML Respuesta": sub.xmlResponse || "",
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cumplidos Manifiesto");
    
    const now = new Date();
    const filename = `cumplidos_manifiesto_${now.toISOString().split('T')[0]}_${now.getHours()}${now.getMinutes()}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    toast({
      title: "Archivo Exportado",
      description: `Se ha descargado ${filename}`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800" data-testid="badge-success">Exitoso</Badge>;
      case "error":
        return <Badge variant="destructive" data-testid="badge-error">Error</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800" data-testid="badge-processing">Procesando</Badge>;
      case "pending":
        return <Badge variant="secondary" data-testid="badge-pending">Pendiente</Badge>;
      case "ready":
        return <Badge className="bg-amber-100 text-amber-800" data-testid="badge-ready">Listo</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-unknown">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Cumplidos</h1>
          <p className="text-muted-foreground">Cumplir Remesas y Manifiestos de Carga en el RNDC.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="remesa" data-testid="tab-remesa">
              <FileCheck className="mr-2 h-4 w-4" /> Cumplir Remesa
            </TabsTrigger>
            <TabsTrigger value="manifiesto" data-testid="tab-manifiesto">
              <FileCode className="mr-2 h-4 w-4" /> Cumplir Manifiesto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="remesa" className="space-y-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Cargar CSV/Excel de Remesas</h3>
                  <p className="text-sm text-muted-foreground">Archivo con datos de remesas a cumplir</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  data-testid="input-file-cumplido"
                />
                <Button onClick={() => fileInputRef.current?.click()} data-testid="button-select-file-cumplido">
                  <Upload className="mr-2 h-4 w-4" /> Seleccionar Archivo
                </Button>
              </CardContent>
            </Card>

            {data.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Vista Previa de Datos</CardTitle>
                      <CardDescription>{data.length} remesas encontradas</CardDescription>
                    </div>
                    <Button 
                      onClick={handleQueryCantidades} 
                      disabled={isQuerying || generatedSubmissions.length > 0} 
                      data-testid="button-query-cantidades"
                    >
                      {isQuerying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando...
                        </>
                      ) : (
                        <>
                          Consultar y Generar XMLs <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Consecutivo</TableHead>
                            <TableHead>NIT Empresa</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Origen</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead>Llegada Cargue</TableHead>
                            <TableHead>Llegada Descargue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.slice((remesaPage - 1) * pageSize, remesaPage * pageSize).map((row, i) => (
                            <TableRow key={i} data-testid={`row-cumplido-${(remesaPage - 1) * pageSize + i}`}>
                              <TableCell className="text-muted-foreground">{(remesaPage - 1) * pageSize + i + 1}</TableCell>
                              <TableCell className="font-mono">{row.CONSECUTIVOREMESA}</TableCell>
                              <TableCell className="font-mono">{row.NUMNITEMPRESATRANSPORTE}</TableCell>
                              <TableCell>{row.NUMPLACA}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{row.ORIGEN}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{row.DESTINO}</TableCell>
                              <TableCell>{formatExcelDateTime(row.FECHALLEGADACARGUE, row.HORALLEGADACARGUE)}</TableCell>
                              <TableCell>{formatExcelDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {data.length > pageSize && (
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {(remesaPage - 1) * pageSize + 1} - {Math.min(remesaPage * pageSize, data.length)} de {data.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemesaPage(p => Math.max(1, p - 1))}
                            disabled={remesaPage === 1}
                            data-testid="button-prev-remesa"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium">
                            Página {remesaPage} de {Math.ceil(data.length / pageSize)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRemesaPage(p => Math.min(Math.ceil(data.length / pageSize), p + 1))}
                            disabled={remesaPage >= Math.ceil(data.length / pageSize)}
                            data-testid="button-next-remesa"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {generatedSubmissions.length > 0 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>XMLs Generados ({generatedSubmissions.length})</CardTitle>
                          <CardDescription>Cumplidos listos para enviar al RNDC</CardDescription>
                        </div>
                        <Button
                          onClick={handleSendCumplidos}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isSending}
                          data-testid="button-send-cumplidos"
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                            </>
                          ) : (
                            <>
                              Enviar al RNDC <CheckCircle className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[300px] overflow-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Consecutivo</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Cantidad Cargada</TableHead>
                                <TableHead>Fecha Cargue</TableHead>
                                <TableHead>Fecha Descargue</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>XML</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {generatedSubmissions.map((sub, i) => (
                                <TableRow key={i} data-testid={`row-generated-${i}`}>
                                  <TableCell className="font-mono">{sub.consecutivoRemesa}</TableCell>
                                  <TableCell>{sub.numPlaca}</TableCell>
                                  <TableCell className="font-mono">{sub.cantidadCargada}</TableCell>
                                  <TableCell>{sub.fechaEntradaCargue} {sub.horaEntradaCargue}</TableCell>
                                  <TableCell>{sub.fechaEntradaDescargue} {sub.horaEntradaDescargue}</TableCell>
                                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                                  <TableCell>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" data-testid={`button-view-xml-${i}`}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-3xl max-h-[80vh]">
                                        <DialogHeader>
                                          <DialogTitle>XML Cumplido Remesa - {sub.consecutivoRemesa}</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="h-[60vh]">
                                          <XmlViewer xml={sub.xmlCumplidoRequest} title="XML Request" />
                                        </ScrollArea>
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                      <XmlViewer xml={generatedSubmissions[0]?.xmlQueryRequest || ""} title="Ejemplo Consulta CANTIDADCARGADA" />
                      <XmlViewer xml={generatedSubmissions[0]?.xmlCumplidoRequest || ""} title="Ejemplo Cumplido Remesa" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {showResults && currentBatchResults.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Resultados del Lote</CardTitle>
                    <CardDescription>
                      {currentBatchResults.filter(r => r.status === "success").length} exitosos, {" "}
                      {currentBatchResults.filter(r => r.status === "error").length} errores
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportResults} data-testid="button-export-results">
                      <Download className="h-4 w-4 mr-2" /> Exportar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCloseResults} data-testid="button-close-results">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Consecutivo</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Mensaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentBatchResults.map((result, i) => (
                          <TableRow key={i} data-testid={`row-result-${i}`}>
                            <TableCell className="font-mono">{result.consecutivoRemesa}</TableCell>
                            <TableCell>{result.numPlaca}</TableCell>
                            <TableCell>{getStatusBadge(result.status)}</TableCell>
                            <TableCell className="font-mono">{result.responseCode || "-"}</TableCell>
                            <TableCell className="max-w-[300px] truncate">{result.responseMessage || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manifiesto" className="space-y-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Cargar CSV/Excel de Manifiestos</h3>
                  <p className="text-sm text-muted-foreground">Archivo con datos de manifiestos a cumplir</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={manifiestoFileInputRef}
                  onChange={handleManifiestoFileUpload}
                  data-testid="input-file-manifiesto"
                />
                <Button onClick={() => manifiestoFileInputRef.current?.click()} data-testid="button-select-file-manifiesto">
                  <Upload className="mr-2 h-4 w-4" /> Seleccionar Archivo
                </Button>
              </CardContent>
            </Card>

            {manifiestoData.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Vista Previa de Datos</CardTitle>
                      <CardDescription>{manifiestoData.length} manifiestos encontrados</CardDescription>
                    </div>
                    <Button 
                      onClick={handleGenerateManifiestoXmls} 
                      disabled={manifiestoSubmissions.length > 0} 
                      data-testid="button-generate-manifiesto-xmls"
                    >
                      Generar XMLs <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[400px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead>Manifiesto</TableHead>
                            <TableHead>NIT (NUMIDGPS)</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Origen</TableHead>
                            <TableHead>Destino</TableHead>
                            <TableHead>Fecha Descargue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manifiestoData.slice((manifiestoPage - 1) * pageSize, manifiestoPage * pageSize).map((row, i) => (
                            <TableRow key={i} data-testid={`row-manifiesto-${(manifiestoPage - 1) * pageSize + i}`}>
                              <TableCell className="text-muted-foreground">{(manifiestoPage - 1) * pageSize + i + 1}</TableCell>
                              <TableCell className="font-mono">{row.CONSECUTIVOREMESA}</TableCell>
                              <TableCell className="font-mono">{row.NUMIDGPS}</TableCell>
                              <TableCell>{row.NUMPLACA}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{row.ORIGEN}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{row.DESTINO}</TableCell>
                              <TableCell>{formatExcelDateTime(row.FECHALLEGADADESCARGUE, row.HORALLEGADADESCARGUE)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {manifiestoData.length > pageSize && (
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-sm text-muted-foreground">
                          Mostrando {(manifiestoPage - 1) * pageSize + 1} - {Math.min(manifiestoPage * pageSize, manifiestoData.length)} de {manifiestoData.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setManifiestoPage(p => Math.max(1, p - 1))}
                            disabled={manifiestoPage === 1}
                            data-testid="button-prev-manifiesto"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium">
                            Página {manifiestoPage} de {Math.ceil(manifiestoData.length / pageSize)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setManifiestoPage(p => Math.min(Math.ceil(manifiestoData.length / pageSize), p + 1))}
                            disabled={manifiestoPage >= Math.ceil(manifiestoData.length / pageSize)}
                            data-testid="button-next-manifiesto"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {manifiestoSubmissions.length > 0 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle>XMLs Generados ({manifiestoSubmissions.length})</CardTitle>
                          <CardDescription>Cumplidos listos para enviar al RNDC</CardDescription>
                        </div>
                        <Button
                          onClick={handleSendManifiestos}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isSendingManifiesto}
                          data-testid="button-send-manifiestos"
                        >
                          {isSendingManifiesto ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                            </>
                          ) : (
                            <>
                              Enviar al RNDC <CheckCircle className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[300px] overflow-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Manifiesto</TableHead>
                                <TableHead>NIT</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Fecha Entrega Docs</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>XML</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {manifiestoSubmissions.map((sub, i) => (
                                <TableRow key={i} data-testid={`row-manifiesto-generated-${i}`}>
                                  <TableCell className="font-mono">{sub.numManifiestoCarga}</TableCell>
                                  <TableCell className="font-mono">{sub.numNitEmpresa}</TableCell>
                                  <TableCell>{sub.numPlaca}</TableCell>
                                  <TableCell>{sub.fechaEntregaDocumentos}</TableCell>
                                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                                  <TableCell>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" data-testid={`button-view-manifiesto-xml-${i}`}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-3xl max-h-[80vh]">
                                        <DialogHeader>
                                          <DialogTitle>XML Cumplido Manifiesto - {sub.numManifiestoCarga}</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="h-[60vh]">
                                          <XmlViewer xml={sub.xmlCumplidoRequest} title="XML Request" />
                                        </ScrollArea>
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-1">
                      <XmlViewer xml={manifiestoSubmissions[0]?.xmlCumplidoRequest || ""} title="Ejemplo Cumplido Manifiesto" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {showManifiestoResults && manifestoBatchResults.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Resultados del Lote</CardTitle>
                    <CardDescription>
                      {manifestoBatchResults.filter(r => r.status === "success").length} exitosos, {" "}
                      {manifestoBatchResults.filter(r => r.status === "error").length} errores
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportManifiestoResults} data-testid="button-export-manifiesto-results">
                      <Download className="h-4 w-4 mr-2" /> Exportar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCloseManifiestoResults} data-testid="button-close-manifiesto-results">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Manifiesto</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Mensaje</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manifestoBatchResults.map((result, i) => (
                          <TableRow key={i} data-testid={`row-manifiesto-result-${i}`}>
                            <TableCell className="font-mono">{result.numManifiestoCarga}</TableCell>
                            <TableCell>{result.numPlaca}</TableCell>
                            <TableCell>{getStatusBadge(result.status)}</TableCell>
                            <TableCell className="font-mono">{result.responseCode || "-"}</TableCell>
                            <TableCell className="max-w-[300px] truncate">{result.responseMessage || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
