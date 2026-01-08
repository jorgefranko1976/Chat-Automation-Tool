import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, GripVertical, Trash2, Plus, Star, Type, Database, Upload, Image } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PdfTemplateField, PdfTemplate } from "@shared/schema";

interface FieldDefinition {
  id: string;
  label: string;
  dataKey: string;
  defaultX: number;
  defaultY: number;
  page: number;
}

const MANIFEST_FIELDS: FieldDefinition[] = [
  { id: "consecutivo", label: "Consecutivo", dataKey: "consecutivo", defaultX: 238, defaultY: 29, page: 1 },
  { id: "ingresoid", label: "Autorización (MEC)", dataKey: "ingresoId", defaultX: 238, defaultY: 36, page: 1 },
  { id: "fechaExpedicion", label: "Fecha Expedición", dataKey: "fechaExpedicion", defaultX: 20, defaultY: 52, page: 1 },
  { id: "fechaRadicacion", label: "Fecha Radicación", dataKey: "fechaRadicacion", defaultX: 60, defaultY: 52, page: 1 },
  { id: "tipoManifiesto", label: "Tipo Manifiesto", dataKey: "tipoManifiesto", defaultX: 107, defaultY: 52, page: 1 },
  { id: "origen", label: "Origen", dataKey: "origen", defaultX: 145, defaultY: 52, page: 1 },
  { id: "destino", label: "Destino", dataKey: "destino", defaultX: 202, defaultY: 52, page: 1 },
  { id: "titularNombre", label: "Titular Nombre", dataKey: "titularNombre", defaultX: 20, defaultY: 66, page: 1 },
  { id: "titularDocumento", label: "Titular Documento", dataKey: "titularDocumento", defaultX: 90, defaultY: 66, page: 1 },
  { id: "titularDireccion", label: "Titular Dirección", dataKey: "titularDireccion", defaultX: 140, defaultY: 66, page: 1 },
  { id: "titularTelefono", label: "Titular Teléfono", dataKey: "titularTelefono", defaultX: 202, defaultY: 66, page: 1 },
  { id: "titularCiudad", label: "Titular Ciudad", dataKey: "titularCiudad", defaultX: 252, defaultY: 66, page: 1 },
  { id: "placa", label: "Placa Vehículo", dataKey: "placa", defaultX: 20, defaultY: 77, page: 1 },
  { id: "marca", label: "Marca Vehículo", dataKey: "marca", defaultX: 50, defaultY: 77, page: 1 },
  { id: "placaRemolque", label: "Placa Semiremolque", dataKey: "placaRemolque", defaultX: 82, defaultY: 77, page: 1 },
  { id: "configuracion", label: "Configuración", dataKey: "configuracion", defaultX: 130, defaultY: 77, page: 1 },
  { id: "pesoVacio", label: "Peso Vacío", dataKey: "pesoVacio", defaultX: 152, defaultY: 77, page: 1 },
  { id: "aseguradoraSoat", label: "Aseguradora SOAT", dataKey: "aseguradoraSoat", defaultX: 195, defaultY: 77, page: 1 },
  { id: "polizaSoat", label: "Póliza SOAT", dataKey: "polizaSoat", defaultX: 237, defaultY: 77, page: 1 },
  { id: "venceSoat", label: "Vence SOAT", dataKey: "venceSoat", defaultX: 259, defaultY: 77, page: 1 },
  { id: "conductorNombre", label: "Conductor Nombre", dataKey: "conductorNombre", defaultX: 20, defaultY: 87, page: 1 },
  { id: "conductorDocumento", label: "Conductor Documento", dataKey: "conductorDocumento", defaultX: 80, defaultY: 87, page: 1 },
  { id: "conductorDireccion", label: "Conductor Dirección", dataKey: "conductorDireccion", defaultX: 130, defaultY: 87, page: 1 },
  { id: "conductorTelefono", label: "Conductor Teléfono", dataKey: "conductorTelefono", defaultX: 195, defaultY: 87, page: 1 },
  { id: "conductorLicencia", label: "Licencia Conducción", dataKey: "conductorLicencia", defaultX: 225, defaultY: 87, page: 1 },
  { id: "tenedorDocumento", label: "Tenedor Documento", dataKey: "tenedorDocumento", defaultX: 20, defaultY: 107, page: 1 },
  { id: "tenedorDireccion", label: "Tenedor Dirección", dataKey: "tenedorDireccion", defaultX: 130, defaultY: 107, page: 1 },
  { id: "tenedorTelefono", label: "Tenedor Teléfono", dataKey: "tenedorTelefono", defaultX: 205, defaultY: 107, page: 1 },
  { id: "remesaNumero", label: "Número Remesa", dataKey: "remesaNumero", defaultX: 15, defaultY: 126, page: 1 },
  { id: "unidadMedida", label: "Unidad Medida", dataKey: "unidadMedida", defaultX: 37, defaultY: 126, page: 1 },
  { id: "cantidad", label: "Cantidad", dataKey: "cantidad", defaultX: 57, defaultY: 126, page: 1 },
  { id: "naturaleza", label: "Naturaleza Carga", dataKey: "naturaleza", defaultX: 75, defaultY: 126, page: 1 },
  { id: "producto", label: "Producto", dataKey: "producto", defaultX: 101, defaultY: 131, page: 1 },
  { id: "remitente", label: "Remitente", dataKey: "remitente", defaultX: 155, defaultY: 126, page: 1 },
  { id: "destinatario", label: "Destinatario", dataKey: "destinatario", defaultX: 205, defaultY: 126, page: 1 },
  { id: "valorTotal", label: "Valor Total Viaje", dataKey: "valorTotal", defaultX: 53, defaultY: 150, page: 1 },
  { id: "retencionFuente", label: "Retención Fuente", dataKey: "retencionFuente", defaultX: 53, defaultY: 157, page: 1 },
  { id: "retencionIca", label: "Retención ICA", dataKey: "retencionIca", defaultX: 53, defaultY: 163, page: 1 },
  { id: "valorNeto", label: "Valor Neto", dataKey: "valorNeto", defaultX: 53, defaultY: 170, page: 1 },
  { id: "anticipo", label: "Anticipo", dataKey: "anticipo", defaultX: 53, defaultY: 177, page: 1 },
  { id: "saldo", label: "Saldo a Pagar", dataKey: "saldo", defaultX: 53, defaultY: 183, page: 1 },
  { id: "lugarPago", label: "Lugar de Pago", dataKey: "lugarPago", defaultX: 143, defaultY: 150, page: 1 },
  { id: "fechaPago", label: "Fecha Pago Saldo", dataKey: "fechaPago", defaultX: 170, defaultY: 150, page: 1 },
  { id: "valorEnLetras", label: "Valor en Letras", dataKey: "valorEnLetras", defaultX: 53, defaultY: 191, page: 1 },
  { id: "p2_consecutivo", label: "Consecutivo (Pág 2)", dataKey: "consecutivo", defaultX: 238, defaultY: 45, page: 2 },
  { id: "p2_ingresoid", label: "Autorización (Pág 2)", dataKey: "ingresoId", defaultX: 238, defaultY: 52, page: 2 },
  { id: "p2_placa", label: "Placa (Pág 2)", dataKey: "placa", defaultX: 42, defaultY: 70, page: 2 },
  { id: "p2_conductor", label: "Conductor (Pág 2)", dataKey: "conductorNombre", defaultX: 110, defaultY: 70, page: 2 },
  { id: "p2_cedula", label: "Cédula (Pág 2)", dataKey: "cedula", defaultX: 240, defaultY: 70, page: 2 },
  { id: "p2_remesa", label: "Remesa (Pág 2)", dataKey: "remesaNumero", defaultX: 17, defaultY: 90, page: 2 },
  { id: "p2_hrsCargue", label: "Hrs Cargue", dataKey: "hrsCargue", defaultX: 52, defaultY: 90, page: 2 },
  { id: "p2_hrsDescargue", label: "Hrs Descargue", dataKey: "hrsDescargue", defaultX: 67, defaultY: 90, page: 2 },
  { id: "p2_fechaCargue", label: "Fecha Cargue", dataKey: "fechaCargue", defaultX: 88, defaultY: 90, page: 2 },
  { id: "p2_horaCargue", label: "Hora Cargue", dataKey: "horaCargue", defaultX: 105, defaultY: 90, page: 2 },
  { id: "p2_fechaDescargue", label: "Fecha Descargue", dataKey: "fechaDescargue", defaultX: 198, defaultY: 90, page: 2 },
  { id: "p2_horaDescargue", label: "Hora Descargue", dataKey: "horaDescargue", defaultX: 218, defaultY: 90, page: 2 },
];

const SCALE = 2.5;

export function ReportDesigner() {
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [fields, setFields] = useState<PdfTemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<PdfTemplate | null>(null);
  const [templateName, setTemplateName] = useState("Mi Plantilla");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    label: "",
    bindingType: "static" as "data" | "static",
    dataKey: "",
    defaultValue: "",
    page: 1,
  });
  const [backgroundImage1, setBackgroundImage1] = useState<string | null>(null);
  const [backgroundImage2, setBackgroundImage2] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/pdf-templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        const defaultTemplate = data.templates.find((t: PdfTemplate) => t.isDefault === 1);
        if (defaultTemplate) {
          setCurrentTemplate(defaultTemplate);
          setFields(defaultTemplate.fields);
          setTemplateName(defaultTemplate.name);
          setBackgroundImage1(defaultTemplate.backgroundImage1 || null);
          setBackgroundImage2(defaultTemplate.backgroundImage2 || null);
        } else {
          initializeDefaultFields();
        }
      }
    } catch {
      initializeDefaultFields();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeDefaultFields = () => {
    const defaultFields: PdfTemplateField[] = MANIFEST_FIELDS.map(f => ({
      id: f.id,
      label: f.label,
      dataKey: f.dataKey,
      x: f.defaultX,
      y: f.defaultY,
      fontSize: 6,
      fontWeight: "normal" as const,
      page: f.page,
      isCustom: false,
      bindingType: "data" as const,
    }));
    setFields(defaultFields);
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
    if (!field || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - field.x * SCALE,
      y: e.clientY - rect.top - field.y * SCALE,
    });
    setSelectedField(fieldId);
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !selectedField || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(279, (e.clientX - rect.left - dragOffset.x) / SCALE));
    const newY = Math.max(0, Math.min(216, (e.clientY - rect.top - dragOffset.y) / SCALE));

    setFields(prev => prev.map(f => 
      f.id === selectedField ? { ...f, x: Math.round(newX), y: Math.round(newY) } : f
    ));
  }, [isDragging, selectedField, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const updateFieldProperty = (fieldId: string, property: keyof PdfTemplateField, value: any) => {
    setFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, [property]: value } : f
    ));
  };

  const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = (page: 1 | 2) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: "Error", description: "Por favor seleccione un archivo de imagen", variant: "destructive" });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "La imagen no debe superar 10MB", variant: "destructive" });
      return;
    }

    try {
      toast({ title: "Procesando", description: "Optimizando imagen..." });
      const compressedBase64 = await compressImage(file, 1800, 1400, 0.75);
      
      if (page === 1) {
        setBackgroundImage1(compressedBase64);
      } else {
        setBackgroundImage2(compressedBase64);
      }
      
      const originalKB = Math.round(file.size / 1024);
      const compressedKB = Math.round((compressedBase64.length * 3) / 4 / 1024);
      toast({ 
        title: "Imagen cargada", 
        description: `Fondo de página ${page} actualizado (${originalKB}KB → ${compressedKB}KB)` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Error al procesar la imagen", variant: "destructive" });
    }
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: templateName,
        templateType: "manifiesto",
        fields,
        pageWidth: 279,
        pageHeight: 216,
        orientation: "landscape",
        backgroundImage1,
        backgroundImage2,
      };

      if (currentTemplate) {
        const res = await apiRequest("PUT", `/api/pdf-templates/${currentTemplate.id}`, payload);
        const data = await res.json();
        if (data.success) {
          toast({ title: "Guardado", description: "Plantilla actualizada correctamente" });
          setCurrentTemplate(data.template);
          loadTemplates();
        }
      } else {
        const res = await apiRequest("POST", "/api/pdf-templates", payload);
        const data = await res.json();
        if (data.success) {
          toast({ title: "Guardado", description: "Nueva plantilla creada" });
          setCurrentTemplate(data.template);
          loadTemplates();
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar la plantilla", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const setAsDefault = async () => {
    if (!currentTemplate) return;
    try {
      await apiRequest("POST", `/api/pdf-templates/${currentTemplate.id}/set-default`);
      toast({ title: "Predeterminada", description: "Esta plantilla se usará para generar PDFs" });
      loadTemplates();
    } catch {
      toast({ title: "Error", description: "No se pudo establecer como predeterminada", variant: "destructive" });
    }
  };

  const newTemplate = () => {
    setCurrentTemplate(null);
    setTemplateName("Nueva Plantilla");
    setBackgroundImage1(null);
    setBackgroundImage2(null);
    initializeDefaultFields();
  };

  const loadTemplate = (template: PdfTemplate) => {
    setCurrentTemplate(template);
    setFields(template.fields);
    setTemplateName(template.name);
    setBackgroundImage1(template.backgroundImage1 || null);
    setBackgroundImage2(template.backgroundImage2 || null);
  };

  const clearBackgroundImage = (page: 1 | 2) => {
    if (page === 1) {
      setBackgroundImage1(null);
    } else {
      setBackgroundImage2(null);
    }
    toast({ title: "Imagen eliminada", description: `Fondo de página ${page} restaurado al predeterminado` });
  };

  const addCustomField = () => {
    if (!newFieldData.label.trim()) {
      toast({ title: "Error", description: "Ingrese un nombre para el campo", variant: "destructive" });
      return;
    }
    if (newFieldData.bindingType === "data" && !newFieldData.dataKey.trim()) {
      toast({ title: "Error", description: "Ingrese la clave de datos para el campo vinculado", variant: "destructive" });
      return;
    }
    if (newFieldData.bindingType === "static" && !newFieldData.defaultValue.trim()) {
      toast({ title: "Error", description: "Ingrese el texto a mostrar", variant: "destructive" });
      return;
    }
    const fieldId = `custom_${Date.now()}`;
    const newField: PdfTemplateField = {
      id: fieldId,
      label: newFieldData.label,
      dataKey: newFieldData.bindingType === "data" ? newFieldData.dataKey : fieldId,
      x: 50,
      y: 50 + (fields.filter(f => f.page === newFieldData.page && f.isCustom).length * 10),
      fontSize: 6,
      fontWeight: "normal",
      page: newFieldData.page,
      isCustom: true,
      bindingType: newFieldData.bindingType,
      defaultValue: newFieldData.defaultValue,
    };
    setFields(prev => [...prev, newField]);
    setShowAddFieldDialog(false);
    setNewFieldData({ label: "", bindingType: "static", dataKey: "", defaultValue: "", page: activePage });
    toast({ title: "Campo agregado", description: `Campo "${newFieldData.label}" creado` });
  };

  const deleteField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setFields(prev => prev.filter(f => f.id !== fieldId));
      if (selectedField === fieldId) setSelectedField(null);
      toast({ title: "Campo eliminado", description: `Campo "${field.label}" eliminado de la plantilla` });
    }
  };

  const pageFields = fields.filter(f => f.page === activePage);
  const selectedFieldData = fields.find(f => f.id === selectedField);

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Cargando...</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-1 space-y-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Plantillas Guardadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={newTemplate} size="sm" variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Nueva Plantilla
            </Button>
            <ScrollArea className="h-32">
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className={`p-2 rounded cursor-pointer text-sm flex items-center gap-2 ${currentTemplate?.id === t.id ? "bg-primary/10" : "hover:bg-muted"}`}
                >
                  {t.isDefault === 1 && <Star className="h-3 w-3 text-yellow-500" />}
                  {t.name}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Nombre de Plantilla</Label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTemplate} disabled={isSaving} size="sm" className="flex-1">
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Guardando..." : "Guardar"}
              </Button>
              {currentTemplate && (
                <Button onClick={setAsDefault} size="sm" variant="outline">
                  <Star className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Campos Disponibles</CardTitle>
            <Button onClick={() => { setNewFieldData(prev => ({ ...prev, page: activePage })); setShowAddFieldDialog(true); }} size="sm" variant="ghost" className="h-6 w-6 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {pageFields.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedField(f.id)}
                    className={`p-2 rounded cursor-pointer text-xs flex items-center justify-between ${selectedField === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {f.isCustom ? (
                        f.bindingType === "static" ? <Type className="h-3 w-3 flex-shrink-0" /> : <Database className="h-3 w-3 flex-shrink-0" />
                      ) : null}
                      <span className="truncate">{f.label}</span>
                      <span className={`ml-1 flex-shrink-0 ${selectedField === f.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>({f.x}, {f.y})</span>
                    </div>
                    <Button
                      onClick={e => { e.stopPropagation(); deleteField(f.id); }}
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
                      title="Eliminar campo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {selectedFieldData && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Propiedades del Campo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">X (mm)</Label>
                  <Input
                    type="number"
                    value={selectedFieldData.x}
                    onChange={e => updateFieldProperty(selectedFieldData.id, "x", parseInt(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Y (mm)</Label>
                  <Input
                    type="number"
                    value={selectedFieldData.y}
                    onChange={e => updateFieldProperty(selectedFieldData.id, "y", parseInt(e.target.value) || 0)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tamaño Fuente</Label>
                <Input
                  type="number"
                  value={selectedFieldData.fontSize}
                  onChange={e => updateFieldProperty(selectedFieldData.id, "fontSize", parseInt(e.target.value) || 6)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Peso Fuente</Label>
                <Select
                  value={selectedFieldData.fontWeight}
                  onValueChange={v => updateFieldProperty(selectedFieldData.id, "fontWeight", v)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Negrita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="col-span-3">
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Vista Previa de Plantilla</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef1}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload(1)}
                  className="hidden"
                  data-testid="input-bg-image-1"
                />
                <input
                  ref={fileInputRef2}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload(2)}
                  className="hidden"
                  data-testid="input-bg-image-2"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => (activePage === 1 ? fileInputRef1 : fileInputRef2).current?.click()}
                  data-testid="button-change-bg"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Cambiar Fondo
                </Button>
                {((activePage === 1 && backgroundImage1) || (activePage === 2 && backgroundImage2)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => clearBackgroundImage(activePage)}
                    data-testid="button-clear-bg"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Tabs value={String(activePage)} onValueChange={v => setActivePage(Number(v) as 1 | 2)}>
                <TabsList className="h-8">
                  <TabsTrigger value="1" className="text-xs h-6">
                    {backgroundImage1 && <Image className="h-3 w-3 mr-1 text-green-500" />}
                    Página 1
                  </TabsTrigger>
                  <TabsTrigger value="2" className="text-xs h-6">
                    {backgroundImage2 && <Image className="h-3 w-3 mr-1 text-green-500" />}
                    Página 2
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded" style={{ maxHeight: "70vh" }}>
              <div
                ref={canvasRef}
                className="relative bg-white"
                style={{
                  width: 279 * SCALE,
                  height: 216 * SCALE,
                  backgroundImage: `url(${
                    activePage === 1 
                      ? (backgroundImage1 || "/manifiesto_template_p1.jpg") 
                      : (backgroundImage2 || "/manifiesto_template_p2.png")
                  })`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {pageFields.map(field => (
                  <div
                    key={field.id}
                    onMouseDown={e => handleMouseDown(e, field.id)}
                    className={`absolute cursor-move select-none px-1 rounded text-xs whitespace-nowrap ${
                      selectedField === field.id
                        ? "bg-blue-500 text-white ring-2 ring-blue-300"
                        : "bg-yellow-300/80 text-black hover:bg-yellow-400/80"
                    }`}
                    style={{
                      left: field.x * SCALE,
                      top: field.y * SCALE,
                      fontSize: field.fontSize * SCALE * 0.6,
                      fontWeight: field.fontWeight,
                    }}
                  >
                    <GripVertical className="inline h-3 w-3 mr-1 opacity-50" />
                    {field.label}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Arrastra los campos para posicionarlos. Usa el panel izquierdo para ajustar propiedades exactas.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Campo Personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre del Campo</Label>
              <Input
                value={newFieldData.label}
                onChange={e => setNewFieldData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Ej: Observaciones"
                data-testid="input-custom-field-name"
              />
            </div>
            <div>
              <Label>Tipo de Campo</Label>
              <Select
                value={newFieldData.bindingType}
                onValueChange={v => setNewFieldData(prev => ({ ...prev, bindingType: v as "data" | "static" }))}
              >
                <SelectTrigger data-testid="select-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Texto Estático</SelectItem>
                  <SelectItem value="data">Vinculado a Datos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {newFieldData.bindingType === "static" 
                  ? "El texto se mostrará tal como lo escriba" 
                  : "El valor se tomará de los datos del manifiesto"}
              </p>
            </div>
            {newFieldData.bindingType === "static" ? (
              <div>
                <Label>Texto a Mostrar</Label>
                <Input
                  value={newFieldData.defaultValue}
                  onChange={e => setNewFieldData(prev => ({ ...prev, defaultValue: e.target.value }))}
                  placeholder="Ej: TRANSPETROMIRA S.A.S"
                  data-testid="input-static-value"
                />
              </div>
            ) : (
              <div>
                <Label>Clave de Datos</Label>
                <Input
                  value={newFieldData.dataKey}
                  onChange={e => setNewFieldData(prev => ({ ...prev, dataKey: e.target.value }))}
                  placeholder="Ej: observaciones"
                  data-testid="input-data-key"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nombre del campo en los datos del manifiesto
                </p>
              </div>
            )}
            <div>
              <Label>Página</Label>
              <Select
                value={String(newFieldData.page)}
                onValueChange={v => setNewFieldData(prev => ({ ...prev, page: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Página 1</SelectItem>
                  <SelectItem value="2">Página 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addCustomField} data-testid="button-add-field">
              <Plus className="h-4 w-4 mr-2" /> Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
