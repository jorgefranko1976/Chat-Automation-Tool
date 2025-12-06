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
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, FileCode, History, Loader2, RefreshCw, Eye, Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { useSettings } from "@/hooks/use-settings";

interface ExcelRow {
  INGRESOID: string;
  FECHAINGRESO: string;
  PLACA: string;
  CODPUNTOCONTROL: string;
  LATITUD: number;
  LONGITUD: number;
  FECHACITA: string;
  HORACITA: string;
  INGRESOIDMANIFIESTO: string;
  NUMIDGPS: string;
}

interface GeneratedSubmission {
  ingresoidmanifiesto: string;
  numidgps: string;
  numplaca: string;
  codpuntocontrol: string;
  latitud: string;
  longitud: string;
  fechallegada: string;
  horallegada: string;
  fechasalida: string;
  horasalida: string;
  xmlRequest: string;
}

interface RndcSubmission {
  id: string;
  batchId: string;
  ingresoidmanifiesto: string;
  numidgps: string;
  numplaca: string;
  codpuntocontrol: string;
  latitud: string;
  longitud: string;
  fechallegada: string;
  horallegada: string;
  fechasalida: string;
  horasalida: string;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  xmlRequest: string;
  xmlResponse: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface RndcBatch {
  id: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  status: string;
  createdAt: string;
}

export default function Import() {
  const { settings } = useSettings();
  const [data, setData] = useState<ExcelRow[]>([]);
  const [generatedSubmissions, setGeneratedSubmissions] = useState<GeneratedSubmission[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [batches, setBatches] = useState<RndcBatch[]>([]);
  const [submissions, setSubmissions] = useState<RndcSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<RndcSubmission | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentBatchResults, setCurrentBatchResults] = useState<RndcSubmission[]>([]);
  const [currentBatch, setCurrentBatch] = useState<RndcBatch | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const [batchRes, subRes] = await Promise.all([
        fetch("/api/rndc/batches"),
        fetch("/api/rndc/submissions?limit=50"),
      ]);
      const batchData = await batchRes.json();
      const subData = await subRes.json();
      if (batchData.success) setBatches(batchData.batches);
      if (subData.success) setSubmissions(subData.submissions);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el historial", variant: "destructive" });
    }
    setLoadingHistory(false);
  };

  const fetchBatchResults = useCallback(async (batchId: string): Promise<RndcBatch | null> => {
    try {
      const [batchRes, subRes] = await Promise.all([
        fetch(`/api/rndc/batches/${batchId}`),
        fetch(`/api/rndc/submissions?batchId=${batchId}`),
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

  useEffect(() => {
    fetchHistory();
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
    
    const intervalId = setInterval(pollResults, 2000);
    
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [currentBatchId, isPolling, fetchBatchResults]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws) as ExcelRow[];
      setData(jsonData);
      setGeneratedSubmissions([]);
      toast({
        title: "Archivo Procesado",
        description: `Se han cargado ${jsonData.length} registros exitosamente.`,
      });
    };
    reader.readAsBinaryString(file);
  };

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

  const getShiftedTime = (dStr: any, tStr: any, minAdd: number) => {
    let d = new Date();
    
    if (typeof dStr === 'number') {
      d = excelDateToDate(dStr);
    } else if (typeof dStr === 'string') {
      const parts = dStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else if (parts[0].length === 4) {
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          const std = new Date(dStr);
          if (!isNaN(std.getTime())) d = std;
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

    d.setMinutes(d.getMinutes() + minAdd);

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');

    return { d: `${dd}/${mm}/${yyyy}`, t: `${hh}:${min}` };
  };

  const handleGenerateXml = () => {
    const subs = data.map(row => {
      const arrOffset = Math.floor(Math.random() * (90 - 60 + 1)) + 60;
      const stayDuration = Math.floor(Math.random() * (140 - 90 + 1)) + 90;
      const totalDepOffset = arrOffset + stayDuration;

      const arrivalTime = getShiftedTime(row.FECHACITA, row.HORACITA, arrOffset);
      const departureTime = getShiftedTime(row.FECHACITA, row.HORACITA, totalDepOffset);

      const xmlRequest = `<?xml version='1.0' encoding='iso-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameGps}</username>
<password>${settings.passwordGps}</password>
</acceso>
<solicitud>
<tipo>1</tipo>
<procesoid>60</procesoid>
</solicitud>
<variables>
<numidgps>${row.NUMIDGPS}</numidgps>
<ingresoidmanifiesto>${row.INGRESOIDMANIFIESTO}</ingresoidmanifiesto>
<numplaca>${row.PLACA}</numplaca>
<codpuntocontrol>${row.CODPUNTOCONTROL}</codpuntocontrol>
<latitud>${row.LATITUD}</latitud>
<longitud>${row.LONGITUD}</longitud>
<fechallegada>${arrivalTime.d}</fechallegada>
<horallegada>${arrivalTime.t}</horallegada>
<fechasalida>${departureTime.d}</fechasalida>
<horasalida>${departureTime.t}</horasalida>
</variables>
</root>`;

      return {
        ingresoidmanifiesto: String(row.INGRESOIDMANIFIESTO),
        numidgps: String(row.NUMIDGPS),
        numplaca: String(row.PLACA),
        codpuntocontrol: String(row.CODPUNTOCONTROL),
        latitud: String(row.LATITUD),
        longitud: String(row.LONGITUD),
        fechallegada: arrivalTime.d,
        horallegada: arrivalTime.t,
        fechasalida: departureTime.d,
        horasalida: departureTime.t,
        xmlRequest,
      };
    });

    setGeneratedSubmissions(subs);
    toast({
      title: "XMLs Generados",
      description: `${subs.length} XMLs listos para enviar.`,
    });
  };

  const handleSendAll = async () => {
    if (generatedSubmissions.length === 0) return;

    const wsUrl = settings.wsEnvironment === "production" 
      ? settings.wsUrlProd 
      : settings.wsUrlTest;

    setIsSending(true);
    try {
      const response = await fetch("/api/rndc/submit-batch", {
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
        
        await fetchBatchResults(result.batchId);
        
        setGeneratedSubmissions([]);
        setData([]);
        fetchHistory();
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
    setCurrentBatch(null);
    setCurrentBatchResults([]);
    setIsPolling(false);
  };

  const handleExportResults = () => {
    if (currentBatchResults.length === 0) return;
    
    const exportData = currentBatchResults.map(sub => ({
      Manifiesto: sub.ingresoidmanifiesto,
      Placa: sub.numplaca,
      "NumID GPS": sub.numidgps,
      "Punto Control": sub.codpuntocontrol,
      Latitud: sub.latitud,
      Longitud: sub.longitud,
      "Fecha Llegada": sub.fechallegada,
      "Hora Llegada": sub.horallegada,
      "Fecha Salida": sub.fechasalida,
      "Hora Salida": sub.horasalida,
      Estado: sub.status === "success" ? "Exitoso" : sub.status === "error" ? "Error" : sub.status,
      "Código Respuesta": sub.responseCode || "",
      "Mensaje Respuesta": sub.responseMessage || "",
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respuestas RNDC");
    
    const now = new Date();
    const filename = `respuestas_rndc_${now.toISOString().split('T')[0]}_${now.getHours()}${now.getMinutes()}.xlsx`;
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
      case "completed":
        return <Badge className="bg-green-100 text-green-800" data-testid="badge-completed">Completado</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-unknown">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Importación Masiva</h1>
          <p className="text-muted-foreground">Cargue archivos Excel, genere XMLs y envíe al RNDC.</p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="mr-2 h-4 w-4" /> Nuevo Envío
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" onClick={fetchHistory}>
              <History className="mr-2 h-4 w-4" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Arrastre su archivo Excel aquí</h3>
                  <p className="text-sm text-muted-foreground">O haga clic para seleccionar</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  data-testid="input-file"
                />
                <Button onClick={() => fileInputRef.current?.click()} data-testid="button-select-file">
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
                      <CardDescription>{data.length} registros encontrados</CardDescription>
                    </div>
                    <Button onClick={handleGenerateXml} disabled={generatedSubmissions.length > 0} data-testid="button-generate-xml">
                      Generar XMLs <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[300px] overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>NumID GPS</TableHead>
                            <TableHead>Manifiesto</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Punto Control</TableHead>
                            <TableHead>Cita</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.slice(0, 10).map((row, i) => (
                            <TableRow key={i} data-testid={`row-data-${i}`}>
                              <TableCell className="font-mono">{row.NUMIDGPS}</TableCell>
                              <TableCell className="font-mono">{row.INGRESOIDMANIFIESTO}</TableCell>
                              <TableCell>{row.PLACA}</TableCell>
                              <TableCell>{row.CODPUNTOCONTROL}</TableCell>
                              <TableCell>{formatExcelDateTime(row.FECHACITA, row.HORACITA)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {data.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">Mostrando primeros 10 registros...</p>
                    )}
                  </CardContent>
                </Card>

                {generatedSubmissions.length > 0 && (
                  <div className="grid gap-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileCode className="h-5 w-5" /> XMLs Generados ({generatedSubmissions.length})
                      </h3>
                      <Button
                        onClick={handleSendAll}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={isSending}
                        data-testid="button-send-all"
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
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <XmlViewer xml={generatedSubmissions[0]?.xmlRequest || ""} title="Ejemplo Registro #1" />
                      {generatedSubmissions.length > 1 && (
                        <XmlViewer xml={generatedSubmissions[1]?.xmlRequest || ""} title="Ejemplo Registro #2" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lotes Enviados</CardTitle>
                  <CardDescription>Historial de envíos masivos al RNDC</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingHistory} data-testid="button-refresh">
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </CardHeader>
              <CardContent>
                {batches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay lotes enviados aún</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Exitosos</TableHead>
                          <TableHead>Errores</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batches.map((batch) => (
                          <TableRow key={batch.id} data-testid={`row-batch-${batch.id}`}>
                            <TableCell>{new Date(batch.createdAt).toLocaleString('es-CO')}</TableCell>
                            <TableCell>{batch.totalRecords}</TableCell>
                            <TableCell className="text-green-600">{batch.successCount}</TableCell>
                            <TableCell className="text-red-600">{batch.errorCount}</TableCell>
                            <TableCell>{getStatusBadge(batch.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Envíos</CardTitle>
                <CardDescription>Últimos 50 registros enviados</CardDescription>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No hay envíos registrados</p>
                ) : (
                  <div className="rounded-md border max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Manifiesto</TableHead>
                          <TableHead>Placa</TableHead>
                          <TableHead>NumID GPS</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Respuesta</TableHead>
                          <TableHead>Ver</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map((sub) => (
                          <TableRow key={sub.id} data-testid={`row-submission-${sub.id}`}>
                            <TableCell className="font-mono">{sub.ingresoidmanifiesto}</TableCell>
                            <TableCell>{sub.numplaca}</TableCell>
                            <TableCell className="font-mono text-xs">{sub.numidgps}</TableCell>
                            <TableCell>{getStatusBadge(sub.status)}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs">
                              {sub.responseMessage || "-"}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(sub)} data-testid={`button-view-${sub.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh]">
                                  <DialogHeader>
                                    <DialogTitle>Detalle del Envío - {sub.ingresoidmanifiesto}</DialogTitle>
                                  </DialogHeader>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <h4 className="font-semibold mb-2">XML Enviado</h4>
                                      <ScrollArea className="h-[300px] rounded-md border p-2 bg-slate-50">
                                        <pre className="text-xs whitespace-pre-wrap">{sub.xmlRequest}</pre>
                                      </ScrollArea>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Respuesta RNDC</h4>
                                      <ScrollArea className="h-[300px] rounded-md border p-2 bg-slate-50">
                                        <pre className="text-xs whitespace-pre-wrap">{sub.xmlResponse || "Sin respuesta aún"}</pre>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex gap-4 text-sm">
                                    <div><strong>Código:</strong> {sub.responseCode || "-"}</div>
                                    <div><strong>Mensaje:</strong> {sub.responseMessage || "-"}</div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {showResults && (
          <Card className="animate-in fade-in slide-in-from-bottom-4" data-testid="card-results">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Respuestas del RNDC
                  {isPolling && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                </CardTitle>
                <CardDescription>
                  {currentBatch ? (
                    <>
                      Total: {currentBatch.totalRecords} | 
                      Exitosos: <span className="text-green-600">{currentBatch.successCount}</span> | 
                      Errores: <span className="text-red-600">{currentBatch.errorCount}</span> | 
                      Pendientes: <span className="text-amber-600">{currentBatch.pendingCount}</span>
                    </>
                  ) : (
                    "Procesando..."
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => currentBatchId && fetchBatchResults(currentBatchId)}
                  disabled={isPolling}
                  data-testid="button-refresh-results"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportResults}
                  disabled={currentBatchResults.length === 0}
                  data-testid="button-export-results"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCloseResults}
                  data-testid="button-close-results"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {currentBatchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Esperando respuestas del RNDC...
                </div>
              ) : (
                <div className="rounded-md border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Manifiesto</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>NumID GPS</TableHead>
                        <TableHead>Fecha/Hora Llegada</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Mensaje Respuesta</TableHead>
                        <TableHead>Ver</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentBatchResults.map((sub) => (
                        <TableRow 
                          key={sub.id} 
                          className={sub.status === "error" ? "bg-red-50" : sub.status === "success" ? "bg-green-50" : ""}
                          data-testid={`row-result-${sub.id}`}
                        >
                          <TableCell className="font-mono">{sub.ingresoidmanifiesto}</TableCell>
                          <TableCell>{sub.numplaca}</TableCell>
                          <TableCell className="font-mono text-xs">{sub.numidgps}</TableCell>
                          <TableCell className="text-xs">
                            {sub.fechallegada} {sub.horallegada}
                          </TableCell>
                          <TableCell>{getStatusBadge(sub.status)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {sub.responseCode || "-"}
                          </TableCell>
                          <TableCell className="max-w-[300px] text-xs">
                            {sub.responseMessage || (sub.status === "pending" ? "Pendiente..." : "-")}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(sub)} data-testid={`button-view-result-${sub.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Detalle del Envío - {sub.ingresoidmanifiesto}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div>
                                    <h4 className="font-semibold mb-2">XML Enviado</h4>
                                    <ScrollArea className="h-[300px] rounded-md border p-2 bg-slate-50">
                                      <pre className="text-xs whitespace-pre-wrap">{sub.xmlRequest}</pre>
                                    </ScrollArea>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Respuesta RNDC</h4>
                                    <ScrollArea className="h-[300px] rounded-md border p-2 bg-slate-50">
                                      <pre className="text-xs whitespace-pre-wrap">{sub.xmlResponse || "Sin respuesta aún"}</pre>
                                    </ScrollArea>
                                  </div>
                                </div>
                                <div className="mt-4 flex gap-4 text-sm">
                                  <div><strong>Código:</strong> {sub.responseCode || "-"}</div>
                                  <div><strong>Mensaje:</strong> {sub.responseMessage || "-"}</div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
