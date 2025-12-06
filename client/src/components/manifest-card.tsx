import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Manifest, ControlPoint } from "@/lib/mock-data";
import { MapPin, Clock, Truck, ChevronRight, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManifestCardProps {
  manifest: Manifest;
  onSelect?: (manifest: Manifest) => void;
}

export function ManifestCard({ manifest, onSelect }: ManifestCardProps) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-md border-l-4 border-l-primary/50 hover:border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            {manifest.vehiclePlate}
            <Badge variant="outline" className="ml-2 font-mono text-xs">
              {manifest.consecutive}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs font-mono">
            RNDC: {manifest.radical} | ID: {manifest.id}
          </CardDescription>
        </div>
        <Badge 
          variant={manifest.status === 'Active' ? 'default' : 'secondary'}
          className={cn(
            manifest.status === 'Active' && "bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:text-green-400 border-green-200 dark:border-green-900"
          )}
        >
          {manifest.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="mt-4 space-y-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Puntos de Control</div>
          <div className="relative pl-4 border-l border-border space-y-6">
            {manifest.controlPoints.map((cp, idx) => (
              <div key={cp.id} className="relative">
                <div className={cn(
                  "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background",
                  cp.status === 'Reported' ? "bg-green-500" : 
                  cp.status === 'Pending' ? "bg-muted-foreground" : "bg-primary"
                )} />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cp.location}</span>
                    <Badge variant="outline" className="text-[10px] h-5">
                      {cp.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(cp.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {cp.city}
                    </span>
                  </div>
                  {cp.status === 'Reported' && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" /> Reportado
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {onSelect && (
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-xs hover:bg-primary/5 hover:text-primary"
            onClick={() => onSelect(manifest)}
          >
            Ver Detalles <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
