import { XMLParser } from "fast-xml-parser";

const DEFAULT_RNDC_URL = "http://plc.mintransporte.gov.co:8080/soap/IBPMServices";

function unescapeHtmlEntities(str: string): string {
  if (!str) return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

interface RndcResponse {
  success: boolean;
  code: string;
  message: string;
  rawXml: string;
}

export async function sendXmlToRndc(xmlRequest: string, targetUrl?: string): Promise<RndcResponse> {
  let wsUrl = targetUrl || DEFAULT_RNDC_URL;
  
  if (!wsUrl.includes("/soap/IBPMServices")) {
    wsUrl = wsUrl.replace(/\/?$/, "/soap/IBPMServices");
  }
  
  const cleanedXml = xmlRequest.replace(/<\?xml[^?]*\?>\s*/gi, '').trim();
  
  try {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
               xmlns:tns="urn:BPMServicesIntf-IBPMServices">
  <soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
    <tns:AtenderMensajeRNDC>
      <Request xsi:type="xsd:string">${cleanedXml}</Request>
    </tns:AtenderMensajeRNDC>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(wsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "urn:BPMServicesIntf-IBPMServices#AtenderMensajeRNDC",
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        code: `HTTP_${response.status}`,
        message: `Error HTTP ${response.status}: ${response.statusText}`,
        rawXml: responseText,
      };
    }
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    
    let parsed;
    try {
      parsed = parser.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        code: "PARSE_ERROR",
        message: "Error al parsear respuesta SOAP",
        rawXml: responseText,
      };
    }
    
    let resultRaw: any = null;
    try {
      resultRaw = parsed?.Envelope?.Body?.AtenderMensajeRNDCResponse?.return || 
                  parsed?.Envelope?.Body?.AtenderMensajeRNDCResponse?.AtenderMensajeRNDCResult ||
                  parsed?.Envelope?.Body?.["ns1:AtenderMensajeRNDCResponse"]?.return ||
                  null;
    } catch {
      resultRaw = null;
    }

    let resultXml = "";
    if (resultRaw) {
      if (typeof resultRaw === "string") {
        resultXml = unescapeHtmlEntities(resultRaw);
      } else if (typeof resultRaw === "object" && resultRaw["#text"]) {
        resultXml = unescapeHtmlEntities(resultRaw["#text"]);
      } else if (typeof resultRaw === "object") {
        resultXml = JSON.stringify(resultRaw);
      }
    }

    let code = "";
    let message = "";
    let success = false;

    if (resultXml) {
      try {
        const resultParsed = parser.parse(resultXml);
        
        if (resultParsed?.root?.ingresoid) {
          success = true;
          code = String(resultParsed.root.ingresoid);
          message = `Registro aceptado. IngresoID: ${code}`;
        } else if (resultParsed?.root?.documento?.ingresoid) {
          // Query response with documento wrapper
          success = true;
          code = String(resultParsed.root.documento.ingresoid);
          message = `Consulta exitosa. IngresoID: ${code}`;
        } else if (resultParsed?.root?.ErrorMSG || resultParsed?.root?.errormsg) {
          success = false;
          const errorMsg = String(resultParsed.root.ErrorMSG || resultParsed.root.errormsg);
          const errorMatch = errorMsg.match(/error\s+(\w+):/i);
          code = errorMatch ? errorMatch[1].toUpperCase() : "ERROR";
          message = errorMsg;
        } else if (resultParsed?.root?.respuesta) {
          code = String(resultParsed.root.respuesta.codigo || "000");
          message = String(resultParsed.root.respuesta.mensaje || "Sin mensaje");
          success = code === "00" || code === "0" || code === "000";
        } else {
          code = "UNKNOWN";
          message = "Respuesta no reconocida";
          success = false;
        }
      } catch {
        code = "PARSE_ERROR";
        message = "Error al parsear respuesta del RNDC";
        success = false;
      }
    } else {
      code = "EMPTY";
      message = "Respuesta vacía del servidor";
      success = false;
    }

    return {
      success,
      code,
      message,
      rawXml: resultXml || responseText,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return {
      success: false,
      code: "ERROR",
      message: `Error de conexión: ${errorMessage}`,
      rawXml: "",
    };
  }
}

export function parseRndcResponse(xmlResponse: string): { code: string; message: string; success: boolean } {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    
    const parsed = parser.parse(xmlResponse);
    
    if (parsed?.root?.ingresoid) {
      const ingresoId = String(parsed.root.ingresoid);
      return {
        code: ingresoId,
        message: `Registro aceptado. IngresoID: ${ingresoId}`,
        success: true,
      };
    }
    
    if (parsed?.root?.errormsg) {
      const errorMsg = String(parsed.root.errormsg);
      const errorMatch = errorMsg.match(/error\s+(\w+):/i);
      return {
        code: errorMatch ? errorMatch[1].toUpperCase() : "ERROR",
        message: errorMsg,
        success: false,
      };
    }
    
    if (parsed?.root?.respuesta) {
      const code = String(parsed.root.respuesta.codigo || "UNKNOWN");
      return {
        code,
        message: String(parsed.root.respuesta.mensaje || "Sin mensaje"),
        success: code === "00" || code === "0" || code === "000",
      };
    }
    
    return { code: "UNKNOWN", message: "Respuesta no reconocida", success: false };
  } catch {
    return { code: "PARSE_ERROR", message: "Error al parsear XML de respuesta", success: false };
  }
}
