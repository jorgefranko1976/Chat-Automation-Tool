import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface XmlViewerProps {
  xml: string;
  title?: string;
}

export function XmlViewer({ xml, title = "Vista Previa XML" }: XmlViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-slate-950 border-slate-800 text-slate-50 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4 bg-slate-900 border-b border-slate-800">
        <CardTitle className="text-xs font-mono text-slate-400 uppercase tracking-wider">{title}</CardTitle>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <pre className="p-4 text-xs font-mono leading-relaxed text-blue-100">
          <code>{xml}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
