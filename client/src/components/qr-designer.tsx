import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, GripVertical, RotateCcw, QrCode, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QRFieldConfig {
  id: string;
  label: string;
  dataKey: string;
  enabled: boolean;
  maxLength: number;
  order: number;
  valueType: "dynamic" | "fixed";
  fixedValue: string;
}

const DEFAULT_QR_FIELDS: QRFieldConfig[] = [
  { id: "mec", label: "MEC", dataKey: "INGRESOID", enabled: true, maxLength: 20, order: 1, valueType: "dynamic", fixedValue: "" },
  { id: "fecha", label: "Fecha", dataKey: "FECHAEXPEDICIONMANIFIESTO", enabled: true, maxLength: 10, order: 2, valueType: "dynamic", fixedValue: "" },
  { id: "placa", label: "Placa", dataKey: "NUMPLACA", enabled: true, maxLength: 6, order: 3, valueType: "dynamic", fixedValue: "" },
  { id: "remolque", label: "Remolque", dataKey: "NUMPLACAREMOLQUE", enabled: true, maxLength: 6, order: 4, valueType: "dynamic", fixedValue: "" },
  { id: "config", label: "Config", dataKey: "config", enabled: true, maxLength: 4, order: 5, valueType: "fixed", fixedValue: "2" },
  { id: "orig", label: "Orig", dataKey: "municipioOrigen", enabled: true, maxLength: 20, order: 6, valueType: "dynamic", fixedValue: "" },
  { id: "dest", label: "Dest", dataKey: "municipioDestino", enabled: true, maxLength: 20, order: 7, valueType: "dynamic", fixedValue: "" },
  { id: "mercancia", label: "Mercancia", dataKey: "mercancia", enabled: true, maxLength: 30, order: 8, valueType: "fixed", fixedValue: "ALIMENTO PARA AVES DE CORRAL" },
  { id: "conductor", label: "Conductor", dataKey: "NUMIDCONDUCTOR", enabled: true, maxLength: 15, order: 9, valueType: "dynamic", fixedValue: "" },
  { id: "empresa", label: "Empresa", dataKey: "companyName", enabled: true, maxLength: 30, order: 10, valueType: "dynamic", fixedValue: "" },
  { id: "valor", label: "Valor", dataKey: "VALORFLETEPACTADOVIAJE", enabled: true, maxLength: 15, order: 11, valueType: "dynamic", fixedValue: "" },
  { id: "obs", label: "Obs", dataKey: "observaciones", enabled: false, maxLength: 120, order: 12, valueType: "dynamic", fixedValue: "" },
  { id: "seguro", label: "Seguro", dataKey: "SEGURIDADQR", enabled: true, maxLength: 28, order: 13, valueType: "dynamic", fixedValue: "" },
];

export function QRDesigner() {
  const [fields, setFields] = useState<QRFieldConfig[]>(DEFAULT_QR_FIELDS);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrPreview, setQrPreview] = useState<string>("");
  const [draggedField, setDraggedField] = useState<string | null>(null);

  const mergeWithDefaults = useCallback((storedFields: QRFieldConfig[]): QRFieldConfig[] => {
    const storedById = new Map(storedFields.map(f => [f.id, f]));
    const merged = DEFAULT_QR_FIELDS.map((defaultField, idx) => {
      const stored = storedById.get(defaultField.id);
      if (stored) {
        return {
          ...defaultField,
          ...stored,
          order: stored.order ?? idx + 1,
          fixedValue: stored.fixedValue ?? defaultField.fixedValue ?? "",
        };
      }
      return { ...defaultField, order: idx + 1 };
    });
    return merged.sort((a, b) => a.order - b.order);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/qr-config");
      const data = await res.json();
      if (data.success && data.config && data.config.fields) {
        setFields(mergeWithDefaults(data.config.fields));
      }
    } catch (error) {
      console.log("Using default QR config");
    } finally {
      setIsLoading(false);
    }
  }, [mergeWithDefaults]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const generatePreview = useCallback(() => {
    const enabledFields = fields
      .filter(f => f.enabled)
      .sort((a, b) => a.order - b.order);
    
    const lines = enabledFields.map(f => {
      const value = f.valueType === "fixed" ? f.fixedValue : `[${f.dataKey}]`;
      return `${f.label}:${value.substring(0, f.maxLength)}`;
    });
    
    setQrPreview(lines.join("\r\n"));
  }, [fields]);

  useEffect(() => {
    generatePreview();
  }, [fields, generatePreview]);

  const handleFieldChange = (fieldId: string, updates: Partial<QRFieldConfig>) => {
    setFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  };

  const handleDragStart = (fieldId: string) => {
    setDraggedField(fieldId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedField || draggedField === targetId) return;
    
    setFields(prev => {
      const draggedIndex = prev.findIndex(f => f.id === draggedField);
      const targetIndex = prev.findIndex(f => f.id === targetId);
      
      const newFields = [...prev];
      const [dragged] = newFields.splice(draggedIndex, 1);
      newFields.splice(targetIndex, 0, dragged);
      
      return newFields.map((f, i) => ({ ...f, order: i + 1 }));
    });
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/qr-config", { fields });
      toast({ title: "Configuración Guardada", description: "La configuración del QR ha sido guardada." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("¿Restablecer la configuración por defecto?")) {
      const resetFields = DEFAULT_QR_FIELDS.map((f, idx) => ({ ...f, order: idx + 1 }));
      setFields(resetFields);
      toast({ title: "Restablecido", description: "Configuración por defecto restaurada" });
    }
  };

  const selectedFieldData = fields.find(f => f.id === selectedField);

  if (isLoading) {
    return <div className="text-center py-8">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-qr-config">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Guardando..." : "Guardar Configuración"}
        </Button>
        <Button variant="outline" onClick={handleReset} data-testid="button-reset-qr-config">
          <RotateCcw className="h-4 w-4 mr-2" />
          Restablecer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GripVertical className="h-4 w-4" />
              Campos del QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {fields.map(field => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => handleDragStart(field.id)}
                    onDragOver={(e) => handleDragOver(e, field.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedField(field.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedField === field.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted/50"
                    } ${draggedField === field.id ? "opacity-50" : ""}`}
                    data-testid={`qr-field-${field.id}`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <Switch
                      checked={field.enabled}
                      onCheckedChange={(checked) => handleFieldChange(field.id, { enabled: checked })}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`switch-${field.id}`}
                    />
                    <div className="flex-1">
                      <span className={`font-medium ${!field.enabled ? "text-muted-foreground" : ""}`}>
                        {field.label}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({field.valueType === "fixed" ? "fijo" : "dinámico"})
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      máx {field.maxLength}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedFieldData && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">Editar: {selectedFieldData.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Etiqueta</Label>
                    <Input
                      value={selectedFieldData.label}
                      onChange={(e) => handleFieldChange(selectedFieldData.id, { label: e.target.value })}
                      data-testid="input-field-label"
                    />
                  </div>
                  <div>
                    <Label>Máx. Caracteres</Label>
                    <Input
                      type="number"
                      value={selectedFieldData.maxLength}
                      onChange={(e) => handleFieldChange(selectedFieldData.id, { maxLength: parseInt(e.target.value) || 0 })}
                      data-testid="input-field-maxlength"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Tipo de Valor</Label>
                  <Select
                    value={selectedFieldData.valueType}
                    onValueChange={(v: "dynamic" | "fixed") => handleFieldChange(selectedFieldData.id, { valueType: v })}
                  >
                    <SelectTrigger data-testid="select-value-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dynamic">Dinámico (del manifiesto)</SelectItem>
                      <SelectItem value="fixed">Fijo (valor constante)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedFieldData.valueType === "fixed" ? (
                  <div>
                    <Label>Valor Fijo</Label>
                    <Input
                      value={selectedFieldData.fixedValue}
                      onChange={(e) => handleFieldChange(selectedFieldData.id, { fixedValue: e.target.value })}
                      placeholder="Ej: ALIMENTO PARA AVES DE CORRAL"
                      data-testid="input-fixed-value"
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Campo de Datos</Label>
                    <Input
                      value={selectedFieldData.dataKey}
                      onChange={(e) => handleFieldChange(selectedFieldData.id, { dataKey: e.target.value })}
                      placeholder="Ej: NUMPLACA"
                      data-testid="input-data-key"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Nombre del campo en la respuesta del RNDC
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Vista Previa del Contenido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap border">
                {qrPreview || "Sin campos habilitados"}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Los valores entre [corchetes] se reemplazarán con datos reales del manifiesto.
                El QR usa saltos de línea CRLF según especificación RNDC.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
