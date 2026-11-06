import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://localhost:5174')
  .split(',').map((origin) => origin.trim()).filter(Boolean)
const MAX_PDF_BYTES = 20 * 1024 * 1024
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
}

function response(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers })
}

function ascii(value: unknown) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\xFF]/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatDate(value: unknown) {
  if (!value) return 'Nao informado'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = ascii(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = candidate
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get('origin'))
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return response({ ok: false, error: 'Metodo nao permitido.' }, 405, headers)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return response({ ok: false, error: 'Usuario nao autenticado.' }, 401, headers)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ ok: false, error: 'Configuracao do servidor incompleta.' }, 500, headers)
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return response({ ok: false, error: 'Sessao invalida.' }, 401, headers)

    const body = await request.json().catch(() => ({}))
    const revisionId = String(body.reportRevisionId ?? '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(revisionId)) {
      return response({ ok: false, error: 'Revisao de relatorio invalida.' }, 400, headers)
    }

    const { data: report, error: reportError } = await supabase.from('work_order_report_revisions')
      .select('id,tenant_id,work_order_id,revision_number,state,is_current,acceptance_required,snapshot,reviewed_by_name,reviewed_at,pdf_storage_path,pdf_sha256,pdf_byte_count')
      .eq('id', revisionId).maybeSingle()
    if (reportError || !report) return response({ ok: false, error: 'Relatorio nao encontrado ou sem acesso.' }, 404, headers)
    if (!report.is_current || report.state !== 'approved') {
      return response({ ok: false, error: 'Somente revisao atual aprovada pode gerar PDF.' }, 409, headers)
    }
    if (report.pdf_storage_path) {
      const { error: archivedError } = await supabase.storage.from('work-order-reports').download(report.pdf_storage_path)
      if (archivedError) return response({ ok: false, error: 'O PDF consta como arquivado, mas o arquivo privado nao foi localizado.' }, 409, headers)
      return response({ ok: true, archived: true }, 200, headers)
    }
    const { data: authorized, error: authorizationError } = await supabase.rpc('authorize_preventive_report_pdf', {
      target_revision_id: report.id,
    })
    if (authorizationError || authorized !== true) {
      return response({ ok: false, error: 'Usuario sem permissao para gerar o PDF nesta unidade ou revisao.' }, 403, headers)
    }

    const snapshot = report.snapshot as Record<string, any>
    if (!snapshot || !Array.isArray(snapshot.activities) || snapshot.activities.length === 0) {
      return response({ ok: false, error: 'Snapshot do relatorio nao contem atividades persistidas.' }, 409, headers)
    }
    const { data: signature, error: signatureError } = await supabase.from('work_order_report_signatures')
      .select('representative_name,storage_path,captured_at,collector_name')
      .eq('report_revision_id', report.id).maybeSingle()
    if (signatureError) return response({ ok: false, error: 'Nao foi possivel verificar o aceite registrado.' }, 500, headers)
    if (report.acceptance_required && !signature) {
      return response({ ok: false, error: 'O aceite do representante e obrigatorio nesta OS.' }, 409, headers)
    }

    const pdf = await PDFDocument.create()
    pdf.setTitle(`Relatorio preventivo OS ${ascii((snapshot.order ?? {}).number)}`)
    pdf.setSubject('Relatorio preventivo industrial MARV')
    pdf.setProducer('MARV - NETSECBR')
    pdf.setCreator('MARV')
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pages: any[] = []
    let page: any
    let y = 0

    const addPage = () => {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      pages.push(page)
      page.drawText('MARV  |  NETSECBR', { x: MARGIN, y: PAGE_HEIGHT - 34, size: 10, font: bold, color: rgb(0.04, 0.30, 0.55) })
      page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 44 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 44 }, thickness: 0.7, color: rgb(0.82, 0.87, 0.92) })
      y = PAGE_HEIGHT - 62
    }
    addPage()

    const ensure = (height: number) => { if (y - height < MARGIN + 16) addPage() }
    const drawText = (text: unknown, options: { size?: number; font?: any; color?: any; indent?: number } = {}) => {
      const size = options.size ?? 9
      const font = options.font ?? regular
      const x = MARGIN + (options.indent ?? 0)
      const lines = wrapText(ascii(text), font, size, PAGE_WIDTH - MARGIN * 2 - (options.indent ?? 0))
      for (const line of lines) {
        ensure(size + 5)
        page.drawText(line, { x, y, size, font, color: options.color ?? rgb(0.12, 0.16, 0.22) })
        y -= size + 5
      }
    }
    const drawHeading = (text: string) => {
      ensure(24)
      y -= 4
      page.drawText(ascii(text), { x: MARGIN, y, size: 11, font: bold, color: rgb(0.04, 0.30, 0.55) })
      y -= 18
    }
    const drawRule = () => {
      ensure(10)
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.45, color: rgb(0.85, 0.89, 0.93) })
      y -= 10
    }

    const order = snapshot.order ?? {}
    const asset = snapshot.asset ?? {}
    const activityResults: Record<string, string> = {
      pending: 'Pendente', ok: 'Conforme', not_ok: 'Nao conforme', not_executed: 'Nao realizada', not_applicable: 'Nao se aplica',
    }
    drawText('RELATORIO TECNICO DE MANUTENCAO PREVENTIVA', { size: 15, font: bold, color: rgb(0.04, 0.17, 0.32) })
    drawText(`OS #${ascii(order.number)}  |  Revisao ${report.revision_number}  |  Emitido em ${formatDate(new Date().toISOString())}`, { size: 9, color: rgb(0.34, 0.41, 0.50) })
    drawRule()
    drawHeading('Identificacao')
    drawText(`Cliente: ${snapshot.tenant_name ?? 'Nao informado'}  |  Unidade: ${snapshot.unit_name ?? 'Nao informada'}`)
    drawText(`Centro de custo: ${snapshot.cost_center_name ?? 'Nao informado'}`)
    drawText(`Ativo: ${asset.code ? `${asset.code} - ` : ''}${asset.name ?? 'Nao identificado'}${asset.model ? `  |  Modelo: ${asset.model}` : ''}`)
    if (asset.manufacturer) drawText(`Fabricante: ${asset.manufacturer}`)
    if (asset.serial_number) drawText(`Numero de serie: ${asset.serial_number}`)
    drawText(`OS: #${order.number ?? '—'}  |  ${order.title ?? 'Atendimento preventivo'}  |  Tecnico: ${order.technician_name ?? 'Nao informado'}`)
    drawText(`Abertura: ${formatDate(order.opened_at)}  |  Programacao: ${formatDate(order.scheduled_for)}`)
    if (order.description) drawText(`Descricao: ${order.description}`)
    drawHeading('Atividades, resultados e evidencias')

    for (const [index, activity] of snapshot.activities.entries()) {
      drawRule()
      drawText(`${index + 1}. ${activity.title ?? 'Atividade'}`, { size: 10, font: bold })
      if (activity.instruction) drawText(`Instrucao: ${activity.instruction}`, { indent: 10 })
      drawText(`Resultado: ${activityResults[String(activity.result)] ?? 'Nao informado'}${activity.optional ? '  |  Opcional' : ''}${activity.requires_photo ? '  |  Foto prevista' : ''}`, { indent: 10 })
      if (activity.measurement_parameter) {
        drawText(`Medicao: ${activity.measurement_parameter} = ${activity.measurement_value ?? 'Nao registrada'} ${activity.measurement_unit ?? ''}  |  Ponto: ${activity.measurement_point ?? 'Nao informado'}`, { indent: 10 })
      }
      if (activity.responsible_name) drawText(`Responsavel: ${activity.responsible_name}`, { indent: 10 })
      if (activity.notes) drawText(`Observacao: ${activity.notes}`, { indent: 10 })
      if (activity.nonconformity) drawText(`Nao conformidade: ${activity.nonconformity}`, { indent: 10, color: rgb(0.65, 0.16, 0.12) })
      if (activity.nonconformity_request_number) drawText(`Solicitacao corretiva vinculada: #${activity.nonconformity_request_number}`, { indent: 10 })

      for (const photo of (Array.isArray(activity.photos) ? activity.photos : [])) {
        if (!photo.storage_path) continue
        const { data: imageBlob, error: photoError } = await supabase.storage.from('preventive-evidence').download(String(photo.storage_path))
        if (photoError || !imageBlob) return response({ ok: false, error: 'Uma evidencia fotografica nao pode ser lida; o PDF nao foi arquivado.' }, 409, headers)
        const bytes = new Uint8Array(await imageBlob.arrayBuffer())
        let embedded: any
        const mime = imageBlob.type.toLowerCase()
        try {
          if (mime.includes('png')) embedded = await pdf.embedPng(bytes)
          else if (mime.includes('jpeg') || mime.includes('jpg')) embedded = await pdf.embedJpg(bytes)
          else return response({ ok: false, error: 'Uma foto antiga esta em formato nao suportado pelo PDF. Reenvie a evidencia em JPEG ou PNG.' }, 415, headers)
        } catch {
          return response({ ok: false, error: 'Uma evidencia fotografica esta corrompida ou em formato invalido; o PDF nao foi arquivado.' }, 415, headers)
        }
        const maxWidth = PAGE_WIDTH - MARGIN * 2 - 20
        const maxHeight = 210
        const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1)
        const width = embedded.width * scale
        const height = embedded.height * scale
        ensure(height + 25)
        page.drawImage(embedded, { x: MARGIN + 10, y: y - height, width, height })
        y -= height + 8
        drawText(`Evidencia fotografica  |  ${formatDate(photo.captured_at)}`, { size: 8, indent: 10, color: rgb(0.36, 0.43, 0.52) })
      }
    }

    if (order.action_taken || order.resolution_notes) {
      drawHeading('Resumo do atendimento')
      if (order.action_taken) drawText(`Servico executado: ${order.action_taken}`)
      if (order.resolution_notes) drawText(`Resumo tecnico: ${order.resolution_notes}`)
    }

    if (report.reviewed_by_name || report.reviewed_at) {
      drawHeading('Revisao do supervisor')
      drawText(`Decisao: Aprovado  |  Supervisor: ${report.reviewed_by_name ?? 'Nao identificado'}  |  Data: ${formatDate(report.reviewed_at)}`)
    }
    if (report.acceptance_required) {
      if (!signature) return response({ ok: false, error: 'Assinatura obrigatoria ausente.' }, 409, headers)
      drawHeading('Aceite industrial do representante')
      drawText(`Representante: ${signature.representative_name}`)
      drawText(`Assinatura coletada por: ${signature.collector_name ?? 'Usuario autenticado'}  |  Data: ${formatDate(signature.captured_at)}`)
      const { data: signatureBlob, error: signatureFileError } = await supabase.storage.from('work-order-reports').download(signature.storage_path)
      if (signatureFileError || !signatureBlob) return response({ ok: false, error: 'Arquivo de assinatura nao pode ser lido; o PDF nao foi arquivado.' }, 409, headers)
      try {
        const embeddedSignature = await pdf.embedPng(new Uint8Array(await signatureBlob.arrayBuffer()))
        const signatureWidth = 220
        const signatureHeight = signatureWidth * embeddedSignature.height / embeddedSignature.width
        ensure(signatureHeight + 20)
        page.drawImage(embeddedSignature, { x: MARGIN + 10, y: y - signatureHeight - 6, width: signatureWidth, height: signatureHeight })
        y -= signatureHeight + 18
      } catch {
        return response({ ok: false, error: 'Imagem de assinatura invalida; o PDF nao foi arquivado.' }, 415, headers)
      }
    } else {
      drawHeading('Aceite industrial')
      drawText('O aceite/assinatura do representante nao foi exigido nesta OS preventiva.')
    }

    const generatedAt = new Date().toISOString()
    for (const [index, finalPage] of pages.entries()) {
      finalPage.drawText(`Documento MARV - OS #${ascii(order.number)} - Revisao ${report.revision_number}  |  ${index + 1}/${pages.length}`,
        { x: MARGIN, y: 20, size: 7, font: regular, color: rgb(0.42, 0.48, 0.56) })
    }
    const pdfBytes = await pdf.save()
    if (pdfBytes.byteLength < 1 || pdfBytes.byteLength > MAX_PDF_BYTES) {
      return response({ ok: false, error: 'O PDF excede o limite de 20 MB ou esta vazio.' }, 413, headers)
    }
    const digest = await crypto.subtle.digest('SHA-256', pdfBytes)
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const storagePath = `${report.tenant_id}/${report.work_order_id}/${report.id}/report.pdf`
    const { error: uploadError } = await supabaseAdmin.storage.from('work-order-reports')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false })
    if (uploadError) return response({ ok: false, error: 'Nao foi possivel arquivar o PDF no Storage privado.' }, 500, headers)

    const { data: attached, error: attachError } = await supabase.rpc('attach_preventive_report_pdf', {
      target_revision_id: report.id,
      target_storage_path: storagePath,
      target_sha256: sha256,
      target_byte_count: pdfBytes.byteLength,
    })
    if (attachError || attached !== true) {
      await supabaseAdmin.storage.from('work-order-reports').remove([storagePath])
      return response({ ok: false, error: 'O arquivo foi gerado, mas a revisao aprovada nao confirmou o arquivamento. Atualize e tente novamente.' }, 409, headers)
    }
    return response({ ok: true, archived: true, revision: report.revision_number, bytes: pdfBytes.byteLength, generatedAt }, 200, headers)
  } catch {
    return response({ ok: false, error: 'Ocorreu uma falha ao montar o PDF preventivo. Nenhum estado da OS foi alterado.' }, 500, headers)
  }
})
