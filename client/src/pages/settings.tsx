import { Layout } from "@/components/layout/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Settings() {
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
              <Input defaultValue="usuariogps" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña GPS</Label>
              <Input type="password" defaultValue="passwordgps" />
            </div>
            <div className="space-y-2">
              <Label>NIT Empresa</Label>
              <Input defaultValue="9999999999" />
            </div>
            <Button>Guardar Cambios</Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
