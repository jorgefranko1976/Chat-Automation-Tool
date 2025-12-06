import { useState } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_MANIFESTS, ControlPoint } from "@/lib/mock-data";
import { XmlViewer } from "@/components/xml-viewer";
import { MapPin, Clock, Send, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export default function Tracking() {
  const { settings } = useSettings();
  const [selectedCp, setSelectedCp] = useState<ControlPoint | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    arrivalDate: "",
    arrivalTime: "",
    departureDate: "",
    departureTime: "",
    novelty: "none"
  });
  const [generatedXml, setGeneratedXml] = useState("");

  const handleOpenReport = (cp: ControlPoint) => {
    setSelectedCp(cp);
    setFormData({
      arrivalDate: new Date().toISOString().split('T')[0],
      arrivalTime: "08:00",
      departureDate: new Date().toISOString().split('T')[0],
      departureTime: "10:00",
      novelty: "none"
    });
    setGeneratedXml("");
    setIsDialogOpen(true);
  };

  const generateXml = () => {
    if (!selectedCp) return;

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
<ingresoidmanifiesto>123456789</ingresoidmanifiesto>
<numplaca>bod875</numplaca>
<codpuntocontrol>${selectedCp.sequence}</codpuntocontrol>
<latitud>${selectedCp.coordinates.lat}</latitud>
<longitud>${selectedCp.coordinates.lng}</longitud>
<fechallegada>${formData.arrivalDate.split('-').reverse().join('/')}</fechallegada>
<horallegada>${formData.arrivalTime}</horallegada>
<fechasalida>${formData.departureDate.split('-').reverse().join('/')}</fechasalida>
<horasalida>${formData.departureTime}</horasalida>
${formData.novelty !== 'none' ? `<sinsalida>S</sinsalida>` : ''}
</variables>
</root>`;

    setGeneratedXml(xml);
  };

  const handleSend = () => {
    toast({
      title: "Reporte Enviado",
      description: "El RNDC ha recibido el reporte correctamente. Radicado: 123456",
    });
    setIsDialogOpen(false);
  };

  // Flatten manifests to get all pending control points
  const pendingPoints = MOCK_MANIFESTS.flatMap(m => 
    m.controlPoints.map(cp => ({ ...cp, manifestId: m.id, plate: m.vehiclePlate }))
  ).filter(cp => cp.status === 'Pending' || cp.status === 'Arrived');

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Reporte de Tiempos (RMM)</h1>
          <p className="text-muted-foreground">Registro de novedades y tiempos logísticos para control points.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingPoints.map((cp) => (
            <Card key={`${cp.manifestId}-${cp.id}`} className="hover:border-primary transition-colors cursor-pointer" onClick={() => handleOpenReport(cp)}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {cp.location}
                  </CardTitle>
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    cp.status === 'Pending' ? "bg-amber-500" : "bg-blue-500"
                  )} />
                </div>
                <CardDescription className="font-mono text-xs">{cp.plate} | Seq: {cp.sequence}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Cita: {new Date(cp.scheduledTime).toLocaleString()}
                </div>
                <Button size="sm" className="w-full mt-4" variant="secondary">
                  Reportar Tiempos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Reportar Punto de Control #{selectedCp?.sequence}</DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha Llegada</Label>
                  <Input 
                    type="date" 
                    value={formData.arrivalDate} 
                    onChange={e => setFormData({...formData, arrivalDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Llegada</Label>
                  <Input 
                    type="time" 
                    value={formData.arrivalTime}
                    onChange={e => setFormData({...formData, arrivalTime: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Salida</Label>
                  <Input 
                    type="date" 
                    value={formData.departureDate}
                    onChange={e => setFormData({...formData, departureDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora Salida</Label>
                  <Input 
                    type="time" 
                    value={formData.departureTime}
                    onChange={e => setFormData({...formData, departureTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Novedad / Sin Salida</Label>
                <Select 
                  value={formData.novelty}
                  onValueChange={v => setFormData({...formData, novelty: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione novedad..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin Novedad (Reporte Normal)</SelectItem>
                    <SelectItem value="sinsalida">Sin Salida (&gt; 72 horas)</SelectItem>
                    <SelectItem value="rnmm">Falla Mecánica (RNMM)</SelectItem>
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
                <Button onClick={generateXml} variant="outline" className="mr-2">
                  Previsualizar XML
                </Button>
              </div>

              {generatedXml && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <Label className="mb-2 block">XML a Enviar</Label>
                  <XmlViewer xml={generatedXml} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSend} disabled={!generatedXml} className="gap-2">
                <Send className="h-4 w-4" /> Enviar al RNDC
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
