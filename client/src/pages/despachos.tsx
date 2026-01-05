import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle, Loader2, X, Globe } from "lucide-react";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";

interface DespachoRow {
  granja: string;
  planta: string;
  placa: string;
  cedula: string;
  toneladas: string;
  fecha: string;
  granjaValid: boolean | null;
  granjaData: { sede: string; coordenadas: string } | null;
  plantaValid: boolean | null;
  plantaData: { sede: string; coordenadas: string } | null;
  placaValid: boolean | null;
  placaData: { propietarioId: string; venceSoat: string; pesoVacio: string } | null;
  cedulaValid: boolean | null;
  cedulaData: { venceLicencia: string } | null;
  errors: string[];
}

export default function Despachos() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DespachoRow[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRows([]);
      setValidationComplete(false);
      parseExcel(selectedFile);
    }
  };

  const parseExcel = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    const parsed: DespachoRow[] = jsonData.map((row) => {
      let fechaVal = row["FECHA"] || "";
      if (typeof fechaVal === "number") {
        const date = XLSX.SSF.parse_date_code(fechaVal);
        if (date) {
          fechaVal = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        }
      }

      return {
        granja: String(row["GRANJA"] || "").trim(),
        planta: String(row["PLANTA"] || "").trim(),
        placa: String(row["PLACA"] || "").trim().replace(/\s+/g, "").toUpperCase(),
        cedula: String(row["CEDULA"] || "").trim(),
        toneladas: String(row["TONELADAS"] || "").trim(),
        fecha: fechaVal,
        granjaValid: null,
        granjaData: null,
        plantaValid: null,
        plantaData: null,
        placaValid: null,
        placaData: null,
        cedulaValid: null,
        cedulaData: null,
        errors: [],
      };
    });

    setRows(parsed);
  };

  const validateMutation = useMutation({
    mutationFn: async (data: DespachoRow[]) => {
      const response = await apiRequest("POST", "/api/despachos/validate", { rows: data });
      return response.json();
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setValidationComplete(true);
      const errorCount = data.rows.filter((r: DespachoRow) => r.errors.length > 0).length;
      if (errorCount > 0) {
        toast({
          title: "Validación completada con errores",
          description: `${errorCount} de ${data.rows.length} filas tienen errores`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Validación exitosa",
          description: `${data.rows.length} filas validadas correctamente`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error en validación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleValidate = () => {
    if (rows.length === 0) {
      toast({
        title: "Sin datos",
        description: "Por favor cargue un archivo Excel primero",
        variant: "destructive",
      });
      return;
    }
    setIsValidating(true);
    validateMutation.mutate(rows);
    setIsValidating(false);
  };

  const handleExportExcel = () => {
    const exportData = rows.map((row) => ({
      GRANJA: row.granja,
      GRANJA_SEDE: row.granjaData?.sede || "",
      GRANJA_COORDENADAS: row.granjaData?.coordenadas || "",
      PLANTA: row.planta,
      PLANTA_SEDE: row.plantaData?.sede || "",
      PLANTA_COORDENADAS: row.plantaData?.coordenadas || "",
      PLACA: row.placa,
      NUMIDPROPIETARIO: row.placaData?.propietarioId || "",
      FECHAVENCIMIENTOSOAT: row.placaData?.venceSoat || "",
      PESOVEHICULOVACIO: row.placaData?.pesoVacio || "",
      CEDULA: row.cedula,
      FECHAVENCIMIENTOLICENCIA: row.cedulaData?.venceLicencia || "",
      TONELADAS: row.toneladas,
      FECHA: row.fecha,
      ERRORES: row.errors.join("; "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despachos");
    XLSX.writeFile(wb, `despachos_validados_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setValidationComplete(false);
  };

  const getStatusIcon = (valid: boolean | null) => {
    if (valid === null) return <span className="text-muted-foreground">-</span>;
    if (valid) return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">Módulo Despachos</h1>
          <p className="text-sm text-muted-foreground">
            Validación de despachos contra base de datos local y RNDC
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Cargar Excel de Despachos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="file-upload" className="sr-only">Archivo Excel</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                    data-testid="input-file-upload"
                  />
                </div>
                {file && (
                  <Button variant="ghost" size="icon" onClick={clearFile} data-testid="button-clear-file">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs">({rows.length} filas)</span>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                <strong>Columnas esperadas:</strong> GRANJA, PLANTA, PLACA, CEDULA, TONELADAS, FECHA
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleValidate}
                  disabled={rows.length === 0 || validateMutation.isPending}
                  data-testid="button-validate"
                >
                  {validateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Validar Datos"
                  )}
                </Button>
                {validationComplete && (
                  <Button variant="outline" onClick={handleExportExcel} data-testid="button-export">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Excel Enriquecido
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resultados de Validación</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">#</th>
                        <th className="text-left p-3 font-medium">Granja</th>
                        <th className="text-left p-3 font-medium">Sede Granja</th>
                        <th className="text-left p-3 font-medium">Coord. Granja</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Planta</th>
                        <th className="text-left p-3 font-medium">Sede Planta</th>
                        <th className="text-left p-3 font-medium">Coord. Planta</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Placa</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Cédula</th>
                        <th className="text-center p-3 font-medium">OK</th>
                        <th className="text-left p-3 font-medium">Toneladas</th>
                        <th className="text-left p-3 font-medium">Fecha</th>
                        <th className="text-left p-3 font-medium">Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx} className={`border-t ${row.errors.length > 0 ? "bg-red-50" : ""}`}>
                          <td className="p-3 text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">{row.granja}</td>
                          <td className="p-3 text-xs">{row.granjaData?.sede || "-"}</td>
                          <td className="p-3 text-xs font-mono">
                            {row.granjaData?.coordenadas ? (
                              <a 
                                href={`https://www.google.com/maps?q=${row.granjaData.coordenadas}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {row.granjaData.coordenadas}
                              </a>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-center">{getStatusIcon(row.granjaValid)}</td>
                          <td className="p-3">{row.planta}</td>
                          <td className="p-3 text-xs">{row.plantaData?.sede || "-"}</td>
                          <td className="p-3 text-xs font-mono">
                            {row.plantaData?.coordenadas ? (
                              <a 
                                href={`https://www.google.com/maps?q=${row.plantaData.coordenadas}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {row.plantaData.coordenadas}
                              </a>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-center">{getStatusIcon(row.plantaValid)}</td>
                          <td className="p-3 font-mono">{row.placa}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.placaValid)}</td>
                          <td className="p-3">{row.cedula}</td>
                          <td className="p-3 text-center">{getStatusIcon(row.cedulaValid)}</td>
                          <td className="p-3">{row.toneladas}</td>
                          <td className="p-3">{row.fecha}</td>
                          <td className="p-3 text-red-600 text-xs max-w-xs truncate" title={row.errors.join("; ")}>
                            {row.errors.join("; ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
