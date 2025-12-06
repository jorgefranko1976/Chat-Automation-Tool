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
  INGRESOIDMANIFIESTO: string; // Added as per excel screenshot
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
    // Excel often imports time as a decimal (fraction of a day) or date string.
    // If we get raw strings from CSV/Excel like "5/12/2025" and "17:00"
    
    let dateObj = new Date();
    
    // Handle potential Excel serial dates or string formats
    if (dateStr) {
      if (typeof dateStr === 'number') {
        // Excel serial date
        dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
      } else if (typeof dateStr === 'string') {
         // Try parsing MM/DD/YYYY or DD/MM/YYYY
         // Given the screenshot shows 5/12/2025, likely M/D/Y or D/M/Y depending on locale.
         // Let's assume DD/MM/YYYY based on previous context or try standard Date parse
         const parts = dateStr.split(/[-/]/);
         if (parts.length === 3) {
            // Assuming M/D/Y or D/M/Y. 
            // Let's try to be safe, assuming standard JS Date parsing works for valid strings
             const d = new Date(dateStr);
             if (!isNaN(d.getTime())) {
                 dateObj = d;
             } else {
                // Fallback manual parse for DD/MM/YYYY
                dateObj = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
             }
         }
      }
    }

    if (timeStr) {
      if (typeof timeStr === 'number') {
          // Time as fraction of day
          const totalSeconds = Math.floor(timeStr * 86400);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          dateObj.setHours(hours, minutes);
      } else if (typeof timeStr === 'string') {
         const timeParts = timeStr.split(':');
         if (timeParts.length >= 2) {
             dateObj.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
         }
      }
    }

    // Add random minutes between 10 and 50
    const randomMinutes = Math.floor(Math.random() * (50 - 10 + 1)) + 10;
    dateObj.setMinutes(dateObj.getMinutes() + randomMinutes);

    // Format back to string DD/MM/YYYY and HH:MM
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const min = String(dateObj.getMinutes()).padStart(2, '0');

    return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
  };

  const handleGenerateXml = () => {
    const xmls = data.map(row => {
      // For Arrival: Scheduled + Random(10-50)
      const arrival = addRandomMinutes(row.FECHACITA, row.HORACITA);
      
      // For Departure: Scheduled + Random(35-60) to ensure it is after arrival
      // Using slightly different random range logic to simulate operations
      // Re-using helper but with manual offset logic if needed, but `addRandomMinutes` is hardcoded 10-50.
      // Let's create specific derived times.
      
      // Parse base scheduled time again
      // Duplicate logic for clarity in this mock
      let baseDate = new Date();
      // ... (parsing logic same as helper above, implied for brevity) ...
      // To keep it simple and consistent with the helper function usage:
      
      // Just call helper twice? No, that would be independent randoms, potentially Departure < Arrival
      // Let's refine the helper to accept min/max
      
      const getShiftedTime = (dStr: any, tStr: any, minAdd: number, maxAdd: number) => {
          let d = new Date();
          // Parsing Date
          if (typeof dStr === 'number') {
              d = new Date(Math.round((dStr - 25569) * 86400 * 1000));
          } else if (typeof dStr === 'string') {
              const parts = dStr.split(/[-/]/);
              if (parts.length === 3) {
                   // Attempt standard parse first
                   const std = new Date(dStr);
                   if (!isNaN(std.getTime())) d = std;
                   else d = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
              }
          }
          
          // Parsing Time
          if (typeof tStr === 'number') {
              const totalSeconds = Math.floor(tStr * 86400);
              d.setHours(Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60));
          } else if (typeof tStr === 'string') {
              const parts = tStr.split(':');
              if (parts.length >= 2) d.setHours(parseInt(parts[0]), parseInt(parts[1]));
          }
          
          const rand = Math.floor(Math.random() * (maxAdd - minAdd + 1)) + minAdd;
          d.setMinutes(d.getMinutes() + rand);
          
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          
          return { d: `${dd}/${mm}/${yyyy}`, t: `${hh}:${min}` };
      };

      const arrivalTime = getShiftedTime(row.FECHACITA, row.HORACITA, 10, 30);
      const departureTime = getShiftedTime(row.FECHACITA, row.HORACITA, 40, 60); // Ensures departure is after arrival

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
                        <TableHead>Ingreso ID Manifest</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Punto Control</TableHead>
                        <TableHead>Cita</TableHead>
                        <TableHead>Coords</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{row.INGRESOIDMANIFIESTO}</TableCell>
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
