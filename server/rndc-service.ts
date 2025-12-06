import { XMLParser } from "fast-xml-parser";

const DEFAULT_RNDC_URL = "http://plc.mintransporte.gov.co:8080/soap/IBPMServices";

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
  
  try {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
               xmlns:tns="urn:BPMServicesIntf-IBPMServices">
  <soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
    <tns:AtenderMensajeRNDC>
      <Request xsi:type="xsd:string"><![CDATA[${xmlRequest}]]></Request>
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
    
    let resultXml = "";
    try {
      resultXml = parsed?.Envelope?.Body?.AtenderMensajeRNDCResponse?.return || 
                  parsed?.Envelope?.Body?.AtenderMensajeRNDCResponse?.AtenderMensajeRNDCResult ||
                  parsed?.Envelope?.Body?.["ns1:AtenderMensajeRNDCResponse"]?.return ||
                  "";
    } catch {
      resultXml = responseText;
    }

    let code = "000";
    let message = "Respuesta recibida";
    let success = true;

    if (resultXml) {
      const resultParsed = parser.parse(resultXml);
      if (resultParsed?.root?.respuesta) {
        code = resultParsed.root.respuesta.codigo || "000";
        message = resultParsed.root.respuesta.mensaje || "Sin mensaje";
        success = code === "00" || code === "0" || code === "000";
      }
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

export function parseRndcResponse(xmlResponse: string): { code: string; message: string } {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    
    const parsed = parser.parse(xmlResponse);
    
    if (parsed?.root?.respuesta) {
      return {
        code: parsed.root.respuesta.codigo || "UNKNOWN",
        message: parsed.root.respuesta.mensaje || "Sin mensaje",
      };
    }
    
    return { code: "PARSE_ERROR", message: "No se pudo parsear la respuesta" };
  } catch {
    return { code: "PARSE_ERROR", message: "Error al parsear XML de respuesta" };
  }
}
