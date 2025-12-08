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
import { RefreshCw, Search, Clock, AlertCircle, Download, Eye, FileSpreadsheet, History } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import * as XLSX from "xlsx";

interface ManifestData {
  ingresoidmanifiesto: string;
  numnitempresatransporte: string;
  nummanifiestocarga: string;
  fechaexpedicionmanifiesto: string;
  numplaca: string;
  puntoscontrol: any;
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
  const { settings } = useSettings();
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
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
