import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XmlViewer } from "@/components/xml-viewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RefreshCw, Search, Clock, AlertCircle, Download, Eye, FileSpreadsheet, History, Database, ChevronLeft, ChevronRight, Filter, X, CalendarIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

interface ManifestData {
  ingresoidmanifiesto: string;
  numnitempresatransporte: string;
  nummanifiestocarga: string;
  fechaexpedicionmanifiesto: string;
  numplaca: string;
  puntoscontrol: any;
}

interface StoredManifest {
  id: string;
  ingresoIdManifiesto: string;
  numNitEmpresaTransporte: string;
  fechaExpedicionManifiesto: string | null;
  codigoEmpresa: string | null;
  numManifiestoCarga: string;
  numPlaca: string;
  createdAt: string;
}

interface ControlPoint {
  id: string;
  manifestId: string;
  codPuntoControl: string;
  codMunicipio: string | null;
  direccion: string | null;
  fechaCita: string | null;
  horaCita: string | null;
  latitud: string | null;
  longitud: string | null;
  tiempoPactado: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MonitoringQuery {
  id: string;
  queryType: string;
  numIdGps: string;
  manifestId: string | null;
  xmlRequest: string;
  xmlResponse: string | null;
  manifestsCount: number;
  manifestsData: string | null;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  createdAt: string;
}

export default function Monitoring() {
  const { settings, getActiveWsUrl } = useSettings();
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(300);
  const [canRequest, setCanRequest] = useState(true);
  const [requestXml, setRequestXml] = useState("");
  const [responseXml, setResponseXml] = useState("");
  const [manifests, setManifests] = useState<ManifestData[]>([]);
  const [specificManifestId, setSpecificManifestId] = useState("");
  const [queryHistory, setQueryHistory] = useState<MonitoringQuery[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("results");
  
  const [storedManifests, setStoredManifests] = useState<StoredManifest[]>([]);
  const [storedPagination, setStoredPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loadingStored, setLoadingStored] = useState(false);
  const [selectedManifestControlPoints, setSelectedManifestControlPoints] = useState<ControlPoint[]>([]);
  const [loadingControlPoints, setLoadingControlPoints] = useState(false);
  const [controlPointsDialogOpen, setControlPointsDialogOpen] = useState(false);
  const [selectedManifestInfo, setSelectedManifestInfo] = useState<StoredManifest | null>(null);
  
  const [searchFilters, setSearchFilters] = useState({
    dateFrom: "",
    dateTo: "",
    numPlaca: "",
    ingresoIdManifiesto: "",
    numManifiestoCarga: "",
    codPuntoControl: "",
  });
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0 && !canRequest) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanRequest(true);
      setTimer(300);
    }
    return () => clearInterval(interval);
  }, [timer, canRequest]);

  useEffect(() => {
    if (activeTab === "stored" && storedManifests.length === 0 && !loadingStored) {
      fetchStoredManifests(1);
    }
  }, [activeTab]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateRequestXml = (type: 'NUEVOS' | 'TODOS' | 'SPECIFIC', id?: string) => {
    const base = `<?xml version='1.0' encoding='iso-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameGps}</username>
<password>${settings.passwordGps}</password>
</acceso>
<solicitud>
<tipo>9</tipo>
<procesoid>4</procesoid>
</solicitud>
<documento>
<numidgps>${settings.companyNit}</numidgps>`;

    if (type === 'SPECIFIC' && id) {
      return `${base}
<ingresoidmanifiesto>${id}</ingresoidmanifiesto>
</documento>
</root>`;
    }

    return `${base}
<manifiestos>${type}</manifiestos>
</documento>
</root>`;
  };

  const generateSoapEnvelope = (xmlContent: string) => {
    const cleanedXml = xmlContent.replace(/<\?xml[^?]*\?>\s*/gi, '').trim();
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
               xmlns:tns="urn:BPMServicesIntf-IBPMServices">
  <soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
    <tns:AtenderMensajeRNDC>
      <Request xsi:type="xsd:string">${cleanedXml}</Request>
    </tns:AtenderMensajeRNDC>
  </soap:Body>
</soap:Envelope>`;
  };

  const handleRequest = async (type: 'NUEVOS' | 'TODOS' | 'SPECIFIC') => {
    if (!canRequest && type !== 'SPECIFIC') {
      toast({
        title: "Espere por favor",
        description: `Debe esperar ${formatTime(timer)} para realizar una nueva consulta masiva.`,
        variant: "destructive",
      });
      return;
    }

    if (type === 'SPECIFIC' && !specificManifestId.trim()) {
      toast({
        title: "ID requerido",
        description: "Por favor ingrese el ID del manifiesto a consultar.",
        variant: "destructive",
      });
      return;
    }

    const xml = generateRequestXml(type, type === 'SPECIFIC' ? specificManifestId : undefined);
    setRequestXml(xml);
    setLoading(true);
    
    if (type !== 'SPECIFIC') {
      setCanRequest(false);
    }

    try {
      const response = await fetch("/api/rndc/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryType: type,
          numIdGps: settings.companyNit,
          manifestId: type === 'SPECIFIC' ? specificManifestId : undefined,
          xmlRequest: xml,
          wsUrl: getActiveWsUrl(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResponseXml(data.rawXml || "");
        setManifests(data.manifests || []);
        toast({
          title: "Consulta Exitosa",
          description: `Se han recuperado ${data.manifestsCount || 0} manifiestos del RNDC.`,
        });
      } else {
        setResponseXml(data.rawXml || data.message || "Error en la consulta");
        setManifests([]);
        toast({
          title: "Error en consulta",
          description: data.message || "No se pudo obtener respuesta del RNDC",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/rndc/monitoring/history?limit=20");
      const data = await response.json();
      if (data.success) {
        setQueryHistory(data.queries);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar el historial",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchStoredManifests = async (page: number = 1, useFilters: boolean = false) => {
    setLoadingStored(true);
    try {
      let url = `/api/rndc/manifests?page=${page}&limit=20`;
      
      if (useFilters || isSearchActive) {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", "20");
        
        if (searchFilters.dateFrom) params.set("dateFrom", searchFilters.dateFrom);
        if (searchFilters.dateTo) params.set("dateTo", searchFilters.dateTo);
        if (searchFilters.numPlaca) params.set("numPlaca", searchFilters.numPlaca);
        if (searchFilters.ingresoIdManifiesto) params.set("ingresoIdManifiesto", searchFilters.ingresoIdManifiesto);
        if (searchFilters.numManifiestoCarga) params.set("numManifiestoCarga", searchFilters.numManifiestoCarga);
        if (searchFilters.codPuntoControl) params.set("codPuntoControl", searchFilters.codPuntoControl);
        
        url = `/api/rndc/manifests/search?${params.toString()}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setStoredManifests(data.manifests);
        setStoredPagination(data.pagination);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar los manifiestos guardados",
        variant: "destructive",
      });
    } finally {
      setLoadingStored(false);
    }
  };

  const handleSearch = () => {
    const hasFilters = Object.values(searchFilters).some(v => v.trim() !== "");
    setIsSearchActive(hasFilters);
    fetchStoredManifests(1, hasFilters);
  };

  const clearSearch = () => {
    setSearchFilters({
      dateFrom: "",
      dateTo: "",
      numPlaca: "",
      ingresoIdManifiesto: "",
      numManifiestoCarga: "",
      codPuntoControl: "",
    });
    setIsSearchActive(false);
    fetchStoredManifests(1, false);
  };

  const exportStoredToExcel = async () => {
    setLoadingExport(true);
    try {
      const params = new URLSearchParams();
      if (searchFilters.dateFrom) params.set("dateFrom", searchFilters.dateFrom);
      if (searchFilters.dateTo) params.set("dateTo", searchFilters.dateTo);
      if (searchFilters.numPlaca) params.set("numPlaca", searchFilters.numPlaca);
      if (searchFilters.ingresoIdManifiesto) params.set("ingresoIdManifiesto", searchFilters.ingresoIdManifiesto);
      if (searchFilters.numManifiestoCarga) params.set("numManifiestoCarga", searchFilters.numManifiestoCarga);
      if (searchFilters.codPuntoControl) params.set("codPuntoControl", searchFilters.codPuntoControl);

      const response = await fetch(`/api/rndc/manifests/export?${params.toString()}`);
      const data = await response.json();

      if (!data.success || data.count === 0) {
        toast({
          title: "Sin datos",
          description: "No hay manifiestos para exportar",
          variant: "destructive",
        });
        return;
      }

      const combinedRows: any[] = [];

      data.data.forEach((item: any) => {
        const m = item.manifest;
        
        if (item.controlPoints.length === 0) {
          combinedRows.push({
            "ingresoidmanifiesto": m.ingresoIdManifiesto,
            "numnitempresatransporte": m.numNitEmpresaTransporte,
            "nummanifiestocarga": m.numManifiestoCarga,
            "fechaexpedicionmanifiesto": m.fechaExpedicionManifiesto || "",
            "codigoempresa": m.codigoEmpresa || "",
            "numplaca": m.numPlaca,
            "codpuntocontrol": "",
            "codmunicipio": "",
            "direccion": "",
            "fechacita": "",
            "horacita": "",
            "latitud": "",
            "longitud": "",
            "tiempopactado": "",
          });
        } else {
          item.controlPoints.forEach((cp: any) => {
            combinedRows.push({
              "ingresoidmanifiesto": m.ingresoIdManifiesto,
              "numnitempresatransporte": m.numNitEmpresaTransporte,
              "nummanifiestocarga": m.numManifiestoCarga,
              "fechaexpedicionmanifiesto": m.fechaExpedicionManifiesto || "",
              "codigoempresa": m.codigoEmpresa || "",
              "numplaca": m.numPlaca,
              "codpuntocontrol": cp.codPuntoControl,
              "codmunicipio": cp.codMunicipio || "",
              "direccion": cp.direccion || "",
              "fechacita": cp.fechaCita || "",
              "horacita": cp.horaCita || "",
              "latitud": cp.latitud || "",
              "longitud": cp.longitud || "",
              "tiempopactado": cp.tiempoPactado || "",
            });
          });
        }
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(combinedRows);
      XLSX.utils.book_append_sheet(wb, ws, "manifiestos_puntoscontrol");

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `manifiestos_guardados_${date}.xlsx`);

      toast({
        title: "Exportación exitosa",
        description: `Se exportaron ${data.count} manifiestos a Excel`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo exportar los manifiestos",
        variant: "destructive",
      });
    } finally {
      setLoadingExport(false);
    }
  };

  const fetchControlPoints = async (manifest: StoredManifest) => {
    setSelectedManifestInfo(manifest);
    setLoadingControlPoints(true);
    setControlPointsDialogOpen(true);
    try {
      const response = await fetch(`/api/rndc/manifests/${manifest.id}/control-points`);
      const data = await response.json();
      if (data.success) {
        setSelectedManifestControlPoints(data.controlPoints);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cargar los puntos de control",
        variant: "destructive",
      });
    } finally {
      setLoadingControlPoints(false);
    }
  };

  const loadHistoryQuery = (query: MonitoringQuery) => {
    setRequestXml(query.xmlRequest);
    setResponseXml(query.xmlResponse || "");
    if (query.manifestsData) {
      try {
        setManifests(JSON.parse(query.manifestsData));
      } catch {
        setManifests([]);
      }
    } else {
      setManifests([]);
    }
    setActiveTab("results");
  };

  const exportToExcel = () => {
    if (manifests.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay manifiestos para exportar",
        variant: "destructive",
      });
      return;
    }

    const exportData = manifests.map(m => ({
      "ID Manifiesto": m.ingresoidmanifiesto,
      "NIT Empresa": m.numnitempresatransporte,
      "Número Manifiesto": m.nummanifiestocarga,
      "Fecha Expedición": m.fechaexpedicionmanifiesto,
      "Placa": m.numplaca,
      "Puntos Control": m.puntoscontrol ? JSON.stringify(m.puntoscontrol) : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Manifiestos");
    
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `manifiestos_rndc_${date}.xlsx`);

    toast({
      title: "Exportación exitosa",
      description: `Se exportaron ${manifests.length} manifiestos a Excel`,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Monitoreo RNDC</h1>
            <p className="text-muted-foreground">Consulta de manifiestos y puntos de control asignados.</p>
          </div>
          {!canRequest && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-md border border-amber-200 dark:border-amber-900">
              <Clock className="h-4 w-4" />
              <span className="font-mono font-medium">{formatTime(timer)}</span>
              <span className="text-xs">para siguiente consulta</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>Opciones de Consulta</CardTitle>
              <CardDescription>Seleccione el tipo de solicitud al WebService</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-between" 
                onClick={() => handleRequest('NUEVOS')}
                disabled={loading || !canRequest}
                data-testid="button-manifiestos-nuevos"
              >
                Manifiestos Nuevos
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => handleRequest('TODOS')}
                disabled={loading || !canRequest}
                data-testid="button-manifiestos-todos"
              >
                Todos (24 horas)
                <Clock className="h-4 w-4" />
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">O individual</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Buscar por ID Manifiesto</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Ej: 123456789" 
                    value={specificManifestId}
                    onChange={(e) => setSpecificManifestId(e.target.value)}
                    data-testid="input-manifest-id"
                  />
                  <Button 
                    size="icon" 
                    variant="secondary"
                    onClick={() => handleRequest('SPECIFIC')}
                    disabled={loading}
                    data-testid="button-search-manifest"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="results" data-testid="tab-results">Resultados</TabsTrigger>
                  <TabsTrigger value="xml" data-testid="tab-xml">XML Intercambio</TabsTrigger>
                  <TabsTrigger value="history" onClick={fetchHistory} data-testid="tab-history">
                    <History className="h-4 w-4 mr-2" />
                    Historial
                  </TabsTrigger>
                  <TabsTrigger value="stored" onClick={() => fetchStoredManifests(1)} data-testid="tab-stored">
                    <Database className="h-4 w-4 mr-2" />
                    Guardados
                  </TabsTrigger>
                </TabsList>
                {manifests.length > 0 && activeTab === "results" && (
                  <Button onClick={exportToExcel} variant="outline" size="sm" data-testid="button-export-excel">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                )}
              </div>
              
              <TabsContent value="results" className="space-y-4 mt-4">
                {manifests.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileSpreadsheet className="h-12 w-12 mb-4 opacity-50" />
                      <p>No hay manifiestos para mostrar</p>
                      <p className="text-sm">Realice una consulta para ver los resultados</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Manifiestos Encontrados</span>
                        <Badge variant="secondary">{manifests.length} registros</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID Manifiesto</TableHead>
                              <TableHead>NIT Empresa</TableHead>
                              <TableHead>Núm. Manifiesto</TableHead>
                              <TableHead>Fecha Expedición</TableHead>
                              <TableHead>Placa</TableHead>
                              <TableHead>Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {manifests.map((manifest, index) => (
                              <TableRow key={manifest.ingresoidmanifiesto || index} data-testid={`row-manifest-${index}`}>
                                <TableCell className="font-mono text-sm">{manifest.ingresoidmanifiesto}</TableCell>
                                <TableCell>{manifest.numnitempresatransporte}</TableCell>
                                <TableCell>{manifest.nummanifiestocarga}</TableCell>
                                <TableCell>{manifest.fechaexpedicionmanifiesto}</TableCell>
                                <TableCell className="font-medium">{manifest.numplaca}</TableCell>
                                <TableCell>
                                  {manifest.puntoscontrol && (
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button size="sm" variant="ghost" data-testid={`button-view-puntos-${index}`}>
                                          <Eye className="h-4 w-4 mr-1" />
                                          Ver Puntos
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl max-h-[80vh]">
                                        <DialogHeader>
                                          <DialogTitle>Puntos de Control - Manifiesto {manifest.nummanifiestocarga}</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="h-[400px]">
                                          <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                                            {JSON.stringify(manifest.puntoscontrol, null, 2)}
                                          </pre>
                                        </ScrollArea>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="xml" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant="outline">SOAP Envelope Completo</Badge>
                        <span className="text-muted-foreground font-normal">- XML real enviado al RNDC</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <XmlViewer xml={requestXml ? generateSoapEnvelope(requestXml) : "Esperando consulta..."} title="SOAP Request" />
                    </CardContent>
                  </Card>
                  <div>
                    <Label className="text-xs mb-2 block">Contenido XML Interno</Label>
                    <XmlViewer xml={requestXml || "Esperando consulta..."} title="Request" />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Respuesta RNDC</Label>
                    <XmlViewer xml={responseXml || "Esperando respuesta..."} title="Response" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Historial de Consultas</CardTitle>
                      <Button size="sm" variant="outline" onClick={fetchHistory} disabled={loadingHistory}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistory ? "animate-spin" : ""}`} />
                        Actualizar
                      </Button>
                    </div>
                    <CardDescription>Consultas anteriores realizadas al RNDC</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : queryHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mb-4 opacity-50" />
                        <p>No hay consultas anteriores</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>Manifiestos</TableHead>
                              <TableHead>Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {queryHistory.map((query) => (
                              <TableRow key={query.id} data-testid={`row-history-${query.id}`}>
                                <TableCell className="text-sm">{formatDate(query.createdAt)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{query.queryType}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={query.status === "success" ? "default" : "destructive"}>
                                    {query.status === "success" ? "Exitoso" : "Error"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{query.manifestsCount || 0}</TableCell>
                                <TableCell>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => loadHistoryQuery(query)}
                                    data-testid={`button-load-history-${query.id}`}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stored" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Manifiestos Guardados
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{storedPagination.total} total</Badge>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={exportStoredToExcel} 
                          disabled={loadingExport || storedPagination.total === 0}
                          data-testid="button-export-stored"
                        >
                          <Download className={`h-4 w-4 mr-2 ${loadingExport ? "animate-spin" : ""}`} />
                          Exportar Excel
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => fetchStoredManifests(storedPagination.page, isSearchActive)} disabled={loadingStored} data-testid="button-refresh-stored">
                          <RefreshCw className={`h-4 w-4 mr-2 ${loadingStored ? "animate-spin" : ""}`} />
                          Actualizar
                        </Button>
                      </div>
                    </div>
                    <CardDescription>Manifiestos recuperados del RNDC y almacenados en la base de datos</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pb-3 border-b">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Filter className="h-4 w-4" />
                        Filtros de búsqueda
                        {isSearchActive && (
                          <Badge variant="default" className="ml-2">Filtros activos</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Fecha Desde</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-8 text-sm justify-start text-left font-normal"
                                data-testid="input-date-from"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {searchFilters.dateFrom 
                                  ? format(parse(searchFilters.dateFrom, "yyyy-MM-dd", new Date()), "dd/MM/yyyy", { locale: es })
                                  : "Seleccionar"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={searchFilters.dateFrom ? parse(searchFilters.dateFrom, "yyyy-MM-dd", new Date()) : undefined}
                                onSelect={(date) => setSearchFilters(prev => ({ ...prev, dateFrom: date ? format(date, "yyyy-MM-dd") : "" }))}
                                locale={es}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fecha Hasta</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-8 text-sm justify-start text-left font-normal"
                                data-testid="input-date-to"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {searchFilters.dateTo 
                                  ? format(parse(searchFilters.dateTo, "yyyy-MM-dd", new Date()), "dd/MM/yyyy", { locale: es })
                                  : "Seleccionar"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={searchFilters.dateTo ? parse(searchFilters.dateTo, "yyyy-MM-dd", new Date()) : undefined}
                                onSelect={(date) => setSearchFilters(prev => ({ ...prev, dateTo: date ? format(date, "yyyy-MM-dd") : "" }))}
                                locale={es}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Placa</Label>
                          <Input
                            placeholder="Ej: ABC123"
                            value={searchFilters.numPlaca}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, numPlaca: e.target.value }))}
                            className="h-8 text-sm"
                            data-testid="input-filter-placa"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">ID Manifiesto</Label>
                          <Input
                            placeholder="Ej: 123456"
                            value={searchFilters.ingresoIdManifiesto}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, ingresoIdManifiesto: e.target.value }))}
                            className="h-8 text-sm"
                            data-testid="input-filter-id-manifiesto"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Núm. Manifiesto</Label>
                          <Input
                            placeholder="Ej: M-001"
                            value={searchFilters.numManifiestoCarga}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, numManifiestoCarga: e.target.value }))}
                            className="h-8 text-sm"
                            data-testid="input-filter-num-manifiesto"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Punto Control</Label>
                          <Input
                            placeholder="Código"
                            value={searchFilters.codPuntoControl}
                            onChange={(e) => setSearchFilters(prev => ({ ...prev, codPuntoControl: e.target.value }))}
                            className="h-8 text-sm"
                            data-testid="input-filter-punto-control"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSearch} disabled={loadingStored} data-testid="button-search-stored">
                          <Search className="h-4 w-4 mr-2" />
                          Buscar
                        </Button>
                        {isSearchActive && (
                          <Button size="sm" variant="ghost" onClick={clearSearch} disabled={loadingStored} data-testid="button-clear-search">
                            <X className="h-4 w-4 mr-2" />
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardContent>
                    {loadingStored ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : storedManifests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Database className="h-12 w-12 mb-4 opacity-50" />
                        <p>No hay manifiestos guardados</p>
                        <p className="text-sm">Realice una consulta para guardar manifiestos</p>
                      </div>
                    ) : (
                      <>
                        <ScrollArea className="h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID Manifiesto</TableHead>
                                <TableHead>NIT Empresa</TableHead>
                                <TableHead>Núm. Manifiesto</TableHead>
                                <TableHead>Fecha Expedición</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Guardado</TableHead>
                                <TableHead>Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {storedManifests.map((manifest, index) => (
                                <TableRow key={manifest.id} data-testid={`row-stored-${manifest.id}`}>
                                  <TableCell className="font-mono text-sm">{manifest.ingresoIdManifiesto}</TableCell>
                                  <TableCell>{manifest.numNitEmpresaTransporte}</TableCell>
                                  <TableCell>{manifest.numManifiestoCarga}</TableCell>
                                  <TableCell>{manifest.fechaExpedicionManifiesto || "-"}</TableCell>
                                  <TableCell className="font-medium">{manifest.numPlaca}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{formatDate(manifest.createdAt)}</TableCell>
                                  <TableCell>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => fetchControlPoints(manifest)}
                                      data-testid={`button-view-control-points-${index}`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Puntos
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                        
                        {storedPagination.totalPages > 1 && (
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              Página {storedPagination.page} de {storedPagination.totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchStoredManifests(storedPagination.page - 1, isSearchActive)}
                                disabled={storedPagination.page <= 1 || loadingStored}
                                data-testid="button-prev-page"
                              >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fetchStoredManifests(storedPagination.page + 1, isSearchActive)}
                                disabled={storedPagination.page >= storedPagination.totalPages || loadingStored}
                                data-testid="button-next-page"
                              >
                                Siguiente
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <Dialog open={controlPointsDialogOpen} onOpenChange={setControlPointsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                Puntos de Control - Manifiesto {selectedManifestInfo?.numManifiestoCarga}
              </DialogTitle>
            </DialogHeader>
            {loadingControlPoints ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedManifestControlPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                <p>No hay puntos de control registrados</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Municipio</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Fecha Cita</TableHead>
                      <TableHead>Hora Cita</TableHead>
                      <TableHead>Coordenadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedManifestControlPoints.map((cp) => (
                      <TableRow key={cp.id} data-testid={`row-control-point-${cp.id}`}>
                        <TableCell className="font-mono">{cp.codPuntoControl}</TableCell>
                        <TableCell>{cp.codMunicipio || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{cp.direccion || "-"}</TableCell>
                        <TableCell>{cp.fechaCita || "-"}</TableCell>
                        <TableCell>{cp.horaCita || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {cp.latitud && cp.longitud ? `${cp.latitud}, ${cp.longitud}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
