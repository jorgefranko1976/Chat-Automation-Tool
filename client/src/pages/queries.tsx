import { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Search, Send, History, User, Loader2, CheckCircle, XCircle, Eye, TableIcon, Download } from "lucide-react";
import * as XLSX from "xlsx";
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

interface TerceroDocument {
  ingresoid: string;
  fechaing: string;
  codtipoidtercero: string;
  nomidtercero: string;
  primerapellidoidtercero: string;
  segundoapellidoidtercero: string;
  numtelefonocontacto: string;
  nomenclaturadireccion: string;
  codmunicipiorndc: string;
  codsedetercero: string;
  nomsedetercero: string;
  numlicenciaconduccion: string;
  codcategorialicenciaconduccion: string;
  fechavencimientolicencia: string;
  latitud: string;
  longitud: string;
  regimensimple: string;
}

const QUERY_TYPES = [
  { value: "terceros", label: "Terceros", tipo: "3", procesoid: "11" },
];

const TERCEROS_VARIABLES = "INGRESOID,FECHAING,CODTIPOIDTERCERO,NOMIDTERCERO,PRIMERAPELLIDOIDTERCERO,SEGUNDOAPELLIDOIDTERCERO,NUMTELEFONOCONTACTO,NOMENCLATURADIRECCION,CODMUNICIPIORNDC,CODSEDETERCERO,NOMSEDETERCERO,NUMLICENCIACONDUCCION,CODCATEGORIALICENCIACONDUCCION,FECHAVENCIMIENTOLICENCIA,LATITUD,LONGITUD,REGIMENSIMPLE";

const TERCEROS_COLUMNS = [
  { key: "ingresoid", label: "ID Ingreso" },
  { key: "fechaing", label: "Fecha Ingreso" },
  { key: "codsedetercero", label: "Cod Sede" },
  { key: "nomsedetercero", label: "Nombre Sede" },
  { key: "nomenclaturadireccion", label: "Dirección" },
  { key: "codmunicipiorndc", label: "Cod Municipio" },
  { key: "numtelefonocontacto", label: "Teléfono" },
  { key: "latitud", label: "Latitud" },
  { key: "longitud", label: "Longitud" },
];

function parseDocumentsFromXml(xmlString: string): TerceroDocument[] {
  const documents: TerceroDocument[] = [];
  const docRegex = /<documento>([\s\S]*?)<\/documento>/g;
  let match;

  while ((match = docRegex.exec(xmlString)) !== null) {
    const docContent = match[1];
    const doc: any = {};
    
    const fields = [
      'ingresoid', 'fechaing', 'codtipoidtercero', 'nomidtercero',
      'primerapellidoidtercero', 'segundoapellidoidtercero', 'numtelefonocontacto',
      'nomenclaturadireccion', 'codmunicipiorndc', 'codsedetercero', 'nomsedetercero',
      'numlicenciaconduccion', 'codcategorialicenciaconduccion', 'fechavencimientolicencia',
      'latitud', 'longitud', 'regimensimple'
    ];

    fields.forEach(field => {
      const fieldRegex = new RegExp(`<${field}>([^<]*)</${field}>`);
      const fieldMatch = docContent.match(fieldRegex);
      doc[field] = fieldMatch ? fieldMatch[1].trim() : '';
    });

    documents.push(doc as TerceroDocument);
  }

  return documents;
}

export default function Queries() {
  const { settings } = useSettings();
  const [queryType, setQueryType] = useState("terceros");
  const [numIdTercero, setNumIdTercero] = useState("");
  const [generatedXml, setGeneratedXml] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [parsedDocuments, setParsedDocuments] = useState<TerceroDocument[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<RndcQuery | null>(null);
  const [showXmlResponse, setShowXmlResponse] = useState(false);
  const [filterWithCoords, setFilterWithCoords] = useState(false);

  const filteredDocuments = filterWithCoords 
    ? parsedDocuments.filter(doc => doc.latitud && doc.longitud && doc.latitud.trim() !== '' && doc.longitud.trim() !== '')
    : parsedDocuments;

  const exportToExcel = () => {
    const dataToExport = filteredDocuments.map(doc => ({
      'ID Ingreso': doc.ingresoid,
      'Fecha Ingreso': doc.fechaing,
      'Tipo ID': doc.codtipoidtercero,
      'Nombre': doc.nomidtercero,
      'Primer Apellido': doc.primerapellidoidtercero,
      'Segundo Apellido': doc.segundoapellidoidtercero,
      'Teléfono': doc.numtelefonocontacto,
      'Dirección': doc.nomenclaturadireccion,
      'Cod Municipio': doc.codmunicipiorndc,
      'Cod Sede': doc.codsedetercero,
      'Nombre Sede': doc.nomsedetercero,
      'Licencia': doc.numlicenciaconduccion,
      'Categoría Licencia': doc.codcategorialicenciaconduccion,
      'Vencimiento Licencia': doc.fechavencimientolicencia,
      'Latitud': doc.latitud,
      'Longitud': doc.longitud,
      'Régimen Simple': doc.regimensimple,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Terceros");
    XLSX.writeFile(wb, `terceros_${numIdTercero}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: `Se exportaron ${filteredDocuments.length} registros a Excel`,
    });
  };

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
    setParsedDocuments([]);
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
    setParsedDocuments([]);
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

      if (result.success && result.query?.xmlResponse) {
        const docs = parseDocumentsFromXml(result.query.xmlResponse);
        setParsedDocuments(docs);
        
        if (docs.length > 0) {
          toast({
            title: "Consulta exitosa",
            description: `Se encontraron ${docs.length} registros`,
          });
        }
      }

      if (result.success && result.response?.success) {
        if (parsedDocuments.length === 0) {
          toast({
            title: "Consulta exitosa",
            description: `Código: ${result.response.code}`,
          });
        }
      } else if (!result.success || !result.response?.success) {
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

  const getDocumentsFromQuery = (query: RndcQuery): TerceroDocument[] => {
    if (query.xmlResponse) {
      return parseDocumentsFromXml(query.xmlResponse);
    }
    return [];
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
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastResponse.response?.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      Respuesta del RNDC
                      {parsedDocuments.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({filterWithCoords ? `${filteredDocuments.length} de ${parsedDocuments.length}` : parsedDocuments.length} registros)
                        </span>
                      )}
                    </div>
                    {lastResponse.query?.xmlResponse && (
                      <Button variant="outline" size="sm" onClick={() => setShowXmlResponse(!showXmlResponse)}>
                        {showXmlResponse ? "Ver Tabla" : "Ver XML"}
                      </Button>
                    )}
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

                  {showXmlResponse && lastResponse.query?.xmlResponse ? (
                    <div>
                      <Label className="text-muted-foreground mb-2 block">XML Respuesta</Label>
                      <XmlViewer xml={lastResponse.query.xmlResponse} />
                    </div>
                  ) : parsedDocuments.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <TableIcon className="h-4 w-4" />
                          Documentos Encontrados
                        </Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filterWithCoords}
                              onChange={(e) => setFilterWithCoords(e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            Solo con coordenadas
                          </label>
                          <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
                            <Download className="mr-2 h-4 w-4" /> Exportar Excel
                          </Button>
                        </div>
                      </div>
                      <ScrollArea className="h-[400px] rounded border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {TERCEROS_COLUMNS.map((col) => (
                                <TableHead key={col.key} className="whitespace-nowrap text-xs">
                                  {col.label}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDocuments.map((doc, idx) => (
                              <TableRow key={idx}>
                                {TERCEROS_COLUMNS.map((col) => (
                                  <TableCell key={col.key} className="text-xs whitespace-nowrap">
                                    {(doc as any)[col.key] || "-"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  ) : null}
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Consulta - {selectedQuery?.queryName}</DialogTitle>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <p className={selectedQuery.status === "success" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
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
              </div>

              {selectedQuery.xmlResponse && (
                <div>
                  <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                    <TableIcon className="h-4 w-4" />
                    Documentos ({getDocumentsFromQuery(selectedQuery).length} registros)
                  </Label>
                  <ScrollArea className="h-[300px] rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {TERCEROS_COLUMNS.map((col) => (
                            <TableHead key={col.key} className="whitespace-nowrap text-xs">
                              {col.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getDocumentsFromQuery(selectedQuery).map((doc, idx) => (
                          <TableRow key={idx}>
                            {TERCEROS_COLUMNS.map((col) => (
                              <TableCell key={col.key} className="text-xs whitespace-nowrap">
                                {(doc as any)[col.key] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Ver XML Solicitud
                </summary>
                <div className="mt-2">
                  <XmlViewer xml={selectedQuery.xmlRequest} />
                </div>
              </details>

              {selectedQuery.xmlResponse && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Ver XML Respuesta
                  </summary>
                  <div className="mt-2">
                    <XmlViewer xml={selectedQuery.xmlResponse} />
                  </div>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
