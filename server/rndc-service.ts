import { XMLParser } from "fast-xml-parser";

const DEFAULT_RNDC_URL = "http://rndcws2.mintransporte.gov.co:8080/ws/soap/IBPMServices";

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
        } else if (resultParsed?.root?.documento) {
          // Query response with documento - can be array (multiple) or object (single)
          success = true;
          const docs = resultParsed.root.documento;
          if (Array.isArray(docs)) {
            code = "MULTIPLE";
            message = `Consulta exitosa. ${docs.length} manifiestos encontrados.`;
          } else if (docs.ingresoidmanifiesto) {
            code = String(docs.ingresoidmanifiesto);
            message = `Consulta exitosa. Manifiesto: ${code}`;
          } else if (docs.ingresoid) {
            code = String(docs.ingresoid);
            message = `Consulta exitosa. IngresoID: ${code}`;
          } else {
            code = "DOCS";
            message = `Consulta exitosa con documentos.`;
          }
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

export interface ManifiestoDetails {
  INGRESOID: string;
  FECHAING: string;
  CODOPERACIONTRANSPORTE: string;
  FECHAEXPEDICIONMANIFIESTO: string;
  CODMUNICIPIOORIGENMANIFIESTO: string;
  CODMUNICIPIODESTINOMANIFIESTO: string;
  CODIDTITULARMANIFIESTO: string;
  NUMIDTITULARMANIFIESTO: string;
  NUMPLACA: string;
  NUMPLACAREMOLQUE: string;
  CODIDCONDUCTOR: string;
  NUMIDCONDUCTOR: string;
  CODIDCONDUCTOR2: string;
  NUMIDCONDUCTOR2: string;
  VALORFLETEPACTADOVIAJE: string;
  RETENCIONFUENTEMANIFIESTO: string;
  RETENCIONICAMANIFIESTOCARGA: string;
  VALORANTICIPOMANIFIESTO: string;
  CODMUNICIPIOPAGOSALDO: string;
  CODRESPONSABLEPAGOCARGUE: string;
  CODRESPONSABLEPAGODESCARGUE: string;
  FECHAPAGOSALDOMANIFIESTO: string;
  NITMONITOREOFLOTA: string;
  ACEPTACIONELECTRONICA: string;
  TIPOVALORPACTADO: string;
  SEGURIDADQR: string;
}

export async function queryManifiestoDetails(
  username: string,
  password: string,
  companyNit: string,
  numManifiesto: string,
  targetUrl?: string
): Promise<{ success: boolean; details?: ManifiestoDetails; message: string; rawXml: string }> {
  const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${username}</username>
  <password>${password}</password>
 </acceso>
 <solicitud>
  <tipo>3</tipo>
  <procesoid>4</procesoid>
 </solicitud>
 <variables>
INGRESOID,FECHAING,CODOPERACIONTRANSPORTE,FECHAEXPEDICIONMANIFIESTO,CODMUNICIPIOORIGENMANIFIESTO,CODMUNICIPIODESTINOMANIFIESTO,CODIDTITULARMANIFIESTO,NUMIDTITULARMANIFIESTO,NUMPLACA,NUMPLACAREMOLQUE,CODIDCONDUCTOR,NUMIDCONDUCTOR,CODIDCONDUCTOR2,NUMIDCONDUCTOR2,VALORFLETEPACTADOVIAJE,RETENCIONFUENTEMANIFIESTO,RETENCIONICAMANIFIESTOCARGA,VALORANTICIPOMANIFIESTO,CODMUNICIPIOPAGOSALDO,CODRESPONSABLEPAGOCARGUE,CODRESPONSABLEPAGODESCARGUE,FECHAPAGOSALDOMANIFIESTO,NITMONITOREOFLOTA,ACEPTACIONELECTRONICA,TIPOVALORPACTADO,SEGURIDADQR
 </variables>
 <documento>
  <NUMNITEMPRESATRANSPORTE>${companyNit}</NUMNITEMPRESATRANSPORTE>
  <NUMMANIFIESTOCARGA>${numManifiesto}</NUMMANIFIESTOCARGA>
 </documento>
</root>`;

  const result = await sendXmlToRndc(xml, targetUrl);
  
  if (!result.success) {
    return { success: false, message: result.message, rawXml: result.rawXml };
  }

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    
    const parsed = parser.parse(result.rawXml);
    const doc = parsed?.root?.documento;
    
    if (!doc) {
      return { success: false, message: "No se encontró el documento en la respuesta", rawXml: result.rawXml };
    }

    // Helper to get value handling both uppercase and lowercase keys from RNDC
    const getVal = (key: string) => String(doc[key] || doc[key.toLowerCase()] || "");

    const details: ManifiestoDetails = {
      INGRESOID: getVal("INGRESOID") || getVal("ingresoid"),
      FECHAING: getVal("FECHAING") || getVal("fechaing"),
      CODOPERACIONTRANSPORTE: getVal("CODOPERACIONTRANSPORTE") || getVal("codoperaciontransporte"),
      FECHAEXPEDICIONMANIFIESTO: getVal("FECHAEXPEDICIONMANIFIESTO") || getVal("fechaexpedicionmanifiesto"),
      CODMUNICIPIOORIGENMANIFIESTO: getVal("CODMUNICIPIOORIGENMANIFIESTO") || getVal("codmunicipioorigenmanifiesto"),
      CODMUNICIPIODESTINOMANIFIESTO: getVal("CODMUNICIPIODESTINOMANIFIESTO") || getVal("codmunicipiodestinomanifiesto"),
      CODIDTITULARMANIFIESTO: getVal("CODIDTITULARMANIFIESTO") || getVal("codidtitularmanifiesto"),
      NUMIDTITULARMANIFIESTO: getVal("NUMIDTITULARMANIFIESTO") || getVal("numidtitularmanifiesto"),
      NUMPLACA: getVal("NUMPLACA") || getVal("numplaca"),
      NUMPLACAREMOLQUE: getVal("NUMPLACAREMOLQUE") || getVal("numplacaremolque"),
      CODIDCONDUCTOR: getVal("CODIDCONDUCTOR") || getVal("codidconductor"),
      NUMIDCONDUCTOR: getVal("NUMIDCONDUCTOR") || getVal("numidconductor"),
      CODIDCONDUCTOR2: getVal("CODIDCONDUCTOR2") || getVal("codidconductor2"),
      NUMIDCONDUCTOR2: getVal("NUMIDCONDUCTOR2") || getVal("numidconductor2"),
      VALORFLETEPACTADOVIAJE: getVal("VALORFLETEPACTADOVIAJE") || getVal("valorfletepactadoviaje"),
      RETENCIONFUENTEMANIFIESTO: getVal("RETENCIONFUENTEMANIFIESTO") || getVal("retencionfuentemanifiesto"),
      RETENCIONICAMANIFIESTOCARGA: getVal("RETENCIONICAMANIFIESTOCARGA") || getVal("retencionicamanifiestocarga"),
      VALORANTICIPOMANIFIESTO: getVal("VALORANTICIPOMANIFIESTO") || getVal("valoranticipomanifiesto"),
      CODMUNICIPIOPAGOSALDO: getVal("CODMUNICIPIOPAGOSALDO") || getVal("codmunicipiopagosaldo"),
      CODRESPONSABLEPAGOCARGUE: getVal("CODRESPONSABLEPAGOCARGUE") || getVal("codresponsablepagocargue"),
      CODRESPONSABLEPAGODESCARGUE: getVal("CODRESPONSABLEPAGODESCARGUE") || getVal("codresponsablepagodescargue"),
      FECHAPAGOSALDOMANIFIESTO: getVal("FECHAPAGOSALDOMANIFIESTO") || getVal("fechapagosaldomanifiesto"),
      NITMONITOREOFLOTA: getVal("NITMONITOREOFLOTA") || getVal("nitmonitoreoflota"),
      ACEPTACIONELECTRONICA: getVal("ACEPTACIONELECTRONICA") || getVal("aceptacionelectronica"),
      TIPOVALORPACTADO: getVal("TIPOVALORPACTADO") || getVal("tipovalorpactado"),
      SEGURIDADQR: getVal("SEGURIDADQR") || getVal("seguridadqr"),
    };

    return { success: true, details, message: "Consulta exitosa", rawXml: result.rawXml };
  } catch (error) {
    return { 
      success: false, 
      message: `Error parseando respuesta: ${error instanceof Error ? error.message : "desconocido"}`, 
      rawXml: result.rawXml 
    };
  }
}

export interface TerceroDetails {
  INGRESOID: string;
  FECHAING: string;
  CODTIPOIDTERCERO: string;
  NOMIDTERCERO: string;
  PRIMERAPELLIDOIDTERCERO: string;
  SEGUNDOAPELLIDOIDTERCERO: string;
  NUMTELEFONOCONTACTO: string;
  NOMENCLATURADIRECCION: string;
  CODMUNICIPIORNDC: string;
  CODSEDETERCERO: string;
  NOMSEDETERCERO: string;
  NUMLICENCIACONDUCCION: string;
  CODCATEGORIALICENCIACONDUCCION: string;
  FECHAVENCIMIENTOLICENCIA: string;
  LATITUD: string;
  LONGITUD: string;
  NOMBRERAZONSOCIAL?: string;
}

export interface VehiculoRndcDetails {
  INGRESOID: string;
  FECHAING: string;
  CODMARCAVEHICULOCARGA: string;
  CODLINEAVEHICULOCARGA: string;
  ANOFABRICACIONVEHICULOCARGA: string;
  CODTIPOIDPROPIETARIO: string;
  NUMIDPROPIETARIO: string;
  CODTIPOIDTENEDOR: string;
  NUMIDTENEDOR: string;
  CODTIPOCOMBUSTIBLE: string;
  PESOVEHICULOVACIO: string;
  CODCOLORVEHICULOCARGA: string;
  CODTIPOCARROCERIA: string;
  NUMNITASEGURADORASOAT: string;
  FECHAVENCIMIENTOSOAT: string;
  NUMSEGUROSOAT: string;
  UNIDADMEDIDACAPACIDAD: string;
}

export interface VehiculoExtraDetails {
  PLACA: string;
  CODCONFIGURACION: string;
  ESTADOMATRICULA: string;
  FECHAVENCE_SOAT: string;
  MARCA: string;
  FECHAVENCE_RTM: string;
}

export async function queryTerceroDetails(
  username: string,
  password: string,
  companyNit: string,
  numIdTercero: string,
  codIdTercero?: string,
  targetUrl?: string
): Promise<{ success: boolean; details?: TerceroDetails; message: string; rawXml: string }> {
  const tipoId = codIdTercero || "C";
  const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${username}</username>
  <password>${password}</password>
 </acceso>
 <solicitud>
  <tipo>3</tipo>
  <procesoid>11</procesoid>
 </solicitud>
 <variables>
INGRESOID,FECHAING,CODTIPOIDTERCERO,NOMIDTERCERO,PRIMERAPELLIDOIDTERCERO,SEGUNDOAPELLIDOIDTERCERO,NUMTELEFONOCONTACTO,NOMENCLATURADIRECCION,CODMUNICIPIORNDC,CODSEDETERCERO,NOMSEDETERCERO,NUMLICENCIACONDUCCION,CODCATEGORIALICENCIACONDUCCION,FECHAVENCIMIENTOLICENCIA,LATITUD,LONGITUD,NOMBRERAZONSOCIAL
 </variables>
 <documento>
  <NUMNITEMPRESATRANSPORTE>${companyNit}</NUMNITEMPRESATRANSPORTE>
  <NUMIDTERCERO>${numIdTercero}</NUMIDTERCERO>
 </documento>
</root>`;

  console.log("[queryTerceroDetails] ========== XML ENVIADO ==========");
  console.log(xml);
  console.log("[queryTerceroDetails] =================================");
  
  const result = await sendXmlToRndc(xml, targetUrl);
  
  if (!result.success) {
    console.log("[queryTerceroDetails] RNDC request failed for tercero:", numIdTercero, "message:", result.message);
    return { success: false, message: result.message, rawXml: result.rawXml };
  }

  console.log("[queryTerceroDetails] ========== XML RESPUESTA ==========");
  console.log(result.rawXml);
  console.log("[queryTerceroDetails] ===================================");

  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(result.rawXml);
    const doc = parsed?.root?.documento;
    
    console.log("[queryTerceroDetails] Parsed doc for tercero", numIdTercero, ":", JSON.stringify(doc, null, 2)?.substring(0, 1200));
    
    if (!doc) {
      console.log("[queryTerceroDetails] No documento found for tercero:", numIdTercero);
      return { success: false, message: "No se encontró el tercero", rawXml: result.rawXml };
    }

    const getVal = (key: string) => String(doc[key] || doc[key.toLowerCase()] || "");

    const details: TerceroDetails = {
      INGRESOID: getVal("INGRESOID") || getVal("ingresoid"),
      FECHAING: getVal("FECHAING") || getVal("fechaing"),
      CODTIPOIDTERCERO: getVal("CODTIPOIDTERCERO") || getVal("codtipoidtercero"),
      NOMIDTERCERO: getVal("NOMIDTERCERO") || getVal("nomidtercero"),
      PRIMERAPELLIDOIDTERCERO: getVal("PRIMERAPELLIDOIDTERCERO") || getVal("primerapellidoidtercero"),
      SEGUNDOAPELLIDOIDTERCERO: getVal("SEGUNDOAPELLIDOIDTERCERO") || getVal("segundoapellidoidtercero"),
      NUMTELEFONOCONTACTO: getVal("NUMTELEFONOCONTACTO") || getVal("numtelefonocontacto"),
      NOMENCLATURADIRECCION: getVal("NOMENCLATURADIRECCION") || getVal("nomenclaturadireccion"),
      CODMUNICIPIORNDC: getVal("CODMUNICIPIORNDC") || getVal("codmunicipiorndc"),
      CODSEDETERCERO: getVal("CODSEDETERCERO") || getVal("codsedetercero"),
      NOMSEDETERCERO: getVal("NOMSEDETERCERO") || getVal("nomsedetercero"),
      NUMLICENCIACONDUCCION: getVal("NUMLICENCIACONDUCCION") || getVal("numlicenciaconduccion"),
      CODCATEGORIALICENCIACONDUCCION: getVal("CODCATEGORIALICENCIACONDUCCION") || getVal("codcategorialicenciaconduccion"),
      FECHAVENCIMIENTOLICENCIA: getVal("FECHAVENCIMIENTOLICENCIA") || getVal("fechavencimientolicencia"),
      LATITUD: getVal("LATITUD") || getVal("latitud"),
      LONGITUD: getVal("LONGITUD") || getVal("longitud"),
      NOMBRERAZONSOCIAL: getVal("NOMBRERAZONSOCIAL") || getVal("nombrerazonsocial"),
    };

    return { success: true, details, message: "Consulta exitosa", rawXml: result.rawXml };
  } catch (error) {
    return { 
      success: false, 
      message: `Error parseando respuesta: ${error instanceof Error ? error.message : "desconocido"}`, 
      rawXml: result.rawXml 
    };
  }
}

export async function queryVehiculoDetails(
  username: string,
  password: string,
  companyNit: string,
  numPlaca: string,
  targetUrl?: string
): Promise<{ success: boolean; details?: VehiculoRndcDetails; message: string; rawXml: string }> {
  const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${username}</username>
  <password>${password}</password>
 </acceso>
 <solicitud>
  <tipo>3</tipo>
  <procesoid>12</procesoid>
 </solicitud>
 <variables>
INGRESOID,FECHAING,CODMARCAVEHICULOCARGA,CODLINEAVEHICULOCARGA,ANOFABRICACIONVEHICULOCARGA,CODTIPOIDPROPIETARIO,NUMIDPROPIETARIO,CODTIPOIDTENEDOR,NUMIDTENEDOR,CODTIPOCOMBUSTIBLE,PESOVEHICULOVACIO,CODCOLORVEHICULOCARGA,CODTIPOCARROCERIA,NUMNITASEGURADORASOAT,FECHAVENCIMIENTOSOAT,NUMSEGUROSOAT,UNIDADMEDIDACAPACIDAD
 </variables>
 <documento>
  <NUMNITEMPRESATRANSPORTE>${companyNit}</NUMNITEMPRESATRANSPORTE>
  <NUMPLACA>'${numPlaca.toUpperCase()}'</NUMPLACA>
 </documento>
</root>`;

  const result = await sendXmlToRndc(xml, targetUrl);
  
  if (!result.success) {
    return { success: false, message: result.message, rawXml: result.rawXml };
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(result.rawXml);
    const doc = parsed?.root?.documento;
    
    if (!doc) {
      return { success: false, message: "No se encontró el vehículo", rawXml: result.rawXml };
    }

    const getVal = (key: string) => String(doc[key] || doc[key.toLowerCase()] || "");

    const details: VehiculoRndcDetails = {
      INGRESOID: getVal("INGRESOID") || getVal("ingresoid"),
      FECHAING: getVal("FECHAING") || getVal("fechaing"),
      CODMARCAVEHICULOCARGA: getVal("CODMARCAVEHICULOCARGA") || getVal("codmarcavehiculocarga"),
      CODLINEAVEHICULOCARGA: getVal("CODLINEAVEHICULOCARGA") || getVal("codlineavehiculocarga"),
      ANOFABRICACIONVEHICULOCARGA: getVal("ANOFABRICACIONVEHICULOCARGA") || getVal("anofabricacionvehiculocarga"),
      CODTIPOIDPROPIETARIO: getVal("CODTIPOIDPROPIETARIO") || getVal("codtipoidpropietario"),
      NUMIDPROPIETARIO: getVal("NUMIDPROPIETARIO") || getVal("numidpropietario"),
      CODTIPOIDTENEDOR: getVal("CODTIPOIDTENEDOR") || getVal("codtipoidtenedor"),
      NUMIDTENEDOR: getVal("NUMIDTENEDOR") || getVal("numidtenedor"),
      CODTIPOCOMBUSTIBLE: getVal("CODTIPOCOMBUSTIBLE") || getVal("codtipocombustible"),
      PESOVEHICULOVACIO: getVal("PESOVEHICULOVACIO") || getVal("pesovehiculovacio"),
      CODCOLORVEHICULOCARGA: getVal("CODCOLORVEHICULOCARGA") || getVal("codcolorvehiculocarga"),
      CODTIPOCARROCERIA: getVal("CODTIPOCARROCERIA") || getVal("codtipocarroceria"),
      NUMNITASEGURADORASOAT: getVal("NUMNITASEGURADORASOAT") || getVal("numnitaseguradorasoat"),
      FECHAVENCIMIENTOSOAT: getVal("FECHAVENCIMIENTOSOAT") || getVal("fechavencimientosoat"),
      NUMSEGUROSOAT: getVal("NUMSEGUROSOAT") || getVal("numsegurosoat"),
      UNIDADMEDIDACAPACIDAD: getVal("UNIDADMEDIDACAPACIDAD") || getVal("unidadmedidacapacidad"),
    };

    return { success: true, details, message: "Consulta exitosa", rawXml: result.rawXml };
  } catch (error) {
    return { 
      success: false, 
      message: `Error parseando respuesta: ${error instanceof Error ? error.message : "desconocido"}`, 
      rawXml: result.rawXml 
    };
  }
}

export async function queryVehiculoExtraDetails(
  username: string,
  password: string,
  numPlaca: string,
  targetUrl?: string
): Promise<{ success: boolean; details?: VehiculoExtraDetails; message: string; rawXml: string }> {
  const xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<root>
 <acceso>
  <username>${username}</username>
  <password>${password}</password>
 </acceso>
 <solicitud>
  <tipo>6</tipo>
  <procesoid>48</procesoid>
 </solicitud>
 <variables>
PLACA,CODCONFIGURACION,ESTADOMATRICULA,FECHAVENCE_SOAT,MARCA,FECHAVENCE_RTM
 </variables>
 <documento>
  <PLACA>'${numPlaca.toUpperCase()}'</PLACA>
 </documento>
</root>`;

  const result = await sendXmlToRndc(xml, targetUrl);
  
  if (!result.success) {
    return { success: false, message: result.message, rawXml: result.rawXml };
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsed = parser.parse(result.rawXml);
    const doc = parsed?.root?.documento;
    
    if (!doc) {
      return { success: false, message: "No se encontró el vehículo", rawXml: result.rawXml };
    }

    const getVal = (key: string) => String(doc[key] || doc[key.toLowerCase()] || "");

    const details: VehiculoExtraDetails = {
      PLACA: getVal("PLACA") || getVal("placa"),
      CODCONFIGURACION: getVal("CODCONFIGURACION") || getVal("codconfiguracion"),
      ESTADOMATRICULA: getVal("ESTADOMATRICULA") || getVal("estadomatricula"),
      FECHAVENCE_SOAT: getVal("FECHAVENCE_SOAT") || getVal("fechavence_soat"),
      MARCA: getVal("MARCA") || getVal("marca"),
      FECHAVENCE_RTM: getVal("FECHAVENCE_RTM") || getVal("fechavence_rtm"),
    };

    return { success: true, details, message: "Consulta exitosa", rawXml: result.rawXml };
  } catch (error) {
    return { 
      success: false, 
      message: `Error parseando respuesta: ${error instanceof Error ? error.message : "desconocido"}`, 
      rawXml: result.rawXml 
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
