import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XmlViewer } from "@/components/xml-viewer";
import { ManifestCard } from "@/components/manifest-card";
import { MOCK_MANIFESTS } from "@/lib/mock-data";
import { RefreshCw, Search, Clock, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";

export default function Monitoring() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(300); // 5 minutes in seconds
  const [canRequest, setCanRequest] = useState(true);
  const [requestXml, setRequestXml] = useState("");
  const [responseXml, setResponseXml] = useState("");
  const [manifests, setManifests] = useState(MOCK_MANIFESTS);

  // Timer logic for 5-minute constraint
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

  const handleRequest = async (type: 'NUEVOS' | 'TODOS') => {
    if (!canRequest) {
      toast({
        title: "Espere por favor",
        description: `Debe esperar ${formatTime(timer)} para realizar una nueva consulta masiva.`,
        variant: "destructive",
      });
      return;
    }

    const xml = generateRequestXml(type);
    setRequestXml(xml);
    setLoading(true);
    setCanRequest(false);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setResponseXml(`<?xml version="1.0" encoding="iso-8859-1" ?>
<root>
<documento>
<ingresoidmanifiesto>123456789</ingresoidmanifiesto>
<numnitempresatransporte>${settings.companyNit}</numnitempresatransporte>
<nummanifiestocarga>111</nummanifiestocarga>
<fechaexpedicionmanifiesto>03/09/2014</fechaexpedicionmanifiesto>
<numplaca>bod874</numplaca>
<puntoscontrol>
<puntocontrol>
<codpuntocontrol>1</codpuntocontrol >
<codmunicipio>11001000</codmunicipio>
<direccion>calle 1 3-51 parque industrial xxx</direccion>
<fechacita>2018/11/05</ fechacita>
<horacita>16:07</ horacita>
<latitud>5.417198</ latitud>
<longitud>-72.290611</ longitud>
<tiempopactado>65</tiempopactado >
</puntocontrol>
</puntoscontrol>
</documento>
</root>`);
      toast({
        title: "Consulta Exitosa",
        description: `Se han recuperado ${manifests.length} manifiestos del RNDC.`,
      });
    }, 2000);
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
              >
                Manifiestos Nuevos
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => handleRequest('TODOS')}
                disabled={loading || !canRequest}
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
                <Label>Buscar por Manifiesto</Label>
                <div className="flex gap-2">
                  <Input placeholder="Ej: 123456789" />
                  <Button size="icon" variant="secondary">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="results">
              <TabsList>
                <TabsTrigger value="results">Resultados</TabsTrigger>
                <TabsTrigger value="xml">XML Intercambio</TabsTrigger>
              </TabsList>
              
              <TabsContent value="results" className="space-y-4 mt-4">
                {manifests.map((m) => (
                  <ManifestCard key={m.id} manifest={m} />
                ))}
              </TabsContent>
              
              <TabsContent value="xml" className="space-y-4 mt-4">
                <div className="grid gap-4">
                  <div>
                    <Label className="text-xs mb-2 block">Solicitud Enviada</Label>
                    <XmlViewer xml={requestXml || "Esperando consulta..."} title="Request" />
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Respuesta RNDC</Label>
                    <XmlViewer xml={responseXml || "Esperando respuesta..."} title="Response" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
}
