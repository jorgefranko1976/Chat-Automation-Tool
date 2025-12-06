import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings, RndcSettings, WsEnvironment } from "@/hooks/use-settings";
import { toast } from "@/hooks/use-toast";
import { Save, KeyRound, Building2, Globe, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const { settings, saveSettings } = useSettings();
  const [formData, setFormData] = useState<RndcSettings>(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof RndcSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEnvironmentChange = (env: WsEnvironment) => {
    setFormData(prev => ({ ...prev, wsEnvironment: env }));
  };

  const handleSave = () => {
    saveSettings(formData);
    toast({
      title: "Configuración Guardada",
      description: "Los parámetros del sistema han sido actualizados correctamente.",
    });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">Configure los parámetros del sistema</p>
        </div>

        <Tabs defaultValue="credentials" className="w-full max-w-3xl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="credentials" data-testid="tab-credentials">
              <KeyRound className="mr-2 h-4 w-4" /> Credenciales RNDC
            </TabsTrigger>
            <TabsTrigger value="company" data-testid="tab-company">
              <Building2 className="mr-2 h-4 w-4" /> Datos Empresa
            </TabsTrigger>
            <TabsTrigger value="webservice" data-testid="tab-webservice">
              <Globe className="mr-2 h-4 w-4" /> Web Service
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credentials">
            <Card>
              <CardHeader>
                <CardTitle>Credenciales RNDC</CardTitle>
                <CardDescription>Datos de acceso para el WebService del Ministerio de Transporte</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usernameGps">Usuario GPS</Label>
                  <Input 
                    id="usernameGps"
                    value={formData.usernameGps} 
                    onChange={(e) => handleChange("usernameGps", e.target.value)}
                    placeholder="Ingrese su usuario GPS"
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordGps">Contraseña GPS</Label>
                  <Input 
                    id="passwordGps"
                    type="password" 
                    value={formData.passwordGps}
                    onChange={(e) => handleChange("passwordGps", e.target.value)}
                    placeholder="Ingrese su contraseña GPS"
                    data-testid="input-password"
                  />
                </div>
                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-credentials">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la Empresa</CardTitle>
                <CardDescription>Información de su empresa para los reportes RNDC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nombre de la Empresa</Label>
                  <Input 
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                    placeholder="Razón social de la empresa"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyNit">NIT Empresa</Label>
                  <Input 
                    id="companyNit"
                    value={formData.companyNit}
                    onChange={(e) => handleChange("companyNit", e.target.value)}
                    placeholder="NIT sin dígito de verificación"
                    data-testid="input-company-nit"
                  />
                </div>
                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-company">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webservice">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Web Service</CardTitle>
                <CardDescription>URLs de conexión al Web Service SOAP del RNDC.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="wsUrlProd">URL Producción</Label>
                  <Input 
                    id="wsUrlProd"
                    value={formData.wsUrlProd}
                    onChange={(e) => handleChange("wsUrlProd", e.target.value)}
                    placeholder="URL del servicio de producción"
                    data-testid="input-url-prod"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wsUrlTest">URL Pruebas</Label>
                  <Input 
                    id="wsUrlTest"
                    value={formData.wsUrlTest}
                    onChange={(e) => handleChange("wsUrlTest", e.target.value)}
                    placeholder="URL del servicio de pruebas"
                    data-testid="input-url-test"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Ambiente Activo</Label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange("testing")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        formData.wsEnvironment === "testing"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-env-testing"
                    >
                      {formData.wsEnvironment === "testing" && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">Pruebas</div>
                        <div className="text-sm text-muted-foreground">Para desarrollo y testing</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange("production")}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        formData.wsEnvironment === "production"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                      data-testid="button-env-production"
                    >
                      {formData.wsEnvironment === "production" && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold">Producción</div>
                        <div className="text-sm text-muted-foreground">Envío real al RNDC</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-amber-800">
                    <strong>Nota:</strong> El ambiente activo actualmente es{" "}
                    <span className="font-bold uppercase text-amber-900">
                      {formData.wsEnvironment === "production" ? "PRODUCCIÓN" : "PRUEBAS"}
                    </span>
                  </p>
                </div>

                <Button onClick={handleSave} className="w-full sm:w-auto" data-testid="button-save-webservice">
                  <Save className="mr-2 h-4 w-4" /> Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
