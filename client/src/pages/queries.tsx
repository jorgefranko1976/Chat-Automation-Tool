import { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, History, User, Loader2, CheckCircle, XCircle, Eye } from "lucide-react";
import { XmlViewer } from "@/components/xml-viewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RndcQuery {
  id: string;
  queryType: string;
  queryName: string;
  numNitEmpresa: string | null;
  numIdTercero: string | null;
  xmlRequest: string;
  xmlResponse: string | null;
  responseData: string | null;
  status: string;
  responseCode: string | null;
  responseMessage: string | null;
  createdAt: string;
}

const QUERY_TYPES = [
  { value: "terceros", label: "Terceros", tipo: "3", procesoid: "11" },
];

const TERCEROS_VARIABLES = "INGRESOID,FECHAING,CODTIPOIDTERCERO,NOMIDTERCERO,PRIMERAPELLIDOIDTERCERO,SEGUNDOAPELLIDOIDTERCERO,NUMTELEFONOCONTACTO,NOMENCLATURADIRECCION,CODMUNICIPIORNDC,CODSEDETERCERO,NOMSEDETERCERO,NUMLICENCIACONDUCCION,CODCATEGORIALICENCIACONDUCCION,FECHAVENCIMIENTOLICENCIA,LATITUD,LONGITUD,REGIMENSIMPLE";

export default function Queries() {
  const { settings } = useSettings();
  const [queryType, setQueryType] = useState("terceros");
  const [numIdTercero, setNumIdTercero] = useState("");
  const [generatedXml, setGeneratedXml] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [selectedQuery, setSelectedQuery] = useState<RndcQuery | null>(null);

  const { data: queriesData, refetch: refetchQueries } = useQuery({
    queryKey: ["/api/rndc/queries"],
    queryFn: async () => {
      const res = await fetch("/api/rndc/queries?limit=50");
      return res.json();
    },
  });

  const queries: RndcQuery[] = queriesData?.queries || [];

  const generateXml = () => {
    if (!numIdTercero.trim()) {
      toast({
        title: "Campo requerido",
        description: "Ingrese el número de identificación del tercero",
        variant: "destructive",
      });
      return;
    }

    const queryConfig = QUERY_TYPES.find(q => q.value === queryType);
    if (!queryConfig) return;

    const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
<acceso>
<username>${settings.usernameRndc}</username>
<password>${settings.passwordRndc}</password>
</acceso>
<solicitud>
<tipo>${queryConfig.tipo}</tipo>
<procesoid>${queryConfig.procesoid}</procesoid>
</solicitud>
<variables>
${TERCEROS_VARIABLES}
</variables>
<documento>
<NUMNITEMPRESATRANSPORTE>${settings.companyNit}</NUMNITEMPRESATRANSPORTE>
<NUMIDTERCERO>${numIdTercero}</NUMIDTERCERO>
</documento>
</root>`;

    setGeneratedXml(xml);
    setLastResponse(null);
  };

  const handleSubmit = async () => {
    if (!generatedXml) {
      toast({
        title: "Error",
        description: "Primero genere el XML de consulta",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const wsUrl = settings.wsEnvironment === "production" 
        ? settings.wsUrlProd 
        : settings.wsUrlTest;

      const queryConfig = QUERY_TYPES.find(q => q.value === queryType);

      const response = await apiRequest("POST", "/api/rndc/queries/execute", {
        queryType,
        queryName: queryConfig?.label || queryType,
        numNitEmpresa: settings.companyNit,
        numIdTercero,
        xmlRequest: generatedXml,
        wsUrl,
      });

      const result = await response.json();
      setLastResponse(result);
      refetchQueries();

      if (result.success && result.response?.success) {
        toast({
          title: "Consulta exitosa",
          description: `Código: ${result.response.code}`,
        });
      } else {
        toast({
          title: "Error en consulta",
          description: result.response?.message || result.message || "Error desconocido",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al ejecutar consulta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Consultas RNDC</h1>
          <p className="text-muted-foreground">Consulte información en el sistema RNDC</p>
        </div>

        <Tabs defaultValue="consultar" className="w-full">
          <TabsList>
            <TabsTrigger value="consultar" data-testid="tab-consultar">
              <Search className="mr-2 h-4 w-4" /> Consultar
            </TabsTrigger>
            <TabsTrigger value="historial" data-testid="tab-historial">
              <History className="mr-2 h-4 w-4" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consultar" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Consulta de Terceros
                  </CardTitle>
                  <CardDescription>
                    Consulte información de un tercero registrado en el RNDC
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de Consulta</Label>
                    <Select value={queryType} onValueChange={setQueryType}>
                      <SelectTrigger data-testid="select-query-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUERY_TYPES.map((qt) => (
                          <SelectItem key={qt.value} value={qt.value}>
                            {qt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numIdTercero">Número de Identificación del Tercero</Label>
                    <Input
                      id="numIdTercero"
                      value={numIdTercero}
                      onChange={(e) => setNumIdTercero(e.target.value)}
                      placeholder="Ej: 8600588314"
                      data-testid="input-num-id-tercero"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={generateXml} variant="outline" className="flex-1" data-testid="button-generate-xml">
                      <Search className="mr-2 h-4 w-4" /> Generar XML
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={!generatedXml || isSubmitting}
                      className="flex-1"
                      data-testid="button-submit-query"
                    >
                      {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Enviar al RNDC
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa XML</CardTitle>
                  <CardDescription>XML que se enviará al RNDC</CardDescription>
                </CardHeader>
                <CardContent>
                  {generatedXml ? (
                    <XmlViewer xml={generatedXml} />
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      Complete el formulario y genere el XML
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {lastResponse && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {lastResponse.response?.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    Respuesta del RNDC
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Código</Label>
                      <p className="font-mono">{lastResponse.response?.code || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Mensaje</Label>
                      <p>{lastResponse.response?.message || "N/A"}</p>
                    </div>
                  </div>

                  {lastResponse.response?.data && (
                    <div>
                      <Label className="text-muted-foreground mb-2 block">Datos de Respuesta</Label>
                      <ScrollArea className="h-64 rounded border p-4">
                        <pre className="text-sm font-mono whitespace-pre-wrap">
                          {JSON.stringify(lastResponse.response.data, null, 2)}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}

                  {lastResponse.query?.xmlResponse && (
                    <div>
                      <Label className="text-muted-foreground mb-2 block">XML Respuesta</Label>
                      <XmlViewer xml={lastResponse.query.xmlResponse} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="historial">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Consultas</CardTitle>
                <CardDescription>Últimas consultas realizadas al RNDC</CardDescription>
              </CardHeader>
              <CardContent>
                {queries.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    No hay consultas registradas
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queries.map((query) => (
                      <div
                        key={query.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedQuery(query)}
                        data-testid={`query-row-${query.id}`}
                      >
                        <div className="flex items-center gap-4">
                          {query.status === "success" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{query.queryName}</p>
                            <p className="text-sm text-muted-foreground">
                              ID: {query.numIdTercero || "N/A"} | {format(new Date(query.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedQuery} onOpenChange={() => setSelectedQuery(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Consulta</DialogTitle>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <p>{selectedQuery.queryName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <p className={selectedQuery.status === "success" ? "text-green-600" : "text-red-600"}>
                    {selectedQuery.status === "success" ? "Exitoso" : "Error"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ID Tercero</Label>
                  <p className="font-mono">{selectedQuery.numIdTercero || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha</Label>
                  <p>{format(new Date(selectedQuery.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Código Respuesta</Label>
                  <p className="font-mono">{selectedQuery.responseCode || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mensaje</Label>
                  <p>{selectedQuery.responseMessage || "N/A"}</p>
                </div>
              </div>

              {selectedQuery.responseData && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">Datos de Respuesta</Label>
                  <ScrollArea className="h-48 rounded border p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(JSON.parse(selectedQuery.responseData), null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground mb-2 block">XML Solicitud</Label>
                <XmlViewer xml={selectedQuery.xmlRequest} />
              </div>

              {selectedQuery.xmlResponse && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">XML Respuesta</Label>
                  <XmlViewer xml={selectedQuery.xmlResponse} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
