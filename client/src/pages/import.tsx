import { useState, useRef } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XmlViewer } from "@/components/xml-viewer";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, FileCode } from "lucide-react";
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
}

export default function Import() {
  const { settings } = useSettings();
  const [data, setData] = useState<ExcelRow[]>([]);
  const [generatedXmls, setGeneratedXmls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast({
        title: "Archivo Procesado",
        description: `Se han cargado ${jsonData.length} registros exitosamente.`,
      });
    };
    reader.readAsBinaryString(file);
  };

  const addRandomMinutes = (dateStr: string, timeStr: string) => {
    // Combine date and time
    // Assuming dateStr is DD/MM/YYYY or YYYY-MM-DD. 
    // Excel usually gives dates in various formats, let's try to handle standard ones or just basic parsing
    // For robustness in this mockup, let's construct a Date object
    
    // Handle potential Excel serial dates or string formats
    let dateObj = new Date();
    
    if (timeStr && dateStr) {
      // Simple parse for "YYYY-MM-DD" or "DD/MM/YYYY"
      const timeParts = timeStr.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = parseInt(timeParts[1]);
      
      // Try to parse date
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        dateObj = d;
        dateObj.setHours(hours, minutes);
      }
    }

    // Add random minutes between 10 and 50
    const randomMinutes = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
    dateObj.setMinutes(dateObj.getMinutes() + randomMinutes);

    // Format back to string
    const newDateStr = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const newTimeStr = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    return { date: newDateStr, time: newTimeStr };
  };

  const handleGenerateXml = () => {
    const xmls = data.map(row => {
      const arrival = addRandomMinutes(row.FECHACITA, row.HORACITA);
      // We can use the arrival time as base for departure + another random interval if needed, 
      // or just add another random offset to the original scheduled time as requested.
      // The prompt says: "sumar entre 10 y 50 minutos" for both arrival and departure.
      // Let's assume they are independent events relative to the scheduled time (FECHACITA/HORACITA).
      
      // However, logically Departure should be AFTER Arrival. 
      // Let's make Departure = Arrival + Random(10-50) to ensure consistency
      
      // Re-calculating based on the Logic requested:
      // "horallegada ... sumar entre 10 y 50 minutos" -> relative to scheduled time
      // "horasalida ... sumar entre 10 y 50 minutos" -> implies relative to scheduled time too?
      // OR relative to arrival? Usually departure is after arrival.
      // Let's assume relative to scheduled time for arrival, and then ensure departure is later.
      
      // Let's implement exactly as requested:
      // Arrival = Scheduled + Random(10-50)
      // Departure = Scheduled + Random(10-50) (but let's make sure it's > Arrival + 5 mins at least for realism?)
      // To stay strict to "sumar entre 10 y 50 minutos", let's do:
      // Arrival = Scheduled + Random(10, 30)
      // Departure = Scheduled + Random(35, 50) -> Ensures Departure > Arrival
      
      const randomArr = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
      const randomDep = Math.floor(Math.random() * (50 - 35 + 1)) + 35;

      // Helper to add minutes
      const addMins = (dStr: string, tStr: string, mins: number) => {
        // Check if date is Excel serial number (number) or string
        let dateObj = new Date();
        
        // Very basic parsing for the mockup example data which looks like strings
        if (typeof dStr === 'string' && dStr.includes('/')) {
             const parts = dStr.split('/'); // DD/MM/YYYY
             // Note: Date constructor expects MM/DD/YYYY or YYYY-MM-DD
             // Let's manually construct
             if (parts.length === 3) {
                 // Assuming DD/MM/YYYY from the example
                 dateObj = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
             }
        } else {
             dateObj = new Date(dStr);
        }

        if (tStr) {
            const tParts = tStr.split(':');
            dateObj.setHours(parseInt(tParts[0]), parseInt(tParts[1]));
        }
        
        dateObj.setMinutes(dateObj.getMinutes() + mins);
        
        // Return DD/MM/YYYY and HH:MM
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yyyy = dateObj.getFullYear();
        const hh = String(dateObj.getHours()).padStart(2, '0');
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        
        return {
            d: `${dd}/${mm}/${yyyy}`,
            t: `${hh}:${min}`
        };
      };

      const arrivalTime = addMins(row.FECHACITA, row.HORACITA, randomArr);
      const departureTime = addMins(row.FECHACITA, row.HORACITA, randomDep);

      return `<?xml version='1.0' encoding='iso-8859-1' ?>
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
<ingresoidmanifiesto>${row.INGRESOID}</ingresoidmanifiesto>
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
    });
    setGeneratedXmls(xmls);
    toast({
      title: "XMLs Generados",
      description: "Revise la vista previa antes de enviar.",
    });
  };

  const handleSendAll = () => {
    toast({
      title: "Enviando al RNDC",
      description: `Iniciando transmisión de ${generatedXmls.length} reportes...`,
    });
    // Simulate process
    setTimeout(() => {
      toast({
        title: "Transmisión Completada",
        description: "Todos los reportes han sido aceptados.",
        className: "bg-green-50 border-green-200 text-green-800",
      });
      setGeneratedXmls([]);
      setData([]);
    }, 2000);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Importación Masiva</h1>
          <p className="text-muted-foreground">Cargue archivos Excel para generar reportes masivos (Cumplir Tiempos).</p>
        </div>

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
            />
            <Button onClick={() => fileInputRef.current?.click()}>
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
                <Button onClick={handleGenerateXml} disabled={generatedXmls.length > 0}>
                  Generar XMLs <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingreso ID</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Punto Control</TableHead>
                        <TableHead>Cita</TableHead>
                        <TableHead>Coords</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{row.INGRESOID}</TableCell>
                          <TableCell>{row.PLACA}</TableCell>
                          <TableCell>{row.CODPUNTOCONTROL}</TableCell>
                          <TableCell>{row.FECHACITA} {row.HORACITA}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.LATITUD}, {row.LONGITUD}</TableCell>
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

            {generatedXmls.length > 0 && (
              <div className="grid gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileCode className="h-5 w-5" /> XMLs Generados
                  </h3>
                  <Button onClick={handleSendAll} className="bg-green-600 hover:bg-green-700">
                    Enviar {generatedXmls.length} Reportes al RNDC <CheckCircle className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <XmlViewer xml={generatedXmls[0]} title="Ejemplo Registro #1" />
                  {generatedXmls.length > 1 && (
                    <XmlViewer xml={generatedXmls[1]} title="Ejemplo Registro #2" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
