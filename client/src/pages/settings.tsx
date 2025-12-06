import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export default function Settings() {
  const { settings, saveSettings } = useSettings();
  const [formData, setFormData] = useState(settings);

  // Sync local state when settings load
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveSettings(formData);
    toast({
      title: "Configuración Guardada",
      description: "Sus credenciales han sido actualizadas correctamente.",
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Credenciales RNDC</CardTitle>
            <CardDescription>Datos de acceso para el WebService del Ministerio de Transporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario GPS</Label>
              <Input 
                value={formData.usernameGps} 
                onChange={(e) => handleChange("usernameGps", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña GPS</Label>
              <Input 
                type="password" 
                value={formData.passwordGps}
                onChange={(e) => handleChange("passwordGps", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>NIT Empresa</Label>
              <Input 
                value={formData.companyNit}
                onChange={(e) => handleChange("companyNit", e.target.value)}
              />
            </div>
            <Button onClick={handleSave} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" /> Guardar Cambios
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
