import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { XmlViewer } from "@/components/xml-viewer";
import { MapPin, Clock, Send, AlertTriangle, Search, Loader2, CheckCircle, XCircle, History, Truck, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RndcManifest {
  id: string;
  ingresoIdManifiesto: string;
  numNitEmpresaTransporte: string;
  numManifiestoCarga: string;
  numPlaca: string;
  fechaExpedicionManifiesto?: string;
  createdAt: string;
}

interface RndcControlPoint {
  id: string;
  manifestId: string;
  codPuntoControl: string;
  codMunicipio?: string;
  direccion?: string;
  fechaCita?: string;
  horaCita?: string;
  latitud?: string;
  longitud?: string;
  tiempoPactado?: string;
}

interface RndcSubmission {
  id: string;
  batchId: string;
  ingresoidmanifiesto: string;
  numplaca: string;
  codpuntocontrol: string;
  latitud: string;
  longitud: string;
  fechallegada: string;
  horallegada: string;
  fechasalida: string;
  horasalida: string;
  status: string;
  responseCode?: string;
  responseMessage?: string;
  xmlRequest: string;
  xmlResponse?: string;
  createdAt: string;
}

export default function Tracking() {
  const { settings, getActiveWsUrl } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<RndcManifest | null>(null);
  const [manifestControlPoints, setManifestControlPoints] = useState<RndcControlPoint[]>([]);
  const [selectedControlPoint, setSelectedControlPoint] = useState<RndcControlPoint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    arrivalDate: "",
    arrivalTime: "",
    departureDate: "",
    departureTime: "",
    latitud: "",
    longitud: "",
    novelty: "none"
  });
  const [generatedXml, setGeneratedXml] = useState("");
  const [lastResponse, setLastResponse] = useState<{ success: boolean; code: string; message: string } | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<RndcSubmission | null>(null);

  const { data: recentSubmissionsData, refetch: refetchSubmissions } = useQuery({
    queryKey: ["/api/rndc/submissions", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/submissions?limit=20");
      return res.json();
    },
  });

  const recentSubmissions: RndcSubmission[] = recentSubmissionsData?.submissions || [];

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({ title: "Ingrese un número de manifiesto o IngresoID", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    setSelectedManifest(null);
    setManifestControlPoints([]);

    try {
      const res = await fetch(`/api/rndc/manifests/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();

      if (data.success && data.manifest) {
        setSelectedManifest(data.manifest);
        setManifestControlPoints(data.controlPoints || []);
        toast({ title: "Manifiesto encontrado", description: `IngresoID: ${data.manifest.ingresoIdManifiesto}` });
      } else {
        toast({ title: "No encontrado", description: data.message || "No se encontró el manifiesto", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Error al buscar manifiesto", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenReport = (cp: RndcControlPoint) => {
    setSelectedControlPoint(cp);
    const now = new Date();
    setFormData({
      arrivalDate: now.toISOString().split('T')[0],
      arrivalTime: format(now, "HH:mm"),
      departureDate: now.toISOString().split('T')[0],
      departureTime: format(new Date(now.getTime() + 2 * 60 * 60 * 1000), "HH:mm"),
      latitud: cp.latitud || "",
      longitud: cp.longitud || "",
      novelty: "none"
    });
    setGeneratedXml("");
    setLastResponse(null);
    setIsDialogOpen(true);
  };

  const generateXml = () => {
    if (!selectedControlPoint || !selectedManifest) return;

    const fechaLlegada = formData.arrivalDate.split('-').reverse().join('/');
    const fechaSalida = formData.departureDate.split('-').reverse().join('/');

    const xml = `<?xml version='1.0' encoding='iso-8859-1' ?>
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
<numidgps>${settings.companyNit}</numidgps>
<ingresoidmanifiesto>${selectedManifest.ingresoIdManifiesto}</ingresoidmanifiesto>
<numplaca>${selectedManifest.numPlaca.toLowerCase()}</numplaca>
<codpuntocontrol>${selectedControlPoint.codPuntoControl}</codpuntocontrol>
<latitud>${formData.latitud}</latitud>
<longitud>${formData.longitud}</longitud>
<fechallegada>${fechaLlegada}</fechallegada>
<horallegada>${formData.arrivalTime}</horallegada>
<fechasalida>${fechaSalida}</fechasalida>
<horasalida>${formData.departureTime}</horasalida>
${formData.novelty === 'sinsalida' ? '<sinsalida>S</sinsalida>' : ''}
</variables>
</root>`;

    setGeneratedXml(xml);
  };

  const handleSend = async () => {
    if (!generatedXml || !selectedManifest || !selectedControlPoint) return;

    setIsSending(true);
    setLastResponse(null);

    try {
      const wsUrl = getActiveWsUrl();
      const res = await fetch("/api/rndc/submit-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xmlRequest: generatedXml,
          wsUrl,
          metadata: {
            ingresoidmanifiesto: selectedManifest.ingresoIdManifiesto,
            numidgps: settings.companyNit,
            numplaca: selectedManifest.numPlaca,
            codpuntocontrol: selectedControlPoint.codPuntoControl,
            latitud: formData.latitud,
            longitud: formData.longitud,
            fechallegada: formData.arrivalDate.split('-').reverse().join('/'),
            horallegada: formData.arrivalTime,
            fechasalida: formData.departureDate.split('-').reverse().join('/'),
            horasalida: formData.departureTime,
          }
        }),
      });

      const data = await res.json();

      setLastResponse({
        success: data.success && data.response?.success,
        code: data.response?.code || "ERROR",
        message: data.response?.message || data.message || "Error desconocido",
      });

      if (data.success && data.response?.success) {
        toast({
          title: "Reporte Enviado",
          description: `Código: ${data.response.code} - ${data.response.message}`,
          className: "bg-green-50 border-green-200",
        });
        refetchSubmissions();
      } else {
        toast({
          title: "Error en Reporte",
          description: data.response?.message || data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar reporte";
      setLastResponse({ success: false, code: "ERROR", message });
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-tracking-title">Reporte de Tiempos (RMM)</h1>
          <p className="text-muted-foreground">Registro de novedades y tiempos logísticos para puntos de control.</p>
        </div>

        <Tabs defaultValue="reportar" className="w-full">
          <TabsList>
            <TabsTrigger value="reportar" className="gap-2">
              <Send className="h-4 w-4" /> Reportar
            </TabsTrigger>
            <TabsTrigger value="historial" className="gap-2">
              <History className="h-4 w-4" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reportar" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-500" />
                  Buscar Manifiesto
                </CardTitle>
                <CardDescription>Ingrese el número de manifiesto o IngresoID para reportar tiempos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    placeholder="Número de manifiesto o IngresoID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                    data-testid="input-search-manifest"
                  />
                  <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-manifest">
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">Buscar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {selectedManifest && (
              <Card className="animate-in fade-in slide-in-from-top-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-green-500" />
                    Manifiesto #{selectedManifest.numManifiestoCarga}
                  </CardTitle>
                  <CardDescription>
                    IngresoID: <span className="font-mono text-primary">{selectedManifest.ingresoIdManifiesto}</span> | 
                    Placa: <span className="font-mono">{selectedManifest.numPlaca}</span> |
                    NIT: {selectedManifest.numNitEmpresaTransporte}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {manifestControlPoints.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay puntos de control registrados para este manifiesto
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {manifestControlPoints.map((cp) => (
                        <Card key={cp.id} className="hover:border-primary transition-colors cursor-pointer" onClick={() => handleOpenReport(cp)}>
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                Punto #{cp.codPuntoControl}
                              </CardTitle>
                            </div>
                            <CardDescription className="font-mono text-xs">
                              {cp.direccion || cp.codMunicipio || "Sin dirección"}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {cp.fechaCita && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                <Clock className="h-3 w-3" />
                                Cita: {cp.fechaCita} {cp.horaCita}
                              </div>
                            )}
                            {cp.latitud && cp.longitud && (
                              <div className="text-xs text-muted-foreground mb-2">
                                📍 {cp.latitud}, {cp.longitud}
                              </div>
                            )}
                            <Button size="sm" className="w-full mt-2" variant="secondary" data-testid={`button-report-cp-${cp.codPuntoControl}`}>
                              Reportar Tiempos
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historial">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-500" />
                  Historial de Reportes
                </CardTitle>
                <CardDescription>Últimos reportes de tiempos enviados al RNDC</CardDescription>
              </CardHeader>
              <CardContent>
                {recentSubmissions.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    No hay reportes registrados
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ESTADO</TableHead>
                          <TableHead>INGRESOID</TableHead>
                          <TableHead>PLACA</TableHead>
                          <TableHead>PUNTO</TableHead>
                          <TableHead>LLEGADA</TableHead>
                          <TableHead>SALIDA</TableHead>
                          <TableHead>FECHA</TableHead>
                          <TableHead>VER</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentSubmissions.map((sub) => (
                          <TableRow key={sub.id} data-testid={`submission-row-${sub.id}`}>
                            <TableCell>
                              {sub.status === "success" ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : sub.status === "error" ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-primary">{sub.ingresoidmanifiesto}</TableCell>
                            <TableCell className="font-mono">{sub.numplaca}</TableCell>
                            <TableCell className="font-medium">{sub.codpuntocontrol}</TableCell>
                            <TableCell className="text-xs">{sub.fechallegada} {sub.horallegada}</TableCell>
                            <TableCell className="text-xs">{sub.fechasalida} {sub.horasalida}</TableCell>
                            <TableCell className="text-xs">
                              {format(new Date(sub.createdAt), "dd/MM HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedSubmission(sub)}
                                data-testid={`button-view-submission-${sub.id}`}
                              >
                                <Eye className="h-4 w-4" />
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Reportar Punto de Control #{selectedControlPoint?.codPuntoControl}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitud</Label>
                  <Input 
                    value={formData.latitud} 
                    onChange={e => setFormData({...formData, latitud: e.target.value})}
                    placeholder="Ej: 4.7110"
                    data-testid="input-latitud"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitud</Label>
                  <Input 
                    value={formData.longitud} 
                    onChange={e => setFormData({...formData, longitud: e.target.value})}
                    placeholder="Ej: -74.0721"
                    data-testid="input-longitud"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Llegada</Label>
                  <Input 
                    type="date" 
                    value={formData.arrivalDate} 
                    onChange={e => setFormData({...formData, arrivalDate: e.target.value})}
                    data-testid="input-arrival-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Llegada</Label>
                  <Input 
                    type="time" 
                    value={formData.arrivalTime}
                    onChange={e => setFormData({...formData, arrivalTime: e.target.value})}
                    data-testid="input-arrival-time"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Salida</Label>
                  <Input 
                    type="date" 
                    value={formData.departureDate}
                    onChange={e => setFormData({...formData, departureDate: e.target.value})}
                    data-testid="input-departure-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Salida</Label>
                  <Input 
                    type="time" 
                    value={formData.departureTime}
                    onChange={e => setFormData({...formData, departureTime: e.target.value})}
                    data-testid="input-departure-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Novedad / Sin Salida</Label>
                <Select 
                  value={formData.novelty}
                  onValueChange={v => setFormData({...formData, novelty: v})}
                >
                  <SelectTrigger data-testid="select-novelty">
                    <SelectValue placeholder="Seleccione novedad..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Novedad (Reporte Normal)</SelectItem>
                    <SelectItem value="sinsalida">Sin Salida (&gt; 72 horas)</SelectItem>
                  </SelectContent>
                </Select>
                {formData.novelty === 'sinsalida' && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    Se marcará como &lt;sinsalida&gt;S&lt;/sinsalida&gt;
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={generateXml} variant="outline" className="mr-2" data-testid="button-preview-xml">
                  Previsualizar XML
                </Button>
              </div>

              {generatedXml && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <Label className="mb-2 block">XML a Enviar</Label>
                  <XmlViewer xml={generatedXml} />
                </div>
              )}

              {lastResponse && (
                <div className={`p-4 rounded-lg ${lastResponse.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {lastResponse.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-medium ${lastResponse.success ? 'text-green-700' : 'text-red-700'}`}>
                      Código: {lastResponse.code}
                    </span>
                  </div>
                  <p className={`mt-1 text-sm ${lastResponse.success ? 'text-green-600' : 'text-red-600'}`}>
                    {lastResponse.message}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSend} disabled={!generatedXml || isSending} className="gap-2" data-testid="button-send-report">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar al RNDC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle de Reporte - IngresoID {selectedSubmission?.ingresoidmanifiesto}</DialogTitle>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-muted-foreground">Estado</Label>
                    <p className={selectedSubmission.status === "success" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {selectedSubmission.status === "success" ? "Exitoso" : "Error"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Código Respuesta</Label>
                    <p className="font-mono">{selectedSubmission.responseCode || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fecha</Label>
                    <p>{format(new Date(selectedSubmission.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                  </div>
                </div>
                {selectedSubmission.responseMessage && (
                  <div>
                    <Label className="text-muted-foreground">Mensaje</Label>
                    <p className="text-sm">{selectedSubmission.responseMessage}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground mb-2 block">XML Enviado</Label>
                  <XmlViewer xml={selectedSubmission.xmlRequest} />
                </div>
                {selectedSubmission.xmlResponse && (
                  <div>
                    <Label className="text-muted-foreground mb-2 block">XML Respuesta</Label>
                    <XmlViewer xml={selectedSubmission.xmlResponse} />
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
