import { useState, useRef } from "react";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { XmlViewer } from "@/components/xml-viewer";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, FileCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

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

  const handleGenerateXml = () => {
    const xmls = data.map(row => {
      return `<?xml version='1.0' encoding='iso-8859-1' ?>
<root>
<acceso>
<username>usuariogps</username>
<password>passwordgps</password>
</acceso>
<solicitud>
<tipo>1</tipo>
<procesoid>60</procesoid>
</solicitud>
<variables>
<numidgps>9999999999</numidgps>
<ingresoidmanifiesto>${row.INGRESOID}</ingresoidmanifiesto>
<numplaca>${row.PLACA}</numplaca>
<codpuntocontrol>${row.CODPUNTOCONTROL}</codpuntocontrol>
<latitud>${row.LATITUD}</latitud>
<longitud>${row.LONGITUD}</longitud>
<fechallegada>${row.FECHACITA}</fechallegada>
<horallegada>${row.HORACITA}</horallegada>
<fechasalida>${row.FECHACITA}</fechasalida>
<horasalida>${row.HORACITA}</horasalida>
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
